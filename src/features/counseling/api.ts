import { supabase } from '../../lib/supabase'
import type {
  CounselingCategory,
  CounselingFormValues,
  CounselingLog,
  CounselingStatus,
  CounselingUrgency,
} from './types'

export interface CounselingFilters {
  search?: string
  category?: CounselingCategory
  urgency?: CounselingUrgency
  status?: CounselingStatus
}

export async function fetchCounselingLogs(filters: CounselingFilters): Promise<CounselingLog[]> {
  let query = supabase
    .from('counseling_logs')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false })

  if (filters.category) query = query.eq('category', filters.category)
  if (filters.urgency) query = query.eq('urgency', filters.urgency)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(
      `student_name.ilike.${term},counselor_name.ilike.${term},complaint.ilike.${term},diagnosis.ilike.${term}`,
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CounselingLog[]
}

export interface CreateCounselingInput {
  values: CounselingFormValues
  studentName: string
  className: string | null
  createdBy: string | null
}

export async function createCounselingLog(input: CreateCounselingInput): Promise<CounselingLog> {
  const { values, studentName, className, createdBy } = input
  const { data, error } = await supabase
    .from('counseling_logs')
    .insert({
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
      created_by: createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CounselingLog
}

export async function updateCounselingStatus(
  id: string,
  status: CounselingStatus,
): Promise<void> {
  const { error } = await supabase.from('counseling_logs').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteCounselingLog(id: string): Promise<void> {
  const { error } = await supabase.from('counseling_logs').delete().eq('id', id)
  if (error) throw error
}
