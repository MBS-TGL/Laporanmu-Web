import dayjs from 'dayjs'
import type { TeacherAttendanceStatus } from './types'

/**
 * Agregasi murni rekap bulanan absensi guru — dipakai AttendancePage
 * mode Rekap dan diuji di recap.test.ts.
 */

/** Input minimal agar rekap juga bisa dibangun dari grid efektif (saved + draft). */
export interface TeacherRecapInput {
  teacher_id: string
  date: string
  status: TeacherAttendanceStatus
}

export interface TeacherRecapEntry {
  teacherId: string
  hadir: number
  sakit: number
  izin: number
  tugasLuar: number
  /** Jumlah hari yang punya catatan status */
  recorded: number
  /** Persen hadir dari hari tercatat (0 jika tak ada data) */
  pct: number
}

export interface TeacherRecap {
  entries: Map<string, TeacherRecapEntry>
  totals: { hadir: number; sakit: number; izin: number; tugasLuar: number; recorded: number }
  /** Rentang tanggal aktual yang punya data (bila ada) */
  minDate: string | null
  maxDate: string | null
}

export function buildTeacherRecap(rows: TeacherRecapInput[]): TeacherRecap {
  const entries = new Map<string, TeacherRecapEntry>()
  const totals = { hadir: 0, sakit: 0, izin: 0, tugasLuar: 0, recorded: 0 }
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const row of rows) {
    if (!row.status) continue
    let entry = entries.get(row.teacher_id)
    if (!entry) {
      entry = { teacherId: row.teacher_id, hadir: 0, sakit: 0, izin: 0, tugasLuar: 0, recorded: 0, pct: 0 }
      entries.set(row.teacher_id, entry)
    }
    switch (row.status) {
      case 'hadir':
        entry.hadir += 1
        break
      case 'sakit':
        entry.sakit += 1
        break
      case 'izin':
        entry.izin += 1
        break
      case 'tugas_luar':
        entry.tugasLuar += 1
        break
    }
    entry.recorded += 1
    entry.pct = entry.recorded > 0 ? Math.round((entry.hadir / entry.recorded) * 100) : 0

    totals.recorded += 1
    if (row.status === 'hadir') totals.hadir += 1
    else if (row.status === 'sakit') totals.sakit += 1
    else if (row.status === 'izin') totals.izin += 1
    else if (row.status === 'tugas_luar') totals.tugasLuar += 1

    if (!minDate || row.date < minDate) minDate = row.date
    if (!maxDate || row.date > maxDate) maxDate = row.date
  }

  return { entries, totals, minDate, maxDate }
}

/** Tanggal pertama & terakhir bulan (YYYY-MM-DD) */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  return { from: start.format('YYYY-MM-DD'), to: start.endOf('month').format('YYYY-MM-DD') }
}

/** Guru perlu perhatian bila sakit+izin (non-tugas) ≥ 3 hari */
export function isAttention(entry: TeacherRecapEntry): boolean {
  return entry.sakit + entry.izin >= 3
}

/** Nama bulan Indonesia — sinkron dengan konvensi halaman absensi */
export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export type { TeacherAttendanceStatus }
