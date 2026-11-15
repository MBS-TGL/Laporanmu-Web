import { countWeekdays, summarizeDays } from '../attendance/api'
import { STATUS_ORDER } from '../attendance/constants'
import type { AttendanceStatus } from '../attendance/types'
import type { HalaqahAttendanceDays } from './types'

// ─── Ambang batas alert (localStorage) ──────────────────────────────────────

export const THRESHOLD_KEY = 'halaqah_presensi_alert'
export const DEFAULT_THRESHOLD = { alpa: 3, hadirPct: 75 }

export type PresensiThreshold = { alpa: number; hadirPct: number }

export function loadThreshold(): PresensiThreshold {
  try {
    const raw = localStorage.getItem(THRESHOLD_KEY)
    if (raw) return { ...DEFAULT_THRESHOLD, ...JSON.parse(raw) }
  } catch {
    /* quota / parse */
  }
  return DEFAULT_THRESHOLD
}

// ─── Statistik grid presensi (murni) ────────────────────────────────────────

export interface PresensiStats {
  totals: Record<AttendanceStatus, number>
  /** Persen sel hari-kerja yang sudah terisi (anggota × hari kerja). */
  completion: number
}

/** Rekap status semua anggota + kelengkapan pengisian grid bulan tsb. */
export function computePresensiStats(
  students: { id: string }[],
  daysById: Map<string, HalaqahAttendanceDays>,
  year: number,
  month: number,
): PresensiStats {
  const totals: Record<AttendanceStatus, number> = { H: 0, S: 0, I: 0, A: 0, P: 0 }
  const daysInMonth = new Date(year, month, 0).getDate()
  const weekdays = countWeekdays(year, month)
  let filledWeekdayCells = 0
  for (const s of students) {
    const days = daysById.get(s.id) ?? {}
    const sum = summarizeDays(days)
    for (const st of STATUS_ORDER) totals[st] += sum[st]
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month - 1, d).getDay()
      if (dow === 0 || dow === 6) continue
      if (days[String(d)]) filledWeekdayCells += 1
    }
  }
  const completion =
    students.length > 0 && weekdays > 0
      ? Math.round((filledWeekdayCells / (weekdays * students.length)) * 100)
      : 0
  return { totals, completion }
}
