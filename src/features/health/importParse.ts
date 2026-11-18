import { MEDICINE_UNIT_VALUES } from './constants'
import type { HealthStatus } from './types'

/**
 * Parsing murni (tanpa efek samping) untuk impor kesehatan Excel/CSV:
 * 1) log kunjungan (parseLogTable)  2) stok obat (parseMedicineTable).
 * Dipakai ImportModal / MedicineModal dan diuji di importParse.test.ts.
 */

export type ImportRowStatus = 'siap' | 'duplikat' | 'error' | 'tak_dikenal'

export interface RosterEntry {
  id: string
  name: string
  registration_code: string
  class_name: string | null
}

export interface MedicineEntry {
  id: string
  name: string
  unit: string
}

export interface ParseContext {
  /** Tanggal hari ini (YYYY-MM-DD) — tanggal masa depan ditolak */
  today: string
  roster: RosterEntry[]
  medicines: MedicineEntry[]
  /** Kunci duplikat yang sudah ada di DB — format `${student_id}|${date}|${time}|${complaint}` */
  existingKeys?: Set<string>
}

export interface ParsedLogRow {
  row: number
  identifier: string
  studentId: string | null
  studentName: string | null
  className: string | null
  matchBy: 'kode' | 'nama' | null
  date: string
  time: string
  complaint: string
  diagnosis: string
  treatment: string
  medicineId: string | null
  medicineName: string | null
  medicineQty: number
  status: HealthStatus
  rowStatus: ImportRowStatus
  error?: string
}

export interface ParsedMedicineRow {
  row: number
  name: string
  category: string
  stock: number
  unit: string
  minStock: number
  description: string
  /** id obat existing (nama cocok, case-insensitive) — null = insert baru */
  existingId: string | null
  rowStatus: 'baru' | 'perbarui' | 'error'
  error?: string
}

export function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// ------------------------------------------------------------
// Parser nilai tanggal / jam / status
// ------------------------------------------------------------

/** Terima YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY → { date } | { error } */
export function parseDateValue(raw: string, today: string): { date: string } | { error: string } {
  const v = raw.trim()
  if (!v) return { error: 'Tanggal kosong' }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(v)

  let y: number, m: number, d: number
  if (iso) {
    y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3])
  } else if (dmy) {
    d = Number(dmy[1]); m = Number(dmy[2]); y = Number(dmy[3])
  } else {
    return { error: `Format tanggal tidak dikenal: "${raw}"` }
  }

  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { error: `Tanggal tidak valid: "${raw}"` }
  }
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (date > today) return { error: `Tanggal ${date} di masa depan (hari ini ${today})` }
  return { date }
}

/** Terima HH:mm, HH.mm, HHmm → { time: 'HH:mm' }; kosong → default 08:00. */
export function parseTimeValue(raw: string): { time: string } | { error: string } {
  const v = raw.trim()
  if (!v) return { time: '08:00' }

  let h: string, min: string
  const hm = /^(\d{1,2})[:.](\d{1,2})$/.exec(v)
  const compact = /^(\d{2})(\d{2})$/.exec(v)
  if (hm) {
    h = hm[1]; min = hm[2]
  } else if (compact) {
    h = compact[1]; min = compact[2]
  } else {
    return { error: `Format jam tidak dikenal: "${raw}" (contoh: 08:30)` }
  }
  if (Number(h) > 23 || Number(min) > 59) {
    return { error: `Jam tidak valid: "${raw}"` }
  }
  return { time: `${h.padStart(2, '0')}:${min}` }
}

const STATUS_ALIASES: [RegExp, HealthStatus][] = [
  [/^(uks|rawat( uks)?|perawatan)$/i, 'UKS'],
  [/^(asrama|dorm(itory)?|rest( asrama)?|istirahat)$/i, 'Dormitory'],
  [/^(kembali|returned|sembuh|pulih|kbm|kelas)$/i, 'Returned'],
]

/** Kosong → default 'Returned'; teks tak dikenal → null (baris error). */
export function normalizeStatusInput(raw: string): HealthStatus | null | '' {
  const v = raw.trim()
  if (!v || v === '-') return ''
  for (const [re, status] of STATUS_ALIASES) {
    if (re.test(v)) return status
  }
  return null
}

export function parseQtyValue(raw: string): { qty: number } | { error: string } {
  const v = raw.trim()
  if (!v) return { qty: 0 }
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) return { error: `Jumlah tidak valid: "${raw}"` }
  return { qty: n }
}

// ------------------------------------------------------------
// Definisi kolom impor rekam medis (pola students/importParse.ts)
// ------------------------------------------------------------

export const FIELDS = [
  { key: 'kode', label: 'Kode', aliases: ['kode registrasi', 'kode reg', 'registrasi', 'registration', 'nisn', 'code'] },
  { key: 'nama', label: 'Nama', aliases: ['nama santri', 'nama siswa', 'santri', 'siswa', 'pasien', 'name'] },
  { key: 'tanggal', label: 'Tanggal', aliases: ['tgl', 'date', 'tanggal kunjungan'] },
  { key: 'jam', label: 'Jam', aliases: ['waktu', 'time', 'jam kunjungan'] },
  { key: 'keluhan', label: 'Keluhan', required: true, aliases: ['complaint', 'keluhan pasien'] },
  { key: 'diagnosis', label: 'Diagnosis', aliases: ['diag', 'diagnosa'] },
  { key: 'penanganan', label: 'Penanganan', aliases: ['tindakan', 'treatment'] },
  { key: 'obat', label: 'Obat', aliases: ['medicine', 'obat diberikan'] },
  { key: 'jumlah', label: 'Jumlah', aliases: ['qty', 'jml', 'jumlah obat'] },
  { key: 'status', label: 'Status', aliases: ['observasi', 'status akhir'] },
] as const satisfies readonly {
  key: string
  label: string
  required?: boolean
  aliases: readonly string[]
}[]

export type FieldKey = (typeof FIELDS)[number]['key']
export type Mapping = Partial<Record<FieldKey, number>>

// Keterangan per kolom untuk sheet "Petunjuk" di template Excel
const FIELD_NOTES: Partial<Record<FieldKey, string>> = {
  kode: 'Kode registrasi santri — dicocokkan ke Data Santri. Isi salah satu Kode atau Nama.',
  nama: 'Nama santri — dipakai bila kolom Kode kosong; harus unik di Data Santri.',
  tanggal: 'YYYY-MM-DD atau DD/MM/YYYY. Kosong = hari ini. Tidak boleh tanggal masa depan.',
  jam: 'HH:mm (kosong = 08:00).',
  keluhan: 'Wajib diisi.',
  diagnosis: 'Opsional.',
  penanganan: 'Opsional.',
  obat: 'Nama obat sesuai stok (kosong = tanpa obat). Stok terpotong otomatis saat impor.',
  jumlah: 'Angka bulat ≥ 0 (kosong = 1 bila kolom obat terisi).',
  status: 'UKS, asrama, atau kembali (kosong = kembali KBM).',
}

export const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<FieldKey, string>[] = [
  {
    kode: 'LPM-0001-001',
    nama: 'Ahmad Fulan',
    tanggal: '2026-11-17',
    jam: '08:30',
    keluhan: 'Demam tinggi sejak pagi',
    diagnosis: 'Demam biasa',
    penanganan: 'Kompres + istirahat',
    obat: 'Paracetamol 500mg',
    jumlah: '2',
    status: 'UKS',
  },
  {
    kode: 'LPM-0001-002',
    nama: 'Siti Aminah',
    tanggal: '2026-11-17',
    jam: '09:00',
    keluhan: 'Sakit perut',
    diagnosis: '',
    penanganan: 'Istirahat di asrama',
    obat: 'Paracetamol 500mg',
    jumlah: '1',
    status: 'asrama',
  },
]

const byNaturalOrder = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true })

export function downloadTemplate(refs?: { medicines?: string[] }) {
  // xlsx (bukan CSV) supaya sheet "Petunjuk" ikut terbawa; sheet pertama =
  // data, karena readSheet membaca SheetNames[0]
  void import('xlsx').then((XLSX) => {
    const header: string[] = FIELDS.map((f) => f.label)
    const data = TEMPLATE_ROWS.map((row) => TEMPLATE_COLUMNS.map((col) => row[col]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const textCols = new Set(['kode', 'tanggal', 'jam', 'jumlah'])
    for (let c = 0; c < header.length; c++) {
      if (!textCols.has(TEMPLATE_COLUMNS[c])) continue
      for (let r = 1; r < 500; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) ws[addr] = { t: 's', v: '' }
        ws[addr].z = '@'
      }
    }
    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(34, Math.max(h.length + 2, ...data.map((row) => row[c].length + 2))),
    }))

    // Sheet kedua: petunjuk. JANGAN dipindah ke depan — readSheet membaca sheet pertama.
    const medicines = [...(refs?.medicines ?? [])].sort(byNaturalOrder)
    const guide: string[][] = [
      ['PENTING: hapus 2 baris contoh (Ahmad Fulan & Siti Aminah) di sheet "Log" sebelum mengisi data Anda.'],
      [],
      ['Kolom', 'Wajib', 'Keterangan'],
      ...FIELDS.map((f) => [
        f.label as string,
        'required' in f && f.required ? 'Wajib' : 'Opsional',
        FIELD_NOTES[f.key] ?? '',
      ]),
    ]
    if (medicines.length > 0) {
      guide.push([], ['Obat valid'])
      for (const m of medicines) guide.push([m])
    }
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 80 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Log')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk')
    XLSX.writeFile(wb, 'Template-Impor-RekamMedis.xlsx')
  })
}

// ------------------------------------------------------------
// Pemetaan kolom otomatis
// ------------------------------------------------------------

export function normHeader(value: string) {
  return value
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function autoMatch(headers: string[]): Mapping {
  const normalized = headers.map(normHeader)
  const used = new Set<number>()
  const mapping: Mapping = {}
  for (const field of FIELDS) {
    const names = new Set([field.key, field.label, ...field.aliases].map(normHeader))
    const index = normalized.findIndex((h, i) => !used.has(i) && names.has(h))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }
  return mapping
}

export function columnLetter(index: number) {
  let n = index
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letters
}

export function sampleValues(rows: string[][], index?: number) {
  if (index === undefined) return []
  const values: string[] = []
  for (const row of rows) {
    const v = row[index]?.trim()
    if (v) values.push(v)
    if (values.length === 2) break
  }
  return values
}

// ------------------------------------------------------------
// parseLogTable — impor rekam medis
// ------------------------------------------------------------

interface RosterIndex {
  byCode: Map<string, RosterEntry>
  byName: Map<string, RosterEntry>
}

function buildRosterIndex(roster: RosterEntry[]): RosterIndex {
  const byCode = new Map<string, RosterEntry>()
  const byName = new Map<string, RosterEntry>()
  for (const r of roster) {
    byCode.set(r.registration_code.trim().toLowerCase(), r)
    byName.set(normName(r.name), r)
  }
  return { byCode, byName }
}

/**
 * Parse tabel rekam medis (baris pertama = header, hasil autoMatch pemetaan user).
 * Aturan error dipertahankan persis: identitas → keluhan → tanggal → jam →
 * duplikat → obat → jumlah → status.
 */
export function parseLogTable(
  table: string[][],
  mapping: Mapping,
  ctx: ParseContext,
): { rows: ParsedLogRow[]; skippedRows: number } {
  if (table.length < 1) throw new Error('File kosong')

  if (mapping.kode === undefined && mapping.nama === undefined) {
    throw new Error('Kolom identifikasi (kode registrasi / nama santri) tidak ditemukan. Unduh template untuk contoh.')
  }
  if (mapping.keluhan === undefined) {
    throw new Error('Kolom "keluhan" tidak ditemukan. Unduh template untuk contoh.')
  }

  const get = (cells: string[], field: FieldKey): string => {
    const idx = mapping[field]
    return idx === undefined ? '' : (cells[idx] ?? '').trim()
  }

  const index = buildRosterIndex(ctx.roster)
  const medicineByName = new Map(ctx.medicines.map((m) => [normName(m.name), m]))
  const batchSeen = new Set<string>()
  const rows: ParsedLogRow[] = []
  let skippedRows = 0

  for (let i = 1; i < table.length; i++) {
    const cells = table[i]
    const isEmpty = cells.every((c) => !c || !String(c).trim())
    if (isEmpty) {
      skippedRows++
      continue
    }

    const kode = get(cells, 'kode')
    const nama = get(cells, 'nama')
    const base: ParsedLogRow = {
      row: i,
      identifier: [kode, nama].filter(Boolean).join(' · ') || '(tanpa identitas)',
      studentId: null,
      studentName: null,
      className: null,
      matchBy: null,
      date: '',
      time: '08:00',
      complaint: '',
      diagnosis: '',
      treatment: '',
      medicineId: null,
      medicineName: null,
      medicineQty: 0,
      status: 'Returned',
      rowStatus: 'siap',
    }

    // --- identitas santri: kode → nama ---
    let match: RosterEntry | undefined
    let matchBy: 'kode' | 'nama' | null = null
    if (kode) {
      match = index.byCode.get(kode.toLowerCase())
      matchBy = match ? 'kode' : null
    }
    if (!match && nama) {
      match = index.byName.get(normName(nama))
      matchBy = match ? 'nama' : null
    }
    if (!match) {
      const reason = kode
        ? `Kode "${kode}" tidak ditemukan`
        : nama
          ? `Nama "${nama}" tidak ditemukan`
          : 'Baris tidak memiliki identitas santri'
      rows.push({ ...base, rowStatus: 'tak_dikenal', error: reason })
      continue
    }

    const matched: ParsedLogRow = {
      ...base,
      studentId: match.id,
      studentName: match.name,
      className: match.class_name,
      matchBy,
    }

    // --- keluhan wajib ---
    const complaint = get(cells, 'keluhan')
    if (!complaint) {
      rows.push({ ...matched, rowStatus: 'error', error: 'Keluhan wajib diisi' })
      continue
    }
    matched.complaint = complaint
    matched.diagnosis = get(cells, 'diagnosis')
    matched.treatment = get(cells, 'penanganan')

    // --- tanggal & jam ---
    // Tanggal kosong → default hari ini (impor cepat kunjungan harian).
    const dateRaw = get(cells, 'tanggal')
    if (!dateRaw) {
      matched.date = ctx.today
    } else {
      const parsedDate = parseDateValue(dateRaw, ctx.today)
      if ('error' in parsedDate) {
        rows.push({ ...matched, rowStatus: 'error', error: parsedDate.error })
        continue
      }
      matched.date = parsedDate.date
    }

    const parsedTime = parseTimeValue(get(cells, 'jam'))
    if ('error' in parsedTime) {
      rows.push({ ...matched, rowStatus: 'error', error: parsedTime.error })
      continue
    }
    matched.time = parsedTime.time

    // --- duplikat: DB dan dalam-file (santri + tanggal + jam + keluhan) ---
    const dupKey = `${match.id}|${matched.date}|${matched.time}|${complaint.toLowerCase()}`
    if (ctx.existingKeys?.has(dupKey) || batchSeen.has(dupKey)) {
      rows.push({ ...matched, rowStatus: 'duplikat', error: 'Kunjungan santri pada tanggal & jam ini sudah ada' })
      continue
    }
    batchSeen.add(dupKey)

    // --- obat opsional: cocokkan nama → id; jumlah default 1 ---
    const obatRaw = get(cells, 'obat')
    if (obatRaw) {
      const med = medicineByName.get(normName(obatRaw))
      if (!med) {
        rows.push({ ...matched, rowStatus: 'error', error: `Obat "${obatRaw}" tidak ada di stok — kosongkan kolom obat jika tanpa obat` })
        continue
      }
      const parsedQty = parseQtyValue(get(cells, 'jumlah'))
      if ('error' in parsedQty) {
        rows.push({ ...matched, rowStatus: 'error', error: parsedQty.error })
        continue
      }
      const qty = parsedQty.qty > 0 ? parsedQty.qty : 1
      matched.medicineId = med.id
      matched.medicineName = obatRaw
      matched.medicineQty = qty
    }

    // --- status opsional: default Returned ---
    const statusRaw = get(cells, 'status')
    const statusNorm = normalizeStatusInput(statusRaw)
    if (statusNorm === null) {
      rows.push({ ...matched, rowStatus: 'error', error: `Status tidak dikenal: "${statusRaw}"` })
      continue
    }
    if (statusNorm !== '') matched.status = statusNorm

    rows.push(matched)
  }

  return { rows, skippedRows }
}

// ------------------------------------------------------------
// parseMedicineTable — impor / sinkron stok obat
// ------------------------------------------------------------

interface MedicineColumnMap {
  nama: number
  kategori: number
  stok: number
  satuan: number
  min: number
  keterangan: number
}

function mapMedicineColumns(headers: string[]): MedicineColumnMap {
  const norm = headers.map(normalizeHeader)
  const find = (...preds: ((h: string) => boolean)[]) => {
    for (const pred of preds) {
      const i = norm.findIndex(pred)
      if (i >= 0) return i
    }
    return -1
  }
  const is = (...names: string[]) => (h: string) => names.includes(h)
  const has = (...names: string[]) => (h: string) => names.some((n) => h.includes(n))
  return {
    nama: find(is('nama', 'namaobat', 'name', 'obat'), has('nama'), has('name')),
    kategori: find(is('kategori', 'category'), has('kategori'), has('category')),
    stok: find(is('stok', 'stock', 'qty'), has('stok'), has('stock')),
    satuan: find(is('satuan', 'unit'), has('satuan'), has('unit')),
    min: find(is('min', 'minstock', 'minimum'), h => h.startsWith('min'), has('minimum')),
    keterangan: find(is('keterangan', 'description', 'indikasi'), has('keterangan'), has('indikasi'), has('description')),
  }
}

export function parseMedicineTable(table: string[][], existing: { id: string; name: string }[]): { rows: ParsedMedicineRow[]; skippedRows: number } {
  if (table.length < 1) throw new Error('File kosong')

  const headers = table[0]
  const cols = mapMedicineColumns(headers)
  if (cols.nama === -1) {
    throw new Error('Kolom "nama" obat tidak ditemukan. Unduh template untuk contoh.')
  }
  if (cols.stok === -1) {
    throw new Error('Kolom "stok" tidak ditemukan. Unduh template untuk contoh.')
  }

  const existingByName = new Map(existing.map((m) => [normName(m.name), m.id]))
  const batchSeen = new Set<string>()
  const rows: ParsedMedicineRow[] = []
  let skippedRows = 0

  for (let i = 1; i < table.length; i++) {
    const cells = table[i]
    const isEmpty = cells.every((c) => !c || !String(c).trim())
    if (isEmpty) {
      skippedRows++
      continue
    }

    const name = (cols.nama >= 0 ? cells[cols.nama] ?? '' : '').trim()
    if (!name) {
      rows.push({
        row: i, name: '', category: '', stock: 0, unit: 'tablet', minStock: 15, description: '',
        existingId: null, rowStatus: 'error', error: 'Nama obat wajib diisi',
      })
      continue
    }

    const stockParsed = Number((cols.stok >= 0 ? cells[cols.stok] ?? '' : '').trim())
    if (!Number.isInteger(stockParsed) || stockParsed < 0) {
      rows.push({
        row: i, name, category: '', stock: 0, unit: 'tablet', minStock: 15, description: '',
        existingId: null, rowStatus: 'error', error: `Stok tidak valid: "${cells[cols.stok]}" (angka bulat ≥ 0)`,
      })
      continue
    }

    const unitRaw = (cols.satuan >= 0 ? cells[cols.satuan] ?? '' : '').trim().toLowerCase()
    if (unitRaw && !MEDICINE_UNIT_VALUES.includes(unitRaw)) {
      rows.push({
        row: i, name, category: '', stock: stockParsed, unit: unitRaw, minStock: 15, description: '',
        existingId: null, rowStatus: 'error', error: `Satuan "${unitRaw}" tidak dikenal (pilih: ${MEDICINE_UNIT_VALUES.join(', ')})`,
      })
      continue
    }

    const minRaw = (cols.min >= 0 ? cells[cols.min] ?? '' : '').trim()
    const minStock = minRaw ? Number(minRaw) : 15
    if (!Number.isInteger(minStock) || minStock < 0) {
      rows.push({
        row: i, name, category: '', stock: stockParsed, unit: unitRaw || 'tablet', minStock: 15, description: '',
        existingId: null, rowStatus: 'error', error: `Stok minimum tidak valid: "${minRaw}"`,
      })
      continue
    }

    const dupKey = normName(name)
    if (batchSeen.has(dupKey)) {
      rows.push({
        row: i, name, category: '', stock: stockParsed, unit: unitRaw || 'tablet', minStock, description: '',
        existingId: existingByName.get(dupKey) ?? null, rowStatus: 'error', error: `Nama "${name}" muncul lebih dari sekali di file`,
      })
      continue
    }
    batchSeen.add(dupKey)

    const existingId = existingByName.get(dupKey) ?? null
    rows.push({
      row: i,
      name,
      category: cols.kategori >= 0 ? (cells[cols.kategori] ?? '').trim() : '',
      stock: stockParsed,
      unit: unitRaw || 'tablet',
      minStock,
      description: cols.keterangan >= 0 ? (cells[cols.keterangan] ?? '').trim() : '',
      existingId,
      rowStatus: existingId ? 'perbarui' : 'baru',
    })
  }

  return { rows, skippedRows }
}

// ------------------------------------------------------------
// Ilustrasi struktur kolom (langkah Upload, impor rekam medis)
// ------------------------------------------------------------

// Kolom inti yang ditampilkan di contoh modal. Semua kolom wajib HARUS ada di sini
// (dijaga oleh test importParse).
const SAMPLE_KEYS: FieldKey[] = ['kode', 'nama', 'tanggal', 'jam', 'keluhan', 'obat', 'status']
const REQUIRED_KEYS = new Set<string>(
  FIELDS.filter((f) => 'required' in f && f.required).map((f) => f.key),
)

// Diturunkan dari FIELDS + TEMPLATE_ROWS supaya selalu sama dengan template
export const SAMPLE_COLUMNS = SAMPLE_KEYS.map((key) => ({
  key,
  label: FIELDS.find((f) => f.key === key)?.label ?? (key as string), // sama persis dengan header template
  required: REQUIRED_KEYS.has(key),
  values: TEMPLATE_ROWS.map((row) => row[key]),
}))
