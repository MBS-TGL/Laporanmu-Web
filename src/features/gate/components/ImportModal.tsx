import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Progress,
  Radio,
  Space,
  Table,
  Tag,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { useCreateGateLogsBulk, useGateStudentIndex } from '../hooks'
import type { GateDirection, GateLogInsertRow, GateStudentLite } from '../types'

// Parsing waktu multi-format butuh plugin customParseFormat (idempoten)
dayjs.extend(customParseFormat)

interface Props {
  open: boolean
  onClose: () => void
}

type RowStatus = 'siap' | 'duplikat' | 'error'

interface ParsedGateRow {
  key: number
  raw_kode: string
  raw_arah: string
  raw_waktu: string
  raw_catatan: string

  status: RowStatus
  error_message?: string
  student?: GateStudentLite
  direction?: GateDirection
  occurred_at?: string
}

const TEMPLATE_HEADERS = ['kode_registrasi', 'arah', 'waktu', 'catatan']

const SAMPLE_ROWS: string[][] = [
  ['SIS-2025-0001', 'masuk', '2026-01-05 07:15', ''],
  ['SIS-2025-0002', 'keluar', '2026-01-05 16:30', 'Pulang izin'],
]

const TIME_FORMATS = [
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-DD HH:mm',
  'DD/MM/YYYY HH:mm:ss',
  'DD/MM/YYYY HH:mm',
  'DD-MM-YYYY HH:mm',
  'D/M/YYYY H:mm',
  'DD/MM/YYYY',
  'YYYY-MM-DD',
  'DD-MM-YYYY',
]

const DIRECTION_ALIASES: Record<string, GateDirection> = {
  masuk: 'entry',
  entry: 'entry',
  in: 'entry',
  m: 'entry',
  keluar: 'exit',
  exit: 'exit',
  out: 'exit',
  k: 'exit',
  pulang: 'exit',
  pergi: 'exit',
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function handleDownloadTemplateXlsx() {
  void import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...SAMPLE_ROWS])
    // Kunci kolom kode & waktu sebagai teks agar 0 di depan tidak hilang
    for (let c = 0; c < 2; c++) {
      for (let r = 1; r <= SAMPLE_ROWS.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr]) ws[addr].z = '@'
      }
    }
    ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Log Gerbang')
    XLSX.writeFile(wb, 'template-impor-log-gerbang.xlsx')
  })
}

function handleDownloadTemplateCsv() {
  downloadCsv(
    'template-impor-log-gerbang.csv',
    Papa.unparse({ fields: TEMPLATE_HEADERS, data: SAMPLE_ROWS }),
  )
}

/** Sel Excel — Date dirender dengan jam agar kolom waktu tak kehilangan presisi */
function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    const hh = String(val.getHours()).padStart(2, '0')
    const mm = String(val.getMinutes()).padStart(2, '0')
    const ss = String(val.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  }
  return String(val).trim()
}

async function readFileRows(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    })
    return data.map((row) => row.map(cellToString))
  }

  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => resolve(res.data.map((row) => row.map(cellToString))),
      error: (err) => reject(err),
    })
  })
}

/** Parse kolom waktu; balikin ISO lokal, null bila kosong, error bila tak dikenali */
function parseWaktu(raw: string): { iso?: string; error?: string } {
  const v = raw.trim()
  if (!v) return {} // kosong → default waktu impor
  const parsed = dayjs(v, TIME_FORMATS, true)
  if (parsed.isValid()) {
    if (parsed.isAfter(dayjs().add(5, 'minute'))) return { error: 'Waktu di masa depan' }
    return { iso: parsed.format() }
  }
  // ISO dari ekspor sebelumnya
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v)) {
    const iso = dayjs(v)
    if (iso.isValid() && !iso.isAfter(dayjs().add(5, 'minute'))) return { iso: iso.format() }
  }
  return { error: `Format waktu tidak dikenali: "${v}"` }
}

export function ImportModal({ open, onClose }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  // Steps: 0 = Upload & Template, 1 = Preview & Filter, 2 = Selesai
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [parsedRows, setParsedRows] = useState<ParsedGateRow[]>([])
  const [fileName, setFileName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all')
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null)
  const [importSummary, setImportSummary] = useState<{ successful: number; failed: number } | null>(
    null,
  )

  const indexQuery = useGateStudentIndex(open)
  const importMutation = useCreateGateLogsBulk()

  // Map lookup: kode registrasi (persis & dinormalisasi) + NISN
  const studentIndex = useMemo(() => {
    const byCode = new Map<string, GateStudentLite>()
    const byNisn = new Map<string, GateStudentLite>()
    for (const s of indexQuery.data ?? []) {
      byCode.set(s.registration_code, s)
      byCode.set(s.registration_code.toUpperCase(), s)
      if (s.nisn) byNisn.set(s.nisn, s)
    }
    return { byCode, byNisn }
  }, [indexQuery.data])

  const resetState = () => {
    setStep(0)
    setParsedRows([])
    setFileName('')
    setStatusFilter('all')
    setProgress(null)
    setImportSummary(null)
  }

  const handleModalClose = () => {
    if (importMutation.isPending) return
    resetState()
    onClose()
  }

  const handleFileSelected = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return false
    }

    try {
      const tableData = await readFileRows(file)
      if (tableData.length < 2) {
        message.error('File tidak memiliki baris data')
        return false
      }
      if (tableData.length > 5001) {
        message.error('Maksimal 5.000 baris data per impor')
        return false
      }

      const rawHeaders = tableData[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '').trim())

      // Pemetaan kolom fleksibel
      const colMap = {
        kode: rawHeaders.findIndex(
          (h) => h.includes('kode') || h.includes('registrasi') || h === 'code' || h.includes('nisn'),
        ),
        arah: rawHeaders.findIndex(
          (h) => h.includes('arah') || h.includes('direction') || h.includes('gerbang'),
        ),
        waktu: rawHeaders.findIndex(
          (h) =>
            h.includes('waktu') ||
            h.includes('jam') ||
            h.includes('tanggal') ||
            h.includes('occurred') ||
            h === 'time' ||
            h === 'date',
        ),
        catatan: rawHeaders.findIndex(
          (h) => h.includes('catatan') || h.includes('note') || h.includes('keterangan'),
        ),
      }

      if (colMap.kode === -1) {
        message.error('Kolom "kode_registrasi" tidak ditemukan dalam file')
        return false
      }
      if (colMap.arah === -1) {
        message.error('Kolom "arah" tidak ditemukan dalam file')
        return false
      }

      const rows: ParsedGateRow[] = []
      const batchSeenKeys = new Set<string>()

      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i]
        if (row.every((cell) => !cell || cell.trim() === '')) continue

        const rawKode = colMap.kode >= 0 ? row[colMap.kode] : ''
        const rawArah = colMap.arah >= 0 ? row[colMap.arah] : ''
        const rawWaktu = colMap.waktu >= 0 ? row[colMap.waktu] : ''
        const rawCatatan = colMap.catatan >= 0 ? row[colMap.catatan] : ''

        // 1. Validasi baris
        let status: RowStatus = 'siap'
        let errorMessage: string | undefined
        let student: GateStudentLite | undefined
        let direction: GateDirection | undefined
        let occurredAt: string | undefined

        const kodeNorm = rawKode.trim()
        if (!kodeNorm) {
          status = 'error'
          errorMessage = 'Kode registrasi kosong'
        } else {
          student = studentIndex.byCode.get(kodeNorm) ?? studentIndex.byNisn.get(kodeNorm)
          if (!student) {
            status = 'error'
            errorMessage = 'Siswa tidak ditemukan'
          }
        }

        const arahNorm = rawArah.toLowerCase().replace(/[^a-z]/g, '')
        if (status !== 'error') {
          direction = DIRECTION_ALIASES[arahNorm]
          if (!direction) {
            status = 'error'
            errorMessage = `Arah tidak dikenali: "${rawArah}" (gunakan masuk/keluar)`
          }
        }

        if (status !== 'error') {
          const waktuRes = parseWaktu(rawWaktu)
          if (waktuRes.error) {
            status = 'error'
            errorMessage = waktuRes.error
          } else {
            occurredAt = waktuRes.iso ?? new Date().toISOString()
          }
        }

        // 2. Duplikat dalam batch: kode + arah + waktu identik
        if (status === 'siap') {
          const batchKey = `${kodeNorm}|${direction}|${occurredAt}`
          if (batchSeenKeys.has(batchKey)) {
            status = 'duplikat'
            errorMessage = 'Baris identik sudah ada di file ini'
          } else {
            batchSeenKeys.add(batchKey)
          }
        }

        rows.push({
          key: i,
          raw_kode: rawKode,
          raw_arah: rawArah,
          raw_waktu: rawWaktu,
          raw_catatan: rawCatatan,
          status,
          error_message: errorMessage,
          student,
          direction,
          occurred_at: occurredAt,
        })
      }

      setFileName(file.name)
      setParsedRows(rows)
      setStep(1)
      return false
    } catch (err: unknown) {
      console.error(err)
      message.error(err instanceof Error ? err.message : 'Gagal memproses file')
      return false
    }
  }

  const counts = useMemo(() => {
    let siap = 0
    let duplikat = 0
    let error = 0
    for (const r of parsedRows) {
      if (r.status === 'siap') siap++
      else if (r.status === 'duplikat') duplikat++
      else if (r.status === 'error') error++
    }
    return { total: parsedRows.length, siap, duplikat, error }
  }, [parsedRows])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return parsedRows
    return parsedRows.filter((r) => r.status === statusFilter)
  }, [parsedRows, statusFilter])

  const handleDownloadErrorCsv = () => {
    const errorRows = parsedRows.filter((r) => r.status === 'error')
    if (errorRows.length === 0) return
    const csv = Papa.unparse({
      fields: [...TEMPLATE_HEADERS, 'alasan_error'],
      data: errorRows.map((r) => [r.raw_kode, r.raw_arah, r.raw_waktu, r.raw_catatan, r.error_message ?? '']),
    })
    downloadCsv(`baris-error-${fileName || 'log-gerbang'}.csv`, csv)
  }

  const handleStartImport = () => {
    const toImport = parsedRows.filter((r) => r.status === 'siap')
    if (toImport.length === 0) {
      message.warning('Tidak ada baris berstatus Siap yang bisa diimpor')
      return
    }

    const payloads: GateLogInsertRow[] = toImport.map((r) => ({
      student_id: r.student!.id,
      direction: r.direction!,
      occurred_at: r.occurred_at!,
      note: r.raw_catatan || null,
    }))

    setProgress({ processed: 0, total: payloads.length })

    importMutation.mutate(
      {
        rows: payloads,
        onProgress: (proc, tot) => setProgress({ processed: proc, total: tot }),
      },
      {
        onSuccess: (results) => {
          setImportSummary({ successful: results.ok, failed: results.failed })
          setStep(2)
        },
        onError: (err: Error) => {
          message.error(err.message || 'Gagal menyimpan log ke server')
        },
      },
    )
  }

  const columns: TableColumnsType<ParsedGateRow> = [
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, r) => {
        if (r.status === 'siap') return <Tag color="success">Siap</Tag>
        if (r.status === 'duplikat') return <Tag color="warning">Duplikat</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Siswa',
      key: 'student',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.student ? formatDisplayName(r.student.name) : r.raw_kode || '-'}
          </div>
          {r.student ? (
            <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
              {r.student.registration_code}
              {r.student.class_name ? ` · ${r.student.class_name}` : ''}
            </span>
          ) : null}
          {r.error_message && (
            <div
              style={{
                fontSize: 12,
                color: r.status === 'error' ? token.colorError : token.colorWarning,
              }}
            >
              {r.error_message}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Arah',
      key: 'arah',
      width: 90,
      render: (_, r) =>
        r.direction ? (
          <Tag color={r.direction === 'exit' ? 'orange' : 'green'}>
            {r.direction === 'exit' ? 'Keluar' : 'Masuk'}
          </Tag>
        ) : (
          r.raw_arah || '-'
        ),
    },
    {
      title: 'Waktu',
      key: 'waktu',
      width: 150,
      render: (_, r) =>
        r.occurred_at
          ? dayjs(r.occurred_at).format('DD/MM/YYYY HH:mm')
          : r.raw_waktu || <span style={{ color: token.colorTextTertiary }}>otomatis (sekarang)</span>,
    },
    {
      title: 'Catatan',
      dataIndex: 'raw_catatan',
      key: 'catatan',
      responsive: ['md'],
      render: (v: string) => v || '-',
    },
  ]

  return (
    <AppModal
      open={open}
      onCancel={handleModalClose}
      size="lg"
      title="Impor Log Gerbang"
      subtitle="Isi log keluar-masuk dari catatan manual (Excel/CSV)"
      icon={<ImportOutlined />}
      footer={
        step === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={handleModalClose}>Batal</Button>
          </div>
        ) : step === 1 ? (
          <ModalFooter
            left={
              <div style={{ display: 'flex', gap: 8 }}>
                <Button icon={<DownloadOutlined />} disabled={counts.error === 0} onClick={handleDownloadErrorCsv}>
                  Unduh Baris Error (.csv)
                </Button>
                <Button onClick={() => setStep(0)} disabled={importMutation.isPending}>
                  Kembali
                </Button>
              </div>
            }
            onOk={handleStartImport}
            okText={`Impor ${counts.siap} Log`}
            okIcon={<ImportOutlined />}
            okLoading={importMutation.isPending}
            okDisabled={counts.siap === 0}
          />
        ) : (
          <ModalFooter okText="Selesai" onOk={handleModalClose} />
        )
      }
    >
      {step === 0 && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Format file"
            description={
              <div style={{ fontSize: 13 }}>
                Kolom wajib: <b>kode_registrasi</b> (atau NISN) dan <b>arah</b> (masuk/keluar).
                Kolom <b>waktu</b> opsional, kosong berarti dicatat pada waktu impor. Log{' '}
                <b>hanya ditambahkan</b> (tabel log gerbang bersifat immutable), pastikan data belum
                pernah tercatat.
              </div>
            }
            style={{ borderRadius: 10 }}
          />
          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplateXlsx}>
              Unduh Template Excel
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplateCsv}>
              Unduh Template CSV
            </Button>
          </Space>
          <UploadDropzone
            accept=".csv,.xlsx,.xls"
            beforeUpload={(file) => handleFileSelected(file as unknown as File)}
            disabled={indexQuery.isPending}
            title={indexQuery.isPending ? 'Menyiapkan data siswa…' : 'Klik atau tarik file ke sini'}
            hint="CSV atau Excel, maks 5.000 baris / 2 MB"
          />
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Radio.Group
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={[
                { value: 'all', label: `Semua (${counts.total})` },
                { value: 'siap', label: `Siap (${counts.siap})` },
                { value: 'duplikat', label: `Duplikat (${counts.duplikat})` },
                { value: 'error', label: `Error (${counts.error})` },
              ]}
            />
            {progress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                <Progress
                  percent={Math.round((progress.processed / Math.max(progress.total, 1)) * 100)}
                  size="small"
                  style={{ flex: 1, marginBottom: 0 }}
                />
                <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {progress.processed}/{progress.total}
                </span>
              </div>
            )}
          </Space>
          <Table<ParsedGateRow>
            rowKey="key"
            columns={columns}
            dataSource={filteredRows}
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ y: 360 }}
          />
        </Space>
      )}

      {step === 2 && importSummary && (
        <Space direction="vertical" size={16} style={{ width: '100%', textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: token.colorSuccess }} />
          <div>
            <Typography.Title level={4} style={{ marginBottom: 4 }}>
              Impor selesai
            </Typography.Title>
            <Typography.Text type="secondary">
              {importSummary.successful} log berhasil ditambahkan
              {importSummary.failed > 0 ? `, ${importSummary.failed} gagal` : ''}
            </Typography.Text>
          </div>
          {importSummary.failed > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${importSummary.failed} baris gagal disimpan`}
              description="Biasanya karena koneksi terputus di tengah proses. Perbaiki baris di file, lalu impor ulang: baris yang sudah masuk tidak akan tergandakan otomatis, jadi sertakan hanya baris yang belum tercatat."
              style={{ borderRadius: 10, textAlign: 'left' }}
            />
          )}
        </Space>
      )}
    </AppModal>
  )
}
