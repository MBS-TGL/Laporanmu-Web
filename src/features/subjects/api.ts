import { supabase } from '../../lib/supabase'
import type { Subject, SubjectFormValues } from './types'

export async function fetchSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as Subject[]
}

export async function createSubject(values: SubjectFormValues): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      name: values.name.trim(),
      code: values.code?.trim() || null,
      weekly_hours: values.weekly_hours ?? 0,
      category: values.category?.trim() || null,
      description: values.description?.trim() || null,
      is_active: values.is_active,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Subject
}

export async function updateSubject(id: string, values: SubjectFormValues): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .update({
      name: values.name.trim(),
      code: values.code?.trim() || null,
      weekly_hours: values.weekly_hours ?? 0,
      category: values.category?.trim() || null,
      description: values.description?.trim() || null,
      is_active: values.is_active,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Subject
}

export async function softDeleteSubject(id: string): Promise<void> {
  const { error } = await supabase
    .from('subjects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function subjectCodeExists(code: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from('subjects')
    .select('id', { count: 'exact', head: true })
    .eq('code', code)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}
