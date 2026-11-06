import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import type { Student, StudentBrief, StudentFilters, StudentFormValues } from './types'

const SELECT_STR = '*, classes(name), dorms(name)'

export async function fetchStudents(filters: StudentFilters): Promise<{ data: Student[]; total: number }> {
  const { search, classId, gender, status, page, pageSize } = filters
  const from = (page - 1) * pageSize

  let query = supabase
    .from('students')
    .select(SELECT_STR, { count: 'exact' })
    .is('deleted_at', null)

  if (search) {
    const term = `%${search}%`
    query = query.or(`name.ilike.${term},registration_code.ilike.${term},nisn.ilike.${term}`)
  }
  if (classId) query = query.eq('class_id', classId)
  if (gender) query = query.eq('gender', gender)
  if (status) query = query.eq('status', status)

  const { data, count, error } = await query
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as Student[], total: count ?? 0 }
}

// Versi tanpa pagination — untuk ekspor CSV (mengikuti filter aktif)
export async function fetchAllStudents(
  filters: Omit<StudentFilters, 'page' | 'pageSize'>,
): Promise<Student[]> {
  const { search, classId, gender, status } = filters

  let query = supabase.from('students').select(SELECT_STR).is('deleted_at', null)

  if (search) {
    const term = `%${search}%`
    query = query.or(`name.ilike.${term},registration_code.ilike.${term},nisn.ilike.${term}`)
  }
  if (classId) query = query.eq('class_id', classId)
  if (gender) query = query.eq('gender', gender)
  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as Student[]
}

export function downloadStudentsCsv(students: Student[]): void {
  const csv = Papa.unparse(
    students.map((s) => ({
      Nama: s.name,
      'Kode Registrasi': s.registration_code,
      NISN: s.nisn ?? '',
      NIS: s.nis ?? '',
      Gender: s.gender ?? '',
      Status: s.status,
      Kelas: s.classes?.name ?? '',
      Asrama: s.dorms?.name ?? '',
      Poin: s.total_points,
      Telepon: s.phone ?? '',
      Wali: s.guardian_name ?? '',
    })),
  )
  // BOM agar Excel membaca UTF-8 dengan benar
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `data-siswa-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function payload(values: StudentFormValues) {
  return {
    name: values.name,
    registration_code: values.registration_code,
    class_id: values.class_id,
    dorm_id: values.dorm_id || null,
    gender: values.gender ?? null,
    status: values.status,
    nisn: values.nisn || null,
    nis: values.nis || null,
    phone: values.phone || null,
    birth_place: values.birth_place || null,
    birth_date: values.birth_date || null,
    religion: values.religion || null,
    address: values.address || null,
    guardian_name: values.guardian_name || null,
    guardian_relation: values.guardian_relation || null,
    tags: values.tags ?? [],
  }
}

export async function createStudent(values: StudentFormValues): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .insert(payload(values))
    .select(SELECT_STR)
    .single()

  if (error) throw error
  return data as Student
}

export async function updateStudent(id: string, values: StudentFormValues): Promise<Student> {
  const { data, error } = await supabase
    .from('students')
    .update(payload(values))
    .eq('id', id)
    .select(SELECT_STR)
    .single()

  if (error) throw error
  return data as Student
}

export async function softDeleteStudent(id: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function registrationCodeExists(code: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from('students')
    .select('id', { count: 'exact', head: true })
    .eq('registration_code', code)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}

export async function searchStudents(search: string): Promise<StudentBrief[]> {
  let query = supabase
    .from('students')
    .select('id, name, registration_code')
    .is('deleted_at', null)
    .order('name')
    .limit(20)

  if (search) {
    query = query.or(`name.ilike.%${search}%,registration_code.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as StudentBrief[]
}

// ------------------------------------------------------------
// Impor massal via RPC (lihat supabase/migrations/0007_import_rpc.sql)
// ------------------------------------------------------------
export interface ImportStudentPayload {
  name: string
  registration_code: string
  class_id: string
  gender?: string
  status?: string
  phone?: string
  nisn?: string
  dorm_id?: string
}

export interface ImportStudentResult {
  row_index: number
  ok: boolean
  error: string | null
}

export async function importStudents(
  rows: ImportStudentPayload[],
): Promise<ImportStudentResult[]> {
  const { data, error } = await supabase.rpc('import_students', { p_rows: rows })
  if (error) throw error
  return (data ?? []) as ImportStudentResult[]
}
