import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Alert,
  App,
  Button,
  Collapse,
  ConfigProvider,
  Descriptions,
  Input,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Steps,
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
  FileExcelOutlined,
  GlobalOutlined,
  InboxOutlined,
  LinkOutlined,
  TableOutlined,
  UploadOutlined,
  ImportOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import { useQueryClient } from '@tanstack/react-query'
import { AppModal } from '../../../shared/components/AppModal'
import { importStudents, type ImportStudentPayload, type ImportStudentResult } from '../api'
import { useClassesBrief, useDormsBrief, useExistingStudentCodes } from '../hooks'

const { Text } = Typography

const VALID_STATUSES = ['active', 'graduated', 'transferred', 'left']

// RPC dieksekusi per baris (bukan transaksi tunggal) — mengirim per chunk
// menjaga payload tetap kecil untuk file besar tanpa mengubah semantiknya
const IMPORT_CHUNK_SIZE = 500

// ---------------------------------------------------------------------------
// Definisi kolom
// ---------------------------------------------------------------------------

const FIELDS = [
  { key: 'name', label: 'Nama', required: true, aliases: ['nama', 'nama siswa', 'nama lengkap'] },
  {
    key: 'registration_code',
    label: 'Kode Registrasi',
    required: true,
    aliases: ['kode registrasi', 'kode reg', 'kode'],
  },
  { key: 'class_name', label: 'Kelas', required: true, aliases: ['kelas', 'nama kelas', 'class'] },
  { key: 'dorm_name', label: 'Asrama', aliases: ['asrama', 'nama asrama', 'dorm'] },
  { key: 'nisn', label: 'NISN', aliases: [] },
  { key: 'nis', label: 'NIS', aliases: [] },
  { key: 'nik', label: 'NIK', aliases: [] },
  { key: 'gender', label: 'Gender', aliases: ['jenis kelamin', 'jk', 'l p'] },
  { key: 'status', label: 'Status', aliases: [] },
  {
    key: 'phone',
    label: 'Telepon / WA',
    aliases: ['phone wa', 'wa', 'no hp', 'hp', 'telepon', 'no telepon', 'whatsapp', 'nomor hp'],
  },
  { key: 'photo_url', label: 'URL Foto', aliases: ['url foto', 'foto'] },
  { key: 'tags', label: 'Label', aliases: ['label', 'tag'] },
  { key: 'guardian_name', label: 'Nama Wali', aliases: ['nama wali', 'wali'] },
  {
    key: 'guardian_relation',
    label: 'Hubungan Wali',
    aliases: ['hubungan wali', 'hubungan'],
  },
  { key: 'birth_place', label: 'Tempat Lahir', aliases: ['tempat lahir'] },
  { key: 'birth_date', label: 'Tanggal Lahir', aliases: ['tanggal lahir', 'tgl lahir'] },
  { key: 'religion', label: 'Agama', aliases: ['agama'] },
  { key: 'address', label: 'Alamat', aliases: ['alamat'] },
] as const satisfies readonly {
  key: string
  label: string
  required?: boolean
  aliases: readonly string[]
}[]

type FieldKey = (typeof FIELDS)[number]['key']
type Mapping = Partial<Record<FieldKey, number>>

interface ParsedRow {
  key: number
  name?: string
  registration_code?: string
  class_name?: string
  dorm_name?: string
  nisn?: string
  nis?: string
  nik?: string
  gender?: string
  status?: string
  phone?: string
  photo_url?: string
  tags?: string[]
  guardian_name?: string
  guardian_relation?: string
  birth_place?: string
  birth_date?: string
  religion?: string
  address?: string
  // diisi saat validasi
  class_id?: string
  class_label?: string
  dorm_id?: string
  dorm_label?: string
  birth_date_iso?: string
  error?: string
}

interface NamedItem {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Template & unduhan
// ---------------------------------------------------------------------------

const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<FieldKey, string>[] = [
  {
    name: 'Ahmad Fulan',
    registration_code: '2026001',
    class_name: '9A Boarding Putra',
    dorm_name: '',
    nisn: '0012345678',
    nis: '2026001',
    nik: '3509012345670001',
    gender: 'L',
    status: 'active',
    phone: '081234567890',
    photo_url: '',
    tags: 'Beasiswa;Yatim',
    guardian_name: 'Budi Fulan',
    guardian_relation: 'Ayah',
    birth_place: 'Jember',
    birth_date: '2011-05-17',
    religion: 'Islam',
    address: 'Jl. Mawar No. 1, Jember',
  },
  {
    name: 'Siti Fulanah',
    registration_code: '2026002',
    class_name: '9C Reguler Putra',
    dorm_name: '',
    nisn: '',
    nis: '',
    nik: '',
    gender: 'P',
    status: 'active',
    phone: '',
    photo_url: '',
    tags: '',
    guardian_name: '',
    guardian_relation: '',
    birth_place: '',
    birth_date: '',
    religion: '',
    address: '',
  },
]

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function downloadTemplate() {
  // xlsx (bukan CSV) supaya kolom angka panjang bisa dikunci format Teks:
  // NISN/NIK/telepon tidak kehilangan angka 0 di depan atau berubah notasi ilmiah
  void import('xlsx').then((XLSX) => {
    const header = [...TEMPLATE_COLUMNS]
    const data = TEMPLATE_ROWS.map((row) => TEMPLATE_COLUMNS.map((col) => row[col]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const textCols = new Set(['registration_code', 'nisn', 'nis', 'nik', 'phone'])
    for (let c = 0; c < header.length; c++) {
      if (!textCols.has(header[c])) continue
      for (let r = 1; r <= data.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr]) ws[addr].z = '@'
      }
    }
    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(34, Math.max(h.length + 2, ...data.map((row) => row[c].length + 2))),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa')
    XLSX.writeFile(wb, 'template-impor-siswa.xlsx')
  })
}

function downloadInvalidRows(rows: ParsedRow[]) {
  const bad = rows.filter((r) => r.error)
  if (bad.length === 0) return
  downloadCsv(
    'baris-bermasalah.csv',
    Papa.unparse({
      fields: [...TEMPLATE_COLUMNS, 'error'],
      data: bad.map((r) => [
        ...TEMPLATE_COLUMNS.map((col) => {
          const v = r[col]
          return Array.isArray(v) ? v.join(';') : (v ?? '')
        }),
        r.error ?? '',
      ]),
    }),
  )
}

// ---------------------------------------------------------------------------
// Membaca file (CSV / XLSX)
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  return String(value).trim()
}

async function readFileToTable(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    // dimuat hanya saat dibutuhkan agar bundle awal tetap kecil
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
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
      complete: (result) => resolve(result.data.map((row) => row.map(cellToString))),
      error: (err) => reject(err),
    })
  })
}

// ---------------------------------------------------------------------------
// Pemetaan kolom otomatis
// ---------------------------------------------------------------------------

function normHeader(value: string) {
  return value
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function autoMatch(headers: string[]): Mapping {
  const normalized = headers.map(normHeader)
  const used = new Set<number>()
  const mapping: Mapping = {}
  for (const field of FIELDS) {
    const names = new Set([field.key, ...field.aliases].map(normHeader))
    const index = normalized.findIndex((h, i) => !used.has(i) && names.has(h))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }
  return mapping
}

function columnLetter(index: number) {
  let n = index
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letters
}

function sampleValues(rows: string[][], index?: number) {
  if (index === undefined) return []
  const values: string[] = []
  for (const row of rows) {
    const v = row[index]?.trim()
    if (v) values.push(v)
    if (values.length === 2) break
  }
  return values
}

// ---------------------------------------------------------------------------
// Normalisasi & validasi nilai
// ---------------------------------------------------------------------------

const GENDER_ALIASES: Record<string, string> = {
  l: 'L',
  'laki-laki': 'L',
  'laki laki': 'L',
  pria: 'L',
  male: 'L',
  p: 'P',
  perempuan: 'P',
  wanita: 'P',
  female: 'P',
}

function normalizeGender(value?: string) {
  const v = value?.trim()
  if (!v) return undefined
  return GENDER_ALIASES[v.toLowerCase()] ?? v.toUpperCase()
}

// Excel sering menghapus angka 0 di depan nomor HP (0812... -> 812...)
function normalizePhone(value?: string) {
  if (!value) return undefined
  const v = value.replace(/[\s-]/g, '')
  return /^8\d{8,12}$/.test(v) ? `0${v}` : v
}

function splitTags(value?: string) {
  const tags = (value ?? '')
    .split(/[;|,]/)
    .map((t) => t.trim())
    .filter(Boolean)
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined
}

// undefined = kosong, null = tidak valid, string = format ISO (YYYY-MM-DD)
function parseBirthDate(value?: string): string | null | undefined {
  const v = value?.trim()
  if (!v) return undefined
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v)
  let y: number
  let m: number
  let d: number
  if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else if (dmy) {
    d = Number(dmy[1])
    m = Number(dmy[2])
    y = Number(dmy[3])
  } else {
    return null
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null
  }
  return `${y}-${pad(m)}-${pad(d)}`
}

// Samakan spasi & huruf besar/kecil supaya "9a  boarding putra" tetap cocok
function normalizeName(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function validateRows(
  rows: ParsedRow[],
  classes: NamedItem[],
  dorms: NamedItem[],
  defaultClassId?: string,
  defaultDormId?: string,
): ParsedRow[] {
  const classByName = new Map(classes.map((c) => [normalizeName(c.name), c]))
  const dormByName = new Map(dorms.map((d) => [normalizeName(d.name), d]))
  const seen = new Set<string>()

  return rows.map((row) => {
    const name = row.name?.trim()
    const code = row.registration_code?.trim()
    const rawClass = row.class_name?.trim()
    const rawDorm = row.dorm_name?.trim()
    let error: string | undefined

    // Kelas: dari class_name, kalau kosong pakai kelas default
    let classId: string | undefined
    let classLabel: string | undefined = rawClass
    if (rawClass) {
      const match = classByName.get(normalizeName(rawClass))
      if (match) {
        classId = match.id
        classLabel = match.name
      }
    } else if (defaultClassId) {
      classId = defaultClassId
      classLabel = classes.find((c) => c.id === defaultClassId)?.name
    }

    // Asrama: dari dorm_name, kalau kosong pakai asrama default (boleh tanpa asrama)
    let dormId: string | undefined
    let dormLabel: string | undefined = rawDorm
    if (rawDorm) {
      const match = dormByName.get(normalizeName(rawDorm))
      if (match) {
        dormId = match.id
        dormLabel = match.name
      }
    } else if (defaultDormId) {
      dormId = defaultDormId
      dormLabel = dorms.find((d) => d.id === defaultDormId)?.name
    }

    const birthDate = parseBirthDate(row.birth_date)

    if (!name) error = 'Nama kosong'
    else if (!code) error = 'Kode registrasi kosong'
    else if (seen.has(code.toLowerCase())) error = 'Kode registrasi duplikat di file'
    else if (!rawClass && !defaultClassId)
      error = 'Kelas kosong (isi kolom kelas atau pilih kelas default)'
    else if (rawClass && !classId) error = `Kelas "${rawClass}" tidak ditemukan`
    else if (rawDorm && !dormId) error = `Asrama "${rawDorm}" tidak ditemukan`
    else if (row.gender && !['L', 'P'].includes(row.gender)) error = 'Gender harus L atau P'
    else if (row.status && !VALID_STATUSES.includes(row.status)) error = 'Status tidak valid'
    else if (row.nisn && !/^\d+$/.test(row.nisn)) error = 'NISN harus berupa angka'
    else if (row.nis && !/^\d+$/.test(row.nis)) error = 'NIS harus berupa angka'
    else if (row.nik && !/^\d+$/.test(row.nik)) error = 'NIK harus berupa angka'
    else if (birthDate === null)
      error = 'Tanggal lahir tidak valid (pakai YYYY-MM-DD atau DD/MM/YYYY)'
    else if (row.photo_url && !/^https?:\/\//i.test(row.photo_url))
      error = 'URL foto harus diawali http:// atau https://'

    if (code) seen.add(code.toLowerCase())
    return {
      ...row,
      name,
      registration_code: code,
      class_id: classId,
      class_label: classLabel,
      dorm_id: dormId,
      dorm_label: dormLabel,
      birth_date_iso: birthDate ?? undefined,
      error,
    }
  })
}

// ---------------------------------------------------------------------------
// Ilustrasi struktur kolom (langkah Upload)
// ---------------------------------------------------------------------------

const SAMPLE_COLUMNS = [
  { letter: 'A', label: 'NAME', values: ['Budi Santoso', 'Siti Maryam'] },
  { letter: 'B', label: 'GENDER', values: ['L', 'P'] },
  { letter: 'C', label: 'CLASS', values: ['10A Boarding Putra', '10B Boarding Putri'] },
  { letter: 'D', label: 'WA', values: ['08123…', '08567…'] },
  { letter: 'E', label: 'NIS', values: ['2024001', '2024002'] },
  { letter: 'F', label: 'WALI', values: ['Ahmad', 'Aminah'] },
]

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

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
      void queryClient.invalidateQueries({ queryKey: ['students'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setResults(aggregated)
      setStep(3)
    } catch (err) {
      // chunk yang sudah terkirim tetap tersimpan (RPC per-baris) — tampilkan apa yang sudah masuk
      void queryClient.invalidateQueries({ queryKey: ['students'] })
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

  const iconBox = (icon: ReactNode, size = 40): ReactNode => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: token.colorPrimaryBg,
        color: token.colorPrimary,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  )

  const referenceContent = (
    <div style={{ width: 320, maxHeight: 280, overflowY: 'auto' }}>
      {classesQuery.isPending ? (
        <Spin size="small" />
      ) : (
        <>
          <Text strong style={{ fontSize: 12 }}>
            Kelas ({classes.length})
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '6px 0 12px' }}>
            {classes.length === 0 ? <Text type="secondary">Belum ada kelas</Text> : null}
            {classes.map((c) => (
              <Tag key={c.id} style={{ margin: 0 }}>
                {c.name}
              </Tag>
            ))}
          </div>
          <Text strong style={{ fontSize: 12 }}>
            Asrama ({dorms.length})
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {dorms.length === 0 ? <Text type="secondary">Belum ada asrama</Text> : null}
            {dorms.map((d) => (
              <Tag key={d.id} style={{ margin: 0 }}>
                {d.name}
              </Tag>
            ))}
          </div>
        </>
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
          padding: '10px 16px',
          background: token.colorFillAlter,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text strong style={{ fontSize: 12, letterSpacing: 0.4 }}>
          <TableOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
          CONTOH STRUKTUR KOLOM EXCEL
        </Text>
        <Text style={{ fontSize: 12, color: token.colorSuccess, fontWeight: 600 }}>
          <CheckCircleFilled style={{ marginRight: 6 }} />
          Auto-Match Active
        </Text>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 36, background: token.colorFillAlter }} />
              {SAMPLE_COLUMNS.map((col) => (
                <th
                  key={col.letter}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderLeft: `1px solid ${token.colorBorderSecondary}`,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{col.letter}</span>
                  <span
                    style={{
                      float: 'right',
                      marginLeft: 12,
                      fontSize: 10,
                      color: token.colorSuccess,
                      fontWeight: 600,
                    }}
                  >
                    ({col.label})
                  </span>
                  <div
                    style={{
                      height: 3,
                      marginTop: 6,
                      borderRadius: 2,
                      background: token.colorSuccessBorder,
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((r) => (
              <tr key={r}>
                <td
                  style={{
                    textAlign: 'center',
                    background: token.colorFillAlter,
                    color: token.colorTextSecondary,
                    fontWeight: 600,
                  }}
                >
                  {r + 1}
                </td>
                {SAMPLE_COLUMNS.map((col) => (
                  <td
                    key={col.letter}
                    style={{
                      padding: '8px 12px',
                      borderLeft: `1px solid ${token.colorBorderSecondary}`,
                      borderTop: `1px solid ${token.colorBorderSecondary}`,
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
          padding: '8px 16px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" italic style={{ fontSize: 12 }}>
          * Baris pertama = judul kolom. Judul yang mendekati nama kolom di atas dicocokkan otomatis,
          dan bisa diatur ulang di langkah berikutnya.
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
            label: `${columnLetter(i)} — ${h || '(tanpa judul)'}`,
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

  const footer =
    step === 0 ? (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleClose}>Batal</Button>
        {pickFileButton}
      </div>
    ) : step === 1 ? (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setStep(0)}>Ganti File</Button>
        <Button type="primary" disabled={missingRequired.length > 0} onClick={() => setStep(2)}>
          Lanjut ke Review
        </Button>
      </div>
    ) : step === 2 ? (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={() => setStep(1)} disabled={submitting}>
          Kembali
        </Button>
        <Button
          type="primary"
          loading={submitting}
          disabled={validRows.length === 0}
          onClick={() => void handleImport()}
        >
          Impor {validRows.length} Siswa
        </Button>
      </div>
    ) : (
      <Button type="primary" onClick={handleClose}>
        Selesai
      </Button>
    )

  return (
    <AppModal
      title="Impor Data Siswa"
      subtitle="Unggah data siswa secara masal dari file Excel atau CSV. Sistem akan memvalidasi data secara otomatis."
      icon={<ImportOutlined />}
      open={open}
      onCancel={handleClose}
      width={960}
      footer={footer}
      destroyOnHidden
    >
      <Steps
        size="small"
        current={step}
        style={{ margin: '8px 0 24px' }}
        items={[
          { title: 'Upload', description: 'Pilih file' },
          { title: 'Mapping', description: 'Atur kolom' },
          { title: 'Review', description: 'Validasi' },
          { title: 'Hasil', description: 'Selesai' },
        ]}
      />

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
              <Upload.Dragger
                accept=".csv,.xlsx,.xls"
                showUploadList={false}
                multiple={false}
                disabled={reading}
                beforeUpload={(file) => {
                  void handleFile(file)
                  return false
                }}
                style={{ background: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text" style={{ fontWeight: 600, letterSpacing: 0.3 }}>
                  DRAG &amp; DROP ATAU KLIK UNTUK PILIH FILE
                </p>
                <p className="ant-upload-hint">Mendukung .csv dan .xlsx</p>
              </Upload.Dragger>
            </Spin>
          ) : (
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                {iconBox(<GlobalOutlined />, 36)}
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
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message="Sheet harus publik"
                description={'Di Google Sheets: Bagikan → Akses umum → pilih "Siapa saja yang memiliki link" (Pelihat). Secara default sheet pertama yang dibaca; untuk tab tertentu, salin tautan saat berada di tab tersebut (URL akan menyertakan #gid=…).'}
              />
            </div>
          )}

          <div
            style={{
              ...card,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {iconBox(<FileExcelOutlined />, 36)}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4 }}>DATA REFERENSI</div>
                <Text style={{ color: token.colorPrimary, fontSize: 13, fontWeight: 600 }}>
                  Siswa, Kelas &amp; Asrama
                </Text>
              </div>
              <Popover trigger="click" placement="bottomLeft" content={referenceContent}>
                <Button>
                  Daftar kelas valid <Tag color="processing" style={{ margin: '0 4px 0 6px' }}>{classes.length}</Tag>
                  <DownOutlined />
                </Button>
              </Popover>
            </div>
            <ConfigProvider theme={{ token: { colorPrimary: token.colorSuccess } }}>
              <Button type="primary" icon={<DownloadOutlined />} onClick={downloadTemplate}>
                Unduh Template Excel
              </Button>
            </ConfigProvider>
          </div>

          <Collapse
            ghost
            items={[
              {
                key: 'sample',
                label: 'Contoh struktur kolom Excel & tips pengisian',
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {columnStructure}
                    <Alert
                      type="info"
                      showIcon
                      message="Tips Excel"
                      description="Paling aman pakai tombol Unduh Template Excel di atas — kolom angkanya sudah berformat Teks. Isi file sendiri? Atur kolom NISN, NIS, NIK, dan nomor telepon ke format Teks supaya angka 0 di depan tidak hilang dan angka panjang tidak berubah menjadi notasi ilmiah."
                    />
                  </Space>
                ),
              },
            ]}
          />
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type={missingRequired.length > 0 ? 'warning' : 'success'}
            showIcon
            message={`File "${fileName}" — ${fileRows.length} baris data, ${mappedCount} dari ${FIELDS.length} kolom terpetakan`}
            description={
              missingRequired.length > 0
                ? `Belum dipetakan: ${missingRequired.join(', ')}`
                : 'Semua kolom wajib sudah terpetakan. Periksa kolom lain jika perlu, lalu lanjut ke Review.'
            }
          />
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
            <Alert
              type="warning"
              showIcon
              message="Perbaiki baris yang gagal lalu impor ulang dengan kode registrasi yang sama."
            />
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
    </AppModal>
  )
}
