import { normalizeCode, normalizeStatusInput } from '../attendance/constants'
import type { HalaqahAttendanceDays } from './types'

/**
 * Parsing murni (tanpa efek samping) untuk impor presensi halaqah Excel/CSV
 * format grid (kolom nama/kode + hari 1..31). Dipakai ImportModal
 * dan diuji di presensiParse.test.ts.
 */

export type PresensiImportRowStatus = 'siap' | 'tak_dikenal' | 'error'

export interface PresensiRosterEntry {
  id: string
  name: string
  registration_code: string
}

export interface PresensiParseContext {
  daysInMonth: number
  roster: PresensiRosterEntry[]
}

export interface ParsedPresensiRow {
  /** Nomor baris data (baris header = 0, data mulai 1) */
  row: number
  /** Teks identifikasi mentah dari file (kode/nama) */
  identifier: string
  studentId: string | null
  studentName: string | null
  matchBy: 'kode' | 'nama' | null
  /** Hari → status hasil baris ini */
  days: HalaqahAttendanceDays
  status: PresensiImportRowStatus
  error?: string
}

export interface PresensiParseResult {
  rows: ParsedPresensiRow[]
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

interface ColumnMap {
  kode: number
  nama: number
}

function mapColumns(headers: string[]): ColumnMap {
  const norm = headers.map(normalizeHeader)
  const find = (pred: (h: string) => boolean) => norm.findIndex(pred)
  return {
    kode: find((h) => h.includes('kode') || h.includes('registrasi') || h.includes('nis')),
    nama: find((h) => h.includes('nama') || h.includes('name') || h === 'santri' || h === 'siswa'),
  }
}

interface RosterIndex {
  byCode: Map<string, PresensiRosterEntry>
  byName: Map<string, PresensiRosterEntry>
}

function buildRosterIndex(roster: PresensiRosterEntry[]): RosterIndex {
  const byCode = new Map<string, PresensiRosterEntry>()
  const byName = new Map<string, PresensiRosterEntry>()
  for (const r of roster) {
    byCode.set(normalizeCode(r.registration_code), r)
    byName.set(r.name.trim().toLowerCase(), r)
  }
  return { byCode, byName }
}

/** Prioritas kode → nama; kolom terisi tapi tak cocok = tidak dikenal. */
function matchStudent(
  cols: { kode?: string; nama?: string },
  index: RosterIndex,
): { studentId: string; studentName: string; matchBy: 'kode' | 'nama' } | { error: string } | null {
  const kode = (cols.kode ?? '').trim()
  const nama = (cols.nama ?? '').trim()

  if (kode) {
    const hit = index.byCode.get(normalizeCode(kode))
    return hit
      ? { studentId: hit.id, studentName: hit.name, matchBy: 'kode' }
      : { error: `Kode "${kode}" tidak ditemukan di halaqah ini` }
  }
  if (nama) {
    const hit = index.byName.get(nama.toLowerCase())
    return hit
      ? { studentId: hit.id, studentName: hit.name, matchBy: 'nama' }
      : { error: `Nama "${nama}" tidak ditemukan di halaqah ini` }
  }
  return null
}

export function parsePresensiTable(table: string[][], ctx: PresensiParseContext): PresensiParseResult {
  if (table.length < 1) throw new Error('File kosong')

  const headers = table[0]
  const cols = mapColumns(headers)
  if (cols.kode === -1 && cols.nama === -1) {
    throw new Error('Kolom identifikasi (kode registrasi / nama) tidak ditemukan di baris pertama')
  }

  const index = buildRosterIndex(ctx.roster)
  const rows: ParsedPresensiRow[] = []
  let skippedRows = 0

  const identifierCols = [cols.kode, cols.nama].filter((i) => i >= 0)

  for (let i = 1; i < table.length; i++) {
    const cells = table[i]
    const isEmpty = cells.every((c) => !c || !String(c).trim())
    if (isEmpty) {
      skippedRows++
      continue
    }

    const base: ParsedPresensiRow = {
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

    const matched: ParsedPresensiRow = {
      ...base,
      studentId: match.studentId,
      studentName: match.studentName,
      matchBy: match.matchBy,
    }

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
  }

  return { rows, skippedRows }
}
