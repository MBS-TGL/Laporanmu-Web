import { supabase } from '../../lib/supabase'
import type { TahfidzFilters, TahfidzFormValues, TahfidzRecord, TahfidzStats } from './types'

// students!inner agar filter embed (students.name) bisa dipakai
const RECORD_SELECT =
  '*, student:students!inner(id, name, registration_code), teacher:teachers(id, name)'

export async function fetchTahfidz(
  filters: TahfidzFilters,
): Promise<{ data: TahfidzRecord[]; total: number }> {
  const { search, kind, quality, from, to, page, pageSize } = filters
  const fromIdx = (page - 1) * pageSize

  let query = supabase.from('tahfidz_records').select(RECORD_SELECT, { count: 'exact' })

  if (search) query = query.ilike('students.name', `%${search}%`)
  if (kind) query = query.eq('kind', kind)
  if (quality) query = query.eq('quality', quality)
  if (from) query = query.gte('recorded_at', from)
  if (to) query = query.lte('recorded_at', to)

  const { data, count, error } = await query
    .order('recorded_at', { ascending: false })
    .range(fromIdx, fromIdx + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as unknown as TahfidzRecord[], total: count ?? 0 }
}

// Statistik murah: 4 query head-count (tanpa payload baris)
export async function fetchTahfidzStats(): Promise<TahfidzStats> {
  const base = () =>
    supabase.from('tahfidz_records').select('id', { count: 'exact', head: true })

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
