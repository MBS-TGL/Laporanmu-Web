import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Checkbox,
  Progress,
  Radio,
  Space,
  Table,
  Tag,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  DownloadOutlined,
  FileExcelOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { MONTH_NAMES, STATUS_META } from '../constants'
import { parseAttendanceTable, type ParsedImportRow } from '../importParse'
import type { AttendanceDays } from '../types'
import type { ReportCardStudent } from '../../report-cards/types'

interface Props {
  open: boolean
  onClose: () => void
  year: number
  month: number
  daysInMonth: number
  students: ReportCardStudent[]
  /** Merge hasil parse ke drafts grid (overwrite = timpa sel yang sudah terisi) */
  onApply: (merges: { studentId: string; days: AttendanceDays }[], overwrite: boolean) => void
}

interface PreviewRow extends ParsedImportRow {
  key: number
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
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

const DAY_HEADERS = (daysInMonth: number) => Array.from({ length: daysInMonth }, (_, i) => String(i + 1))

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const SAMPLE = [
  { kode: 'LPM-0001-001', nama: 'Ahmad Fulan' },
  { kode: 'LPM-0001-002', nama: 'Siti Aminah' },
]

function handleDownloadTemplateXlsx(year: number, month: number, daysInMonth: number) {
  void import('xlsx').then((XLSX) => {
    const wb = XLSX.utils.book_new()

    const dayHeaders = DAY_HEADERS(daysInMonth)
    const gridAoA = [
      ['kode', 'nama', ...dayHeaders],
      [SAMPLE[0].kode, SAMPLE[0].nama, ...dayHeaders.map((_, i) => (i < 3 ? 'H' : ''))],
      [SAMPLE[1].kode, SAMPLE[1].nama, ...dayHeaders.map((_, i) => (i === 0 ? 'S' : ''))],
    ]
    const gridWs = XLSX.utils.aoa_to_sheet(gridAoA)
    gridWs['!cols'] = [{ wch: 14 }, { wch: 26 }, ...dayHeaders.map(() => ({ wch: 4.5 }))]
    XLSX.utils.book_append_sheet(wb, gridWs, 'Grid')

    const harianWs = XLSX.utils.aoa_to_sheet([
      ['kode', 'nama', 'tanggal', 'status'],
      [SAMPLE[0].kode, SAMPLE[0].nama, `${year}-${String(month).padStart(2, '0')}-01`, 'H'],
      [SAMPLE[1].kode, SAMPLE[1].nama, `${year}-${String(month).padStart(2, '0')}-02`, 'A'],
    ])
    harianWs['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 9 }]
    XLSX.utils.book_append_sheet(wb, harianWs, 'Harian')

    XLSX.writeFile(wb, `template-impor-absensi-${MONTH_NAMES[month - 1]}-${year}.xlsx`)
  })
}

function handleDownloadTemplateCsv(daysInMonth: number) {
  const csv = Papa.unparse({
    fields: ['kode', 'nama', ...DAY_HEADERS(daysInMonth)],
    data: SAMPLE.map((s) => [s.kode, s.nama, ...DAY_HEADERS(daysInMonth).map(() => '')]),
  })
  downloadCsv('template-impor-absensi-grid.csv', csv)
}

export function ImportModal({ open, onClose, year, month, daysInMonth, students, onApply }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [step, setStep] = useState<0 | 1>(0)
  const [parsedRows, setParsedRows] = useState<PreviewRow[]>([])
  const [format, setFormat] = useState<'grid' | 'harian'>('grid')
  const [fileName, setFileName] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'siap' | 'tak_dikenal' | 'error'>('all')
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)

  const resetState = () => {
    setStep(0)
    setParsedRows([])
    setFileName('')
    setStatusFilter('all')
    setOverwrite(false)
  }

  const handleModalClose = () => {
    if (busy) return
    resetState()
    onClose()
  }

  const handleFileSelected = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return false
    }
    setBusy(true)
    try {
      const table = await readFileRows(file)
      if (table.length < 2) {
        message.error('File tidak memiliki baris data')
        return false
      }

      const result = parseAttendanceTable(table, {
        year,
        month,
        daysInMonth,
        roster: students.map((s) => ({
          id: s.id,
          name: s.name,
          registration_code: s.registration_code,
          nisn: s.nisn,
        })),
      })

      setFileName(file.name)
      setFormat(result.format)
      setParsedRows(result.rows.map((r, i) => ({ ...r, key: i })))
      setStep(1)
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses file')
    } finally {
      setBusy(false)
    }
    return false
  }

  const counts = useMemo(() => {
    let siap = 0
    let takDikenal = 0
    let error = 0
    for (const r of parsedRows) {
      if (r.status === 'siap') siap++
      else if (r.status === 'tak_dikenal') takDikenal++
      else error++
    }
    return { total: parsedRows.length, siap, takDikenal, error }
  }, [parsedRows])

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return parsedRows
    return parsedRows.filter((r) => r.status === statusFilter)
  }, [parsedRows, statusFilter])

  const handleDownloadErrorCsv = () => {
    const errorRows = parsedRows.filter((r) => r.status === 'error' || r.status === 'tak_dikenal')
    if (errorRows.length === 0) return
    const csv = Papa.unparse({
      fields: ['baris', 'identitas', 'santri', 'detail', 'alasan'],
      data: errorRows.map((r) => [
        r.row,
        r.identifier,
        r.studentName ?? '',
        Object.entries(r.days).map(([d, s]) => `${d}=${s}`).join(' ') || '',
        r.error ?? '',
      ]),
    })
    downloadCsv(`baris-error-impor-absensi-${fileName || 'file'}.csv`, csv)
  }

  const handleApply = () => {
    const byStudent = new Map<string, AttendanceDays>()
    let filledDays = 0
    for (const r of parsedRows) {
      if (r.status !== 'siap' || !r.studentId) continue
      const days = byStudent.get(r.studentId) ?? {}
      for (const [d, s] of Object.entries(r.days)) {
        if (days[d] && days[d] !== s) filledDays-- // konflik harian: nilai terakhir menang
        days[d] = s
        filledDays++
      }
      byStudent.set(r.studentId, days)
    }
    const merges = [...byStudent].map(([studentId, days]) => ({ studentId, days }))
    if (merges.length === 0) {
      message.warning('Tidak ada baris berstatus Siap untuk diterapkan')
      return
    }
    onApply(merges, overwrite)
    message.success(
      `${merges.length} santri · ${filledDays} sel absensi diterapkan ke grid, periksa lalu klik Simpan Absensi`,
    )
    resetState()
    onClose()
  }

  const columns: TableColumnsType<PreviewRow> = [
    {
      title: 'Status',
      key: 'status',
      width: 105,
      render: (_, r) => {
        if (r.status === 'siap') return <Tag color="success">Siap</Tag>
        if (r.status === 'tak_dikenal') return <Tag color="warning">Tak dikenal</Tag>
        return <Tag color="error">Error</Tag>
      },
    },
    {
      title: 'Identitas (file)',
      key: 'identifier',
      width: 150,
      render: (_, r) => (
        <span style={{ fontSize: 12.5, fontFamily: 'monospace' }}>{r.identifier}</span>
      ),
    },
    {
      title: 'Santri',
      key: 'student',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.studentName ?? '-'}</div>
          {r.matchBy && r.status === 'siap' && (
            <span style={{ fontSize: 11.5, color: token.colorTextTertiary }}>cocok via {r.matchBy}</span>
          )}
          {r.error && (
            <div style={{ fontSize: 12, color: r.status === 'error' ? token.colorError : token.colorWarning }}>
              {r.error}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Absensi',
      key: 'days',
      render: (_, r) => {
        const entries = Object.entries(r.days)
        if (entries.length === 0) return <span style={{ color: token.colorTextTertiary }}>-</span>
        return (
          <Space size={4} wrap>
            {entries.slice(0, 10).map(([d, s]) => (
              <Tag
                key={d}
                style={{ marginInlineEnd: 0, fontSize: 11, color: '#fff', background: STATUS_META[s].color, border: 'none' }}
              >
                {d}:{s}
              </Tag>
            ))}
            {entries.length > 10 && <span style={{ fontSize: 11, color: token.colorTextTertiary }}>+{entries.length - 10}</span>}
          </Space>
        )
      },
    },
  ]

  return (
    <AppModal
      title={`Import Absensi ${MONTH_NAMES[month - 1]} ${year}`}
      subtitle="Dari Excel/CSV: hasil masuk ke draf grid, bukan langsung tersimpan"
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleModalClose}
      width={step === 1 ? 880 : 640}
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
              marginBottom: 16,
              border: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>1. Unduh Template</div>
            <div style={{ fontSize: 13, color: token.colorTextSecondary, marginBottom: 12 }}>
              Dua format didukung dan terdeteksi otomatis:{' '}
              <strong>Grid</strong> (1 baris per santri, kolom tanggal 1..{daysInMonth}) atau{' '}
              <strong>Harian</strong> (kolom kode, tanggal, status). Status: H, S, I, A, P (sel kosong
              dilewati. Santri dicocokkan via kode registrasi, NISN, atau nama persis.
            </div>
            <Space wrap>
              <Button icon={<FileExcelOutlined />} onClick={() => handleDownloadTemplateXlsx(year, month, daysInMonth)}>
                Template Excel (2 sheet)
              </Button>
              <Button icon={<DownloadOutlined />} onClick={() => handleDownloadTemplateCsv(daysInMonth)}>
                Template CSV (grid)
              </Button>
            </Space>
          </div>

          <div style={{ fontWeight: 600, marginBottom: 8 }}>2. Pilih File Absensi</div>
          <UploadDropzone
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            beforeUpload={(file) => handleFileSelected(file as unknown as File)}
            disabled={busy}
            title="Klik atau tarik file CSV / Excel ke area ini"
            hint="Maksimal 2 MB. Hasil impor masuk ke draf, terapkan lalu simpan seperti biasa."
          />
          {busy && <Progress percent={70} status="active" style={{ marginTop: 12 }} />}
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
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                Pratinjau: {fileName} <Tag color="processing">{format === 'grid' ? 'format grid' : 'format harian'}</Tag>
              </div>
              <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                <strong>{counts.siap}</strong> baris siap ·{' '}
                <span style={{ color: token.colorWarningTextActive }}>{counts.takDikenal} tak dikenal</span> ·{' '}
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
              <Radio.Button value="siap">Siap ({counts.siap})</Radio.Button>
              <Radio.Button value="tak_dikenal">Tak dikenal ({counts.takDikenal})</Radio.Button>
              <Radio.Button value="error">Error ({counts.error})</Radio.Button>
            </Radio.Group>
          </div>

          {counts.error + counts.takDikenal > 0 && (
            <Alert
              type={counts.siap === 0 ? 'error' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message="Sebagian baris bermasalah dan tidak akan diterapkan"
              description={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    {counts.takDikenal > 0 &&
                      `${counts.takDikenal} baris tidak cocok dengan santri di kelas ini. `}
                    {counts.error > 0 && `${counts.error} baris format/status tidak valid.`}
                  </span>
                  <Button size="small" danger onClick={handleDownloadErrorCsv} icon={<DownloadOutlined />}>
                    Unduh Baris Bermasalah (.csv)
                  </Button>
                </div>
              }
            />
          )}

          <Table<PreviewRow>
            columns={columns}
            dataSource={filteredRows}
            pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
            size="small"
            scroll={{ x: 700 }}
            style={{ marginBottom: 14 }}
          />

          <Checkbox
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            style={{ marginBottom: 16 }}
          >
            Timpa sel yang sudah terisi di grid{' '}
            <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
              (nonaktif = hanya sel kosong yang diisi)
            </span>
          </Checkbox>

          <ModalFooter
            left={
              <Button onClick={resetState} disabled={busy}>
                Ganti File
              </Button>
            }
            onCancel={handleModalClose}
            onOk={handleApply}
            okText="Terapkan ke Grid"
            okIcon={<ImportOutlined />}
            okDisabled={counts.siap === 0}
          />
        </div>
      )}
    </AppModal>
  )
}
