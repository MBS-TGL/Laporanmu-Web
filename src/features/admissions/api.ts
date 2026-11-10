import { supabase } from '../../lib/supabase'
import type { Admission, AdmissionFormValues, AdmissionStage } from './types'

export async function fetchAdmissions(): Promise<Admission[]> {
  const { data, error } = await supabase
    .from('admissions')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as Admission[]
}

/** Nomor registrasi otomatis: PPDB-<tahun>-<urut 4 digit> */
export async function nextRegistrationNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const { count, error } = await supabase
    .from('admissions')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (error) throw error
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `PPDB-${year}-${seq}`
}

export async function createAdmission(
  values: AdmissionFormValues,
  registrationNumber: string,
): Promise<Admission> {
  const { data, error } = await supabase
    .from('admissions')
    .insert({
      registration_number: registrationNumber,
      full_name: values.full_name.trim(),
      gender: values.gender || null,
      birth_place: values.birth_place?.trim() || null,
      birth_date: values.birth_date || null,
      origin_school: values.origin_school?.trim() || null,
      target_grade: values.target_grade?.trim() || null,
      parent_name: values.parent_name?.trim() || null,
      parent_phone: values.parent_phone?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Admission
}

export async function updateAdmission(
  id: string,
  values: AdmissionFormValues,
): Promise<Admission> {
  const { data, error } = await supabase
    .from('admissions')
    .update({
      full_name: values.full_name.trim(),
      gender: values.gender || null,
      birth_place: values.birth_place?.trim() || null,
      birth_date: values.birth_date || null,
      origin_school: values.origin_school?.trim() || null,
      target_grade: values.target_grade?.trim() || null,
      parent_name: values.parent_name?.trim() || null,
      parent_phone: values.parent_phone?.trim() || null,
      address: values.address?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Admission
}

export async function setAdmissionStage(id: string, stage: AdmissionStage): Promise<void> {
  const { error } = await supabase.from('admissions').update({ stage }).eq('id', id)
  if (error) throw error
}

export async function softDeleteAdmission(id: string): Promise<void> {
  const { error } = await supabase
    .from('admissions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
