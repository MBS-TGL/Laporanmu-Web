import { normalizeCode, normalizeStatusInput } from './constants'
import type { AttendanceDays } from './types'

/**
 * Parsing murni (tanpa efek samping) untuk impor absensi Excel/CSV.
 * Dipakai ImportModal dan diuji di importParse.test.ts.
 */

export type ImportFormat = 'grid' | 'harian'
export type ImportRowStatus = 'siap' | 'error' | 'tak_dikenal'

export interface RosterEntry {
  id: string
  name: string
  registration_code: string
  nisn?: string | null
}

export interface ParseContext {
  year: number
  month: number
  daysInMonth: number
  roster: RosterEntry[]
}

export interface ParsedImportRow {
  /** Nomor baris data (baris header = 0, data mulai 1) */
  row: number
  /** Teks identifikasi mentah dari file (kode/nisn/nama) */
  identifier: string
  studentId: string | null
  studentName: string | null
  matchBy: 'kode' | 'nisn' | 'nama' | null
  /** Hari → status hasil baris ini */
  days: AttendanceDays
  status: ImportRowStatus
  error?: string
}

export interface ParseResult {
  format: ImportFormat
  rows: ParsedImportRow[]
  /** Baris benar-benar kosong yang dilewati */
  skippedRows: number
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Kolom hari pada format grid: "1".."31" atau "h1".."h31" */
function dayFromHeader(h: string): number | null {
  const m = /^h?(\d{1,2})$/.exec(normalizeHeader(h))
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 31 ? n : null
}

export function detectFormat(headers: string[]): ImportFormat | null {
  const norm = headers.map(normalizeHeader)
  const hasDayCols = norm.some((h) => dayFromHeader(h) !== null)
  if (hasDayCols) return 'grid'

  const hasDate = norm.some((h) => h.includes('tanggal') || h.includes('tgl') || h === 'date')
  const hasStatus = norm.some((h) => h.includes('status') || h.includes('ket') || h.includes('kehadiran'))
  if (hasDate && hasStatus) return 'harian'
  return null
}

interface ColumnMap {
  kode: number
  nisn: number
  nis: number
  nama: number
  tanggal: number
  status: number
}

function mapColumns(headers: string[]): ColumnMap {
  const norm = headers.map(normalizeHeader)
  const find = (pred: (h: string) => boolean) => norm.findIndex(pred)
  return {
    kode: find((h) => h.includes('kode') || h.includes('registrasi') || h.includes('registration')),
    nisn: find((h) => h.includes('nisn')),
    nis: find((h) => h === 'nis'),
    nama: find((h) => h.includes('nama') || h.includes('name') || h === 'santri' || h === 'siswa'),
    tanggal: find((h) => h.includes('tanggal') || h.includes('tgl') || h === 'date'),
    status: find((h) => h.includes('status') || h.includes('ket') || h.includes('kehadiran')),
  }
}

/**
 * Ubah teks tanggal menjadi nomor hari pada bulan terpilih.
 * Menerima: 1..31 (angka hari), YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.
 */
export function parseDayValue(
  raw: string,
  ctx: Pick<ParseContext, 'year' | 'month' | 'daysInMonth'>,
): { day: number } | { error: string } {
  const v = raw.trim()
  if (/^\d{1,2}$/.test(v)) {
    const d = Number(v)
    if (d >= 1 && d <= ctx.daysInMonth) return { day: d }
    return { error: `Tanggal ${d} di luar jangkauan bulan ini (1-${ctx.daysInMonth})` }
  }

  let y: number | undefined
  let m: number | undefined
  let d: number | undefined

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  if (iso) {
    y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3])
  } else {
    const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(v)
    if (dmy) {
      d = Number(dmy[1]); m = Number(dmy[2]); y = Number(dmy[3])
    }
  }

  if (y === undefined || m === undefined || d === undefined || Number.isNaN(d)) {
    return { error: `Format tanggal tidak dikenal: "${raw}"` }
  }
  if (y !== ctx.year || m !== ctx.month) {
    return { error: `Tanggal ${v} berada di luar periode ${ctx.month}/${ctx.year} yang dipilih` }
  }
  if (d < 1 || d > ctx.daysInMonth) {
    return { error: `Tanggal ${v} tidak valid untuk bulan ini` }
  }
  return { day: d }
}

interface RosterIndex {
  byCode: Map<string, RosterEntry>
  byNisn: Map<string, RosterEntry>
  byName: Map<string, RosterEntry>
}

function buildRosterIndex(roster: RosterEntry[]): RosterIndex {
  const byCode = new Map<string, RosterEntry>()
  const byNisn = new Map<string, RosterEntry>()
  const byName = new Map<string, RosterEntry>()
  for (const r of roster) {
    byCode.set(normalizeCode(r.registration_code), r)
    if (r.nisn) byNisn.set(normalizeCode(r.nisn), r)
    byName.set(r.name.trim().toLowerCase(), r)
  }
  return { byCode, byNisn, byName }
}

/** Cari santri berdasarkan kolom yang tersedia — prioritas kode → nisn → nama */
function matchStudent(
  cols: Partial<Record<keyof ColumnMap, string>>,
  index: RosterIndex,
): { studentId: string; studentName: string; matchBy: 'kode' | 'nisn' | 'nama' } | { error: string } | null {
  const kode = (cols.kode ?? '').trim()
  const nisn = (cols.nisn ?? '').trim()
  const nama = (cols.nama ?? '').trim()

  // Kolom teridentifikasi tapi nilainya tidak cocok → tidak dikenal (bukan fallback diam-diam)
  if (kode) {
    const hit = index.byCode.get(normalizeCode(kode))
    return hit ? { studentId: hit.id, studentName: hit.name, matchBy: 'kode' } : { error: `Kode "${kode}" tidak ditemukan di kelas ini` }
  }
  if (nisn) {
    const hit = index.byNisn.get(normalizeCode(nisn))
    return hit ? { studentId: hit.id, studentName: hit.name, matchBy: 'nisn' } : { error: `NISN "${nisn}" tidak ditemukan di kelas ini` }
  }
  if (nama) {
    const hit = index.byName.get(nama.toLowerCase())
    return hit ? { studentId: hit.id, studentName: hit.name, matchBy: 'nama' } : { error: `Nama "${nama}" tidak ditemukan di kelas ini` }
  }
  // Tidak ada kolom identifikasi terisi sama sekali → dilewati diam-diam
  return null
}

export function parseAttendanceTable(table: string[][], ctx: ParseContext): ParseResult {
  if (table.length < 1) throw new Error('File kosong')

  const headers = table[0]
  const format = detectFormat(headers)
  if (!format) {
    throw new Error(
      'Format tidak dikenali. Gunakan format grid (kolom 1..31) atau harian (kolom kode, tanggal, status). Unduh template untuk contoh.',
    )
  }

  const cols = mapColumns(headers)
  if (cols.kode === -1 && cols.nisn === -1 && cols.nis === -1 && cols.nama === -1) {
    throw new Error('Kolom identifikasi (kode registrasi / NISN / nama) tidak ditemukan')
  }

  const index = buildRosterIndex(ctx.roster)
  const rows: ParsedImportRow[] = []
  let skippedRows = 0

  const identifierCols = [cols.kode, cols.nisn, cols.nis, cols.nama].filter((i) => i >= 0)

  for (let i = 1; i < table.length; i++) {
    const cells = table[i]
    const isEmpty = cells.every((c) => !c || !String(c).trim())
    if (isEmpty) {
      skippedRows++
      continue
    }

    const base: ParsedImportRow = {
      row: i,
      identifier: identifierCols.map((c) => cells[c] ?? '').filter(Boolean).join(' · ') || '(tanpa identitas)',
      studentId: null,
      studentName: null,
      matchBy: null,
      days: {},
      status: 'siap',
    }

    const match = matchStudent(
      {
        kode: cols.kode >= 0 ? cells[cols.kode] : undefined,
        nisn: (cols.nisn >= 0 ? cells[cols.nisn] : undefined) ?? (cols.nis >= 0 ? cells[cols.nis] : undefined),
        nama: cols.nama >= 0 ? cells[cols.nama] : undefined,
      },
      index,
    )

    if (match && 'error' in match) {
      rows.push({ ...base, status: 'tak_dikenal', error: match.error })
      continue
    }
    if (!match) {
      rows.push({ ...base, status: 'error', error: 'Baris tidak memiliki identitas' })
      continue
    }

    const matched: ParsedImportRow = {
      ...base,
      studentId: match.studentId,
      studentName: match.studentName,
      matchBy: match.matchBy,
    }

    if (format === 'grid') {
      let invalidCell: string | null = null
      for (let c = 0; c < headers.length; c++) {
        const day = dayFromHeader(headers[c])
        if (day === null || day > ctx.daysInMonth) continue
        const norm = normalizeStatusInput(cells[c] ?? '')
        if (norm === '') continue
        if (norm === null) {
          invalidCell = `Status tidak dikenal di hari ${day}: "${cells[c]}"`
          break
        }
        matched.days[String(day)] = norm
      }
      if (invalidCell) {
        rows.push({ ...matched, status: 'error', error: invalidCell })
      } else if (Object.keys(matched.days).length === 0) {
        rows.push({ ...matched, status: 'error', error: 'Tidak ada status yang bisa dibaca di baris ini' })
      } else {
        rows.push(matched)
      }
    } else {
      // format harian: satu baris = satu hari
      const dateCell = cols.tanggal >= 0 ? cells[cols.tanggal] ?? '' : ''
      const statusCell = cols.status >= 0 ? cells[cols.status] ?? '' : ''

      const parsedDay = parseDayValue(dateCell, ctx)
      if ('error' in parsedDay) {
        rows.push({ ...matched, status: 'error', error: parsedDay.error })
        continue
      }
      const norm = normalizeStatusInput(statusCell)
      if (norm === '' ) {
        rows.push({ ...matched, status: 'error', error: `Status kosong/tidak valid: "${statusCell}"` })
        continue
      }
      if (norm === null) {
        rows.push({ ...matched, status: 'error', error: `Status tidak dikenal: "${statusCell}"` })
        continue
      }
      matched.days[String(parsedDay.day)] = norm
      rows.push(matched)
    }
  }

  return { format, rows, skippedRows }
}
