import type {
  DormGender,
  DormImportContext,
  DormParseResult,
  DormStatus,
  ParsedDormRow,
} from './types'

/**
 * Parser pure untuk import CSV kamar asrama — tanpa efek samping agar
 * mudah dites (pola attendance/importParse.ts). UI wizard ada di ImportModal.
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

interface ColMap {
  name: number
  gender: number
  capacity: number
  musyrif: number
  status: number
}

const cell = (row: string[], i: number): string => (row[i] ?? '').trim()

function detectColumns(headers: string[]): ColMap | null {
  const lower = headers.map((h) => h.trim().toLowerCase())
  const find = (...keys: string[]) =>
    lower.findIndex((h) => keys.some((k) => h === k || h.includes(k)))

  // "nama musyrif" juga mengandung "nama" — cek musyrif lebih dulu
  const musyrif = find('musyrif')
  const name = find('nama', 'kamar', 'name')
  const gender = find('gender', 'kelamin', 'jk')
  const capacity = find('kapasitas', 'kuota', 'capacity')
  const status = find('status')

  if (name === -1) return null
  return { name, gender, capacity, musyrif, status }
}

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
 * Parse tabel kamar (hasil Papa.parse — array of arrays, tanpa header).
 * Mengembalikan baris dengan status 'siap' | 'error' | 'duplikat' per baris.
 * Throw bila kolom nama tidak ditemukan (format tak dikenali).
 */
export function parseDormTable(table: string[][], ctx: DormImportContext): DormParseResult {
  if (table.length === 0) throw new Error('File kosong — tidak ada baris untuk diproses')

  const colMap = detectColumns(table[0])
  if (!colMap) {
    throw new Error(
      'Kolom "Nama" tidak ditemukan. Gunakan template: Nama, Gender, Kapasitas, Musyrif, Status',
    )
  }

  // Peta nama musyrif lowercase → id
  const teacherMap = new Map(ctx.teachers.map((t) => [t.name.trim().toLowerCase(), t.id]))
  // Duplikat dua lapis: nama yang sudah ada di DB + nama yang muncul lebih dulu di file
  const existing = new Set(ctx.existingNames)
  const seenInFile = new Set<string>()

  const rows: ParsedDormRow[] = []
  let skippedRows = 0

  for (let i = 1; i < table.length; i++) {
    const raw = table[i]
    if (isEmptyRow(raw)) {
      skippedRows++
      continue
    }

    const name = cell(raw, colMap.name)
    const base: Omit<ParsedDormRow, 'rowStatus' | 'message'> = {
      row: i, // 1-based termasuk header, sesuai nomor baris di spreadsheet
      name,
      gender: null,
      capacity: 0,
      musyrifName: colMap.musyrif >= 0 ? cell(raw, colMap.musyrif) || null : null,
      musyrifId: null,
      status: 'active',
    }

    if (!name) {
      rows.push({ ...base, rowStatus: 'error', message: 'Nama kamar wajib diisi' })
      continue
    }

    const genderRes = parseGender(cell(raw, colMap.gender))
    if ('error' in genderRes) {
      rows.push({ ...base, rowStatus: 'error', message: genderRes.error })
      continue
    }
    const capacityRes = parseCapacity(cell(raw, colMap.capacity))
    if ('error' in capacityRes) {
      rows.push({ ...base, rowStatus: 'error', message: capacityRes.error })
      continue
    }
    const statusRes = parseStatus(colMap.status >= 0 ? cell(raw, colMap.status) : '')
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
