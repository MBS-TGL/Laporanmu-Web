import { supabase } from '../../lib/supabase'
import type { Teacher, TeacherFilters, TeacherFormValues } from './types'

export async function fetchTeachers(filters: TeacherFilters): Promise<{ data: Teacher[]; total: number }> {
  const { search, status, gender, page, pageSize } = filters
  const from = (page - 1) * pageSize

  let query = supabase
    .from('teachers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  if (search) {
    const term = `%${search}%`
    query = query.or(`name.ilike.${term},nbm.ilike.${term},subject.ilike.${term}`)
  }
  if (status) query = query.eq('status', status)
  if (gender) query = query.eq('gender', gender)

  const { data, count, error } = await query
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as Teacher[], total: count ?? 0 }
}

export async function createTeacher(values: TeacherFormValues): Promise<Teacher> {
  const { data, error } = await supabase
    .from('teachers')
    .insert({
      name: values.name,
      nbm: values.nbm || null,
      subject: values.subject || null,
      gender: values.gender ?? null,
      phone: values.phone || null,
      email: values.email || null,
      status: values.status,
      join_date: values.join_date || null,
      nik: values.nik || null,
      nip: values.nip || null,
      nuptk: values.nuptk || null,
      notes: values.notes || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Teacher
}

export async function updateTeacher(id: string, values: TeacherFormValues): Promise<Teacher> {
  const { data, error } = await supabase
    .from('teachers')
    .update({
      name: values.name,
      nbm: values.nbm || null,
      subject: values.subject || null,
      gender: values.gender ?? null,
      phone: values.phone || null,
      email: values.email || null,
      status: values.status,
      join_date: values.join_date || null,
      nik: values.nik || null,
      nip: values.nip || null,
      nuptk: values.nuptk || null,
      notes: values.notes || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Teacher
}

export async function softDeleteTeacher(id: string): Promise<void> {
  const { error } = await supabase
    .from('teachers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function nbmExists(nbm: string, excludeId?: string): Promise<boolean> {
  if (!nbm) return false
  let query = supabase
    .from('teachers')
    .select('id', { count: 'exact', head: true })
    .eq('nbm', nbm)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}
