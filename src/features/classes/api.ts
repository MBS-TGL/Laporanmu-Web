import { supabase } from '../../lib/supabase'
import type { ClassFilters, ClassFormValues, ClassRow, ClassSubject, ClassSubjectRow } from './types'

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

/** Kelas terarsip (deleted_at terisi) — dipakai tabs/ArchiveTab untuk pulihkan */
export async function fetchArchivedClasses(): Promise<ClassRow[]> {
  const { data, error } = await supabase
    .from('classes')
    .select(SELECT_STR)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
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

/** Batalkan soft delete — kelas kembali ke daftar aktif */
export async function restoreClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

export type ClassImportPayload = {
  name: string
  grade: string | null
  major: string | null
  academic_year_id: string | null
  homeroom_teacher_id: string | null
}

/** Insert batch hasil impor (dipanggil per-chunk oleh ImportModal) */
export async function createClassesBulk(rows: ClassImportPayload[]): Promise<number> {
  const { data, error } = await supabase
    .from('classes')
    .insert(
      rows.map((r) => ({
        name: r.name,
        grade: r.grade,
        major: r.major,
        academic_year_id: r.academic_year_id,
        homeroom_teacher_id: r.homeroom_teacher_id,
      })),
    )
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

// ─── Class subjects (mata pelajaran per kelas, mantan classSubjectsApi.ts) ──
const CS_SELECT =
  '*, subjects(id, name, code, kkm, weekly_hours), teachers(id, name), classes(id, name, grade)'

export async function fetchClassSubjects(classId: string, academicYearId: string): Promise<ClassSubject[]> {
  const { data, error } = await supabase
    .from('class_subjects')
    .select(CS_SELECT)
    .eq('class_id', classId)
    .eq('academic_year_id', academicYearId)
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as unknown as ClassSubject[]
}

/** Bulk upsert via RPC — handles insert, update, and soft-delete of removed subjects */
export async function saveClassSubjects(classId: string, academicYearId: string, rows: ClassSubjectRow[]): Promise<void> {
  const { error } = await supabase.rpc('save_class_subjects', {
    p_class_id: classId,
    p_academic_year_id: academicYearId,
    p_rows: rows.map((r) => ({
      subject_id: r.subject_id,
      teacher_id: r.teacher_id || '',
      kkm_override: r.kkm_override,
    })),
  })
  if (error) throw error
}

/** Fetch all class_subjects for a given academic year (for teaching load view) */
export async function fetchClassSubjectsByYear(academicYearId: string): Promise<ClassSubject[]> {
  const { data, error } = await supabase
    .from('class_subjects')
    .select(CS_SELECT)
    .eq('academic_year_id', academicYearId)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as unknown as ClassSubject[]
}

/**
 * Bulk assign/unassign satu guru ke banyak (kelas, mapel) — dari sisi guru.
 * assigned=true  → set/overwrite guru di baris tsb
 * assigned=false → hapus assignment guru ini saja (guru lain aman)
 */
export async function saveTeacherAssignments(
  teacherId: string,
  academicYearId: string,
  rows: { class_id: string; subject_id: string; assigned: boolean }[],
): Promise<void> {
  const { error } = await supabase.rpc('save_teacher_assignments', {
    p_teacher_id: teacherId,
    p_academic_year_id: academicYearId,
    p_rows: rows,
  })
  if (error) throw error
}
