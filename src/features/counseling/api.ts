import dayjs from 'dayjs'
import { supabase } from '../../lib/supabase'
import type {
  CounselingFilters,
  CounselingListResult,
  CounselingLog,
  CounselingFormValues,
  CounselingStatListKind,
  CounselingStats,
  CounselingStatus,
} from './types'

// Batas aman jumlah baris ekspor sekali jalan
export const COUNSELING_EXPORT_LIMIT = 5_000

// Batas daftar drawer statistik (ringkas, bukan data lengkap)
const STAT_LIST_LIMIT = 50

// Query dasar dengan semua filter aktif dipasang — pemakaian ulang untuk
// daftar pagination & ekspor agar keduanya selalu konsisten.
function buildFilteredQuery(filters: CounselingFilters) {
  let query = supabase.from('counseling_logs').select('*')
  if (filters.category) query = query.eq('category', filters.category)
  if (filters.urgency) query = query.eq('urgency', filters.urgency)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.from) query = query.gte('date', filters.from)
  if (filters.to) query = query.lte('date', filters.to)
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(
      `student_name.ilike.${term},counselor_name.ilike.${term},complaint.ilike.${term},diagnosis.ilike.${term},action_plan.ilike.${term}`,
    )
  }
  return query
}

/** Daftar sesi dengan pagination server-side — DB yang menyaring & menghitung. */
export async function fetchCounselingLogs(
  filters: CounselingFilters & { page: number; pageSize: number },
): Promise<CounselingListResult> {
  const { page, pageSize } = filters
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await buildFilteredQuery(filters)
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .range(from, to)

  if (error) throw error
  return { data: (data ?? []) as CounselingLog[], total: count ?? 0 }
}

// ------------------------------------------------------------
// Ekspor
// ------------------------------------------------------------

export async function fetchCounselingForExport(
  filters: CounselingFilters,
): Promise<CounselingLog[]> {
  const { data, error } = await buildFilteredQuery(filters)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .limit(COUNSELING_EXPORT_LIMIT)
  if (error) throw error
  return (data ?? []) as CounselingLog[]
}

export async function fetchCounselingByIds(ids: string[]): Promise<CounselingLog[]> {
  const { data, error } = await supabase
    .from('counseling_logs')
    .select('*')
    .in('id', ids)
    .order('date', { ascending: true })
    .order('time', { ascending: true })
  if (error) throw error
  return (data ?? []) as CounselingLog[]
}

/** Baris ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
export async function fetchCounselingStats(): Promise<CounselingStats> {
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')

  const [totalRes, activeRes, highRes, doneRes] = await Promise.all([
    supabase.from('counseling_logs').select('id', { count: 'exact', head: true }),
    supabase.from('counseling_logs').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase
      .from('counseling_logs')
      .select('id', { count: 'exact', head: true })
      .eq('urgency', 'high')
      .eq('status', 'in_progress'),
    supabase
      .from('counseling_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('date', monthStart),
  ])

  if (totalRes.error) throw totalRes.error
  if (activeRes.error) throw activeRes.error
  if (highRes.error) throw highRes.error
  if (doneRes.error) throw doneRes.error

  return {
    total: totalRes.count ?? 0,
    inProgress: activeRes.count ?? 0,
    highUrgencyActive: highRes.count ?? 0,
    completedThisMonth: doneRes.count ?? 0,
  }
}

/** Daftar ringkas untuk drawer statistik (dalam proses / urgensi tinggi). */
export async function fetchCounselingStatList(
  kind: CounselingStatListKind,
): Promise<CounselingLog[]> {
  let query = supabase
    .from('counseling_logs')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
  query = kind === 'in_progress' ? query.eq('status', 'in_progress') : query.eq('urgency', 'high').eq('status', 'in_progress')
  const { data, error } = await query.limit(STAT_LIST_LIMIT)
  if (error) throw error
  return (data ?? []) as CounselingLog[]
}

/** Riwayat sesi BK satu santri — untuk drawer detail. */
export async function fetchStudentCounseling(studentId: string): Promise<CounselingLog[]> {
  const { data, error } = await supabase
    .from('counseling_logs')
    .select('*')
    .eq('student_id', studentId)
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as CounselingLog[]
}

// ------------------------------------------------------------
// Mutasi
// ------------------------------------------------------------

export interface CreateCounselingInput {
  values: CounselingFormValues
  studentName: string
  className: string | null
  createdBy: string | null
}

export async function createCounselingLog(input: CreateCounselingInput): Promise<CounselingLog> {
  const { values, studentName, className, createdBy } = input
  const additionalCount = values.additional_student_ids?.length ?? 0
  const displayName = additionalCount > 0 ? `${studentName} (+${additionalCount} santri)` : studentName

  const { data, error } = await supabase
    .from('counseling_logs')
    .insert({
      date: values.date,
      time: values.time,
      student_id: values.student_id,
      student_name: displayName,
      class_name: className,
      counselor_name: values.counselor_name || 'Konselor',
      category: values.category,
      complaint: values.complaint,
      diagnosis: values.diagnosis || null,
      action_plan: values.action_plan || null,
      urgency: values.urgency,
      status: values.status,
      created_by: createdBy,
    })
    .select('*')
    .single()
  if (error) throw error

  // Simpan semua partisipan ke counseling_participants jika ada santri tambahan (kelompok)
  if (data && additionalCount > 0 && values.additional_student_ids) {
    const allIds = Array.from(new Set([values.student_id, ...values.additional_student_ids]))
    const participantRows = allIds.map((sId) => ({
      counseling_id: data.id,
      student_id: sId,
    }))
    await supabase.from('counseling_participants').insert(participantRows)
  }

  return data as CounselingLog
}

export interface UpdateCounselingInput {
  id: string
  values: CounselingFormValues
  studentName: string
  className: string | null
}

export async function updateCounselingLog(input: UpdateCounselingInput): Promise<CounselingLog> {
  const { id, values, studentName, className } = input
  const { data, error } = await supabase
    .from('counseling_logs')
    .update({
      date: values.date,
      time: values.time,
      student_id: values.student_id,
      student_name: studentName,
      class_name: className,
      counselor_name: values.counselor_name || 'Konselor',
      category: values.category,
      complaint: values.complaint,
      diagnosis: values.diagnosis || null,
      action_plan: values.action_plan || null,
      urgency: values.urgency,
      status: values.status,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CounselingLog
}

export async function updateCounselingStatus(id: string, status: CounselingStatus): Promise<void> {
  const { error } = await supabase.from('counseling_logs').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteCounselingLog(id: string): Promise<void> {
  const { error } = await supabase.from('counseling_logs').delete().eq('id', id)
  if (error) throw error
}
