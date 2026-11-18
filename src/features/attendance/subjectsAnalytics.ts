import type { SubjectAttendanceEntry } from './api'

/**
 * Analitik absensi mapel (murni, tanpa I/O) — P2 Attendance Center.
 * Semua hitungan dari data `subject_attendance` rentang tanggal.
 */

export interface WeeklyPoint {
  /** Senin dari minggu itu (YYYY-MM-DD) */
  weekStart: string
  hadir: number
  total: number
  pct: number
}

/** Tren mingguan: % hadir per minggu (Senin sebagai awal minggu, ISO). */
export function weeklyTrend(entries: SubjectAttendanceEntry[]): WeeklyPoint[] {
  const buckets = new Map<string, { hadir: number; total: number }>()
  for (const e of entries) {
    const week = weekStartOf(e.date)
    const b = buckets.get(week) ?? { hadir: 0, total: 0 }
    b.total += 1
    if (e.status === 'H') b.hadir += 1
    buckets.set(week, b)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, b]) => ({
      weekStart,
      hadir: b.hadir,
      total: b.total,
      pct: b.total > 0 ? Math.round((b.hadir / b.total) * 100) : 0,
    }))
}

export function weekStartOf(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (dow - 1))
  return d.toISOString().slice(0, 10)
}

export interface SubjectHeatRow {
  subject: string
  hadir: number
  sakit: number
  izin: number
  alpa: number
  total: number
  pct: number
}

/** Heat map per mapel: rekap status + % hadir, terurut dari % terendah. */
export function heatmapBySubject(entries: SubjectAttendanceEntry[]): SubjectHeatRow[] {
  const map = new Map<string, SubjectHeatRow>()
  for (const e of entries) {
    const key = e.subject ?? 'Tanpa Mapel'
    const row = map.get(key) ?? { subject: key, hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0, pct: 0 }
    row.total += 1
    if (e.status === 'H') row.hadir += 1
    else if (e.status === 'S') row.sakit += 1
    else if (e.status === 'I') row.izin += 1
    else if (e.status === 'A') row.alpa += 1
    map.set(key, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, pct: r.total > 0 ? Math.round((r.hadir / r.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
}

export interface StudentAbsenceCount {
  studentId: string
  alpa: number
  total: number
}

/** Santri dengan alpa (A) ≥ ambang dalam rentang data — kandidat watchlist BK. */
export function earlyWarning(
  entries: SubjectAttendanceEntry[],
  threshold: number,
): StudentAbsenceCount[] {
  const map = new Map<string, StudentAbsenceCount>()
  for (const e of entries) {
    const row = map.get(e.student_id) ?? { studentId: e.student_id, alpa: 0, total: 0 }
    row.total += 1
    if (e.status === 'A') row.alpa += 1
    map.set(e.student_id, row)
  }
  return [...map.values()]
    .filter((r) => r.alpa >= threshold)
    .sort((a, b) => b.alpa - a.alpa || b.total - a.total)
}
