import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  App,
  Button,
  Collapse,
  Input,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleFilled,
  DownloadOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  ImportOutlined,
  LinkOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { WizardModal } from '../../../shared/components/WizardModal'
import { IconBox } from '../../../shared/components/IconBox'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { ModalSection } from '../../../shared/components/ModalSection'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { formatDisplayName } from '../../../shared/utils/displayName'
import {
  FIELDS,
  SAMPLE_COLUMNS,
  autoMatch,
  columnLetter,
  downloadTemplate,
  parsePermitTable,
  sampleValues,
  type PermitFieldKey,
  type PermitImportStatus,
  type PermitMapping,
  type ParsedPermitRow,
} from '../permitValidation'
import { useActivePermitKeys, useAllPermitStudents, useCreatePermitsBulk } from '../hooks'
import type { PermitBulkRow } from '../types'

const { Text } = Typography

// ---------------------------------------------------------------------------
// Reader file — dipertahankan: sel Date murni (00:00) → tanggal, dengan jam →
// kolom jam (readFileRows shared hanya memformat tanggal)
// ---------------------------------------------------------------------------

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

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Header CSV error dipertahankan dari versi lama
const ERROR_CSV_HEADERS = [
  'kode_santri',
  'nama_santri',
  'tujuan',
  'keperluan',
  'tanggal_keluar',
  'tanggal_kembali',
  'jam_kembali',
  'no_telepon',
  'alasan_error',
]

interface ImportModalProps {
  open: boolean
  onClose: () => void
  /** sumber data aktif saat modal dibuka (default: upload file) */
  initialSource?: 'file' | 'gsheets'
}

interface PermitImportResult {
  successful: number
}

/** Impor izin — pola WizardModal students: Upload → Mapping → Review → Hasil. */
export function ImportModal({ open, onClose, initialSource = 'file' }: ImportModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState<string>()
  const [reading, setReading] = useState(false)
  const [sheetSource, setSheetSource] = useState<'file' | 'gsheets'>('file')
  const [gsheetsUrl, setGsheetsUrl] = useState('')
  const [fetchingSheet, setFetchingSheet] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<PermitMapping>({})
  const [autoKeys, setAutoKeys] = useState<Set<PermitFieldKey>>(new Set())
  const [reviewFilter, setReviewFilter] = useState<'all' | PermitImportStatus>('all')
  const [results, setResults] = useState<PermitImportResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const studentsQuery = useAllPermitStudents(open)
  const activeKeysQuery = useActivePermitKeys(open)
  const bulkMutation = useCreatePermitsBulk()

  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const activeKeys = useMemo(() => new Set(activeKeysQuery.data ?? []), [activeKeysQuery.data])
  const refsPending = studentsQuery.isPending || activeKeysQuery.isPending

  // buka langsung pada sumber yang diminta — pola penyesuaian state saat render
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSheetSource(initialSource)
  }

  // Pemetaan kolom → parser murni (error ditangkap; langkah Review selalu
  // sudah memenuhi kolom wajib sehingga parse tidak melempar di sana)
  const parsed = useMemo<{ rows: ParsedPermitRow[] }>(() => {
    if (fileRows.length === 0) return { rows: [] }
    try {
      return { rows: parsePermitTable([headers, ...fileRows], mapping, { students, activeKeys }) }
    } catch {
      return { rows: [] }
    }
  }, [headers, fileRows, mapping, students, activeKeys])

  const rows = parsed.rows
  const readyRows = useMemo(() => rows.filter((r) => r.status === 'baru'), [rows])
  const counts = useMemo(() => {
    let duplikat = 0
    let error = 0
    for (const r of rows) {
      if (r.status === 'duplikat') duplikat++
      else if (r.status === 'error') error++
    }
    return { total: rows.length, duplikat, error }
  }, [rows])
  const shownRows = useMemo(() => {
    if (reviewFilter === 'all') return rows
    return rows.filter((r) => r.status === reviewFilter)
  }, [rows, reviewFilter])

  const mappedCount = FIELDS.filter((f) => mapping[f.key] !== undefined).length
  const missingRequired = [
    mapping.kode_santri === undefined &&
      mapping.nama_santri === undefined &&
      'Kode / Nama Santri (salah satu)',
    mapping.tujuan === undefined && 'Tujuan',
    mapping.keperluan === undefined && 'Keperluan',
    mapping.tanggal_keluar === undefined && 'Tanggal Keluar',
    mapping.tanggal_kembali === undefined && 'Tanggal Kembali',
    mapping.jam_kembali === undefined && 'Jam Kembali',
  ].filter(Boolean) as string[]
  const refsBlocked = refsPending || students.length === 0

  const reset = () => {
    setStep(0)
    setFileName(undefined)
    setReading(false)
    setSheetSource('file')
    setGsheetsUrl('')
    setFetchingSheet(false)
    setHeaders([])
    setFileRows([])
    setMapping({})
    setAutoKeys(new Set())
    setReviewFilter('all')
    setResults(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    if (bulkMutation.isPending) return
    onClose()
    // reset setelah modal tertutup agar transisi tidak terlihat
    setTimeout(reset, 200)
  }

  const applyTable = (table: string[][], name: string) => {
    const head = (table[0] ?? []).map((h) => h.replace(/^\ufeff/, '').trim())
    const body = table.slice(1).filter((row) => row.some((c) => c.trim() !== ''))
    if (head.length === 0 || body.length === 0) {
      message.error('File tidak memiliki baris data')
      return
    }
    if (body.length > 2000) {
      message.error('Maksimal 2.000 baris data per impor izin')
      return
    }
    const matched = autoMatch(head)
    setHeaders(head)
    setFileRows(body)
    setMapping(matched)
    setAutoKeys(new Set(Object.keys(matched) as PermitFieldKey[]))
    setFileName(name)
    setStep(1)
  }

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      message.error('Ukuran file maksimal 2 MB')
      return
    }
    setReading(true)
    try {
      const table = await readFileRows(file)
      applyTable(table, file.name)
    } catch (err: unknown) {
      console.error(err)
      message.error(err instanceof Error ? err.message : 'Gagal memproses file')
    } finally {
      setReading(false)
    }
  }

  const handleFetchGSheets = async () => {
    const match = gsheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      message.error('Tautan tidak valid. Gunakan tautan Google Sheets yang benar.')
      return
    }
    // hormati #gid= di URL supaya tab tertentu bisa dipilih; tanpa gid = sheet pertama
    const gid = gsheetsUrl.match(/[#&?]gid=([0-9]+)/)?.[1]
    setFetchingSheet(true)
    try {
      const res = await fetch(
        `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = (await res.text()).trim()
      // respons HTML berarti sheet tidak dibagikan secara publik
      if (text.startsWith('<')) throw new Error('bukan csv')
      const parsedCsv = Papa.parse<string[]>(text, { skipEmptyLines: true })
      applyTable(
        parsedCsv.data.map((row) => row.map((c) => String(c ?? ''))),
        'Google Sheets',
      )
    } catch {
      message.error(
        'Gagal mengambil data sheet. Pastikan sheet dibagikan sebagai "Siapa saja yang memiliki link" dapat melihat.',
      )
    } finally {
      setFetchingSheet(false)
    }
  }

  const changeMapping = (field: PermitFieldKey, index?: number) => {
    setMapping((prev) => {
      const next = { ...prev }
      if (index === undefined) delete next[field]
      else next[field] = index
      return next
    })
    setAutoKeys((prev) => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  const handleDownloadErrorCsv = () => {
    const errorRows = rows.filter((r) => r.status === 'error')
    if (errorRows.length === 0) return
    const csv = Papa.unparse({
      fields: ERROR_CSV_HEADERS,
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

  const handleImport = async () => {
    if (readyRows.length === 0) {
      message.warning('Tidak ada baris berstatus Siap Impor')
      return
    }
    setSubmitting(true)
    const payload: PermitBulkRow[] = readyRows.map((r) => ({
      student_id: r.student_id,
      phone: r.phone ?? null,
      destination: r.destination,
      purpose: r.purpose,
      leave_date: r.leave_date,
      return_deadline: new Date(`${r.return_date}T${r.return_time}:00`).toISOString(),
    }))
    try {
      const created = await bulkMutation.mutateAsync({ rows: payload, issuedBy: null })
      setResults({ successful: created.length })
      setStep(3)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan izin ke server')
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // Potongan UI
  // -------------------------------------------------------------------------

  const card: CSSProperties = {
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
  }

  const columnStructure = (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          background: token.colorFillAlter,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text strong style={{ fontSize: 12, letterSpacing: 0.4 }}>
          <TableOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
          CONTOH ISI FILE EXCEL
        </Text>
        <Text style={{ fontSize: 12, color: token.colorSuccess, fontWeight: 600, whiteSpace: 'nowrap' }}>
          <CheckCircleFilled style={{ marginRight: 6 }} />
          Pencocokan otomatis
        </Text>
      </div>
      {/* bayangan di tepi kiri/kanan muncul otomatis bila tabel bisa digeser */}
      <div
        style={{
          overflowX: 'auto',
          backgroundColor: token.colorBgContainer,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '32px 100%, 32px 100%, 12px 100%, 12px 100%',
          backgroundPosition: '0 0, 100% 0, 0 0, 100% 0',
          backgroundAttachment: 'local, local, scroll, scroll',
          backgroundImage: `linear-gradient(to right, ${token.colorBgContainer}, transparent), linear-gradient(to left, ${token.colorBgContainer}, transparent), radial-gradient(farthest-side at 0 50%, rgba(0,0,0,0.14), transparent), radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,0.14), transparent)`,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {/* baris 1 = judul kolom, persis seperti di Excel */}
            <tr>
              <td
                style={{
                  width: 36,
                  textAlign: 'center',
                  fontSize: 13,
                  color: token.colorTextTertiary,
                  background: token.colorFillTertiary,
                  borderBottom: `2px solid ${token.colorBorder}`,
                }}
              >
                1
              </td>
              {SAMPLE_COLUMNS.map((col) => (
                <td
                  key={col.key}
                  title={col.required ? 'Wajib diisi' : 'Opsional'}
                  style={{
                    padding: '9px 14px',
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                    borderBottom: `2px solid ${token.colorBorder}`,
                    background: token.colorFillTertiary,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.label}
                  {col.required && <span style={{ color: token.colorError, marginLeft: 3 }}>*</span>}
                </td>
              ))}
            </tr>
            {[0, 1].map((r) => (
              <tr key={r}>
                <td
                  style={{
                    textAlign: 'center',
                    fontSize: 13,
                    color: token.colorTextTertiary,
                    background: token.colorFillAlter,
                    borderTop: r === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  {r + 2}
                </td>
                {SAMPLE_COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '9px 14px',
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      borderTop: r === 0 ? undefined : `1px solid ${token.colorBorderSecondary}`,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.values[r]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          <span style={{ color: token.colorError }}>*</span> Wajib diisi. Baris 1 adalah judul kolom, urutan
          bebas.{FIELDS.length - SAMPLE_COLUMNS.length > 0 ? ` ${FIELDS.length - SAMPLE_COLUMNS.length} kolom opsional lain ada di Template Excel.` : ''}
        </Text>
        <Space size={4}>
          <Tag style={{ margin: 0 }}>.xlsx</Tag>
          <Tag style={{ margin: 0 }}>.csv</Tag>
        </Space>
      </div>
    </div>
  )

  const fieldSelectStatus = (f: (typeof FIELDS)[number]) => {
    if ('required' in f && f.required && mapping[f.key] === undefined) return 'error' as const
    // pasangan identitas: cukup salah satu terpetakan
    if (
      (f.key === 'kode_santri' || f.key === 'nama_santri') &&
      mapping.kode_santri === undefined &&
      mapping.nama_santri === undefined
    )
      return 'error' as const
    return undefined
  }

  const mappingColumns = [
    {
      title: 'Data Izin',
      key: 'field',
      width: 190,
      render: (_: unknown, f: (typeof FIELDS)[number]) => (
        <Space size={6} wrap>
          <Text strong>{f.label}</Text>
          {'required' in f && f.required ? <Tag color="red" style={{ margin: 0 }}>Wajib</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Kolom di File',
      key: 'column',
      width: 250,
      render: (_: unknown, f: (typeof FIELDS)[number]) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Tidak dipetakan"
          style={{ width: '100%' }}
          status={fieldSelectStatus(f)}
          value={mapping[f.key]}
          onChange={(v: number | undefined) => changeMapping(f.key, v)}
          options={headers.map((h, i) => ({
            value: i,
            label: `${columnLetter(i)}: ${h || '(tanpa judul)'}`,
          }))}
        />
      ),
    },
    {
      title: 'Contoh Data',
      key: 'sample',
      render: (_: unknown, f: (typeof FIELDS)[number]) => {
        const values = sampleValues(fileRows, mapping[f.key])
        return values.length ? (
          <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
            {values.join(', ')}
          </Text>
        ) : (
          '-'
        )
      },
    },
    {
      title: '',
      key: 'status',
      width: 110,
      render: (_: unknown, f: (typeof FIELDS)[number]) => {
        if (mapping[f.key] === undefined) return null
        return autoKeys.has(f.key) ? (
          <Tag color="green" style={{ margin: 0 }}>
            Otomatis
          </Tag>
        ) : (
          <Tag color="blue" style={{ margin: 0 }}>
            Manual
          </Tag>
        )
      },
    },
  ]

  const previewColumns: TableColumnsType<ParsedPermitRow> = [
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

  const statCard = (label: string, value: number, color?: string) => (
    <div style={{ ...card, padding: '12px 16px', flex: 1, minWidth: 120 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, color }}>{value}</div>
    </div>
  )

  const pickFileButton = (
    <Upload
      accept=".csv,.xlsx,.xls"
      showUploadList={false}
      disabled={reading || refsBlocked}
      beforeUpload={(file) => {
        void handleFile(file)
        return false
      }}
    >
      <Button type="primary" icon={<UploadOutlined />} loading={reading}>
        Pilih File
      </Button>
    </Upload>
  )

  const footerByStep = (s: number): ReactNode => {
    if (s === 0) {
      // ok-nya tombol Pilih File ber-bungkus Upload, bukan Button biasa, sehingga
      // komposisi footer dijaga manual mengikuti bentuk ModalFooter
      return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleClose}>Batal</Button>
          {pickFileButton}
        </div>
      )
    }
    if (s === 1) {
      return (
        <ModalFooter
          left={<Button onClick={() => setStep(0)}>Ganti File</Button>}
          onOk={() => setStep(2)}
          okText="Lanjut ke Review"
          okDisabled={missingRequired.length > 0 || refsBlocked}
        />
      )
    }
    if (s === 2) {
      return (
        <ModalFooter
          left={
            <Button onClick={() => setStep(1)} disabled={submitting}>
              Kembali
            </Button>
          }
          onOk={() => void handleImport()}
          okText={`Impor ${readyRows.length} Izin`}
          okLoading={submitting}
          okDisabled={readyRows.length === 0}
        />
      )
    }
    return <ModalFooter onOk={handleClose} okText="Selesai" />
  }

  return (
    <WizardModal
      title="Impor Izin"
      subtitle="Unggah izin terjadwal dari file Excel, CSV, atau Google Sheets. Santri dicocokkan otomatis, izin aktif di tanggal sama dilewati."
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleClose}
      destroyOnHidden
      size="xl"
      current={step}
      footerByStep={footerByStep}
      steps={[
        { title: 'Upload', description: 'Pilih file' },
        { title: 'Mapping', description: 'Atur kolom' },
        { title: 'Review', description: 'Validasi' },
        { title: 'Hasil', description: 'Selesai' },
      ]}
    >
      {step === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented
            value={sheetSource}
            onChange={(v) => setSheetSource(v as 'file' | 'gsheets')}
            options={[
              { label: 'Upload File', value: 'file', icon: <FileExcelOutlined /> },
              { label: 'Google Sheets', value: 'gsheets', icon: <LinkOutlined /> },
            ]}
          />

          {sheetSource === 'file' ? (
            <Spin spinning={reading} tip="Membaca file...">
              <UploadDropzone
                accept=".csv,.xlsx,.xls"
                multiple={false}
                disabled={reading || refsBlocked}
                icon={<FileAddOutlined />}
                title={refsPending ? 'Menyiapkan data santri…' : 'Klik atau seret file ke sini'}
                hint="Mendukung .csv dan .xlsx, maks 2.000 baris / 2 MB"
                beforeUpload={(file) => {
                  void handleFile(file)
                  return false
                }}
              />
            </Spin>
          ) : (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <IconBox icon={<GlobalOutlined />} size={36} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Sinkronisasi data via Google Sheets</div>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    Tempel tautan sheet publik, sistem akan mengambil baris pertama sebagai judul kolom
                  </Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={gsheetsUrl}
                  onChange={(e) => setGsheetsUrl(e.target.value)}
                  onPressEnter={() => void handleFetchGSheets()}
                  disabled={fetchingSheet}
                />
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={fetchingSheet}
                  disabled={!gsheetsUrl.trim()}
                  onClick={() => void handleFetchGSheets()}
                >
                  Ambil Data
                </Button>
              </div>
              <div style={{ marginTop: 12 }}>
                <ModalNotice tone="info" title="Sheet harus publik">
                  {'Di Google Sheets: Bagikan → Akses umum → pilih "Siapa saja yang memiliki link" (Pelihat). Secara default sheet pertama yang dibaca; untuk tab tertentu, salin tautan saat berada di tab tersebut (URL akan menyertakan #gid=…).'}
                </ModalNotice>
              </div>
            </div>
          )}

          <ModalSection
            icon={<FileExcelOutlined />}
            title="Data referensi"
            desc="Kode & nama santri"
            trailing={
              <Button icon={<DownloadOutlined />} onClick={() => downloadTemplate()}>
                Unduh Template Excel
              </Button>
            }
          />

          <Collapse
            ghost
            items={[
              {
                key: 'sample',
                label: 'Contoh isi file Excel & tips pengisian',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {columnStructure}
                    <ModalNotice tone="info" title="Tips Excel">
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        Hapus 2 baris contoh di template sebelum mengisi data Anda.
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        <li>
                          Identitas: isi Kode Santri atau Nama Santri. Nama harus unik — bila ada nama
                          kembar, isi kolom kode.
                        </li>
                        <li>
                          Wajib: Tujuan, Keperluan, Tanggal Keluar, Tanggal Kembali, dan Jam Kembali
                          (HH:mm; kembali tidak boleh sebelum keluar). Telepon opsional.
                        </li>
                        <li>
                          Santri yang sudah punya izin aktif di tanggal yang sama otomatis dilewati
                          (duplikat).
                        </li>
                      </ul>
                    </ModalNotice>
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <ModalNotice
            tone={missingRequired.length > 0 || refsBlocked ? 'warning' : 'success'}
            title={`File "${fileName}": ${fileRows.length} baris data, ${mappedCount} dari ${FIELDS.length} kolom terpetakan`}
          >
            {refsPending
              ? 'Menyiapkan data santri…'
              : students.length === 0
                ? 'Data santri belum termuat, coba lagi sebentar'
                : missingRequired.length > 0
                  ? `Belum dipetakan: ${missingRequired.join(', ')}`
                  : 'Semua kolom wajib sudah terpetakan. Periksa kolom lain jika perlu, lalu lanjut ke Review.'}
          </ModalNotice>
          <Table<(typeof FIELDS)[number]>
            rowKey="key"
            size="small"
            columns={mappingColumns}
            dataSource={[...FIELDS]}
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Space>
      )}

      {step === 2 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {statCard('Total baris', counts.total)}
            {statCard('Siap impor', readyRows.length, token.colorSuccess)}
            {statCard('Duplikat (dilewati)', counts.duplikat, counts.duplikat > 0 ? token.colorWarning : undefined)}
            {statCard('Bermasalah (dilewati)', counts.error, counts.error > 0 ? token.colorError : undefined)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Segmented
              value={reviewFilter}
              onChange={(v) => setReviewFilter(v as 'all' | PermitImportStatus)}
              options={[
                { label: `Semua (${counts.total})`, value: 'all' },
                { label: `Siap (${readyRows.length})`, value: 'baru' },
                { label: `Duplikat (${counts.duplikat})`, value: 'duplikat' },
                { label: `Bermasalah (${counts.error})`, value: 'error' },
              ]}
            />
            {counts.error > 0 && (
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadErrorCsv}>
                Unduh Baris Error (.csv)
              </Button>
            )}
          </div>
          <Table<ParsedPermitRow>
            rowKey="key"
            size="small"
            columns={previewColumns}
            dataSource={shownRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: true }}
            onRow={(row) => ({
              style:
                row.status === 'error'
                  ? { background: token.colorErrorBg }
                  : row.status === 'duplikat'
                    ? { background: token.colorFillAlter }
                    : undefined,
            })}
          />
        </Space>
      )}

      {step === 3 && results && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {statCard('Berhasil', results.successful, token.colorSuccess)}
            {statCard(
              'Dilewati',
              counts.duplikat + counts.error,
              counts.duplikat + counts.error > 0 ? token.colorWarning : undefined,
            )}
          </div>
          <ModalNotice tone="info" title={`Sebanyak ${results.successful} izin berhasil diterbitkan.`}>
            {counts.duplikat > 0 && <div>{counts.duplikat} duplikat dilewati.</div>}
            {counts.error > 0 && <div>{counts.error} baris error diabaikan.</div>}
            {(counts.duplikat > 0 || counts.error > 0) && (
              <div style={{ marginTop: 4 }}>Perbaiki baris bermasalah lalu impor ulang sisa file.</div>
            )}
          </ModalNotice>
        </Space>
      )}
    </WizardModal>
  )
}
