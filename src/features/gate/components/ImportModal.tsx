import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  App,
  Button,
  Collapse,
  Input,
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
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { WizardModal } from '../../../shared/components/WizardModal'
import { IconBox } from '../../../shared/components/IconBox'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { ModalSection } from '../../../shared/components/ModalSection'
import { UploadDropzone } from '../../../shared/components/UploadDropzone'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { useCreateGateLogsBulk, useGateStudentIndex } from '../hooks'
import type { GateDirection, GateLogInsertRow, GateStudentLite } from '../types'

const { Text } = Typography

// Parsing waktu multi-format butuh plugin customParseFormat (idempoten)
dayjs.extend(customParseFormat)

// ---------------------------------------------------------------------------
// Definisi kolom impor log gerbang.
// Artefak template/mapping diletakkan di file ini (fitur ini tidak punya
// importParse.ts sendiri) — aturan validasi baris tidak berubah.
// ---------------------------------------------------------------------------

const FIELDS = [
  { key: 'kode', label: 'Kode Registrasi', required: true, aliases: ['nisn', 'code', 'registrasi'] },
  { key: 'arah', label: 'Arah', required: true, aliases: ['direction', 'gerbang'] },
  { key: 'waktu', label: 'Waktu', aliases: ['jam', 'tanggal', 'occurred', 'time', 'date'] },
  { key: 'catatan', label: 'Catatan', aliases: ['note', 'keterangan'] },
] as const satisfies readonly {
  key: string
  label: string
  required?: boolean
  aliases: readonly string[]
}[]

type FieldKey = (typeof FIELDS)[number]['key']
type Mapping = Partial<Record<FieldKey, number>>

// Keterangan per kolom untuk sheet "Petunjuk" di template Excel
const FIELD_NOTES: Partial<Record<FieldKey, string>> = {
  kode: 'Wajib. Kode registrasi santri atau NISN, dicocokkan ke Santri.',
  arah: 'Wajib. masuk / keluar (alias: entry, exit, in, out, m, k, pulang, pergi).',
  waktu: 'Opsional. YYYY-MM-DD HH:mm atau DD/MM/YYYY HH:mm. Kosong = waktu impor. Tidak boleh lebih dari 5 menit ke depan.',
  catatan: 'Opsional. Keterangan tambahan (mis. pulang izin).',
}

const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<FieldKey, string>[] = [
  { kode: 'SIS-2025-0001', arah: 'masuk', waktu: '2026-01-05 07:15', catatan: '' },
  { kode: 'SIS-2025-0002', arah: 'keluar', waktu: '2026-01-05 16:30', catatan: 'Pulang izin' },
]

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

  // Cocokkan persis: key, label, alias
  for (const field of FIELDS) {
    const names = new Set([field.key, field.label, ...field.aliases].map(normHeader))
    const index = normalized.findIndex((h, i) => !used.has(i) && names.has(h))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }

  // Fallback fuzzy — pemetaan lama gate (header mengandung kata kunci)
  const fuzzy: Record<FieldKey, (h: string) => boolean> = {
    kode: (h) => h.includes('kode') || h.includes('registrasi') || h === 'code' || h.includes('nisn'),
    arah: (h) => h.includes('arah') || h.includes('direction') || h.includes('gerbang'),
    waktu: (h) =>
      h.includes('waktu') ||
      h.includes('jam') ||
      h.includes('tanggal') ||
      h.includes('occurred') ||
      h === 'time' ||
      h === 'date',
    catatan: (h) => h.includes('catatan') || h.includes('note') || h.includes('keterangan'),
  }
  for (const field of FIELDS) {
    if (mapping[field.key] !== undefined) continue
    const index = normalized.findIndex((h, i) => !used.has(i) && fuzzy[field.key](h))
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

// Kolom inti yang ditampilkan di contoh modal — semua kolom template ikut tampil
const SAMPLE_KEYS: FieldKey[] = ['kode', 'arah', 'waktu', 'catatan']
const REQUIRED_KEYS = new Set<string>(FIELDS.filter((f) => 'required' in f && f.required).map((f) => f.key))

const SAMPLE_COLUMNS = SAMPLE_KEYS.map((key) => ({
  key,
  label: FIELDS.find((f) => f.key === key)?.label ?? (key as string),
  required: REQUIRED_KEYS.has(key),
  values: TEMPLATE_ROWS.map((row) => row[key]),
}))

function downloadTemplate() {
  // xlsx (bukan CSV) supaya sheet "Petunjuk" ikut terbawa; sheet pertama =
  // data, karena reader membaca SheetNames[0]
  void import('xlsx').then((XLSX) => {
    const header: string[] = FIELDS.map((f) => f.label)
    const data = TEMPLATE_ROWS.map((row) => TEMPLATE_COLUMNS.map((col) => row[col]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    // Kunci kolom kode & waktu sebagai teks agar 0 di depan tidak hilang
    for (const c of [0, 2]) {
      for (let r = 1; r <= TEMPLATE_ROWS.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) ws[addr] = { t: 's', v: '' }
        ws[addr].z = '@'
      }
    }
    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(34, Math.max(h.length + 2, ...data.map((row) => row[c].length + 2))),
    }))

    // Sheet kedua: petunjuk. JANGAN dipindah ke depan — reader membaca sheet pertama.
    const guide: string[][] = [
      ['PENTING: hapus 2 baris contoh (SIS-2025-0001 & SIS-2025-0002) di sheet "Log Gerbang" sebelum mengisi data Anda.'],
      ['Log gerbang hanya ditambahkan (tabel immutable) — pastikan data belum pernah tercatat.'],
      [],
      ['Kolom', 'Wajib', 'Keterangan'],
      ...FIELDS.map((f) => [
        f.label as string,
        'required' in f && f.required ? 'Wajib' : 'Opsional',
        FIELD_NOTES[f.key] ?? '',
      ]),
    ]
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 90 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Log Gerbang')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk')
    XLSX.writeFile(wb, 'Template-Impor-LogGerbang.xlsx')
  })
}

// ---------------------------------------------------------------------------
// Reader file — dipertahankan: sel Date dirender dengan jam agar kolom waktu
// tidak kehilangan presisi (readFileRows shared hanya memformat tanggal)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Parser baris — aturan validasi dipertahankan persis dari versi lama:
// kode → siswa → arah → waktu → duplikat dalam batch
// ---------------------------------------------------------------------------

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

interface ParseContext {
  byCode: Map<string, GateStudentLite>
  byNisn: Map<string, GateStudentLite>
}

function parseGateTable(table: string[][], mapping: Mapping, ctx: ParseContext): ParsedGateRow[] {
  if (table.length < 1) throw new Error('File kosong')
  if (mapping.kode === undefined) {
    throw new Error('Kolom "kode_registrasi" tidak ditemukan dalam file')
  }
  if (mapping.arah === undefined) {
    throw new Error('Kolom "arah" tidak ditemukan dalam file')
  }

  const get = (cells: string[], field: FieldKey): string => {
    const idx = mapping[field]
    return idx === undefined ? '' : (cells[idx] ?? '').trim()
  }

  const rows: ParsedGateRow[] = []
  const batchSeenKeys = new Set<string>()

  for (let i = 1; i < table.length; i++) {
    const row = table[i]
    if (row.every((cell) => !cell || cell.trim() === '')) continue

    const rawKode = get(row, 'kode')
    const rawArah = get(row, 'arah')
    const rawWaktu = get(row, 'waktu')
    const rawCatatan = get(row, 'catatan')

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
      student = ctx.byCode.get(kodeNorm) ?? ctx.byCode.get(kodeNorm.toUpperCase()) ?? ctx.byNisn.get(kodeNorm)
      if (!student) {
        status = 'error'
        errorMessage = 'Santri tidak ditemukan'
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

  return rows
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
const ERROR_CSV_HEADERS = ['kode_registrasi', 'arah', 'waktu', 'catatan', 'alasan_error']

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

interface ImportModalProps {
  open: boolean
  onClose: () => void
  /** sumber data aktif saat modal dibuka (default: upload file) */
  initialSource?: 'file' | 'gsheets'
}

interface GateImportResult {
  successful: number
  failed: number
}

/** Impor log gerbang — pola WizardModal students: Upload → Mapping → Review → Hasil. */
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
  const [mapping, setMapping] = useState<Mapping>({})
  const [autoKeys, setAutoKeys] = useState<Set<FieldKey>>(new Set())
  const [reviewFilter, setReviewFilter] = useState<'all' | RowStatus>('all')
  const [results, setResults] = useState<GateImportResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)

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
  const indexPending = indexQuery.isPending

  // buka langsung pada sumber yang diminta — pola penyesuaian state saat render
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSheetSource(initialSource)
  }

  // Pemetaan kolom → parser murni (error ditangkap; langkah Review selalu
  // sudah memenuhi kolom wajib sehingga parse tidak melempar di sana)
  const parsed = useMemo<{ rows: ParsedGateRow[] }>(() => {
    if (fileRows.length === 0) return { rows: [] }
    try {
      return { rows: parseGateTable([headers, ...fileRows], mapping, studentIndex) }
    } catch {
      return { rows: [] }
    }
  }, [headers, fileRows, mapping, studentIndex])

  const rows = parsed.rows
  const readyRows = useMemo(() => rows.filter((r) => r.status === 'siap'), [rows])
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
    mapping.kode === undefined && 'Kode Registrasi',
    mapping.arah === undefined && 'Arah',
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
    setResults(null)
    setSubmitting(false)
    setImportProgress(null)
  }

  const handleClose = () => {
    if (importMutation.isPending) return
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
    if (body.length > 5000) {
      message.error('Maksimal 5.000 baris data per impor')
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

  const handleDownloadErrorCsv = () => {
    const errorRows = rows.filter((r) => r.status === 'error')
    if (errorRows.length === 0) return
    const csv = Papa.unparse({
      fields: ERROR_CSV_HEADERS,
      data: errorRows.map((r) => [r.raw_kode, r.raw_arah, r.raw_waktu, r.raw_catatan, r.error_message ?? '']),
    })
    downloadCsv(`baris-error-${fileName || 'log-gerbang'}.csv`, csv)
  }

  const handleImport = async () => {
    if (readyRows.length === 0) {
      message.warning('Tidak ada baris berstatus Siap yang bisa diimpor')
      return
    }
    setSubmitting(true)
    const payloads: GateLogInsertRow[] = readyRows.map((r) => ({
      student_id: r.student!.id,
      direction: r.direction!,
      occurred_at: r.occurred_at!,
      note: r.raw_catatan || null,
    }))
    try {
      setImportProgress({ done: 0, total: payloads.length })
      const res = await importMutation.mutateAsync({
        rows: payloads,
        onProgress: (processed, total) => setImportProgress({ done: processed, total }),
      })
      setResults({ successful: res.ok, failed: res.failed })
      setStep(3)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan log ke server')
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

  const mappingColumns = [
    {
      title: 'Data Log Gerbang',
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
          status={'required' in f && f.required && mapping[f.key] === undefined ? 'error' : undefined}
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

  const previewColumns: TableColumnsType<ParsedGateRow> = [
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
      title: 'Santri',
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
      disabled={reading || indexPending}
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
          okDisabled={missingRequired.length > 0 || indexPending}
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
          okText={`Impor ${readyRows.length} Log`}
          okLoading={submitting}
          okDisabled={readyRows.length === 0}
        />
      )
    }
    return <ModalFooter onOk={handleClose} okText="Selesai" />
  }

  return (
    <WizardModal
      title="Impor Log Gerbang"
      subtitle="Unggah log keluar-masuk dari file Excel, CSV, atau Google Sheets. Santri & arah dicocokkan otomatis."
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
                disabled={reading || indexPending}
                icon={<FileAddOutlined />}
                title={indexPending ? 'Menyiapkan data siswa…' : 'Klik atau seret file ke sini'}
                hint="Mendukung .csv dan .xlsx, maks 5.000 baris / 2 MB"
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
            desc="Kode registrasi & NISN siswa"
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
                          Kolom wajib: Kode Registrasi (atau NISN) dan Arah (masuk/keluar). Waktu opsional,
                          kosong berarti dicatat pada waktu impor.
                        </li>
                        <li>
                          Log hanya ditambahkan (tabel log gerbang bersifat immutable) — pastikan data belum
                          pernah tercatat.
                        </li>
                        <li>
                          Waktu format YYYY-MM-DD HH:mm atau DD/MM/YYYY HH:mm dan tidak boleh lebih dari 5
                          menit ke depan.
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
            tone={missingRequired.length > 0 || indexPending ? 'warning' : 'success'}
            title={`File "${fileName}": ${fileRows.length} baris data, ${mappedCount} dari ${FIELDS.length} kolom terpetakan`}
          >
            {indexPending
              ? 'Menyiapkan data siswa…'
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
            {statCard('Total baris', counts.total)}
            {statCard('Siap impor', readyRows.length, token.colorSuccess)}
            {statCard('Duplikat (dilewati)', counts.duplikat, counts.duplikat > 0 ? token.colorWarning : undefined)}
            {statCard('Bermasalah (dilewati)', counts.error, counts.error > 0 ? token.colorError : undefined)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Segmented
              value={reviewFilter}
              onChange={(v) => setReviewFilter(v as 'all' | RowStatus)}
              options={[
                { label: `Semua (${counts.total})`, value: 'all' },
                { label: `Siap (${readyRows.length})`, value: 'siap' },
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
          <Table<ParsedGateRow>
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
            {statCard('Gagal', results.failed, results.failed > 0 ? token.colorError : undefined)}
          </div>
          {results.failed > 0 && (
            <ModalNotice tone="warning" title="Baris gagal disimpan">
              Biasanya karena koneksi terputus di tengah proses. Perbaiki baris di file, lalu impor ulang:
              baris yang sudah masuk tidak akan tergandakan otomatis, jadi sertakan hanya baris yang belum
              tercatat.
            </ModalNotice>
          )}
        </Space>
      )}
    </WizardModal>
  )
}
