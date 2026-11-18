import dayjs from 'dayjs'
import type { PermitStudentBrief } from './types'

/**
 * Fungsi validasi murni (tanpa UI) untuk impor izin & parser hasil scan QR.
 * Pola mengikuti src/features/students/alumniValidation.ts — mudah diuji.
 */

// ------------------------------------------------------------
// Parser hasil scan QR kartu santri / surat izin
// ------------------------------------------------------------

/** Ambil kode izin dari teks `permit:<uuid>` (QR di surat cetak) */
export function extractPermitRef(raw: string): string | null {
  const str = String(raw ?? '').trim()
  const m = /^permit:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(str)
  return m ? m[1].toLowerCase() : null
}

/**
 * Ambil kode registrasi santri dari hasil scan.
 * QR kartu berisi URL `${origin}/check?code=REG-XXX&pin=...`; terima juga teks polos.
 * Mengembalikan null bila teks adalah referensi izin (`permit:`) atau tidak berisi kode.
 */
export function extractScannedCode(raw: string): string | null {
  if (extractPermitRef(raw)) return null
  const str = String(raw ?? '').trim()
  if (!str) return null

  try {
    const url = new URL(str)
    const code = url.searchParams.get('code')
    if (code) return code.trim().toUpperCase()
  } catch {
    // bukan URL — perlakukan sebagai teks polos di bawah
  }

  if (/^[A-Z0-9-]{3,32}$/i.test(str)) return str.toUpperCase()
  return null
}

// ------------------------------------------------------------
// Parser tanggal & jam untuk impor
// ------------------------------------------------------------

/** Terima ISO YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, atau Date → 'YYYY-MM-DD' */
export function parsePermitDate(value?: unknown): string | null | undefined {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return dayjs(value).format('YYYY-MM-DD')
  }
  const str = String(value).trim()
  if (!str) return undefined

  // Format ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str)
  if (isoMatch) {
    const d = dayjs(`${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(str)
  if (dmyMatch) {
    const d = dayjs(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  const parsed = dayjs(str)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

/** Terima HH:mm, HH.mm, HH:mm:ss, "7.05" → 'HH:mm'; null bila tidak valid */
export function parsePermitTime(value?: unknown): string | null | undefined {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date && !isNaN(value.getTime())) {
    return dayjs(value).format('HH:mm')
  }
  const str = String(value).trim()
  if (!str) return undefined

  const m = /^(\d{1,2})[.:](\d{1,2})(?::\d{1,2})?$/.exec(str)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Normalisasi nomor telepon sederhana: digit saja, 62… → 0… */
export function normalizePermitPhone(value?: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const str = String(value).replace(/\D/g, '').replace(/^62/, '0')
  return str || undefined
}

// ------------------------------------------------------------
// Validasi baris impor
// ------------------------------------------------------------

export type PermitImportStatus = 'baru' | 'duplikat' | 'error'

export interface PermitImportRowInput {
  kode_santri: string
  nama_santri: string
  tujuan: string
  keperluan: string
  tanggal_keluar: string
  tanggal_kembali: string
  jam_kembali: string
  no_telepon: string
}

export interface PermitImportNormalized {
  student_id: string
  student_name: string
  phone?: string
  destination: string
  purpose: string
  leave_date: string
  return_date: string
  return_time: string
}

/** Nama bandingkan: huruf kecil, hanya alfanumerik */
function getComparableName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function validatePermitImportRow(
  input: PermitImportRowInput,
  students: PermitStudentBrief[],
): { isValid: boolean; error?: string; normalized?: PermitImportNormalized } {
  const destination = input.tujuan.trim()
  const purpose = input.keperluan.trim()

  // Resolve santri: kode registrasi dulu, lalu nama (harus unik)
  const code = input.kode_santri.trim().toUpperCase()
  const name = input.nama_santri.trim()
  let student: PermitStudentBrief | undefined

  if (code) {
    student = students.find((s) => s.registration_code.toUpperCase() === code)
    if (!student) {
      return { isValid: false, error: `Kode santri "${code}" tidak ditemukan` }
    }
  } else if (name) {
    const matches = students.filter((s) => getComparableName(s.name) === getComparableName(name))
    if (matches.length === 0) {
      return { isValid: false, error: `Santri "${name}" tidak ditemukan` }
    }
    if (matches.length > 1) {
      return { isValid: false, error: `Nama "${name}" ambigu (${matches.length} santri) — isi kolom kode_santri` }
    }
    student = matches[0]
  } else {
    return { isValid: false, error: 'kode_santri wajib diisi' }
  }

  const leaveDate = parsePermitDate(input.tanggal_keluar)
  const returnDate = parsePermitDate(input.tanggal_kembali)
  const returnTime = parsePermitTime(input.jam_kembali)

  let error: string | undefined
  if (!destination) error = 'Tujuan wajib diisi'
  else if (!purpose) error = 'Keperluan wajib diisi'
  else if (leaveDate === null || leaveDate === undefined) error = 'Tanggal keluar tidak valid'
  else if (returnDate === null || returnDate === undefined) error = 'Tanggal kembali tidak valid'
  else if (returnDate < leaveDate) error = 'Tanggal kembali tidak boleh sebelum tanggal keluar'
  else if (returnTime === null || returnTime === undefined) error = 'Jam kembali tidak valid (HH:mm)'

  if (error) return { isValid: false, error }

  return {
    isValid: true,
    normalized: {
      student_id: student.id,
      student_name: student.name,
      phone: normalizePermitPhone(input.no_telepon),
      destination,
      purpose,
      leave_date: leaveDate as string,
      return_date: returnDate as string,
      return_time: returnTime as string,
    },
  }
}

export function checkPermitDuplicate(
  candidate: { student_id: string; leave_date: string },
  activeKeys: Set<string>,
  batchSeen: Set<string>,
): { isDuplicate: boolean; reason?: string } {
  const key = `${candidate.student_id}|${candidate.leave_date}`
  if (batchSeen.has(key)) {
    return { isDuplicate: true, reason: 'Duplikat dalam file yang sama' }
  }
  if (activeKeys.has(key)) {
    return { isDuplicate: true, reason: 'Santri sudah punya izin aktif di tanggal tersebut' }
  }
  return { isDuplicate: false }
}

// ------------------------------------------------------------
// Definisi kolom impor izin (pola students/importParse.ts).
// Artefak template/mapping diletakkan di file ini (fitur ini tidak punya
// importParse.ts sendiri) — fungsi validasi di atas tidak berubah.
// ------------------------------------------------------------

export const FIELDS = [
  {
    key: 'kode_santri',
    label: 'Kode Santri',
    aliases: ['kode', 'kode_registrasi', 'registrasi', 'reg', 'nis', 'code'],
  },
  { key: 'nama_santri', label: 'Nama Santri', aliases: ['nama', 'santri', 'siswa', 'name'] },
  { key: 'tujuan', label: 'Tujuan', required: true, aliases: ['destination', 'alamat_tujuan'] },
  { key: 'keperluan', label: 'Keperluan', required: true, aliases: ['purpose', 'alasan'] },
  {
    key: 'tanggal_keluar',
    label: 'Tanggal Keluar',
    required: true,
    aliases: ['tgl_keluar', 'keluar', 'leave_date', 'tanggal_mulai'],
  },
  {
    key: 'tanggal_kembali',
    label: 'Tanggal Kembali',
    required: true,
    aliases: ['tgl_kembali', 'kembali', 'return_date', 'tanggal_selesai'],
  },
  { key: 'jam_kembali', label: 'Jam Kembali', required: true, aliases: ['jam', 'waktu_kembali', 'time'] },
  { key: 'no_telepon', label: 'No Telepon', aliases: ['telepon', 'hp', 'wa', 'phone', 'no_hp'] },
] as const satisfies readonly {
  key: string
  label: string
  required?: boolean
  aliases: readonly string[]
}[]

export type PermitFieldKey = (typeof FIELDS)[number]['key']
export type PermitMapping = Partial<Record<PermitFieldKey, number>>

// Keterangan per kolom untuk sheet "Petunjuk" di template Excel
const FIELD_NOTES: Partial<Record<PermitFieldKey, string>> = {
  kode_santri: 'Wajib (atau isi Nama Santri). Kode registrasi — dicocokkan ke Data Santri.',
  nama_santri: 'Wajib (atau isi Kode Santri). Nama harus unik; bila ambigu, isi kolom kode.',
  tujuan: 'Wajib. Tujuan perjalanan (mis. Rumah orang tua).',
  keperluan: 'Wajib. Alasan izin (mis. Pulang ke rumah).',
  tanggal_keluar: 'Wajib. YYYY-MM-DD atau DD/MM/YYYY.',
  tanggal_kembali: 'Wajib. Tidak boleh sebelum tanggal keluar.',
  jam_kembali: 'Wajib. HH:mm.',
  no_telepon: 'Opsional. Nomor HP santri (digits saja).',
}

export const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<PermitFieldKey, string>[] = [
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

export function normHeader(value: string) {
  return value
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function autoMatch(headers: string[]): PermitMapping {
  const normalized = headers.map(normHeader)
  const used = new Set<number>()
  const mapping: PermitMapping = {}

  // Cocokkan persis: key, label, alias
  for (const field of FIELDS) {
    const names = new Set([field.key, field.label, ...field.aliases].map(normHeader))
    const index = normalized.findIndex((h, i) => !used.has(i) && names.has(h))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }

  // Fallback fuzzy — pemetaan lama izin (header mengandung kata kunci alias)
  const fuzzy: Record<PermitFieldKey, (h: string) => boolean> = {
    kode_santri: (h) => h.includes('kode') || h.includes('registrasi') || h === 'reg' || h === 'nis',
    nama_santri: (h) => h.includes('nama') || h.includes('santri') || h.includes('siswa') || h === 'name',
    tujuan: (h) => h.includes('tujuan') || h.includes('destination'),
    keperluan: (h) => h.includes('keperluan') || h.includes('purpose') || h.includes('alasan'),
    tanggal_keluar: (h) => h.includes('keluar') || h.includes('leave'),
    tanggal_kembali: (h) => h.includes('kembali') || h.includes('return'),
    jam_kembali: (h) => h.includes('jam') || h === 'time',
    no_telepon: (h) => h.includes('telepon') || h.includes('hp') || h.includes('phone') || h === 'wa',
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

// Kolom inti yang ditampilkan di contoh modal (maks 7). Semua kolom wajib
// HARUS ada di sini (dijaga oleh test permitValidation).
const SAMPLE_KEYS: PermitFieldKey[] = [
  'kode_santri',
  'nama_santri',
  'tujuan',
  'keperluan',
  'tanggal_keluar',
  'tanggal_kembali',
  'jam_kembali',
]
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

export function downloadTemplate() {
  // xlsx (bukan CSV) supaya sheet "Petunjuk" ikut terbawa; sheet pertama =
  // data, karena reader membaca SheetNames[0]
  void import('xlsx').then((XLSX) => {
    const header: string[] = FIELDS.map((f) => f.label)
    const data = TEMPLATE_ROWS.map((row) => TEMPLATE_COLUMNS.map((col) => row[col]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])

    // Kunci kolom teks agar 0 di depan (kode/HP) & format tanggal tidak rusak
    const textCols = new Set(['kode_santri', 'tanggal_keluar', 'tanggal_kembali', 'jam_kembali', 'no_telepon'])
    for (let c = 0; c < header.length; c++) {
      if (!textCols.has(TEMPLATE_COLUMNS[c])) continue
      for (let r = 1; r <= TEMPLATE_ROWS.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (!ws[addr]) ws[addr] = { t: 's', v: '' }
        ws[addr].z = '@'
      }
    }

    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(34, Math.max(h.length + 3, ...data.map((row) => String(row[c] ?? '').length + 3))),
    }))

    // Sheet kedua: petunjuk. JANGAN dipindah ke depan — reader membaca sheet pertama.
    const guide: string[][] = [
      ['PENTING: hapus 2 baris contoh (REG-001 & REG-002) di sheet "Izin Keluar" sebelum mengisi data Anda.'],
      ['Santri yang sudah punya izin aktif di tanggal yang sama otomatis dilewati (duplikat).'],
      [],
      ['Kolom', 'Wajib', 'Keterangan'],
      ...FIELDS.map((f) => [
        f.label as string,
        'required' in f && f.required ? 'Wajib' : 'Opsional',
        FIELD_NOTES[f.key] ?? '',
      ]),
    ]
    const wsGuide = XLSX.utils.aoa_to_sheet(guide)
    wsGuide['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 80 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Izin Keluar')
    XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk')
    XLSX.writeFile(wb, 'Template-Impor-Izin.xlsx')
  })
}

// ------------------------------------------------------------
// Parser tabel izin — aturan validasi dipertahankan persis dari versi lama
// (validatePermitImportRow → checkPermitDuplicate)
// ------------------------------------------------------------

export interface ParsedPermitRow {
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

export interface PermitParseContext {
  students: PermitStudentBrief[]
  activeKeys: Set<string>
}

export function parsePermitTable(
  table: string[][],
  mapping: PermitMapping,
  ctx: PermitParseContext,
): ParsedPermitRow[] {
  if (table.length < 1) throw new Error('File kosong')
  if (mapping.kode_santri === undefined && mapping.nama_santri === undefined) {
    throw new Error('Kolom kode_santri atau nama_santri wajib ada di file')
  }
  const missingOther = (['tujuan', 'keperluan', 'tanggal_keluar', 'tanggal_kembali', 'jam_kembali'] as const).find(
    (f) => mapping[f] === undefined,
  )
  if (missingOther) {
    throw new Error(`Kolom wajib tidak ditemukan: ${missingOther}`)
  }

  const get = (cells: string[], field: PermitFieldKey): string => {
    const idx = mapping[field]
    return idx === undefined ? '' : (cells[idx] ?? '')
  }

  const batchSeen = new Set<string>()
  const rows: ParsedPermitRow[] = []

  for (let i = 1; i < table.length; i++) {
    const row = table[i]
    if (row.every((cell) => !cell || cell.trim() === '')) continue

    const input = {
      kode_santri: get(row, 'kode_santri'),
      nama_santri: get(row, 'nama_santri'),
      tujuan: get(row, 'tujuan'),
      keperluan: get(row, 'keperluan'),
      tanggal_keluar: get(row, 'tanggal_keluar'),
      tanggal_kembali: get(row, 'tanggal_kembali'),
      jam_kembali: get(row, 'jam_kembali'),
      no_telepon: get(row, 'no_telepon'),
    }

    const valRes = validatePermitImportRow(input, ctx.students)

    let status: PermitImportStatus = 'baru'
    let errorMessage = valRes.error

    if (!valRes.isValid) {
      status = 'error'
    } else {
      const dupRes = checkPermitDuplicate(
        { student_id: valRes.normalized!.student_id, leave_date: valRes.normalized!.leave_date },
        ctx.activeKeys,
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

  return rows
}
