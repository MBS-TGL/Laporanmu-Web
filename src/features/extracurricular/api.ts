import { supabase } from '../../lib/supabase'
import { softDeleteMany } from '../../shared/api/crud'
import type {
  Activity,
  ActivityAttendanceRow,
  ActivityAttendanceUpsert,
  ActivityFormValues,
  ActivityMember,
  StudentBrief,
} from './types'

export async function fetchActivity(): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('extracurriculars')
    .select('*, teachers(id, name), members:extracurricular_members(count)')
    .is('deleted_at', null)
    // Hitung hanya anggota aktif — tanpa filter ini anggota yang sudah
    // dikeluarkan (soft delete) tetap terhitung di count embed (PostgREST
    // menerapkan filter embed sebelum agregasi count).
    .filter('members.deleted_at', 'is', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as Activity[]
}

export async function createActivity(values: ActivityFormValues): Promise<Activity> {
  const { data, error } = await supabase
    .from('extracurriculars')
    .insert({
      name: values.name.trim(),
      coach_id: values.coach_id || null,
      schedule: values.schedule?.trim() || null,
      place: values.place?.trim() || null,
      description: values.description?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Activity
}

export async function updateActivity(id: string, values: ActivityFormValues): Promise<Activity> {
  const { data, error } = await supabase
    .from('extracurriculars')
    .update({
      name: values.name.trim(),
      coach_id: values.coach_id || null,
      schedule: values.schedule?.trim() || null,
      place: values.place?.trim() || null,
      description: values.description?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Activity
}

export async function softDeleteActivity(id: string): Promise<void> {
  const { error } = await supabase
    .from('extracurriculars')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export interface BulkCreateResult {
  inserted: number
  failed: { name: string; error: string }[]
}

/** Insert kegiatan hasil impor per chunk — chunk gagal dilaporkan per baris, bukan membatalkan semuanya. */
export async function bulkCreateActivity(values: ActivityFormValues[]): Promise<BulkCreateResult> {
  const failed: BulkCreateResult['failed'] = []
  let inserted = 0
  const CHUNK_SIZE = 50
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from('extracurriculars').insert(
      chunk.map((v) => ({
        name: v.name.trim(),
        coach_id: v.coach_id || null,
        schedule: v.schedule?.trim() || null,
        place: v.place?.trim() || null,
        description: v.description?.trim() || null,
      })),
    )
    if (error) {
      for (const v of chunk) failed.push({ name: v.name, error: error.message })
    } else {
      inserted += chunk.length
    }
  }
  return { inserted, failed }
}

export async function fetchActivityMembers(activityId: string): Promise<ActivityMember[]> {
  const { data, error } = await supabase
    .from('extracurricular_members')
    .select(
      // phone & status untuk broadcast WA wali anggota (BroadcastModal butuh bentuk Student)
      '*, students(id, name, registration_code, phone, status, classes!students_class_id_fkey(name))',
    )
    .eq('ekskul_id', activityId)
    .is('deleted_at', null)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as ActivityMember[]
}

/** Semua santri aktif dari kelas-kelas terpilih (untuk tambah anggota per kelas). */
export async function fetchStudentsByClasses(classIds: string[]): Promise<StudentBrief[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, registration_code, classes!students_class_id_fkey(name)')
    .is('deleted_at', null)
    .eq('status', 'active')
    .in('class_id', classIds)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as StudentBrief[]
}

/** Tambah anggota — yang sudah tergabung dilewati. */
export async function addActivityMembers(activityId: string, studentIds: string[]): Promise<number> {
  const existing = await fetchActivityMembers(activityId)
  const existingSet = new Set(existing.map((m) => m.student_id))
  const fresh = studentIds.filter((id) => !existingSet.has(id))
  if (fresh.length === 0) return 0

  const { error } = await supabase
    .from('extracurricular_members')
    .insert(fresh.map((student_id) => ({ ekskul_id: activityId, student_id })))
  if (error) throw error
  return fresh.length
}

export async function removeActivityMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('extracurricular_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}

/** Keluarkan banyak anggota sekaligus (aksi massal di drawer anggota). */
export async function removeActivityMembers(memberIds: string[]): Promise<void> {
  await softDeleteMany('extracurricular_members', memberIds)
}

export async function setMemberRole(memberId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('extracurricular_members')
    .update({ role })
    .eq('id', memberId)
  if (error) throw error
}

// ─── Presensi bulanan (pola halaqah_attendance, tanpa session) ──────────────

export async function fetchActivityAttendance(
  activityId: string,
  year: number,
  month: number,
): Promise<ActivityAttendanceRow[]> {
  const { data, error } = await supabase
    .from('ekskul_attendance')
    .select('id, ekskul_id, student_id, year, month, days, notes')
    .eq('ekskul_id', activityId)
    .eq('year', year)
    .eq('month', month)
  if (error) throw error
  return (data ?? []) as ActivityAttendanceRow[]
}

/** Upsert presensi — konflik pada unique (activity, santri, tahun, bulan). */
export async function saveActivityAttendance(payload: ActivityAttendanceUpsert[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('ekskul_attendance')
    .upsert(payload, { onConflict: 'ekskul_id,student_id,year,month' })
  if (error) throw error
}

export interface StudentActivityBrief {
  id: string
  role: string
  activity: { id: string; name: string } | null
}

/** Keikutsertaan activity satu santri (untuk penilaian di raport semester). */
export async function fetchActivityByStudent(studentId: string): Promise<StudentActivityBrief[]> {
  const { data, error } = await supabase
    .from('extracurricular_members')
    .select('id, role, activity:extracurriculars(id, name)')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .filter('extracurriculars.deleted_at', 'is', null)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as StudentActivityBrief[]
}
