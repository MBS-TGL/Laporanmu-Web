import { supabase } from '../../lib/supabase'
import type { ClassFilters, ClassFormValues, ClassRow } from './types'

const SELECT_STR =
  '*, students(count), homeroom_teacher:teachers!classes_homeroom_teacher_id_fkey(name), academic_year:academic_years(name)'

function extractCount(students: ClassRow['students']): number {
  if (!students) return 0
  if (Array.isArray(students)) {
    const first = students[0]
    if (first && typeof first === 'object' && 'count' in first) return first.count
    return 0
  }
  if (typeof students === 'object' && 'count' in students) return students.count
  return 0
}

export { extractCount }

export async function fetchClasses(filters: ClassFilters): Promise<{ data: ClassRow[]; total: number }> {
  const { search, academicYearId, page, pageSize } = filters
  const from = (page - 1) * pageSize

  let query = supabase
    .from('classes')
    .select(SELECT_STR, { count: 'exact' })
    .is('deleted_at', null)

  if (search) query = query.ilike('name', `%${search}%`)
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)

  const { data, count, error } = await query
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as unknown as ClassRow[], total: count ?? 0 }
}

export async function createClass(values: ClassFormValues): Promise<ClassRow> {
  const { data, error } = await supabase
    .from('classes')
    .insert({
      name: values.name,
      grade: values.grade,
      major: values.major || null,
      academic_year_id: values.academic_year_id,
      homeroom_teacher_id: values.homeroom_teacher_id || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as ClassRow
}

export async function updateClass(id: string, values: ClassFormValues): Promise<ClassRow> {
  const { data, error } = await supabase
    .from('classes')
    .update({
      name: values.name,
      grade: values.grade,
      major: values.major || null,
      academic_year_id: values.academic_year_id,
      homeroom_teacher_id: values.homeroom_teacher_id || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as ClassRow
}

export async function softDeleteClass(id: string): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
