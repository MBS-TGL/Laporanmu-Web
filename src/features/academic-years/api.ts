import { supabase } from '../../lib/supabase'
import type { AcademicYear, AcademicYearFilters, YearFormValues } from './types'

export async function fetchAcademicYears(
  filters: AcademicYearFilters,
): Promise<{ data: AcademicYear[]; total: number }> {
  const { search, page, pageSize } = filters
  const from = (page - 1) * pageSize

  let query = supabase
    .from('academic_years')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as AcademicYear[], total: count ?? 0 }
}

export async function createAcademicYear(values: YearFormValues): Promise<AcademicYear> {
  const { data, error } = await supabase
    .from('academic_years')
    .insert({
      name: values.name,
      semester: values.semester,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      curriculum: values.curriculum || null,
      is_active: values.makeActive ?? false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as AcademicYear
}

export async function updateAcademicYear(
  id: string,
  values: YearFormValues,
): Promise<AcademicYear> {
  const { data, error } = await supabase
    .from('academic_years')
    .update({
      name: values.name,
      semester: values.semester,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      curriculum: values.curriculum || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as AcademicYear
}

export async function softDeleteAcademicYear(id: string): Promise<void> {
  const { error } = await supabase
    .from('academic_years')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Nonaktifkan semua tahun lain, lalu aktifkan target (urutan sama seperti legacy). */
export async function setActiveAcademicYear(id: string): Promise<void> {
  const deactivate = await supabase
    .from('academic_years')
    .update({ is_active: false })
    .neq('id', id)
  if (deactivate.error) throw deactivate.error

  const activate = await supabase
    .from('academic_years')
    .update({ is_active: true })
    .eq('id', id)
  if (activate.error) throw activate.error
}
