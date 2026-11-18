import { supabase } from '../../lib/supabase'
import dayjs from 'dayjs'
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

// ─── P2 Absensi per jam pelajaran (module.subject_attendance, 0054) ──────────

export interface SubjectSlot {
  schedule_id: string
  start_time: string
  end_time: string
  subject: string | null
  teacher: string | null
  room: string | null
}

export interface SubjectAttendanceUpsert {
  student_id: string
  schedule_id: string
  date: string
  status: 'H' | 'S' | 'I' | 'A'
  recorded_by: string | null
}

export interface SubjectAttendanceEntry {
  student_id: string
  schedule_id: string
  date: string
  status: 'H' | 'S' | 'I' | 'A'
  subject: string | null
}

/** Slot pelajaran kelas pada satu tanggal = baris jadwal hari itu
 *  (deviasi plan: tanpa tabel time_slots terpisah), guru jam itu
 *  dari jadwal + override substitution_logs bila ada. */
export async function fetchSubjectSlots(classId: string, date: string): Promise<SubjectSlot[]> {
  const d = dayjs(date)
  const isodow = d.day() === 0 ? 7 : d.day()
  const { data, error } = await supabase
    .from('schedules')
    .select(
      'id, start_time, end_time, room, subjects(name), teachers!schedules_teacher_id_fkey(name), substitution_logs!substitution_logs_schedule_id_fkey(date, substitute_teacher_id, teachers!substitution_logs_substitute_teacher_id_fkey(name))',
    )
    .eq('class_id', classId)
    .eq('day_of_week', isodow)
    .is('deleted_at', null)
    .order('start_time')
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => {
    const subs = (r.substitution_logs as Array<{ date: string; teachers: { name: string } | null }> | null) ?? []
    const todaySub = subs.find((s) => s.date === date)
    const teacher = (r.teachers as { name: string } | null)?.name ?? null
    return {
      schedule_id: r.id as string,
      start_time: r.start_time as string,
      end_time: r.end_time as string,
      subject: (r.subjects as { name: string } | null)?.name ?? null,
      teacher: todaySub?.teachers?.name ?? teacher,
      room: (r.room as string | null) ?? null,
    }
  })
}

/** Absensi mapel kelas pada satu tanggal (dipetakan per schedule_id). */
export async function fetchSubjectAttendance(
  scheduleIds: string[],
  date: string,
): Promise<SubjectAttendanceEntry[]> {
  if (scheduleIds.length === 0) return []
  const { data, error } = await supabase
    .from('subject_attendance')
    .select('student_id, schedule_id, date, status')
    .in('schedule_id', scheduleIds)
    .eq('date', date)
  if (error) throw error
  return (data ?? []) as SubjectAttendanceEntry[]
}

export async function upsertSubjectAttendance(payload: SubjectAttendanceUpsert[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('subject_attendance')
    .upsert(payload, { onConflict: 'student_id,schedule_id,date' })
  if (error) throw error
}

/** Rentang tanggal untuk analitik — join jadwal untuk nama mapel. */
export async function fetchSubjectAttendanceRange(
  classId: string,
  from: string,
  to: string,
): Promise<SubjectAttendanceEntry[]> {
  const { data, error } = await supabase
    .from('subject_attendance')
    .select('student_id, schedule_id, date, status, schedules!inner(class_id, subjects(name))')
    .eq('schedules.class_id', classId)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    student_id: r.student_id as string,
    schedule_id: r.schedule_id as string,
    date: r.date as string,
    status: r.status as 'H' | 'S' | 'I' | 'A',
    subject: (r.schedules as { subjects: { name: string } | null } | null)?.subjects?.name ?? null,
  }))
}

/** Rekap absensi mapel satu santri (bulan berjalan) untuk DetailDrawer. */
export async function fetchStudentSubjectRecap(
  studentId: string,
  from: string,
  to: string,
): Promise<SubjectAttendanceEntry[]> {
  const { data, error } = await supabase
    .from('subject_attendance')
    .select('student_id, schedule_id, date, status, schedules(subjects(name))')
    .eq('student_id', studentId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    student_id: r.student_id as string,
    schedule_id: r.schedule_id as string,
    date: r.date as string,
    status: r.status as 'H' | 'S' | 'I' | 'A',
    subject: (r.schedules as { subjects: { name: string } | null } | null)?.subjects?.name ?? null,
  }))
}
