import { supabase } from '../../lib/supabase'
import type { Ekskul, EkskulFormValues, EkskulMember } from './types'

export async function fetchEkskul(): Promise<Ekskul[]> {
  const { data, error } = await supabase
    .from('extracurriculars')
    .select('*, teachers(id, name), members:extracurricular_members(count)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as Ekskul[]
}

export async function createEkskul(values: EkskulFormValues): Promise<Ekskul> {
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
  return data as Ekskul
}

export async function updateEkskul(id: string, values: EkskulFormValues): Promise<Ekskul> {
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
  return data as Ekskul
}

export async function softDeleteEkskul(id: string): Promise<void> {
  const { error } = await supabase
    .from('extracurriculars')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchEkskulMembers(ekskulId: string): Promise<EkskulMember[]> {
  const { data, error } = await supabase
    .from('extracurricular_members')
    .select('*, students(id, name, registration_code, classes(name))')
    .eq('ekskul_id', ekskulId)
    .is('deleted_at', null)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as EkskulMember[]
}

/** Tambah anggota — yang sudah tergabung dilewati. */
export async function addEkskulMembers(ekskulId: string, studentIds: string[]): Promise<number> {
  const existing = await fetchEkskulMembers(ekskulId)
  const existingSet = new Set(existing.map((m) => m.student_id))
  const fresh = studentIds.filter((id) => !existingSet.has(id))
  if (fresh.length === 0) return 0

  const { error } = await supabase
    .from('extracurricular_members')
    .insert(fresh.map((student_id) => ({ ekskul_id: ekskulId, student_id })))
  if (error) throw error
  return fresh.length
}

export async function removeEkskulMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('extracurricular_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}

export async function setMemberRole(memberId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('extracurricular_members')
    .update({ role })
    .eq('id', memberId)
  if (error) throw error
}
