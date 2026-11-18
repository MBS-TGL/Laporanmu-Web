import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  App,
  Button,
  Collapse,
  Descriptions,
  Input,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
  theme,
} from 'antd'
import {
  CheckCircleFilled,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  DownloadOutlined,
  FileAddOutlined,
  ApartmentOutlined,
  BankOutlined,
  FileExcelOutlined,
  GlobalOutlined,
  LinkOutlined,
  TableOutlined,
  UploadOutlined,
  ImportOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { useQueryClient } from '@tanstack/react-query'
import { WizardModal } from '../../../shared/components/WizardModal'
import { IconBox } from '../../../shared/components/IconBox'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { ModalSection } from '../../../shared/components/ModalSection'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import {
  SAMPLE_COLUMNS,
  autoMatch,
  columnLetter,
  downloadInvalidRows,
  downloadTemplate,
  normalizeGender,
  normalizePhone,
  readFileToTable,
  sampleValues,
  normalizeName,
  splitTags,
  validateRows,
  FIELDS,
  type FieldKey,
  type Mapping,
  type ParsedRow,
} from '../importParse'
import { importStudents, type ImportStudentPayload, type ImportStudentResult } from '../api'
import { useClassesBrief, useDormsBrief, useExistingStudentCodes } from '../hooks'

const { Text } = Typography

// RPC dieksekusi per baris (bukan transaksi tunggal) — mengirim per chunk
// menjaga payload tetap kecil untuk file besar tanpa mengubah semantiknya
const IMPORT_CHUNK_SIZE = 500

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

function ReferencePanel({
  title,
  icon,
  names,
  query,
}: {
  title: string
  icon: ReactNode
  names: string[]
  query: string
}) {
  const { token } = theme.useToken()
  const filtered = names.filter((n) => normalizeName(n).includes(normalizeName(query)))
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 10,
        overflow: 'hidden',
        minWidth: 0,
        background: token.colorBgContainer,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: token.colorFillAlter,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <span style={{ color: token.colorPrimary, fontSize: 13 }}>{icon}</span>
        <Text strong style={{ fontSize: 12.5 }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
          ({names.length})
        </Text>
      </div>
      <div style={{ maxHeight: 208, overflowY: 'auto', padding: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '16px 12px', fontSize: 12.5, color: token.colorTextSecondary, textAlign: 'center' }}>
            {names.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok dengan pencarian.'}
          </div>
        ) : (
          filtered.map((name) => (
            <div key={name} className="ref-row" style={{ padding: '5px 10px', fontSize: 12.5 }}>
              {name}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
  /** sumber data aktif saat modal dibuka (default: upload file) */
  initialSource?: 'file' | 'gsheets'
}

export function ImportModal({ open, onClose, initialSource = 'file' }: ImportModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState<string>()
  const [reading, setReading] = useState(false)
  const [sheetSource, setSheetSource] = useState<'file' | 'gsheets'>('file')
  const [gsheetsUrl, setGsheetsUrl] = useState('')
  const [fetchingSheet, setFetchingSheet] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [fileRows, setFileRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Mapping>({})
  const [autoKeys, setAutoKeys] = useState<Set<FieldKey>>(new Set())
  const [reviewFilter, setReviewFilter] = useState<'all' | 'ok' | 'error'>('all')
  const [results, setResults] = useState<ImportStudentResult[]>([])
  // Default: dipakai hanya untuk baris yang kolom kelas / asramanya kosong
  const [classId, setClassId] = useState<string>()
  const [dormId, setDormId] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)
  const [refQuery, setRefQuery] = useState('')

  const classesQuery = useClassesBrief()
  const dormsQuery = useDormsBrief()
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])
  const dorms = useMemo(() => dormsQuery.data ?? [], [dormsQuery.data])
  const existingCodesQuery = useExistingStudentCodes(open && step >= 1)
  const existingCodes = useMemo(
    () => new Set(existingCodesQuery.data ?? []),
    [existingCodesQuery.data],
  )

  // buka langsung pada sumber yang diminta (mis. "Import GSheets" dari menu) —
  // pola penyesuaian state saat render, bukan effect
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSheetSource(initialSource)
  }

  // File + pemetaan kolom -> baris mentah
  const rawRows = useMemo<ParsedRow[]>(() => {
    const cell = (row: string[], field: FieldKey) => {
      const index = mapping[field]
      return index === undefined ? undefined : row[index]?.trim() || undefined
    }
    return fileRows.map((row, i) => ({
      key: i + 1,
      name: cell(row, 'name'),
      registration_code: cell(row, 'registration_code'),
      class_name: cell(row, 'class_name'),
      dorm_name: cell(row, 'dorm_name'),
      nisn: cell(row, 'nisn'),
      nis: cell(row, 'nis'),
      nik: cell(row, 'nik'),
      gender: normalizeGender(cell(row, 'gender')),
      status: cell(row, 'status')?.toLowerCase(),
      phone: normalizePhone(cell(row, 'phone')),
      photo_url: cell(row, 'photo_url'),
      tags: splitTags(cell(row, 'tags')),
      guardian_name: cell(row, 'guardian_name'),
      guardian_relation: cell(row, 'guardian_relation'),
      birth_place: cell(row, 'birth_place'),
      birth_date: cell(row, 'birth_date'),
      religion: cell(row, 'religion'),
      address: cell(row, 'address'),
    }))
  }, [fileRows, mapping])

  // Validasi dihitung ulang otomatis saat pemetaan, daftar kelas/asrama, atau default berubah
  const rows = useMemo(
    () =>
      validateRows(rawRows, classes, dorms, classId, dormId).map((row) => {
        // pra-cek duplikat: kode yang sudah terdaftar pasti gagal di server (constraint unik)
        const code = row.registration_code?.toLowerCase()
        if (!row.error && code && existingCodes.has(code)) {
          return { ...row, error: 'Kode registrasi sudah terdaftar di sistem' }
        }
        return row
      }),
    [rawRows, classes, dorms, classId, dormId, existingCodes],
  )
  const validRows = useMemo(() => rows.filter((r) => !r.error), [rows])
  const invalidCount = rows.length - validRows.length
  const shownRows = useMemo(
    () =>
      reviewFilter === 'all'
        ? rows
        : rows.filter((r) => (reviewFilter === 'ok' ? !r.error : !!r.error)),
    [rows, reviewFilter],
  )

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount

  const mappedCount = FIELDS.filter((f) => mapping[f.key] !== undefined).length
  const missingRequired = [
    mapping.name === undefined && 'Nama',
    mapping.registration_code === undefined && 'Kode Registrasi',
    mapping.class_name === undefined && !classId && 'Kelas (atau pilih kelas default)',
  ].filter(Boolean) as string[]

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
    setResults([])
    setClassId(undefined)
    setDormId(undefined)
    setSubmitting(false)
    setImportProgress(null)
    setRefQuery('')
  }

  const handleClose = () => {
    onClose()
    // reset setelah modal tertutup agar transisi tidak terlihat
    setTimeout(reset, 200)
  }

  const applyTable = async (table: string[][], name: string) => {
    const head = (table[0] ?? []).map((h) => h.replace(/^\ufeff/, '').trim())
    const body = table.slice(1).filter((row) => row.some((c) => c.trim() !== ''))
    if (head.length === 0 || body.length === 0) {
      message.error('Data kosong atau formatnya tidak sesuai (baris pertama harus berisi judul kolom)')
      return
    }
    const matched = autoMatch(head)
    setHeaders(head)
    setFileRows(body)
    setMapping(matched)
    setAutoKeys(new Set(Object.keys(matched) as FieldKey[]))
    setFileName(name)
    setStep(1)
  }

  const handleFile = async (file: File) => {
    setReading(true)
    try {
      const table = await readFileToTable(file)
      await applyTable(table, file.name)
    } catch {
      message.error('Gagal membaca file. Pastikan file berformat .csv atau .xlsx yang valid')
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
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true })
      await applyTable(
        parsed.data.map((row) => row.map((c) => String(c ?? ''))),
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

  const changeMapping = (field: FieldKey, index?: number) => {
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

  const handleImport = async () => {
    setSubmitting(true)
    const payload: ImportStudentPayload[] = validRows.map((row) => ({
      name: row.name as string,
      registration_code: row.registration_code as string,
      class_id: row.class_id as string,
      dorm_id: row.dorm_id,
      nisn: row.nisn,
      nis: row.nis,
      nik: row.nik,
      gender: row.gender,
      status: row.status,
      phone: row.phone,
      photo_url: row.photo_url,
      tags: row.tags,
      guardian_name: row.guardian_name,
      guardian_relation: row.guardian_relation,
      birth_place: row.birth_place,
      birth_date: row.birth_date_iso,
      religion: row.religion,
      address: row.address,
    }))
    const aggregated: ImportStudentResult[] = []
    setImportProgress({ done: 0, total: payload.length })
    try {
      for (let i = 0; i < payload.length; i += IMPORT_CHUNK_SIZE) {
        const res = await importStudents(payload.slice(i, i + IMPORT_CHUNK_SIZE))
        // row_index dari RPC = posisi 1-based dalam chunk → offset ke posisi global
        for (const r of res) aggregated.push({ ...r, row_index: i + r.row_index })
        setImportProgress({ done: Math.min(i + IMPORT_CHUNK_SIZE, payload.length), total: payload.length })
      }
      void queryClient.invalidateQueries({ queryKey: ['students', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['student-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['students', 'codes'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setResults(aggregated)
      setStep(3)
    } catch (err) {
      // chunk yang sudah terkirim tetap tersimpan (RPC per-baris) — tampilkan apa yang sudah masuk
      void queryClient.invalidateQueries({ queryKey: ['students', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['student-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['students', 'codes'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (aggregated.length > 0) {
        setResults(aggregated)
        setStep(3)
        message.warning('Koneksi terputus di tengah impor. Baris yang sudah terkirim ditampilkan di hasil.')
      } else {
        message.error(err instanceof Error ? err.message : 'Gagal mengimpor siswa')
      }
    } finally {
      setSubmitting(false)
      setImportProgress(null)
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

  const referenceContent = (
    <div style={{ width: 440, maxWidth: 'calc(100vw - 48px)' }}>
      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
        placeholder="Cari kelas / asrama…"
        value={refQuery}
        onChange={(e) => setRefQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      {classesQuery.isPending || dormsQuery.isPending ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Spin size="small" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          <ReferencePanel title="Kelas" icon={<BankOutlined />} names={classes.map((c) => c.name)} query={refQuery} />
          <ReferencePanel title="Asrama" icon={<ApartmentOutlined />} names={dorms.map((d) => d.name)} query={refQuery} />
        </div>
      )}
    </div>
  )
  const defaultSelects = (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <Text strong>Nilai default</Text>{' '}
        <Text type="secondary" style={{ fontSize: 12 }}>
          (opsional, dipakai untuk baris yang kolom kelas / asramanya kosong)
        </Text>
      </div>
      <Space wrap size="middle">
        <Select
          placeholder="Kelas default"
          allowClear
          style={{ minWidth: 260 }}
          value={classId}
          loading={classesQuery.isPending}
          onChange={setClassId}
          options={classes.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          placeholder="Asrama default"
          allowClear
          style={{ minWidth: 260 }}
          value={dormId}
          loading={dormsQuery.isPending}
          onChange={setDormId}
          options={dorms.map((d) => ({ value: d.id, label: d.name }))}
        />
      </Space>
    </div>
  )

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
          bebas. {FIELDS.length - SAMPLE_COLUMNS.length} kolom opsional lain ada di Template Excel.
        </Text>
        <Space size={4}>
          <Tag style={{ margin: 0 }}>.xlsx</Tag>
          <Tag style={{ margin: 0 }}>.csv</Tag>
        </Space>
      </div>
    </div>
  )

  const mappingColumns = [
    {
      title: 'Data Siswa',
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
          status={
            'required' in f && f.required && mapping[f.key] === undefined && !(f.key === 'class_name' && classId)
              ? 'error'
              : undefined
          }
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

  const previewColumns = [
    { title: '#', dataIndex: 'key', key: 'key', width: 50 },
    { title: 'Nama', dataIndex: 'name', key: 'name', render: (v?: string) => v || '-' },
    {
      title: 'Kode Registrasi',
      dataIndex: 'registration_code',
      key: 'registration_code',
      render: (v?: string) => v || '-',
    },
    { title: 'Kelas', dataIndex: 'class_label', key: 'class_label', render: (v?: string) => v || '-' },
    { title: 'Asrama', dataIndex: 'dorm_label', key: 'dorm_label', render: (v?: string) => v || '-' },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 80, render: (v?: string) => v || '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 90, render: (v?: string) => v || 'active' },
    {
      title: 'Validasi',
      dataIndex: 'error',
      key: 'error',
      render: (v?: string) => (v ? <Tag color="red">{v}</Tag> : <Tag color="green">Siap impor</Tag>),
    },
  ]

  const resultColumns = [
    { title: 'Baris', dataIndex: 'row_index', key: 'row_index', width: 70 },
    {
      title: 'Hasil',
      dataIndex: 'ok',
      key: 'ok',
      width: 110,
      render: (v: boolean) =>
        v ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Berhasil
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Gagal
          </Tag>
        ),
    },
    { title: 'Keterangan', dataIndex: 'error', key: 'error', render: (v: string | null) => v || 'Tersimpan' },
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
      disabled={reading}
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
          okDisabled={missingRequired.length > 0}
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
          okText={`Impor ${validRows.length} Siswa`}
          okLoading={submitting}
          okDisabled={validRows.length === 0}
        />
      )
    }
    return <ModalFooter onOk={handleClose} okText="Selesai" />
  }

  return (
    <WizardModal
      title="Impor Data Siswa"
      subtitle="Unggah data siswa secara masal dari file Excel, CSV, atau Google Sheets. Sistem akan memvalidasi data secara otomatis."
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleClose}
      destroyOnHidden
      size="xl"
      current={step}
      footerByStep={footerByStep}
      steps={[
        { title: 'Unggah', description: 'Pilih file' },
        { title: 'Pemetaan', description: 'Atur kolom' },
        { title: 'Pratinjau', description: 'Validasi' },
        { title: 'Hasil', description: 'Selesai' },
      ]}
    >
      {step === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Segmented
            value={sheetSource}
            onChange={(v) => setSheetSource(v as 'file' | 'gsheets')}
            options={[
              { label: 'Unggah File', value: 'file', icon: <FileExcelOutlined /> },
              { label: 'Google Sheets', value: 'gsheets', icon: <LinkOutlined /> },
            ]}
          />

          {sheetSource === 'file' ? (
            <Spin spinning={reading} tip="Membaca file...">
              <UploadDropzone
                accept=".csv,.xlsx,.xls"
                multiple={false}
                disabled={reading}
                icon={<FileAddOutlined />}
                title="Klik atau seret file ke sini"
                hint="Mendukung .csv dan .xlsx"
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
            desc="Siswa, Kelas & Asrama"
            trailing={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Popover trigger="click" placement="bottomLeft" content={referenceContent}>
                  <Button>
                    Kelas & asrama valid <Tag color="processing" style={{ margin: '0 4px 0 6px' }}>{classes.length + dorms.length}</Tag>
                    <DownOutlined />
                  </Button>
                </Popover>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    downloadTemplate({
                      classes: classes.map((c) => c.name),
                      dorms: dorms.map((d) => d.name),
                    })
                  }
                >
                  Unduh Template Excel
                </Button>
              </div>
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
                          Paling aman pakai Template Excel di atas: kolom angka sudah berformat Teks, jadi angka
                          0 di depan tidak hilang. Isi file sendiri? Format kolom NISN, NIS, NIK, dan telepon
                          sebagai Teks.
                        </li>
                        <li>
                          Nama kelas harus sama persis dengan yang ada di Kelas & asrama valid (boleh kosong
                          bila memilih kelas default).
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
            tone={missingRequired.length > 0 ? 'warning' : 'success'}
            title={`File "${fileName}": ${fileRows.length} baris data, ${mappedCount} dari ${FIELDS.length} kolom terpetakan`}
          >
            {missingRequired.length > 0
              ? `Belum dipetakan: ${missingRequired.join(', ')}`
              : 'Semua kolom wajib sudah terpetakan. Periksa kolom lain jika perlu, lalu lanjut ke Review.'}
          </ModalNotice>
          {defaultSelects}
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
          {importProgress && (
            <div style={{ ...card, padding: '12px 16px' }}>
              <Text strong style={{ fontSize: 13 }}>
                Mengimpor {importProgress.done} dari {importProgress.total} baris…
              </Text>
              <Progress
                percent={Math.round((importProgress.done / Math.max(1, importProgress.total)) * 100)}
                status="active"
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {statCard('Total baris', rows.length)}
            {statCard('Siap impor', validRows.length, token.colorSuccess)}
            {statCard('Bermasalah (dilewati)', invalidCount, invalidCount > 0 ? token.colorError : undefined)}
          </div>
          {defaultSelects}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <Segmented
              value={reviewFilter}
              onChange={(v) => setReviewFilter(v as 'all' | 'ok' | 'error')}
              options={[
                { label: `Semua (${rows.length})`, value: 'all' },
                { label: `Siap (${validRows.length})`, value: 'ok' },
                { label: `Bermasalah (${invalidCount})`, value: 'error' },
              ]}
            />
            {invalidCount > 0 && (
              <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadInvalidRows(rows)}>
                Unduh baris bermasalah
              </Button>
            )}
          </div>
          <Table<ParsedRow>
            rowKey="key"
            size="small"
            columns={previewColumns}
            dataSource={shownRows}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: true }}
            onRow={(row) => ({ style: row.error ? { background: token.colorErrorBg } : undefined })}
            expandable={{
              expandedRowRender: (row) => (
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="NISN">{row.nisn || '-'}</Descriptions.Item>
                  <Descriptions.Item label="NIS">{row.nis || '-'}</Descriptions.Item>
                  <Descriptions.Item label="NIK">{row.nik || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Telepon">{row.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Tempat Lahir">{row.birth_place || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Tanggal Lahir">
                    {row.birth_date_iso || row.birth_date || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Agama">{row.religion || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Label">
                    {row.tags?.length ? row.tags.map((t) => <Tag key={t}>{t}</Tag>) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Wali">
                    {row.guardian_name
                      ? `${row.guardian_name}${row.guardian_relation ? ` (${row.guardian_relation})` : ''}`
                      : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="URL Foto">{row.photo_url || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Alamat" span={2}>
                    {row.address || '-'}
                  </Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        </Space>
      )}

      {step === 3 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {statCard('Berhasil', okCount, token.colorSuccess)}
            {statCard('Gagal', failCount, failCount > 0 ? token.colorError : undefined)}
          </div>
          {failCount > 0 && (
            <ModalNotice tone="warning" title="Perbaiki baris yang gagal lalu impor ulang dengan kode registrasi yang sama." />
          )}
          <Table<ImportStudentResult>
            rowKey="row_index"
            size="small"
            columns={resultColumns}
            dataSource={results}
            pagination={{ pageSize: 8, showSizeChanger: false }}
          />
        </Space>
      )}
    </WizardModal>
  )
}
