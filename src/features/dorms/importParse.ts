import type {
  DormGender,
  DormImportContext,
  DormParseResult,
  DormStatus,
  ParsedDormRow,
} from './types'

/**
 * Parser pure untuk impor kamar asrama — tanpa efek samping agar mudah dites.
 * Pola sama dengan students/importParse.ts: FIELDS + autoMatch (pemetaan kolom
 * oleh user di langkah Mapping) + template Excel dua sheet. Aturan error baris
 * WAJIB dipertahankan persis: nama kosong → gender → kapasitas → status →
 * duplikat dalam file → duplikat di database → musyrif (peringatan, bukan error).
 */

/** Alias gender yang diterima (case-insensitive) */
const GENDER_ALIASES: Record<string, DormGender> = {
  putra: 'male',
  male: 'male',
  l: 'male',
  m: 'male',
  putri: 'female',
  female: 'female',
  p: 'female',
  f: 'female',
  campur: 'mixed',
  mixed: 'mixed',
  mix: 'mixed',
}

/** Alias status yang diterima (case-insensitive) */
const STATUS_ALIASES: Record<string, DormStatus> = {
  aktif: 'active',
  active: 'active',
  penuh: 'full',
  full: 'full',
  nonaktif: 'inactive',
  inactive: 'inactive',
  inaktif: 'inactive',
  nonactive: 'inactive',
}

// ---------------------------------------------------------------------------
// Definisi kolom
// ---------------------------------------------------------------------------

export const FIELDS = [
  { key: 'name', label: 'Nama', required: true, aliases: ['kamar', 'nama kamar', 'name', 'nama ruang', 'room'] },
  { key: 'gender', label: 'Gender', aliases: ['kelamin', 'jk', 'jenis kelamin'] },
  { key: 'capacity', label: 'Kapasitas', required: true, aliases: ['kuota', 'capacity', 'kapasitas kamar'] },
  { key: 'musyrif', label: 'Musyrif', aliases: ['nama musyrif', 'pembina', 'pengasuh', 'ustadz', 'ustadzah'] },
  { key: 'status', label: 'Status', aliases: ['status kamar'] },
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
  name: 'Wajib diisi & unik. Kamar dengan nama yang sudah ada di database akan dilewati.',
  gender: 'Putra, Putri, atau Campur. Kosong = tidak ditentukan.',
  capacity: 'Wajib. Angka bulat 1–100.',
  musyrif:
    'Nama musyrif persis seperti di Data Guru (boleh kosong; tidak ditemukan → kolom dikosongkan dengan peringatan).',
  status: 'Aktif, Penuh, atau Nonaktif. Kosong = Aktif.',
}

// ---------------------------------------------------------------------------
// Template & unduhan
// ---------------------------------------------------------------------------

export const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<FieldKey, string>[] = [
  { name: 'Melati A1', gender: 'Putra', capacity: '12', musyrif: 'Ustadz Ahmad', status: 'Aktif' },
  { name: 'Anggrek B2', gender: 'Putri', capacity: '10', musyrif: 'Ustadzah Fatimah', status: 'Penuh' },
]

const byNaturalOrder = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true })

export function downloadTemplate(refs?: { teachers?: string[] }) {
  // xlsx (bukan CSV) supaya sheet "Petunjuk" ikut terbawa; sheet pertama =
  // data, karena readSheet membaca SheetNames[0]
  void import('xlsx').then((XLSX) => {
    const header: string[] = FIELDS.map((f) => f.label)
    const data = TEMPLATE_ROWS.map((row) => TEMPLATE_COLUMNS.map((col) => row[col]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(34, Math.max(h.length + 2, ...data.map((row) => row[c].length + 2))),
    }))

    // Sheet kedua: petunjuk. JANGAN dipindah ke depan — readSheet membaca sheet pertama.
    const teachers = [...(refs?.teachers ?? [])].sort(byNaturalOrder)
    const guide: string[][] = [
      ['PENTING: hapus 2 baris contoh (Melati A1 & Anggrek B2) di sheet "Kamar" sebelum mengisi data Anda.'],
      [],
      ['Kolom', 'Wajib', 'Keterangan'],
      ...FIELDS.map((f) => [
        f.label as string,
        'required' in f && f.required ? 'Wajib' : 'Opsional',
        FIELD_NOTES[f.key] ?? '',
      ]),
    ]
    if (teachers.length > 0) {
      guide.push([], ['Musyrif valid'])
      for (const t of teachers) guide.push([t])
    }
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 80 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kamar')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk')
    XLSX.writeFile(wb, 'Template-Impor-Kamar.xlsx')
  })
}

// ---------------------------------------------------------------------------
// Pemetaan kolom otomatis
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Parse & validasi baris
// ---------------------------------------------------------------------------

const cell = (row: string[], i: number): string => (row[i] ?? '').trim()

function parseGender(raw: string): { value: DormGender | null } | { error: string } {
  if (!raw) return { value: null }
  const v = GENDER_ALIASES[raw.toLowerCase()]
  return v ? { value: v } : { error: `Gender tidak dikenal: "${raw}"` }
}

function parseCapacity(raw: string): { value: number } | { error: string } {
  if (!raw) return { error: 'Kapasitas wajib diisi' }
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > 100)
    return { error: `Kapasitas harus angka bulat 1–100 (dapat: "${raw}")` }
  return { value: n }
}

function parseStatus(raw: string): { value: DormStatus } | { error: string } {
  if (!raw) return { value: 'active' }
  const v = STATUS_ALIASES[raw.toLowerCase()]
  return v ? { value: v } : { error: `Status tidak dikenal: "${raw}"` }
}

const isEmptyRow = (row: string[]) => row.every((c) => !c || !c.trim())

/**
 * Parse tabel kamar (baris pertama = header, hasil autoMatch pemetaan user).
 * Mengembalikan baris dengan status 'siap' | 'error' | 'duplikat' per baris.
 * Throw bila kolom nama tidak dipetakan (format tak dikenali).
 */
export function parseDormTable(
  table: string[][],
  mapping: Mapping,
  ctx: DormImportContext,
): DormParseResult {
  if (table.length === 0) throw new Error('File kosong — tidak ada baris untuk diproses')
  if (mapping.name === undefined) {
    throw new Error(
      'Kolom "Nama" tidak ditemukan. Gunakan template: Nama, Gender, Kapasitas, Musyrif, Status',
    )
  }

  // Peta nama musyrif lowercase → id
  const teacherMap = new Map(ctx.teachers.map((t) => [t.name.trim().toLowerCase(), t.id]))
  // Duplikat dua lapis: nama yang sudah ada di DB + nama yang muncul lebih dulu di file
  const existing = new Set(ctx.existingNames)
  const seenInFile = new Set<string>()

  const get = (row: string[], field: FieldKey): string => {
    const idx = mapping[field]
    return idx === undefined ? '' : cell(row, idx)
  }

  const rows: ParsedDormRow[] = []
  let skippedRows = 0

  for (let i = 1; i < table.length; i++) {
    const raw = table[i]
    if (isEmptyRow(raw)) {
      skippedRows++
      continue
    }

    const name = get(raw, 'name')
    const musyrifRaw = get(raw, 'musyrif')
    const base: Omit<ParsedDormRow, 'rowStatus' | 'message'> = {
      row: i, // 1-based termasuk header, sesuai nomor baris di spreadsheet
      name,
      gender: null,
      capacity: 0,
      musyrifName: musyrifRaw || null,
      musyrifId: null,
      status: 'active',
    }

    if (!name) {
      rows.push({ ...base, rowStatus: 'error', message: 'Nama kamar wajib diisi' })
      continue
    }

    const genderRes = parseGender(get(raw, 'gender'))
    if ('error' in genderRes) {
      rows.push({ ...base, rowStatus: 'error', message: genderRes.error })
      continue
    }
    const capacityRes = parseCapacity(get(raw, 'capacity'))
    if ('error' in capacityRes) {
      rows.push({ ...base, rowStatus: 'error', message: capacityRes.error })
      continue
    }
    const statusRes = parseStatus(get(raw, 'status'))
    if ('error' in statusRes) {
      rows.push({ ...base, rowStatus: 'error', message: statusRes.error })
      continue
    }

    const key = name.toLowerCase()
    if (seenInFile.has(key)) {
      rows.push({
        ...base,
        gender: genderRes.value,
        capacity: capacityRes.value,
        status: statusRes.value,
        rowStatus: 'duplikat',
        message: 'Duplikat dalam file yang sama',
      })
      continue
    }
    seenInFile.add(key)
    if (existing.has(key)) {
      rows.push({
        ...base,
        gender: genderRes.value,
        capacity: capacityRes.value,
        status: statusRes.value,
        rowStatus: 'duplikat',
        message: 'Kamar dengan nama ini sudah ada di database',
      })
      continue
    }

    // Musyrif opsional — tidak ditemukan bukan error, hanya peringatan
    let message: string | undefined
    let musyrifId: string | null = null
    if (base.musyrifName) {
      musyrifId = teacherMap.get(base.musyrifName.trim().toLowerCase()) ?? null
      if (!musyrifId) message = `Musyrif "${base.musyrifName}" tidak ditemukan — kolom dikosongkan`
    }

    rows.push({
      ...base,
      gender: genderRes.value,
      capacity: capacityRes.value,
      status: statusRes.value,
      musyrifId,
      rowStatus: 'siap',
      message,
    })
  }

  return { rows, skippedRows }
}

// ---------------------------------------------------------------------------
// Ilustrasi struktur kolom (langkah Upload)
// ---------------------------------------------------------------------------

// Kolom inti yang ditampilkan di contoh modal. Semua kolom wajib HARUS ada di sini
// (dijaga oleh test importParse).
const SAMPLE_KEYS: FieldKey[] = ['name', 'gender', 'capacity', 'musyrif', 'status']
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
