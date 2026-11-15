import { supabase } from '../../lib/supabase'
import type {
  HalaqahAttendanceRow,
  HalaqahAttendanceUpsert,
  HalaqahFormValues,
  HalaqahGroup,
  HalaqahMember,
  HalaqahSession,
  TahfidzFilters,
  TahfidzFormValues,
  TahfidzRecord,
  TahfidzStats,
} from './types'

export async function fetchHalaqah(): Promise<HalaqahGroup[]> {
  const { data, error } = await supabase
    .from('halaqah_groups')
    .select('*, teachers(id, name), members:halaqah_members(count)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as HalaqahGroup[]
}

export async function createHalaqah(values: HalaqahFormValues): Promise<HalaqahGroup> {
  const { data, error } = await supabase
    .from('halaqah_groups')
    .insert({
      name: values.name.trim(),
      musyrif_id: values.musyrif_id || null,
      gender: values.gender || null,
      place: values.place?.trim() || null,
      schedule: values.schedule?.trim() || null,
      capacity: values.capacity ?? 0,
      notes: values.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as HalaqahGroup
}

export async function updateHalaqah(id: string, values: HalaqahFormValues): Promise<HalaqahGroup> {
  const { data, error } = await supabase
    .from('halaqah_groups')
    .update({
      name: values.name.trim(),
      musyrif_id: values.musyrif_id || null,
      gender: values.gender || null,
      place: values.place?.trim() || null,
      schedule: values.schedule?.trim() || null,
      capacity: values.capacity ?? 0,
      notes: values.notes?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as HalaqahGroup
}

export async function softDeleteHalaqah(id: string): Promise<void> {
  const { error } = await supabase
    .from('halaqah_groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchHalaqahMembers(groupId: string): Promise<HalaqahMember[]> {
  const { data, error } = await supabase
    .from('halaqah_members')
    .select('*, students(id, name, registration_code, classes!students_class_id_fkey(name))')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as HalaqahMember[]
}

/** Tambah anggota — yang sudah tergabung dilewati (aman dari unique aktif). */
export async function addHalaqahMembers(
  groupId: string,
  studentIds: string[],
): Promise<number> {
  const existing = await fetchHalaqahMembers(groupId)
  const existingSet = new Set(existing.map((m) => m.student_id))
  const fresh = studentIds.filter((id) => !existingSet.has(id))
  if (fresh.length === 0) return 0

  const { error } = await supabase
    .from('halaqah_members')
    .insert(fresh.map((student_id) => ({ group_id: groupId, student_id })))
  if (error) throw error
  return fresh.length
}

export async function removeHalaqahMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('halaqah_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}

// ─── Presensi halaqah ────────────────────────────────────────────────────────

export async function fetchHalaqahAttendance(
  groupId: string,
  session: HalaqahSession,
  year: number,
  month: number,
): Promise<HalaqahAttendanceRow[]> {
  const { data, error } = await supabase
    .from('halaqah_attendance')
    .select('id, group_id, student_id, session, year, month, days, notes')
    .eq('group_id', groupId)
    .eq('session', session)
    .eq('year', year)
    .eq('month', month)
  if (error) throw error
  return (data ?? []) as HalaqahAttendanceRow[]
}

/** Upsert presensi — konflik pada unique (group, santri, sesi, tahun, bulan). */
export async function saveHalaqahAttendance(payload: HalaqahAttendanceUpsert[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('halaqah_attendance')
    .upsert(payload, { onConflict: 'group_id,student_id,session,year,month' })
  if (error) throw error
}

// ─── Setoran hafalan (tahfidz) ───────────────────────────────────────────────

// students!inner agar filter embed (students.name) bisa dipakai
const RECORD_SELECT =
  '*, student:students!inner(id, name, registration_code), teacher:teachers(id, name)'

export async function fetchTahfidz(
  filters: TahfidzFilters,
): Promise<{ data: TahfidzRecord[]; total: number }> {
  const { search, kind, quality, from, to, studentIds, page, pageSize } = filters
  const fromIdx = (page - 1) * pageSize

  let query = supabase.from('tahfidz_records').select(RECORD_SELECT, { count: 'exact' })

  if (search) query = query.ilike('students.name', `%${search}%`)
  if (kind) query = query.eq('kind', kind)
  if (quality) query = query.eq('quality', quality)
  if (from) query = query.gte('recorded_at', from)
  if (to) query = query.lte('recorded_at', to)
  // Scope musyrif: setoran santri anggota kelompok guru tsb
  if (studentIds?.length) query = query.in('student_id', studentIds)

  const { data, count, error } = await query
    .order('recorded_at', { ascending: false })
    .range(fromIdx, fromIdx + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as unknown as TahfidzRecord[], total: count ?? 0 }
}

// Statistik murah: 4 query head-count (tanpa payload baris)
export async function fetchTahfidzStats(studentIds?: string[]): Promise<TahfidzStats> {
  const base = () => {
    let q = supabase.from('tahfidz_records').select('id', { count: 'exact', head: true })
    // Scope musyrif — tanpa scope, angka sekolah
    if (studentIds?.length) q = q.in('student_id', studentIds)
    return q
  }

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoStr = weekAgo.toISOString().slice(0, 10)

  const [total, ziyadah, murojaah, week] = await Promise.all([
    base(),
    base().eq('kind', 'ziyadah'),
    base().eq('kind', 'murojaah'),
    base().gte('recorded_at', weekAgoStr),
  ])

  return {
    total: total.count ?? 0,
    ziyadah: ziyadah.count ?? 0,
    murojaah: murojaah.count ?? 0,
    week: week.count ?? 0,
  }
}

export async function createTahfidz(values: TahfidzFormValues): Promise<TahfidzRecord> {
  const { data, error } = await supabase
    .from('tahfidz_records')
    .insert({
      student_id: values.student_id,
      teacher_id: values.teacher_id || null,
      kind: values.kind,
      surah: values.surah.trim(),
      from_ayat: values.from_ayat ?? null,
      to_ayat: values.to_ayat ?? null,
      quality: values.quality || null,
      note: values.note?.trim() || null,
      recorded_at: values.recorded_at,
    })
    .select(RECORD_SELECT)
    .single()
  if (error) throw error
  return data as unknown as TahfidzRecord
}

export async function updateTahfidz(id: string, values: TahfidzFormValues): Promise<TahfidzRecord> {
  const { data, error } = await supabase
    .from('tahfidz_records')
    .update({
      student_id: values.student_id,
      teacher_id: values.teacher_id || null,
      kind: values.kind,
      surah: values.surah.trim(),
      from_ayat: values.from_ayat ?? null,
      to_ayat: values.to_ayat ?? null,
      quality: values.quality || null,
      note: values.note?.trim() || null,
      recorded_at: values.recorded_at,
    })
    .eq('id', id)
    .select(RECORD_SELECT)
    .single()
  if (error) throw error
  return data as unknown as TahfidzRecord
}

export async function deleteTahfidz(id: string): Promise<void> {
  const { error } = await supabase.from('tahfidz_records').delete().eq('id', id)
  if (error) throw error
}

// Riwayat hafalan satu santri (dipakai di form: setoran terakhir santri)
export async function fetchTahfidzByStudent(studentId: string, limit = 5): Promise<TahfidzRecord[]> {
  const { data, error } = await supabase
    .from('tahfidz_records')
    .select(RECORD_SELECT)
    .eq('student_id', studentId)
    .order('recorded_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as TahfidzRecord[]
}
