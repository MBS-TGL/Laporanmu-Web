import { supabase } from '../../lib/supabase'
import { hardDelete, hardDeleteMany } from '../../shared/api/crud'
import type {
  Teacher,
  TeacherFilters,
  TeacherFormValues,
  TeacherSort,
  TeacherStatus,
} from './types'

type TeacherQuery = ReturnType<ReturnType<typeof supabase.from>['select']>

function applyTeacherFilters(
  query: TeacherQuery,
  filters: Omit<TeacherFilters, 'page' | 'pageSize'>,
): TeacherQuery {
  const { search, status, gender, subject, type, missingWa } = filters
  let q = query
  if (search) {
    const term = `%${search}%`
    q = q.or(`name.ilike.${term},nbm.ilike.${term},subject.ilike.${term}`)
  }
  if (status) q = q.eq('status', status)
  if (gender) q = q.eq('gender', gender)
  if (subject) q = q.eq('subject', subject)
  if (type) q = q.eq('type', type)
  // or() kedua di level query yang sama digabung AND oleh PostgREST
  if (missingWa) q = q.or('phone.is.null,phone.eq.""')
  return q
}

// Urutan server-side — dipakai ekspor; daftar di halaman tetap sortir ulang di memori
function applyTeacherSort(query: TeacherQuery, sortBy?: TeacherSort): TeacherQuery {
  switch (sortBy) {
    case 'name_desc':
      return query.order('name', { ascending: false })
    case 'nbm_asc':
      return query.order('nbm', { ascending: true, nullsFirst: false })
    case 'nbm_desc':
      return query.order('nbm', { ascending: false, nullsFirst: false })
    case 'status_asc':
      return query.order('status', { ascending: true })
    case 'status_desc':
      return query.order('status', { ascending: false })
    case 'join_desc':
      return query.order('join_date', { ascending: false, nullsFirst: false })
    case 'join_asc':
      return query.order('join_date', { ascending: true, nullsFirst: false })
    default:
      return query.order('name', { ascending: true })
  }
}

export async function fetchTeachers(filters: TeacherFilters): Promise<{ data: Teacher[]; total: number }> {
  const { page, pageSize, sortBy } = filters
  const from = (page - 1) * pageSize

  const query = applyTeacherFilters(
    supabase.from('teachers').select('*', { count: 'exact' }).is('deleted_at', null),
    filters,
  )

  const { data, count, error } = await applyTeacherSort(query, sortBy).range(
    from,
    from + pageSize - 1,
  )

  if (error) throw error
  return { data: (data ?? []) as Teacher[], total: count ?? 0 }
}

// Versi tanpa pagination — untuk ekspor (mengikuti filter aktif di halaman)
export async function fetchAllTeachers(
  filters: Omit<TeacherFilters, 'page' | 'pageSize'>,
): Promise<Teacher[]> {
  const query = applyTeacherFilters(
    supabase.from('teachers').select('*').is('deleted_at', null),
    filters,
  )
  const { data, error } = await applyTeacherSort(query, filters.sortBy)
  if (error) throw error
  return (data ?? []) as Teacher[]
}

export async function fetchTeachersByIds(ids: string[]): Promise<Teacher[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .is('deleted_at', null)
    .in('id', ids)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Teacher[]
}

/** Payload form — satu sumber untuk insert & update agar kolomnya selalu sinkron */
function teacherFormPayload(values: TeacherFormValues) {
  return {
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
    address: values.address || null,
    photo_url: values.photo_url || null,
    employment_status: values.employment_status || 'GTY',
    type: values.type || 'guru',
    birth_place: values.birth_place || null,
    birth_date: values.birth_date || null,
    teaching_hours: values.teaching_hours ?? null,
    last_education: values.last_education || null,
    major: values.major || null,
    graduation_year: values.graduation_year ?? null,
    work_days: values.work_days?.length ? values.work_days : null,
    fingerspot_name: values.fingerspot_name || null,
  }
}

export async function createTeacher(values: TeacherFormValues): Promise<Teacher> {
  const { data, error } = await supabase
    .from('teachers')
    .insert(teacherFormPayload(values))
    .select('*')
    .single()

  if (error) throw error
  return data as Teacher
}

export async function updateTeacher(id: string, values: TeacherFormValues): Promise<Teacher> {
  const { data, error } = await supabase
    .from('teachers')
    .update(teacherFormPayload(values))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Teacher
}

/** Sematkan / lepas guru dari urutan atas daftar */
export async function setTeacherPinned(id: string, isPinned: boolean): Promise<void> {
  const { error } = await supabase.from('teachers').update({ is_pinned: isPinned }).eq('id', id)
  if (error) throw error
}

export async function softDeleteTeacher(id: string): Promise<void> {
  const { error } = await supabase
    .from('teachers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Arsip massal guru (soft delete) — dipakai bulk bar TeachersPage */
export async function softDeleteTeachersBulk(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('teachers')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

/** Ubah status massal guru (aktif/nonaktif/cuti) — dipakai bulk bar TeachersPage */
export async function setTeacherStatusBulk(ids: string[], status: TeacherStatus): Promise<void> {
  const { error } = await supabase.from('teachers').update({ status }).in('id', ids)
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

// ------------------------------------------------------------
// Arsip guru (soft delete) & pemulihan
// ------------------------------------------------------------
export async function fetchArchivedTeachers(search?: string): Promise<Teacher[]> {
  let query = supabase
    .from('teachers')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200)

  if (search) {
    const term = `%${search}%`
    query = query.or(`name.ilike.${term},nbm.ilike.${term},subject.ilike.${term}`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Teacher[]
}

export async function restoreTeacher(id: string): Promise<void> {
  const { error } = await supabase.from('teachers').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

export async function restoreTeachersBulk(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('teachers').update({ deleted_at: null }).in('id', ids)
  if (error) throw error
}

/** Hapus permanen guru dari database — HANYA di Arsip Guru, gated `canDelete`. */
export async function hardDeleteTeacher(id: string): Promise<void> {
  await hardDelete('teachers', id)
}

/** Hapus permanen massal guru — HANYA di Arsip Guru, gated `canDelete`. */
export async function hardDeleteTeachersBulk(ids: string[]): Promise<void> {
  await hardDeleteMany('teachers', ids)
}

// ------------------------------------------------------------
// Impor massal guru (insert biasa, chunk per 500 baris —
// chunk gagal diulang per baris agar baris valid tetap masuk)
// ------------------------------------------------------------
export interface ImportTeacherPayload {
  name: string
  nbm?: string
  nip?: string
  nuptk?: string
  nik?: string
  subject?: string
  gender?: string
  status?: string
  type?: string
  employment_status?: string
  phone?: string
  email?: string
  join_date?: string
  birth_place?: string
  birth_date?: string
  teaching_hours?: number
  last_education?: string
  major?: string
  graduation_year?: number
  address?: string
  fingerspot_name?: string
  notes?: string
}

export interface ImportTeacherResult {
  row_index: number
  ok: boolean
  error: string | null
}

const IMPORT_CHUNK_SIZE = 500

function importPayload(values: ImportTeacherPayload) {
  return {
    name: values.name,
    nbm: values.nbm || null,
    nip: values.nip || null,
    nuptk: values.nuptk || null,
    nik: values.nik || null,
    subject: values.subject || null,
    gender: values.gender || null,
    status: values.status || 'active',
    type: values.type || 'guru',
    employment_status: values.employment_status || 'GTY',
    phone: values.phone || null,
    email: values.email || null,
    join_date: values.join_date || null,
    birth_place: values.birth_place || null,
    birth_date: values.birth_date || null,
    teaching_hours: values.teaching_hours ?? null,
    last_education: values.last_education || null,
    major: values.major || null,
    graduation_year: values.graduation_year ?? null,
    address: values.address || null,
    fingerspot_name: values.fingerspot_name || null,
    notes: values.notes || null,
  }
}

export async function importTeachers(rows: ImportTeacherPayload[]): Promise<ImportTeacherResult[]> {
  const results: ImportTeacherResult[] = []
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE)
    const { error } = await supabase
      .from('teachers')
      .insert(chunk.map(importPayload))
    if (!error) {
      for (let j = 0; j < chunk.length; j++) {
        results.push({ row_index: i + j + 1, ok: true, error: null })
      }
    } else {
      // fallback per baris — pesan error spesifik per baris
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowError } = await supabase
          .from('teachers')
          .insert(importPayload(chunk[j]))
        results.push({
          row_index: i + j + 1,
          ok: !rowError,
          error: rowError ? rowError.message : null,
        })
      }
    }
  }
  return results
}

/** NBM yang sudah terdaftar — untuk pra-cek duplikat sebelum impor */
export async function fetchExistingNbms(): Promise<string[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select('nbm')
    .is('deleted_at', null)
    .not('nbm', 'is', null)
  if (error) throw error
  return (data ?? []).map((r) => (r as { nbm: string }).nbm.trim().toLowerCase())
}
