/**
 * Parser pure untuk import CSV/Excel kegiatan ekstrakurikuler — tanpa efek
 * samping agar mudah dites (pola importParse.ts). UI wizard ada di ImportModal.
 */

export interface ParsedEkskulRow {
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

export interface EkskulImportContext {
  /** Nama kegiatan aktif di DB (lowercase) — untuk deteksi duplikat */
  existingNames: string[]
  /** Daftar guru untuk pencocokan pembina */
  teachers: { id: string; name: string }[]
}

interface ColMap {
  name: number
  coach: number
  schedule: number
  place: number
  description: number
}

const cell = (row: string[], i: number): string => (row[i] ?? '').trim()

function detectColumns(headers: string[]): ColMap | null {
  const lower = headers.map((h) => h.trim().toLowerCase())
  const find = (...keys: string[]) =>
    lower.findIndex((h) => keys.some((k) => h === k || h.includes(k)))

  // "nama pembina" juga mengandung "nama" — cek pembina lebih dulu
  const coach = find('pembina', 'coach', 'pelatih')
  const name = find('nama', 'kegiatan', 'ekskul', 'name')
  const schedule = find('jadwal', 'schedule')
  const place = find('tempat', 'lokasi', 'place')
  const description = find('deskripsi', 'keterangan', 'description')

  if (name === -1) return null
  return { name, coach, schedule, place, description }
}

const isEmptyRow = (row: string[]) => row.every((c) => !c || !c.trim())

/**
 * Parse tabel ekskul (array of arrays, baris pertama = header).
 * Throw bila kolom nama tidak ditemukan (format tak dikenali).
 * Pembina dicocokkan case-insensitive; tidak ditemukan = peringatan, bukan error.
 */
export function parseEkskulTable(
  table: string[][],
  ctx: EkskulImportContext,
): { rows: ParsedEkskulRow[]; skippedRows: number } {
  if (table.length === 0) throw new Error('File kosong — tidak ada baris untuk diproses')

  const colMap = detectColumns(table[0])
  if (!colMap) {
    throw new Error(
      'Kolom "Nama Kegiatan" tidak ditemukan. Gunakan template: Nama Kegiatan, Pembina, Jadwal, Tempat, Deskripsi',
    )
  }

  const teacherMap = new Map(ctx.teachers.map((t) => [t.name.trim().toLowerCase(), t.id]))
  // Duplikat dua lapis: nama yang sudah ada di DB + nama yang muncul lebih dulu di file
  const existing = new Set(ctx.existingNames)
  const seenInFile = new Set<string>()

  const rows: ParsedEkskulRow[] = []
  let skippedRows = 0

  for (let i = 1; i < table.length; i++) {
    const raw = table[i]
    if (isEmptyRow(raw)) {
      skippedRows++
      continue
    }

    const name = cell(raw, colMap.name)
    const coachName = colMap.coach >= 0 ? cell(raw, colMap.coach) || null : null
    const base: Omit<ParsedEkskulRow, 'rowStatus' | 'message'> = {
      row: i,
      name,
      coachName,
      coachId: null,
      schedule: colMap.schedule >= 0 ? cell(raw, colMap.schedule) || null : null,
      place: colMap.place >= 0 ? cell(raw, colMap.place) || null : null,
      description: colMap.description >= 0 ? cell(raw, colMap.description) || null : null,
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
    if (coachName) {
      coachId = teacherMap.get(coachName.trim().toLowerCase()) ?? null
      if (!coachId) message = `Pembina "${coachName}" tidak ditemukan — kolom dikosongkan`
    }

    rows.push({ ...base, coachId, rowStatus: 'siap', message })
  }

  return { rows, skippedRows }
}
