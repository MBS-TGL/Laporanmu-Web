import { supabase } from '../../lib/supabase'
import { downloadCsv } from '../../shared/utils/csv'
import type { ClassFilters, ClassFormValues, ClassRow } from './types'

const SELECT_STR =
  '*, homeroom_teacher:teachers!classes_homeroom_teacher_id_fkey(name), academic_year:academic_years(name)'

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

/** Tanpa pagination — dipakai ExportModal untuk lingkup "hasil filter" */
export async function fetchAllClasses(
  filters: Omit<ClassFilters, 'page' | 'pageSize'>,
): Promise<ClassRow[]> {
  const { search, academicYearId } = filters

  let query = supabase.from('classes').select(SELECT_STR).is('deleted_at', null)
  if (search) query = query.ilike('name', `%${search}%`)
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)

  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ClassRow[]
}

/** Untuk lingkup ekspor "terpilih" */
export async function fetchClassesByIds(ids: string[]): Promise<ClassRow[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('classes')
    .select(SELECT_STR)
    .in('id', ids)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ClassRow[]
}

/**
 * Jumlah santri AKTIF per kelas + split gender (pola ringkasan Buku Induk Sidikmu:
 * Total Siswa/L/P). Satu query ringan menggantikan view class_sizes — dan memakai
 * status='active' agar konsisten dengan hitungan ClassDrawer.
 */
export async function fetchClassGenderCounts(): Promise<Map<string, { total: number; male: number; female: number }>> {
  const { data, error } = await supabase
    .from('students')
    .select('class_id, gender')
    .eq('status', 'active')
    .is('deleted_at', null)
  if (error) throw error

  const map = new Map<string, { total: number; male: number; female: number }>()
  for (const row of data ?? []) {
    if (!row.class_id) continue
    const entry = map.get(row.class_id) ?? { total: 0, male: 0, female: 0 }
    entry.total += 1
    if (row.gender === 'L') entry.male += 1
    else if (row.gender === 'P') entry.female += 1
    map.set(row.class_id, entry)
  }
  return map
}

function classExportRow(c: ClassRow, counts: { total: number; male: number; female: number } | undefined) {
  return {
    'Nama Kelas': c.name,
    'Tingkat': c.grade,
    'Jurusan': c.major,
    'Tahun Akademik': c.academic_year?.name,
    'Wali Kelas': c.homeroom_teacher?.name,
    'Jumlah Santri': counts?.total ?? 0,
    'Putra (L)': counts?.male ?? 0,
    'Putri (P)': counts?.female ?? 0,
  }
}

export function downloadClassesCsv(
  rows: ClassRow[],
  counts: Map<string, { total: number; male: number; female: number }>,
): void {
  const headers = ['Nama Kelas', 'Tingkat', 'Jurusan', 'Tahun Akademik', 'Wali Kelas', 'Jumlah Santri', 'Putra (L)', 'Putri (P)']
  const body = rows.map((c) => {
    const r = classExportRow(c, counts.get(c.id))
    return headers.map((h) => r[h as keyof typeof r])
  })
  downloadCsv(`Data_Kelas_${new Date().toISOString().slice(0, 10)}.csv`, headers, body)
}

export async function downloadClassesXlsx(
  rows: ClassRow[],
  counts: Map<string, { total: number; male: number; female: number }>,
): Promise<void> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows.map((c) => classExportRow(c, counts.get(c.id))))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Kelas')
  XLSX.writeFile(book, `data-kelas-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/** Validasi duplikat nama kelas dalam satu tahun akademik (pola nbmExists TeacherForm) */
export async function classNameExists(
  name: string,
  academicYearId: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('name', name)
    .eq('academic_year_id', academicYearId)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}

/** Aksi massal wali kelas — padanan halaman "Wali Kelas" Sidikmu (Simpan Semua) */
export async function setClassesHomeroomBulk(ids: string[], teacherId: string | null): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ homeroom_teacher_id: teacherId })
    .in('id', ids)
  if (error) throw error
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

/** Arsip massal kelas (soft delete) — dipakai bulk bar ClassesPage */
export async function softDeleteClassesBulk(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}
