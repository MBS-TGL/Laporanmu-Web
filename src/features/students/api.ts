import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { hardDelete, hardDeleteMany } from '../../shared/api/crud'
import { isIncomplete, type CompletenessFields } from './completeness'
import type {
  GraduationSnapshot,
  PromotionClassBrief,
  PromotionMove,
  SortOption,
  Student,
  StudentBrief,
  StudentFilters,
  StudentFormValues,
  StudentGuardian,
  StudentGuardianInput,
  StudentStats,
} from './types'

const SELECT_STR =
  '*, classes!students_class_id_fkey(name), dorms(name), last_class:classes!students_last_class_id_fkey(name)'

/** Siswa dianggap berisiko bila poinnya mencapai batas ini */
export const RISK_THRESHOLD = -30

type StudentQuery = ReturnType<ReturnType<typeof supabase.from>['select']>

function applyStudentFilters(query: StudentQuery, filters: Partial<StudentFilters>): StudentQuery {
  const { search, classId, gender, status, missing, pointMode, graduationYear, lastClassId } =
    filters

  let q = query
  if (search) {
    const term = `%${search}%`
    q = q.or(`name.ilike.${term},registration_code.ilike.${term},nisn.ilike.${term}`)
  }
  if (classId) q = q.eq('class_id', classId)
  if (gender) q = q.eq('gender', gender)
  if (status) q = q.eq('status', status)
  if (graduationYear) q = q.eq('graduation_year', graduationYear)
  if (lastClassId) q = q.eq('last_class_id', lastClassId)
  if (missing === 'photo') q = q.is('photo_url', null)
  if (missing === 'phone') q = q.is('phone', null)
  if (missing === 'nisn') q = q.is('nisn', null)
  if (missing === 'any') q = q.or('photo_url.is.null,phone.is.null,nisn.is.null')
  if (pointMode === 'negative') q = q.lt('total_points', 0)
  if (pointMode === 'positive') q = q.gt('total_points', 0)
  return q
}

function applySort(query: StudentQuery, sortBy?: SortOption): StudentQuery {
  switch (sortBy) {
    case 'name_desc':
      return query.order('name', { ascending: false })
    case 'class_asc':
      return query
        .order('name', { ascending: true, referencedTable: 'classes' })
        .order('name', { ascending: true })
    case 'class_desc':
      return query
        .order('name', { ascending: false, referencedTable: 'classes' })
        .order('name', { ascending: true })
    case 'points_desc':
      return query.order('total_points', { ascending: false }).order('name', { ascending: true })
    case 'points_asc':
      return query.order('total_points', { ascending: true }).order('name', { ascending: true })
    case 'updated_desc':
      return query.order('updated_at', { ascending: false })
    case 'graduated_desc':
      return query
        .order('graduated_at', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })
    case 'graduated_asc':
      return query
        .order('graduated_at', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
    case 'year_desc':
      return query
        .order('graduation_year', { ascending: false, nullsFirst: false })
        .order('graduated_at', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })
    case 'year_asc':
      return query
        .order('graduation_year', { ascending: true, nullsFirst: false })
        .order('graduated_at', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
    default:
      return query.order('name', { ascending: true })
  }
}

export async function fetchStudents(filters: StudentFilters): Promise<{ data: Student[]; total: number }> {
  const { page, pageSize, sortBy } = filters
  const from = (page - 1) * pageSize

  const query = applyStudentFilters(
    supabase.from('students').select(SELECT_STR, { count: 'exact' }).is('deleted_at', null),
    filters,
  )

  const { data, count, error } = await applySort(query, sortBy).range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as Student[], total: count ?? 0 }
}

// Versi tanpa pagination — untuk ekspor CSV (mengikuti filter aktif)
export async function fetchAllStudents(
  filters: Omit<StudentFilters, 'page' | 'pageSize'>,
): Promise<Student[]> {
  const query = applyStudentFilters(
    supabase.from('students').select(SELECT_STR).is('deleted_at', null),
    filters,
  )

  const { data, error } = await applySort(query, filters.sortBy)
  if (error) throw error
  return (data ?? []) as Student[]
}

/** Baris ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
function payload(values: StudentFormValues) {
  return {
    name: values.name,
    registration_code: values.registration_code,
    class_id: values.class_id || null,
    dorm_id: values.dorm_id || null,
    gender: values.gender ?? null,
    status: values.status,
    nisn: values.nisn || null,
    nis: values.nis || null,
    nik: values.nik || null,
    phone: values.phone || null,
    birth_place: values.birth_place || null,
    birth_date: values.birth_date || null,
    religion: values.religion || null,
    address: values.address || null,
    guardian_name: values.guardian_name || null,
    guardian_relation: values.guardian_relation || null,
    tags: values.tags ?? [],
    nickname: values.nickname || null,
    kk_number: values.kk_number || null,
    child_status: values.child_status || null,
    child_number: values.child_number ?? null,
    siblings_count: values.siblings_count ?? null,
    home_phone: values.home_phone || null,
    origin_school: values.origin_school || null,
    origin_graduation_year: values.origin_graduation_year ?? null,
    admitted_at: values.admitted_at || null,
    uniform_size: values.uniform_size || null,
  }
}

// ------------------------------------------------------------
// Data orang tua/wali (tabel student_guardians — migration 0020)
// ------------------------------------------------------------

export async function fetchStudentGuardians(studentId: string): Promise<StudentGuardian[]> {
  const { data, error } = await supabase
    .from('student_guardians')
    .select('*')
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('created_at')

  if (error) throw error
  return (data ?? []) as StudentGuardian[]
}

/**
 * Simpan baris ayah/ibu/wali sekaligus via RPC (diff per relation —
 * baris yang tidak dikirim di-soft-delete). Lihat migration 0020.
 */
export async function saveStudentGuardians(
  studentId: string,
  rows: StudentGuardianInput[],
): Promise<void> {
  const { error } = await supabase.rpc('save_student_guardians', {
    p_student_id: studentId,
    p_rows: rows,
  })
  if (error) throw error
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
  // Jalur kelulusan manual via form: isi jejak kelulusan saat status jadi 'graduated',
  // kosongkan saat status berubah dari 'graduated' ke selain itu.
  let extra: Partial<Pick<Student, 'graduated_at' | 'graduation_year' | 'last_class_id'>> = {}
  if (values.status === 'graduated') {
    const { data: existing } = await supabase
      .from('students')
      .select('graduated_at, graduation_year, class_id, last_class_id')
      .eq('id', id)
      .maybeSingle()
    const row = existing as { graduated_at: string | null; graduation_year: number | null; class_id: string | null; last_class_id: string | null } | null
    // Snapshot kelas terakhir yang sudah ada (mis. saat edit ulang alumni) jangan ditimpa
    extra = {
      graduated_at: row?.graduated_at ?? new Date().toISOString(),
      graduation_year: row?.graduation_year ?? new Date().getFullYear(),
      last_class_id: row?.last_class_id ?? row?.class_id ?? null,
    }
  } else {
    const { data: existing } = await supabase
      .from('students')
      .select('status')
      .eq('id', id)
      .maybeSingle()
    if ((existing as { status: string } | null)?.status === 'graduated') {
      extra = { graduated_at: null, graduation_year: null, last_class_id: null }
    }
  }

  const { data, error } = await supabase
    .from('students')
    .update({ ...payload(values), ...extra })
    .eq('id', id)
    .select(SELECT_STR)
    .single()

  if (error) throw error
  return data as Student
}

/** Pulihkan jejak kelulusan dari snapshot — untuk undo pembatalan kelulusan massal */
export async function restoreGraduationSnapshot(
  row: GraduationSnapshot,
): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({
      status: 'graduated',
      graduated_at: row.graduated_at ?? new Date().toISOString(),
      graduation_year: row.graduation_year ?? new Date().getFullYear(),
      last_class_id: row.last_class_id ?? null,
    })
    .eq('id', row.id)
  if (error) throw error
}

/** Ambil satu siswa berdasar id — dipakai DetailProvider (deep link antar modul). */
export async function fetchStudentById(id: string): Promise<Student> {
  const { data, error } = await supabase.from('students').select(SELECT_STR).eq('id', id).single()
  if (error) throw error
  return data as Student
}

/** Update tags/label siswa saja (dipakai popover Label di drawer detail) */
export async function updateStudentTags(id: string, tags: string[]): Promise<Student> {  const { data, error } = await supabase
    .from('students')
    .update({ tags })
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
  dorm_id?: string
  gender?: string
  status?: string
  phone?: string
  nisn?: string
  nis?: string
  nik?: string
  photo_url?: string
  tags?: string[]
  guardian_name?: string
  guardian_relation?: string
  birth_place?: string
  birth_date?: string
  religion?: string
  address?: string
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

/** Kode registrasi yang sudah terdaftar (huruf kecil) — untuk pra-cek duplikat sebelum impor */
export async function fetchExistingStudentCodes(): Promise<string[]> {
  const { data, error } = await supabase
    .from('students')
    .select('registration_code')
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []).map((r) => (r as { registration_code: string }).registration_code.toLowerCase())
}

// ------------------------------------------------------------
// Statistik ringkas (chips + banner Terbaik/Terendah)
// ------------------------------------------------------------
export async function fetchStudentStats(): Promise<StudentStats> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [studentsRes, reportsRes] = await Promise.all([
    supabase
      .from('students')
      // hint FK wajib sejak 0018 — students punya 2 FK ke classes (class_id & last_class_id)
      // kolom lengkap dimuat untuk definisi kelengkapan 13 field (completeness.ts, §6.1b)
      .select(
        'id, name, gender, total_points, class_id, photo_url, nisn, nis, nik, phone, address, birth_place, birth_date, religion, guardian_name, kk_number, origin_school, tags, classes!students_class_id_fkey(name)',
      )
      .is('deleted_at', null)
      // Chips statistik merepresentasikan santri aktif — lulus/pindah/keluar tidak dihitung
      .eq('status', 'active'),
    supabase.from('reports').select('points').gte('created_at', weekAgo),
  ])

  if (studentsRes.error) throw studentsRes.error
  type Row = {
    name: string
    gender: string | null
    total_points: number
    class_id: string | null
    classes?: { name: string } | null
  } & CompletenessFields
  const rows = (studentsRes.data ?? []) as unknown as Row[]
  const total = rows.length

  let male = 0
  let female = 0
  let pointSum = 0
  let riskCount = 0
  let incompleteCount = 0
  const classBuckets = new Map<
    string,
    { name: string; sum: number; count: number; incomplete: number }
  >()

  for (const row of rows) {
    if (row.gender === 'L') male += 1
    else if (row.gender === 'P') female += 1
    pointSum += row.total_points ?? 0
    if ((row.total_points ?? 0) <= RISK_THRESHOLD) riskCount += 1
    if (isIncomplete(row)) incompleteCount += 1

    if (row.class_id) {
      const bucket = classBuckets.get(row.class_id) ?? {
        name: row.classes?.name ?? 'Tanpa nama',
        sum: 0,
        count: 0,
        incomplete: 0,
      }
      bucket.sum += row.total_points ?? 0
      bucket.count += 1
      if (isIncomplete(row)) bucket.incomplete += 1
      classBuckets.set(row.class_id, bucket)
    }
  }

  let topPerformer: StudentStats['topPerformer'] = null
  for (const row of rows) {
    if ((row.total_points ?? 0) > (topPerformer?.points ?? 0)) {
      topPerformer = { name: row.name, points: row.total_points }
    }
  }

  let worstClass: StudentStats['worstClass'] = null
  for (const [id, bucket] of classBuckets) {
    const avg = bucket.sum / bucket.count
    if (avg < 0 && avg < (worstClass?.avg ?? 0)) {
      worstClass = { id, name: bucket.name, avg: Math.round(avg), count: bucket.count }
    }
  }

  // Rekap kelengkapan per kelas — terendah dulu; semua kelas dengan siswa dilaporkan
  const classCompleteness = [...classBuckets.entries()]
    .map(([id, b]) => ({
      id,
      name: b.name,
      total: b.count,
      incomplete: b.incomplete,
      percent: Math.round(((b.count - b.incomplete) / b.count) * 100),
    }))
    .sort((a, b) => a.percent - b.percent || b.incomplete - a.incomplete)
  const worstCompleteness =
    classCompleteness.find((c) => c.incomplete > 0) ?? null

  let trend7d: number | null = null
  if (!reportsRes.error && total > 0) {
    const reportSum = ((reportsRes.data ?? []) as { points: number }[]).reduce(
      (acc, r) => acc + (r.points ?? 0),
      0,
    )
    trend7d = Math.round(reportSum / total)
  }

  return {
    total,
    male,
    female,
    avgPoints: total > 0 ? Math.round(pointSum / total) : 0,
    riskCount,
    incompleteCount,
    classCompleteness,
    worstCompleteness,
    trend7d,
    topPerformer,
    worstClass,
  }
}

// ------------------------------------------------------------
// Arsip siswa (soft delete) & pemulihan
// ------------------------------------------------------------
/** Semua siswa ter-soft delete — fetch sekali, filter/sort/search dilakukan di memori (pola AlumniPage) */
export async function fetchArchivedStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from('students')
    .select(SELECT_STR)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(1000)

  if (error) throw error
  return (data ?? []) as Student[]
}

export async function restoreStudent(id: string): Promise<void> {
  const { error } = await supabase.from('students').update({ deleted_at: null }).eq('id', id)
  if (error) throw error
}

export async function restoreStudentsBulk(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('students').update({ deleted_at: null }).in('id', ids)
  if (error) throw error
}

/** Hapus permanen siswa dari database — HANYA di Arsip Siswa, gated `canDelete`. */
export async function hardDeleteStudent(id: string): Promise<void> {
  await hardDelete('students', id)
}

/** Hapus permanen massal siswa — HANYA di Arsip Siswa, gated `canDelete`. */
export async function hardDeleteStudentsBulk(ids: string[]): Promise<void> {
  await hardDeleteMany('students', ids)
}

export async function deleteStudentsBulk(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('students')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

// ------------------------------------------------------------
// Pindah kelas massal (naik kelas awal tahun ajaran)
// ------------------------------------------------------------
export async function moveStudentsBulk(ids: string[], classId: string): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('students').update({ class_id: classId }).in('id', ids)
  if (error) throw error
}

/** Kelas lengkap dengan grade & tahun ajaran — dipakai pemetaan wizard kenaikan kelas (0030) */
export async function fetchClassesForPromotion(): Promise<PromotionClassBrief[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, major, academic_year_id, academic_year:academic_years(name)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  type Raw = {
    id: string
    name: string
    grade: string | null
    major: string | null
    academic_year_id: string | null
    academic_year?: { name: string } | null
  }
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    name: r.name,
    grade: r.grade,
    major: r.major,
    academic_year_id: r.academic_year_id,
    academic_year_name: r.academic_year?.name ?? null,
  }))
}

/** Naik kelas massal per batch (RPC 0030) — mengembalikan batch ID untuk undo */
export async function promoteStudents(moves: PromotionMove[]): Promise<string> {
  if (moves.length === 0) return ''
  const { data, error } = await supabase.rpc('promote_students', {
    p_moves: moves.map((m) => ({ student_id: m.studentId, class_id: m.classId })),
  })
  if (error) throw error
  return data as string
}

/** Batalkan kenaikan kelas satu batch (RPC 0030) */
export async function undoPromotion(batchId: string): Promise<number> {
  const { data, error } = await supabase.rpc('undo_promotion', { p_batch_id: batchId })
  if (error) throw error
  return (data as number) ?? 0
}

// ------------------------------------------------------------
// Kelulusan massal (RPC di supabase/migrations/0018_kelulusan.sql)
// ------------------------------------------------------------
export async function graduateStudentsBulk(ids: string[], graduationYear: number): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.rpc('graduate_students', {
    p_ids: ids,
    p_graduation_year: graduationYear,
  })
  if (error) throw error
}

/** Batalkan kelulusan: kembali jadi siswa aktif tanpa jejak kelulusan */
export async function revertGraduation(id: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ status: 'active', graduated_at: null, graduation_year: null, last_class_id: null })
    .eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Fitur Alumni: Manual Tambah, Edit, & Impor Massal
// ------------------------------------------------------------
export interface AlumniFormValues {
  name: string
  gender: 'L' | 'P'
  graduation_year: number
  nisn?: string
  last_class_id?: string
  graduated_at?: string
  phone?: string
}

export interface ExistingAlumniKey {
  id: string
  nisn: string | null
  name: string
  graduation_year: number | null
}

export interface ImportAlumniRowPayload {
  name: string
  gender: 'L' | 'P'
  graduation_year: number
  nisn?: string
  last_class_id?: string
  graduated_at?: string
  phone?: string
}

export interface ImportAlumniResult {
  row_index: number
  ok: boolean
  error: string | null
}

/** Ambil seluruh siswa (non-deleted) untuk pra-cek duplikat alumni (NISN / Nama + Tahun) */
export async function fetchExistingAlumniKeys(): Promise<ExistingAlumniKey[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, nisn, name, graduation_year')
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []) as ExistingAlumniKey[]
}

/** Ambil ID alumni yang memiliki riwayat laporan poin di tabel reports */
export async function fetchAlumniWithPointsHistory(studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('reports')
    .select('student_id')
    .in('student_id', studentIds)
    .limit(10000)
  if (error) {
    console.warn('Gagal mengecek riwayat laporan alumni:', error)
    return new Set()
  }
  const set = new Set<string>()
  for (const r of data ?? []) {
    if (r.student_id) set.add(r.student_id)
  }
  return set
}

/** Helper generator kode registrasi acak untuk alumni */
function generateAlumniRegistrationCode(year: number, existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = Math.floor(1000 + Math.random() * 9000)
    const code = `ALM-${year}-${rand}`
    if (!existingCodes.has(code.toLowerCase())) {
      existingCodes.add(code.toLowerCase())
      return code
    }
  }
  const timestamp = Date.now().toString().slice(-6)
  const code = `ALM-${year}-${timestamp}`
  existingCodes.add(code.toLowerCase())
  return code
}

export async function createAlumni(values: AlumniFormValues): Promise<Student> {
  const existingCodesList = await fetchExistingStudentCodes()
  const codeSet = new Set(existingCodesList.map((c) => c.toLowerCase()))
  const regCode = generateAlumniRegistrationCode(values.graduation_year, codeSet)

  const insertData = {
    name: values.name.trim(),
    registration_code: regCode,
    gender: values.gender,
    status: 'graduated',
    graduation_year: values.graduation_year,
    graduated_at: values.graduated_at || null,
    last_class_id: values.last_class_id || null,
    nisn: values.nisn?.trim() || null,
    phone: values.phone?.trim() || null,
    total_points: 0,
  }

  const { data, error } = await supabase
    .from('students')
    .insert(insertData)
    .select(SELECT_STR)
    .single()

  if (error) throw error
  return data as Student
}

export async function updateAlumni(id: string, values: AlumniFormValues): Promise<Student> {
  const updateData = {
    name: values.name.trim(),
    gender: values.gender,
    graduation_year: values.graduation_year,
    graduated_at: values.graduated_at || null,
    last_class_id: values.last_class_id || null,
    nisn: values.nisn?.trim() || null,
    phone: values.phone?.trim() || null,
  }

  const { data, error } = await supabase
    .from('students')
    .update(updateData)
    .eq('id', id)
    .select(SELECT_STR)
    .single()

  if (error) throw error
  return data as Student
}

export async function importAlumniBatch(
  rows: ImportAlumniRowPayload[],
  onProgress?: (processed: number, total: number) => void,
): Promise<ImportAlumniResult[]> {
  if (rows.length === 0) return []

  const existingCodesList = await fetchExistingStudentCodes()
  const codeSet = new Set(existingCodesList.map((c) => c.toLowerCase()))

  const CHUNK_SIZE = 500
  const results: ImportAlumniResult[] = []

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const payloads = chunk.map((r) => ({
      name: r.name.trim(),
      registration_code: generateAlumniRegistrationCode(r.graduation_year, codeSet),
      gender: r.gender,
      status: 'graduated',
      graduation_year: r.graduation_year,
      graduated_at: r.graduated_at || null,
      last_class_id: r.last_class_id || null,
      nisn: r.nisn?.trim() || null,
      phone: r.phone?.trim() || null,
      total_points: 0,
    }))

    const { error } = await supabase.from('students').insert(payloads)
    if (!error) {
      for (let j = 0; j < chunk.length; j++) {
        results.push({ row_index: i + j + 1, ok: true, error: null })
      }
    } else {
      // Fallback row-by-row agar baris valid tetap masuk jika chunk error
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowError } = await supabase.from('students').insert(payloads[j])
        results.push({
          row_index: i + j + 1,
          ok: !rowError,
          error: rowError ? rowError.message : null,
        })
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + CHUNK_SIZE, rows.length), rows.length)
    }
  }

  return results
}

// ------------------------------------------------------------
// Reset poin (awal semester)
// ------------------------------------------------------------
export async function resetPoints(classId: string | null): Promise<number> {
  let query = supabase.from('students').update({ total_points: 0 }).is('deleted_at', null)
  if (classId) query = query.eq('class_id', classId)

  const { data, error } = await query.select('id')
  if (error) throw error
  return data?.length ?? 0
}

// ------------------------------------------------------------
// Ekspor terpilih & foto massal
// ------------------------------------------------------------
export async function fetchStudentsByIds(ids: string[]): Promise<Student[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('students')
    .select(SELECT_STR)
    .in('id', ids)
    .order('name')
  if (error) throw error
  return (data ?? []) as Student[]
}

export async function updateStudentPhoto(id: string, photoUrl: string): Promise<void> {
  const { error } = await supabase.from('students').update({ photo_url: photoUrl }).eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Generate PIN portal wali (RPC di supabase/migrations/0021_generate_pins.sql)
// ------------------------------------------------------------
export interface GeneratedPin {
  student_id: string
  new_pin: string
}

export async function generateStudentPins(ids: string[]): Promise<GeneratedPin[]> {
  const { data, error } = await supabase.rpc('generate_student_pins', { p_ids: ids })
  if (error) throw error
  return (data ?? []) as GeneratedPin[]
}

// ------------------------------------------------------------
// Broadcast WhatsApp via Fonnte — diproxy Edge Function
// `wa-broadcast` karena API Fonnte tanpa header CORS dan token
// device tidak boleh pernah sampai ke browser.
// Lihat supabase/functions/wa-broadcast/index.ts & 0017_wa_broadcast.sql
// ------------------------------------------------------------

export interface WaSettingsStatus {
  configured: boolean
  sender_name: string | null
  /** WA otomatis saat pelanggaran dicatat (migration 0026) */
  auto_violation_wa: boolean
  /** WA otomatis saat surat resmi BK diterbitkan (migration 0039) */
  auto_bk_wa: boolean
  /** WA otomatis saat mutasi tabungan (migration 0039) */
  auto_savings_wa: boolean
  /** WA otomatis saat pembayaran SPP dicatat (migration 0046) */
  auto_spp_wa: boolean
  /** WA otomatis skor ujian CBT (migration 0048) */
  auto_cbt_wa: boolean
  updated_at: string | null
}

export async function fetchWaSettingsStatus(): Promise<WaSettingsStatus> {
  const { data, error } = await supabase.rpc('wa_settings_status')
  if (error) throw error
  const res = data as unknown as WaSettingsStatus | { error: string } | null
  if (res && 'error' in res) throw new Error(res.error)
  return res ?? { configured: false, sender_name: null, auto_violation_wa: false, auto_bk_wa: false, auto_savings_wa: false, auto_spp_wa: false, auto_cbt_wa: false, updated_at: null }
}

export async function updateWaSettings(
  token: string,
  senderName: string,
  autoViolation?: boolean,
  autoBk?: boolean,
  autoSavings?: boolean,
  autoSpp?: boolean,
  autoCbt?: boolean,
): Promise<void> {
  const { data, error } = await supabase.rpc('update_wa_settings', {
    p_token: token,
    p_sender_name: senderName,
    // null = biarkan nilai lama (pola sama dengan token)
    p_auto_violation: autoViolation ?? null,
    p_auto_bk: autoBk ?? null,
    p_auto_savings: autoSavings ?? null,
    p_auto_spp: autoSpp ?? null,
    p_auto_cbt: autoCbt ?? null,
  })
  if (error) throw error
  const res = data as unknown as { ok?: boolean; error?: string } | null
  if (res?.error) throw new Error(res.error)
}

export interface WaRecipient {
  target: string
  message: string
}

export interface WaBroadcastResult {
  ok: boolean
  reason?: string
  detail?: string
  sent?: number
}

export async function sendWaBroadcast(recipients: WaRecipient[]): Promise<WaBroadcastResult> {
  const { data, error } = await supabase.functions.invoke('wa-broadcast', {
    body: { recipients },
  })
  if (error) {
    // Function selalu balik HTTP 200 dengan { ok:false, reason } — kecuali
    // 401/403 (auth/role). Baca reason bila responsenya JSON.
    if (error instanceof FunctionsHttpError && error.context instanceof Response) {
      try {
        const body = (await error.context.json()) as WaBroadcastResult
        if (body.reason) return body
      } catch {
        /* jatuh ke pesan generik */
      }
    }
    return { ok: false, reason: 'Gagal menghubungi server — periksa koneksi & login ulang' }
  }
  return (data ?? { ok: false, reason: 'Response kosong dari server' }) as WaBroadcastResult
}

// ─── Hub Wali (agregat student_guardians + anak) ────────────────────────────

export interface GuardianFamilyStudent {
  id: string
  name: string
  registration_code: string | null
  class_name: string | null
}

export interface GuardianFamilyRow {
  id: string
  name: string | null
  relation: 'father' | 'mother' | 'guardian'
  phone: string | null
  occupation: string | null
  student: GuardianFamilyStudent | null
}

/**
 * Semua baris guardian (RLS: developer/admin/pengurus saja) dengan anak
 * ter-embed. Agregasi per keluarga dilakukan di klien — grup by no. HP,
 * fallback nama (lihat tabs/WaliTab.tsx).
 *
 * Embed classes wajib hint FK — students punya 3 FK ke classes
 * (gotcha "more than one relationship").
 */
export async function fetchGuardianFamilies(): Promise<GuardianFamilyRow[]> {
  const { data, error } = await supabase
    .from('student_guardians')
    .select(
      'id, name, relation, phone, occupation, ' +
        'students!student_guardians_student_id_fkey(id, name, registration_code, deleted_at, classes!students_class_id_fkey(name))',
    )
    .is('deleted_at', null)
    .is('students.deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      name: string | null
      relation: 'father' | 'mother' | 'guardian'
      phone: string | null
      occupation: string | null
      students: {
        id: string
        name: string
        registration_code: string | null
        deleted_at: string | null
        classes: { name: string } | null
      } | null
    }
    return {
      id: r.id,
      name: r.name,
      relation: r.relation,
      phone: r.phone,
      occupation: r.occupation,
      student: r.students
        ? {
            id: r.students.id,
            name: r.students.name,
            registration_code: r.students.registration_code,
            class_name: r.students.classes?.name ?? null,
          }
        : null,
    }
  })
}
