/**
 * Parser pure untuk impor kegiatan ekstrakurikuler — tanpa efek samping agar
 * mudah dites. Pola sama dengan students/importParse.ts: FIELDS + autoMatch
 * (pemetaan kolom oleh user di langkah Mapping) + template Excel dua sheet.
 * Aturan error baris WAJIB dipertahankan persis: nama kosong → duplikat dalam
 * file → duplikat di database → pembina (peringatan, bukan error).
 */

export interface ParsedActivityRow {
  /** 1-based termasuk header, sesuai nomor baris di spreadsheet */
  row: number
  name: string
  coachName: string | null
  coachId: string | null
  schedule: string | null
  place: string | null
  description: string | null
  rowStatus: 'siap' | 'error' | 'duplikat'
  message?: string
}

export interface ActivityImportContext {
  /** Nama kegiatan aktif di DB (lowercase) — untuk deteksi duplikat */
  existingNames: string[]
  /** Daftar guru untuk pencocokan pembina */
  teachers: { id: string; name: string }[]
}

// ---------------------------------------------------------------------------
// Definisi kolom
// ---------------------------------------------------------------------------

export const FIELDS = [
  { key: 'name', label: 'Nama Kegiatan', required: true, aliases: ['nama', 'kegiatan', 'ekskul', 'name', 'nama ekskul'] },
  { key: 'coach', label: 'Pembina', aliases: ['nama pembina', 'coach', 'pelatih', 'guru'] },
  { key: 'schedule', label: 'Jadwal', aliases: ['schedule', 'waktu'] },
  { key: 'place', label: 'Tempat', aliases: ['lokasi', 'place'] },
  { key: 'description', label: 'Deskripsi', aliases: ['keterangan', 'description'] },
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
  name: 'Wajib diisi & unik. Kegiatan dengan nama yang sudah ada di database akan dilewati.',
  coach: 'Nama pembina persis seperti di Data Guru (boleh kosong; tidak ditemukan → kolom dikosongkan dengan peringatan).',
  schedule: 'Contoh: Jumat, 15.30.',
  place: 'Lokasi kegiatan, contoh: Lapangan.',
  description: 'Keterangan tambahan (boleh kosong).',
}

// ---------------------------------------------------------------------------
// Template & unduhan
// ---------------------------------------------------------------------------

export const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<FieldKey, string>[] = [
  {
    name: 'Pramuka',
    coach: 'Siti Aminah',
    schedule: 'Jumat',
    place: 'Lapangan',
    description: 'Wajib untuk kelas 7',
  },
  {
    name: 'Futsal',
    coach: 'Muhammad Misbahul Huda',
    schedule: 'Sabtu Pagi',
    place: 'Lapangan Sekolah',
    description: 'Latihan rutin',
  },
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
      ['PENTING: hapus 2 baris contoh (Pramuka & Futsal) di sheet "Kegiatan" sebelum mengisi data Anda.'],
      [],
      ['Kolom', 'Wajib', 'Keterangan'],
      ...FIELDS.map((f) => [
        f.label as string,
        'required' in f && f.required ? 'Wajib' : 'Opsional',
        FIELD_NOTES[f.key] ?? '',
      ]),
    ]
    if (teachers.length > 0) {
      guide.push([], ['Pembina valid'])
      for (const t of teachers) guide.push([t])
    }
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 24 }, { wch: 80 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kegiatan')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk')
    XLSX.writeFile(wb, 'Template-Impor-Ekstrakurikuler.xlsx')
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

const isEmptyRow = (row: string[]) => row.every((c) => !c || !c.trim())

/**
 * Parse tabel kegiatan (baris pertama = header, hasil autoMatch pemetaan user).
 * Throw bila kolom nama tidak dipetakan (format tak dikenali).
 * Pembina dicocokkan case-insensitive; tidak ditemukan = peringatan, bukan error.
 */
export function parseActivityTable(
  table: string[][],
  mapping: Mapping,
  ctx: ActivityImportContext,
): { rows: ParsedActivityRow[]; skippedRows: number } {
  if (table.length === 0) throw new Error('File kosong — tidak ada baris untuk diproses')
  if (mapping.name === undefined) {
    throw new Error(
      'Kolom "Nama Kegiatan" tidak ditemukan. Gunakan template: Nama Kegiatan, Pembina, Jadwal, Tempat, Deskripsi',
    )
  }

  const teacherMap = new Map(ctx.teachers.map((t) => [t.name.trim().toLowerCase(), t.id]))
  // Duplikat dua lapis: nama yang sudah ada di DB + nama yang muncul lebih dulu di file
  const existing = new Set(ctx.existingNames)
  const seenInFile = new Set<string>()

  const get = (row: string[], field: FieldKey): string => {
    const idx = mapping[field]
    return idx === undefined ? '' : cell(row, idx)
  }

  const rows: ParsedActivityRow[] = []
  let skippedRows = 0

  for (let i = 1; i < table.length; i++) {
    const raw = table[i]
    if (isEmptyRow(raw)) {
      skippedRows++
      continue
    }

    const name = get(raw, 'name')
    const coachRaw = get(raw, 'coach')
    const base: Omit<ParsedActivityRow, 'rowStatus' | 'message'> = {
      row: i,
      name,
      coachName: coachRaw || null,
      coachId: null,
      schedule: get(raw, 'schedule') || null,
      place: get(raw, 'place') || null,
      description: get(raw, 'description') || null,
    }

    if (!name) {
      rows.push({ ...base, rowStatus: 'error', message: 'Nama kegiatan wajib diisi' })
      continue
    }

    const key = name.toLowerCase()
    if (seenInFile.has(key)) {
      rows.push({ ...base, rowStatus: 'duplikat', message: 'Duplikat dalam file yang sama' })
      continue
    }
    seenInFile.add(key)
    if (existing.has(key)) {
      rows.push({
        ...base,
        rowStatus: 'duplikat',
        message: 'Kegiatan dengan nama ini sudah ada di database',
      })
      continue
    }

    // Pembina opsional — tidak ditemukan bukan error, hanya peringatan
    let message: string | undefined
    let coachId: string | null = null
    if (base.coachName) {
      coachId = teacherMap.get(base.coachName.trim().toLowerCase()) ?? null
      if (!coachId) message = `Pembina "${base.coachName}" tidak ditemukan — kolom dikosongkan`
    }

    rows.push({ ...base, coachId, rowStatus: 'siap', message })
  }

  return { rows, skippedRows }
}

// ---------------------------------------------------------------------------
// Ilustrasi struktur kolom (langkah Upload)
// ---------------------------------------------------------------------------

// Kolom inti yang ditampilkan di contoh modal. Semua kolom wajib HARUS ada di sini
// (dijaga oleh test importParse).
const SAMPLE_KEYS: FieldKey[] = ['name', 'coach', 'schedule', 'place', 'description']
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
