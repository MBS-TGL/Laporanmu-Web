import { supabase } from '../../lib/supabase'
import type { AttendanceDays, StudentAttendanceRow } from './types'

export interface AttendanceUpsert {
  student_id: string
  class_id: string
  year: number
  month: number
  days: AttendanceDays
  updated_by: string | null
}

export async function fetchAttendanceRows(
  classId: string,
  year: number,
  month: number,
): Promise<StudentAttendanceRow[]> {
  const { data, error } = await supabase
    .from('student_attendance')
    .select('id, student_id, class_id, year, month, days')
    .eq('class_id', classId)
    .eq('year', year)
    .eq('month', month)

  if (error) throw error
  return (data ?? []) as StudentAttendanceRow[]
}

export async function upsertAttendance(payload: AttendanceUpsert[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('student_attendance')
    .upsert(payload, { onConflict: 'student_id,year,month' })
  if (error) throw error
}

// Sinkronisasi rekap absensi ke kolom raport bulanan (mekanisme V1)
export async function syncAttendanceToReportCards(
  rows: { student_id: string; days: AttendanceDays }[],
  classId: string,
  year: number,
  month: number,
  updatedBy: string | null,
): Promise<void> {
  if (rows.length === 0) return

  const { data: existing, error: existingError } = await supabase
    .from('student_monthly_reports')
    .select('id, student_id')
    .in(
      'student_id',
      rows.map((r) => r.student_id),
    )
    .eq('month', month)
    .eq('year', year)
  if (existingError) throw existingError

  const existingByStudent = new Map((existing ?? []).map((r) => [r.student_id, r.id]))

  const upserts = rows.map((r) => {
    const summary = summarizeDays(r.days)
    return {
      student_id: r.student_id,
      month,
      year,
      sick_days: summary.S,
      excused_days: summary.I,
      absent_days: summary.A,
      early_leave_days: summary.P,
      updated_by: updatedBy,
      ...(existingByStudent.get(r.student_id) ? { id: existingByStudent.get(r.student_id) } : {}),
    }
  })

  const { error } = await supabase
    .from('student_monthly_reports')
    .upsert(upserts, { onConflict: 'student_id,month,year' })
  if (error) throw error
  void classId
}

export function summarizeDays(days: AttendanceDays): Record<'H' | 'S' | 'I' | 'A' | 'P', number> {
  const out = { H: 0, S: 0, I: 0, A: 0, P: 0 }
  for (const value of Object.values(days)) {
    if (value in out) out[value as keyof typeof out] += 1
  }
  return out
}

export function countWeekdays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let n = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay()
    if (dow !== 0 && dow !== 6) n++
  }
  return n
}
