import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import type { Admission, AdmissionFilters, AdmissionStage, ConversionInput } from './types'

const SELECT = '*'

export async function fetchAdmissions(filters: AdmissionFilters = {}): Promise<Admission[]> {
  let query = supabase
    .from('admissions')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(1000)

  query = filters.archived
    ? query.not('deleted_at', 'is', null)
    : query.is('deleted_at', null)

  if (filters.stage) query = query.eq('stage', filters.stage)
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(
      `full_name.ilike.${term},registration_number.ilike.${term},parent_name.ilike.${term},origin_school.ilike.${term}`,
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Admission[]
}

export async function updateAdmissionStage(id: string, stage: AdmissionStage): Promise<void> {
  const { error } = await supabase.from('admissions').update({ stage }).eq('id', id)
  if (error) throw error
}

export async function updateAdmissionNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('admissions')
    .update({ notes: notes.trim() || null })
    .eq('id', id)
  if (error) throw error
}

export async function archiveAdmission(id: string): Promise<void> {
  await softDelete('admissions', id)
}

export async function restoreAdmission(id: string): Promise<void> {
  const { error } = await supabase.from('admissions').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

export async function convertAdmission(input: ConversionInput): Promise<string> {
  const { data, error } = await supabase.rpc('convert_admission_to_student', {
    p_admission_id: input.admissionId,
    p_class_id: input.classId,
    p_registration_code: input.registrationCode?.trim() || null,
  })
  if (error) throw error
  return data as string
}
