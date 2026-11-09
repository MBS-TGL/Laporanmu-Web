import Papa from 'papaparse'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { isIncomplete, type CompletenessFields } from './completeness'
import type {
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
  const { search, classId, gender, status, missing, pointMode } = filters

  let q = query
  if (search) {
    const term = `%${search}%`
    q = q.or(`name.ilike.${term},registration_code.ilike.${term},nisn.ilike.${term}`)
  }
  if (classId) q = q.eq('class_id', classId)
  if (gender) q = q.eq('gender', gender)
  if (status) q = q.eq('status', status)
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
function studentExportRow(s: Student) {
  return {
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
  }
}

export function downloadStudentsCsv(students: Student[]): void {
  const csv = Papa.unparse(students.map(studentExportRow))
  // BOM agar Excel membaca UTF-8 dengan benar
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `data-siswa-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// XLSX di-load on-demand — hanya dibutuhkan saat ekspor Excel
export async function downloadStudentsXlsx(students: Student[]): Promise<void> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(students.map(studentExportRow))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Siswa')
  XLSX.writeFile(book, `data-siswa-${new Date().toISOString().slice(0, 10)}.xlsx`)
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
      .select('graduated_at, graduation_year, class_id')
      .eq('id', id)
      .maybeSingle()
    const row = existing as { graduated_at: string | null; graduation_year: number | null; class_id: string | null } | null
    extra = {
      graduated_at: row?.graduated_at ?? new Date().toISOString(),
      graduation_year: row?.graduation_year ?? new Date().getFullYear(),
      last_class_id: row?.class_id ?? null,
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

/** Update tags/label siswa saja (dipakai popover Label di drawer detail) */
export async function updateStudentTags(id: string, tags: string[]): Promise<Student> {
  const { data, error } = await supabase
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
      .is('deleted_at', null),
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

  // Rekap kelengkapan per kelas — terendah dulu; kelas tanpa field kosong tak dilaporkan
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
export async function fetchArchivedStudents(search?: string): Promise<Student[]> {
  let query = supabase
    .from('students')
    .select(SELECT_STR)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200)

  if (search) {
    const term = `%${search}%`
    query = query.or(`name.ilike.${term},registration_code.ilike.${term},nisn.ilike.${term}`)
  }

  const { data, error } = await query
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
  updated_at: string | null
}

export async function fetchWaSettingsStatus(): Promise<WaSettingsStatus> {
  const { data, error } = await supabase.rpc('wa_settings_status')
  if (error) throw error
  const res = data as unknown as WaSettingsStatus | { error: string } | null
  if (res && 'error' in res) throw new Error(res.error)
  return res ?? { configured: false, sender_name: null, updated_at: null }
}

export async function updateWaSettings(token: string, senderName: string): Promise<void> {
  const { data, error } = await supabase.rpc('update_wa_settings', {
    p_token: token,
    p_sender_name: senderName,
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
