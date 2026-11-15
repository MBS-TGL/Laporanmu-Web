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
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { formatDisplayName } from '../../../shared/utils/displayName'
import {
  checkPermitDuplicate,
  validatePermitImportRow,
  type PermitImportStatus,
} from '../permitValidation'
import { useActivePermitKeys, useAllPermitStudents, useCreatePermitsBulk } from '../hooks'
import type { PermitBulkRow } from '../types'

interface Props {
  open: boolean
  onClose: () => void
}

interface ParsedPermitRow {
  key: number
  raw_kode?: string
  raw_nama?: string
  raw_tujuan?: string
  raw_keperluan?: string
  raw_tanggal_keluar?: string
  raw_tanggal_kembali?: string
  raw_jam?: string
  raw_hp?: string

  status: PermitImportStatus
  error_message?: string
  student_id: string
  student_name: string
  phone?: string
  destination: string
  purpose: string
  leave_date: string
  return_date: string
  return_time: string
}

const TEMPLATE_HEADERS = [
  'kode_santri',
  'nama_santri',
  'tujuan',
  'keperluan',
  'tanggal_keluar',
  'tanggal_kembali',
  'jam_kembali',
  'no_telepon',
]

const SAMPLE_ROWS = [
  {
    kode_santri: 'REG-001',
    nama_santri: 'Ahmad Fulan',
    tujuan: 'Rumah orang tua',
    keperluan: 'Pulang ke rumah',
    tanggal_keluar: '2026-03-05',
    tanggal_kembali: '2026-03-07',
    jam_kembali: '16:00',
    no_telepon: '081234567890',
  },
  {
    kode_santri: 'REG-002',
    nama_santri: 'Siti Aminah',
    tujuan: 'RSUD Jember',
    keperluan: 'Kontrol kesehatan',
    tanggal_keluar: '2026-03-05',
    tanggal_kembali: '2026-03-05',
    jam_kembali: '14:30',
    no_telepon: '081987654321',
  },
]

// Alias nama kolom — urutan penting (diuji berurutan)
const COLUMN_ALIASES: Record<keyof typeof SAMPLE_ROWS[number], string[]> = {
  kode_santri: ['kode_santri', 'kode', 'kode_registrasi', 'registrasi', 'reg', 'nis'],
  nama_santri: ['nama_santri', 'nama', 'santri', 'siswa', 'name'],
  tujuan: ['tujuan', 'destination', 'alamat_tujuan'],
  keperluan: ['keperluan', 'purpose', 'alasan'],
  tanggal_keluar: ['tanggal_keluar', 'tgl_keluar', 'keluar', 'leave_date', 'tanggal_mulai'],
  tanggal_kembali: ['tanggal_kembali', 'tgl_kembali', 'kembali', 'return_date', 'tanggal_selesai'],
  jam_kembali: ['jam_kembali', 'jam', 'waktu_kembali', 'time'],
  no_telepon: ['no_telepon', 'telepon', 'hp', 'wa', 'phone', 'no_hp'],
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
    const header = [...TEMPLATE_HEADERS]
    const data = SAMPLE_ROWS.map((row) => TEMPLATE_HEADERS.map((h) => row[h as keyof typeof row]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])

    // Kunci kolom teks agar 0 di depan (kode/HP) & format tanggal tidak rusak
    const textCols = new Set(['kode_santri', 'tanggal_keluar', 'tanggal_kembali', 'jam_kembali', 'no_telepon'])
    for (let c = 0; c < header.length; c++) {
      if (!textCols.has(header[c])) continue
      for (let r = 1; r <= data.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr]) ws[addr].z = '@'
      }
    }

    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(30, Math.max(h.length + 3, ...data.map((r) => String(r[c] ?? '').length + 3))),
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Izin Keluar')
    XLSX.writeFile(wb, 'template-impor-izin.xlsx')
  })
}

function handleDownloadTemplateCsv() {
  const csv = Papa.unparse({
    fields: TEMPLATE_HEADERS,
    data: SAMPLE_ROWS.map((row) => TEMPLATE_HEADERS.map((h) => row[h as keyof typeof row])),
  })
  downloadCsv('template-impor-izin.csv', csv)
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, '0')
    const m = String(val.getMinutes()).padStart(2, '0')
    // Tanggal murni (00:00) → YYYY-MM-DD; dengan jam → tetap tanggal, jam di kolomnya
    const y = val.getFullYear()
    const mo = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    if (h === '00' && m === '00') return `${y}-${mo}-${d}`
    return `${h}:${m}`
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

/**
 * Impor izin dari Excel/CSV — 3 langkah (template → pratinjau → selesai),
 * pola mengikuti AlumniImport. Insert massal sekali jalan.
 */
export function ImportModal({ open, onClose }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [parsedRows, setParsedRows] = useState<ParsedPermitRow[]>([])
  const [fileName, setFileName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PermitImportStatus>('all')
  const [importSummary, setImportSummary] = useState<{ successful: number } | null>(null)

  const studentsQuery = useAllPermitStudents(open)
  const activeKeysQuery = useActivePermitKeys(open)
  const bulkMutation = useCreatePermitsBulk()

  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const activeKeys = useMemo(() => new Set(activeKeysQuery.data ?? []), [activeKeysQuery.data])

  const resetState = () => {
    setStep(0)
    setParsedRows([])
    setFileName('')
    setStatusFilter('all')
    setImportSummary(null)
  }

  const handleModalClose = () => {
    if (bulkMutation.isPending) return
    resetState()
    onClose()
  }

  const handleFileSelected = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return false
    }
    if (students.length === 0) {
      message.error('Data santri belum termuat, coba lagi sebentar')
      return false
    }

    try {
      const tableData = await readFileRows(file)
      if (tableData.length < 2) {
        message.error('File tidak memiliki baris data')
        return false
      }
      if (tableData.length > 2001) {
        message.error('Maksimal 2.000 baris data per impor izin')
        return false
      }

      const rawHeaders = tableData[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, '').trim())

      const findCol = (aliases: string[]) =>
        rawHeaders.findIndex((h) => aliases.some((a) => h === a || h.includes(a)))

      const colMap = Object.fromEntries(
        Object.entries(COLUMN_ALIASES).map(([field, aliases]) => [field, findCol(aliases)]),
      ) as Record<keyof typeof COLUMN_ALIASES, number>

      const missingStudentCol = colMap.kode_santri === -1 && colMap.nama_santri === -1
      if (missingStudentCol) {
        message.error('Kolom kode_santri atau nama_santri wajib ada di file')
        return false
      }
      const missingOther = (['tujuan', 'keperluan', 'tanggal_keluar', 'tanggal_kembali', 'jam_kembali'] as const).find(
        (f) => colMap[f] === -1,
      )
      if (missingOther) {
        message.error(`Kolom wajib tidak ditemukan: ${COLUMN_ALIASES[missingOther][0]}`)
        return false
      }

      const batchSeen = new Set<string>()
      const rows: ParsedPermitRow[] = []

      for (let i = 1; i < tableData.length; i++) {
        const row = tableData[i]
        if (row.every((cell) => !cell || cell.trim() === '')) continue

        const get = (field: keyof typeof COLUMN_ALIASES) => {
          const idx = colMap[field]
          return idx >= 0 ? (row[idx] ?? '') : ''
        }

        const input = {
          kode_santri: get('kode_santri'),
          nama_santri: get('nama_santri'),
          tujuan: get('tujuan'),
          keperluan: get('keperluan'),
          tanggal_keluar: get('tanggal_keluar'),
          tanggal_kembali: get('tanggal_kembali'),
          jam_kembali: get('jam_kembali'),
          no_telepon: get('no_telepon'),
        }

        const valRes = validatePermitImportRow(input, students)

        let status: PermitImportStatus = 'baru'
        let errorMessage = valRes.error

        if (!valRes.isValid) {
          status = 'error'
        } else {
          const dupRes = checkPermitDuplicate(
            { student_id: valRes.normalized!.student_id, leave_date: valRes.normalized!.leave_date },
            activeKeys,
            batchSeen,
          )
          if (dupRes.isDuplicate) {
            status = 'duplikat'
            errorMessage = dupRes.reason
          } else {
            batchSeen.add(`${valRes.normalized!.student_id}|${valRes.normalized!.leave_date}`)
          }
        }

        rows.push({
          key: i,
          raw_kode: input.kode_santri,
          raw_nama: input.nama_santri,
          raw_tujuan: input.tujuan,
          raw_keperluan: input.keperluan,
          raw_tanggal_keluar: input.tanggal_keluar,
          raw_tanggal_kembali: input.tanggal_kembali,
          raw_jam: input.jam_kembali,
          raw_hp: input.no_telepon,
          status,
          error_message: errorMessage,
          student_id: valRes.normalized?.student_id ?? '',
          student_name: valRes.normalized?.student_name ?? input.nama_santri,
          phone: valRes.normalized?.phone,
          destination: valRes.normalized?.destination ?? input.tujuan,
          purpose: valRes.normalized?.purpose ?? input.keperluan,
          leave_date: valRes.normalized?.leave_date ?? '',
          return_date: valRes.normalized?.return_date ?? '',
          return_time: valRes.normalized?.return_time ?? '',
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
    let baru = 0
    let duplikat = 0
    let error = 0
    for (const r of parsedRows) {
      if (r.status === 'baru') baru++
      else if (r.status === 'duplikat') duplikat++
      else if (r.status === 'error') error++
    }
    return { total: parsedRows.length, baru, duplikat, error }
  }, [parsedRows])

  const filteredRows = useMemo(
    () => (statusFilter === 'all' ? parsedRows : parsedRows.filter((r) => r.status === statusFilter)),
    [parsedRows, statusFilter],
  )

  const handleDownloadErrorCsv = () => {
    const errorRows = parsedRows.filter((r) => r.status === 'error')
    if (errorRows.length === 0) return
    const csv = Papa.unparse({
      fields: [...TEMPLATE_HEADERS, 'alasan_error'],
      data: errorRows.map((r) => [
        r.raw_kode ?? '',
        r.raw_nama ?? '',
        r.raw_tujuan ?? '',
        r.raw_keperluan ?? '',
        r.raw_tanggal_keluar ?? '',
        r.raw_tanggal_kembali ?? '',
        r.raw_jam ?? '',
        r.raw_hp ?? '',
        r.error_message ?? '',
      ]),
    })
    downloadCsv(`baris-error-izin-${fileName || 'impor'}.csv`, csv)
  }

  const handleStartImport = async () => {
    const toImport = parsedRows.filter((r) => r.status === 'baru')
    if (toImport.length === 0) {
      message.warning('Tidak ada baris berstatus Siap Impor')
      return
    }

    const rows: PermitBulkRow[] = toImport.map((r) => ({
      student_id: r.student_id,
      phone: r.phone ?? null,
      destination: r.destination,
      purpose: r.purpose,
      leave_date: r.leave_date,
      return_deadline: new Date(`${r.return_date}T${r.return_time}:00`).toISOString(),
    }))

    try {
      const created = await bulkMutation.mutateAsync({ rows, issuedBy: null })
      setImportSummary({ successful: created.length })
      setStep(2)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan izin ke server')
    }
  }

  const columns: TableColumnsType<ParsedPermitRow> = [
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, r) => {
        if (r.status === 'baru') return <Tag color="success">Siap Impor</Tag>
        if (r.status === 'duplikat') return <Tag color="warning">Duplikat</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Santri',
      key: 'student',
      width: 190,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.student_name ? formatDisplayName(r.student_name) : r.raw_nama || '-'}</div>
          {r.error_message && (
            <div style={{ fontSize: 12, color: r.status === 'error' ? token.colorError : token.colorWarning }}>
              {r.error_message}
            </div>
          )}
        </div>
      ),
    },
    { title: 'Kode', key: 'kode', width: 100, render: (_, r) => r.raw_kode || '-' },
    { title: 'Tujuan', key: 'tujuan', width: 130, render: (_, r) => r.destination || r.raw_tujuan || '-' },
    { title: 'Keperluan', key: 'keperluan', width: 130, render: (_, r) => r.purpose || r.raw_keperluan || '-' },
    { title: 'Tgl Keluar', key: 'leave', width: 105, render: (_, r) => r.leave_date || r.raw_tanggal_keluar || '-' },
    { title: 'Tgl Kembali', key: 'return', width: 105, render: (_, r) => r.return_date || r.raw_tanggal_kembali || '-' },
    { title: 'Jam', key: 'jam', width: 70, render: (_, r) => r.return_time || r.raw_jam || '-' },
  ]

  return (
    <AppModal
      title="Impor Izin dari Excel/CSV"
      subtitle="Unggah file izin terjadwal dengan pemetaan kolom otomatis"
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleModalClose}
      width={step === 1 ? 940 : 640}
      footer={null}
      destroyOnHidden
    >
      {step === 0 && (
        <div style={{ padding: '8px 0' }}>
          <div
            style={{
              background: token.colorFillAlter,
              padding: 16,
              borderRadius: 8,
              marginBottom: 18,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>1. Unduh Template File</div>
            <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 12 }}>
              Kolom <strong>kode_santri</strong> (atau nama_santri), tujuan, tanggal &amp; jam wajib ada.
              Kolom kode, tanggal, jam, dan telepon dikunci sebagai teks agar tidak berubah format.
            </div>
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={handleDownloadTemplateXlsx}>
                Unduh Template Excel (.xlsx)
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplateCsv}>
                Unduh Template CSV (.csv)
              </Button>
            </Space>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>2. Pilih File Izin</div>
          <UploadDropzone
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            beforeUpload={(file) => handleFileSelected(file as unknown as File)}
            title="Klik atau tarik file CSV / Excel ke area ini"
            hint="Maksimal 2 MB atau 2.000 baris per file. Santri yang sudah punya izin aktif di tanggal yang sama otomatis dilewati."
          />
        </div>
      )}

      {step === 1 && (
        <div style={{ padding: '4px 0' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Pratinjau Data: {fileName}</div>
              <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                Total: <strong>{counts.total}</strong> baris ·{' '}
                <span style={{ color: token.colorSuccessTextActive }}>{counts.baru} siap impor</span> ·{' '}
                <span style={{ color: token.colorWarningTextActive }}>{counts.duplikat} duplikat (dilewati)</span> ·{' '}
                <span style={{ color: token.colorErrorTextActive }}>{counts.error} error</span>
              </div>
            </div>

            <Radio.Group
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="small"
              buttonStyle="solid"
            >
              <Radio.Button value="all">Semua ({counts.total})</Radio.Button>
              <Radio.Button value="baru">Siap ({counts.baru})</Radio.Button>
              <Radio.Button value="duplikat">Duplikat ({counts.duplikat})</Radio.Button>
              <Radio.Button value="error">Error ({counts.error})</Radio.Button>
            </Radio.Group>
          </div>

          {counts.error > 0 && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Terdapat ${counts.error} baris tidak valid`}
              description={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Baris bermasalah tidak akan dimasukkan.</span>
                  <Button size="small" danger onClick={handleDownloadErrorCsv} icon={<DownloadOutlined />}>
                    Unduh Baris Error (.csv)
                  </Button>
                </div>
              }
            />
          )}

          <Table<ParsedPermitRow>
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
            size="small"
            scroll={{ x: 850 }}
            style={{ marginBottom: 16 }}
          />

          {bulkMutation.isPending && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>Menyimpan izin ke database…</div>
              <Progress percent={70} status="active" />
            </div>
          )}

          <div style={{ paddingTop: 8 }}>
            <ModalFooter
              left={
                <Button onClick={resetState} disabled={bulkMutation.isPending}>
                  Ganti File
                </Button>
              }
              onCancel={handleModalClose}
              cancelDisabled={bulkMutation.isPending}
              onOk={() => void handleStartImport()}
              okText={`Impor ${counts.baru} Izin`}
              okIcon={<ImportOutlined />}
              okDisabled={counts.baru === 0 || bulkMutation.isPending}
              okLoading={bulkMutation.isPending}
            />
          </div>
        </div>
      )}

      {step === 2 && importSummary && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 56, color: token.colorSuccess, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Impor Selesai</div>
          <p style={{ color: token.colorTextSecondary, marginBottom: 20 }}>
            Sebanyak <strong>{importSummary.successful}</strong> izin berhasil diterbitkan.
            {counts.duplikat > 0 && <span> {counts.duplikat} duplikat dilewati.</span>}
            {counts.error > 0 && <span> {counts.error} baris error diabaikan.</span>}
          </p>
          <Button type="primary" onClick={handleModalClose}>
            Selesai
          </Button>
        </div>
      )}
    </AppModal>
  )
}
