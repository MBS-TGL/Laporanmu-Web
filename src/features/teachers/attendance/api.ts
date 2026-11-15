import { supabase } from '../../../lib/supabase'
import type { TeacherAttendance, TeacherAttendanceDeleteTarget, TeacherAttendancePayload } from './types'

export async function fetchTeacherAttendance(date: string): Promise<TeacherAttendance[]> {
  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('*, teachers(id, name, nbm, subject, phone)')
    .eq('date', date)

  if (error) throw error
  return (data ?? []) as unknown as TeacherAttendance[]
}

/** Rekap rentang tanggal (inklusif) — untuk rekap bulanan */
export async function fetchTeacherAttendanceRange(from: string, to: string): Promise<TeacherAttendance[]> {
  const { data, error } = await supabase
    .from('teacher_attendance')
    .select('*, teachers(id, name, nbm, subject, phone)')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as TeacherAttendance[]
}

export async function upsertTeacherAttendance(payload: TeacherAttendancePayload[]): Promise<void> {
  if (payload.length === 0) return

  const { error } = await supabase.from('teacher_attendance').upsert(
    payload.map((p) => ({
      teacher_id: p.teacher_id,
      date: p.date,
      status: p.status,
      note: p.note || null,
    })),
    { onConflict: 'teacher_id,date' }
  )

  if (error) throw error
}

/**
 * Hapus baris absensi per pasangan guru+tanggal.
 * Supabase tidak punya `IN` tuple, jadi dijalankan paralel agar tidak
 * menghapus kombinasi silang (cross-product) guru × tanggal.
 */
export async function deleteTeacherAttendance(items: TeacherAttendanceDeleteTarget[]): Promise<void> {
  if (items.length === 0) return

  await Promise.all(
    items.map(async ({ teacher_id, date }) => {
      const { error } = await supabase
        .from('teacher_attendance')
        .delete()
        .eq('teacher_id', teacher_id)
        .eq('date', date)
      if (error) throw error
    }),
  )
}
