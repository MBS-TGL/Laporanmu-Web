import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { chunk } from '../../shared/utils/array'
import { findOrphanIds, type AutomationRun } from './automation'
import type {
  AdminProfile,
  AuditLog,
  BucketInfo,
  IntegrityIssue,
  StorageFileInfo,
  TableStat,
} from './types'

// ------------------------------------------------------------
// Manajemen pengguna (dev/admin)
// ------------------------------------------------------------
export async function fetchProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name')
  if (error) throw error
  return (data ?? []) as AdminProfile[]
}

export async function updateProfile(
  id: string,
  updates: { name?: string; role?: string },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Audit log viewer
// ------------------------------------------------------------
export interface AuditFilters {
  source?: string
  action?: string
  tableName?: string
  recordId?: string
  /** Filter per pengguna — dipakai drawer detail akun */
  userId?: string
  search?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}

export async function fetchAuditLogs(
  filters: AuditFilters,
): Promise<{ data: AuditLog[]; total: number }> {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.source) query = query.eq('source', filters.source)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.tableName) query = query.eq('table_name', filters.tableName)
  if (filters.recordId) query = query.eq('record_id', filters.recordId)
  if (filters.userId) query = query.eq('user_id', filters.userId)
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`)
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59Z`)
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`actor_name.ilike.${term},table_name.ilike.${term},action.ilike.${term}`)
  }

  const from = (filters.page - 1) * filters.pageSize
  const { data, count, error } = await query.range(from, from + filters.pageSize - 1)
  if (error) throw error
  return { data: (data ?? []) as AuditLog[], total: count ?? 0 }
}

/**
 * Semua baris hasil filter untuk ekspor CSV — diambil per batch 1000 baris
 * (maks 20k) karena endpoint viewer hanya mengirim satu halaman per call.
 */
export async function fetchAuditLogsForExport(
  filters: Omit<AuditFilters, 'page' | 'pageSize'>,
): Promise<AuditLog[]> {
  const out: AuditLog[] = []
  const pageSize = 1000
  for (let page = 1; page <= 20; page++) {
    const { data } = await fetchAuditLogs({ ...filters, page, pageSize })
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}

// ------------------------------------------------------------
// Manajemen pengguna: link guru ↔ akun & reset password
// ------------------------------------------------------------

export interface TeacherLinkBrief {
  id: string
  name: string
  nbm: string | null
  email: string | null
  status: string | null
  profile_id: string | null
}

/** Semua guru aktif + status keterhubungan akunnya (untuk list & pilihan link). */
export async function fetchTeachersForLinking(): Promise<TeacherLinkBrief[]> {
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, nbm, email, status, profile_id')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as TeacherLinkBrief[]
}

/** Hubungkan guru ke akun pengguna (teachers.profile_id). */
export async function setTeacherProfileLink(teacherId: string, profileId: string | null): Promise<void> {
  const { error } = await supabase.from('teachers').update({ profile_id: profileId }).eq('id', teacherId)
  if (error) throw error
}

/**
 * Kirim email pemulihan password ke akun — client-side via Supabase Auth.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/login`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

/** Login terakhir per akun (RPC 0062, dari audit trail) — dipetakan user_id → ISO timestamp. */
export async function fetchLastLogins(): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('admin_last_logins')
  if (error) throw error
  return Object.fromEntries(
    ((data ?? []) as { user_id: string; last_login: string }[]).map((r) => [r.user_id, r.last_login]),
  )
}

// ------------------------------------------------------------
// Buat akun staff baru (invite) — lewat Edge Function `create-user`
// (service role). Jangan pakai auth.signUp client-side: akan
// mengganti sesi admin yang sedang aktif.
// ------------------------------------------------------------
export interface CreateStaffUserInput {
  email: string
  name: string
  role: string
  /** Bila diisi, guru ini langsung di-link ke akun baru (teachers.profile_id) */
  teacherId?: string
  /** Hasilkan link set-password untuk dibagikan ke penerima (tanpa password kustom) */
  sendInvite?: boolean
  /** Password kustom (min 8 karakter) — bila diisi, akun langsung bisa login */
  password?: string
}

export interface CreateStaffUserResult {
  userId: string
  email: string
  role: string
  actionLink: string | null
  passwordSet: boolean
}

export async function createStaffUser(input: CreateStaffUserInput): Promise<CreateStaffUserResult> {
  const { data, error } = await supabase.functions.invoke('create-user', { body: input })
  if (error) {
    // Non-2xx dari Edge Function = FunctionsHttpError: pesan asli ada di body
    // (context), error.message-nya hanya "returned a non-2xx status code".
    let detail = error.message
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null
      detail = body?.error ?? detail
    }
    const hint = /failed|not found|404/i.test(detail)
      ? 'Edge Function "create-user" belum ter-deploy — jalankan: supabase functions deploy create-user'
      : detail
    throw new Error(hint)
  }
  const res = (data ?? {}) as CreateStaffUserResult & { error?: string }
  if (res.error) throw new Error(res.error)
  return res
}

// ------------------------------------------------------------
// Statistik tabel — Dashboard Admin & Kesehatan Database
// ------------------------------------------------------------
export interface TableDef {
  key: string
  label: string
  softDelete: boolean
}

export const TABLE_CONFIG: TableDef[] = [
  { key: 'students', label: 'Santri', softDelete: true },
  { key: 'teachers', label: 'Guru', softDelete: true },
  { key: 'classes', label: 'Kelas', softDelete: true },
  { key: 'dorms', label: 'Asrama', softDelete: true },
  { key: 'academic_years', label: 'Tahun Akademik', softDelete: true },
  { key: 'point_rules', label: 'Aturan Poin', softDelete: false },
  { key: 'reports', label: 'Catatan Poin', softDelete: false },
  { key: 'gate_logs', label: 'Log Gerbang', softDelete: false },
  { key: 'student_attendance', label: 'Absensi', softDelete: false },
  { key: 'announcements', label: 'Informasi', softDelete: false },
  { key: 'profiles', label: 'Akun Pengguna', softDelete: false },
  { key: 'audit_logs', label: 'Audit Log', softDelete: false },
  // ── Tabel modul 0022+ (softDelete sesuai skema migrasi) ──
  { key: 'subjects', label: 'Mata Pelajaran', softDelete: true },
  { key: 'schedules', label: 'Jadwal KBM', softDelete: true },
  { key: 'tahfidz_records', label: 'Setoran Tahfidz', softDelete: true },
  { key: 'halaqah_groups', label: 'Halaqah', softDelete: true },
  { key: 'extracurriculars', label: 'Ekstrakurikuler', softDelete: true },
  { key: 'books', label: 'Buku Perpustakaan', softDelete: true },
  { key: 'book_loans', label: 'Peminjaman Buku', softDelete: false },
  { key: 'savings_accounts', label: 'Rekening Tabungan', softDelete: true },
  { key: 'savings_transactions', label: 'Transaksi Tabungan', softDelete: false },
  { key: 'inventory_items', label: 'Inventaris', softDelete: true },
  { key: 'leave_permits', label: 'Izin Keluar', softDelete: false },
  { key: 'health_logs', label: 'Rekam Medis', softDelete: false },
  { key: 'counseling_logs', label: 'Sesi BK', softDelete: false },
  { key: 'admissions', label: 'Pendaftar PPDB', softDelete: true },
  { key: 'suspensions', label: 'Skorsing', softDelete: false },
  // ── Tabel modul 0049–0056 (softDelete sesuai skema migrasi) ──
  { key: 'subject_attendance', label: 'Absensi Mapel', softDelete: false },
  { key: 'instruments', label: 'Instrumen Evaluasi', softDelete: true },
  { key: 'instrument_responses', label: 'Respons Angket', softDelete: false },
  { key: 'api_keys', label: 'API Key', softDelete: false },
  { key: 'api_request_log', label: 'Log Request API', softDelete: false },
  { key: 'entities', label: 'Entitas', softDelete: true },
  { key: 'portal_sessions', label: 'Sesi Portal', softDelete: false },
  { key: 'portal_login_attempts', label: 'Percobaan Login Portal', softDelete: false },
  { key: 'push_subscriptions', label: 'Langganan Push', softDelete: false },
  { key: 'worship_items', label: 'Materi Ibadah', softDelete: true },
  { key: 'worship_mastery', label: 'Penguasaan Ibadah', softDelete: false },
  { key: 'worship_scores', label: 'Skor Ibadah', softDelete: false },
  { key: 'curriculum_cps', label: 'CP Kurikulum', softDelete: true },
  { key: 'curriculum_tps', label: 'TP Kurikulum', softDelete: true },
  { key: 'cocurricular_dims', label: 'Dimensi Kokurikuler', softDelete: true },
  { key: 'graduation_checks', label: 'Cek Kelulusan', softDelete: false },
]

// Label tampilan tabel yang muncul di audit log tapi tidak masuk
// TABLE_CONFIG (tabel turunan/log/autentikasi).
const AUDIT_TABLE_EXTRA_LABELS: Record<string, string> = {
  academic_calendar_events: 'Kalender Akademik',
  app_settings: 'Pengaturan Aplikasi',
  assessments: 'Penilaian',
  attendance_machines: 'Mesin Absensi',
  cbt_attempts: 'Percobaan CBT',
  cbt_exams: 'Ujian CBT',
  cbt_questions: 'Bank Soal CBT',
  class_subjects: 'Mapel per Kelas',
  dorm_occupancy: 'Penghuni Asrama',
  ekskul_attendance: 'Absensi Ekstrakurikuler',
  extracurricular_members: 'Anggota Ekstrakurikuler',
  feature_flags: 'Feature Flags',
  grade_configs: 'Konfigurasi Nilai',
  halaqah_attendance: 'Absensi Halaqah',
  halaqah_members: 'Anggota Halaqah',
  health_medicines: 'Stok Obat',
  insight_logs: 'Riwayat Insight',
  official_letters: 'Surat Resmi',
  role_permissions: 'Permission Role',
  roles: 'Roles',
  rooms: 'Ruang',
  spp_components: 'Komponen SPP',
  spp_obligations: 'Tagihan SPP',
  spp_payments: 'Pembayaran SPP',
  'storage.objects': 'Penyimpanan',
  student_guardians: 'Wali Santri',
  student_monthly_reports: 'Rapor Bulanan',
  student_semester_reports: 'Rapor Semester',
  substitution_logs: 'Log Penggantian Jadwal',
  suspension_followups: 'Tindak Lanjut Skorsing',
  suspension_task_submissions: 'Kiriman Tugas Skorsing',
  suspension_tasks: 'Tugas Skorsing',
  suspension_tokens: 'Token Skorsing',
  task_runs: 'Riwayat Otomasi',
  teacher_attendance: 'Absensi Guru',
  time_slots: 'Jam Pelajaran',
  wa_settings: 'Pengaturan WA',
}

/** Satu sumber label tabel untuk viewer audit (AuditPage) — gabungan TABLE_CONFIG + ekstra. */
export const TABLE_LABELS: Record<string, string> = {
  ...Object.fromEntries(TABLE_CONFIG.map((c) => [c.key, c.label])),
  ...AUDIT_TABLE_EXTRA_LABELS,
}

export async function fetchTableCount(table: string, activeOnly = false): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (activeOnly) query = query.is('deleted_at', null)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

interface AdminTableStatRow {
  key: string
  total: number
  active: number | null
  latest_created_at: string | null
}

/**
 * Statistik semua tabel dalam SATU call RPC (migrasi 0062) — sebelumnya
 * 2 count + 1 latest per tabel (±65 request per refresh). LABEL & urutan
 * tetap dari TABLE_CONFIG; tabel yang belum ada di deployment (RPC
 * melewatinya) tampil sebagai 0.
 */
export async function fetchTableStats(): Promise<TableStat[]> {
  const { data, error } = await supabase.rpc('admin_table_stats')
  if (error) throw error
  const byKey = new Map(((data ?? []) as AdminTableStatRow[]).map((r) => [r.key, r]))
  return TABLE_CONFIG.map((cfg) => {
    const row = byKey.get(cfg.key)
    return {
      key: cfg.key,
      label: cfg.label,
      total: row?.total ?? 0,
      active: cfg.softDelete ? (row?.active ?? 0) : null,
      latestCreatedAt: row?.latest_created_at ?? null,
    }
  })
}

export interface AuditDayPoint {
  date: string
  total: number
}

/** Kunci tanggal lokal (bukan UTC) — aktivitas malam WIB tidak tergeser satu hari. */
function localDayKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

// Aktivitas audit N hari terakhir (default 7), dikelompokkan per hari.
export async function fetchAuditActivity(days = 7): Promise<AuditDayPoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('audit_logs')
    .select('created_at')
    .gte('created_at', since.toISOString())
    .limit(2000)
  if (error) throw error

  const buckets = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    buckets.set(localDayKey(d), 0)
  }
  for (const row of (data ?? []) as { created_at: string }[]) {
    const key = localDayKey(new Date(row.created_at))
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([date, total]) => ({ date, total }))
}

// ------------------------------------------------------------
// Cek integritas data — Kesehatan Database
// Hitungan server-side via RPC admin_integrity_checks (migrasi
// 0062, 1 call tanpa download tabel); label & copy tetap di klien.
// Diadaptasi ke skema V2: FK ketat berarti "orphan" nyata hanya
// terjadi lewat soft delete (child menunjuk parent terhapus).
// ------------------------------------------------------------
const ISSUE_META: Record<string, { label: string; detail: string; fixable: boolean }> = {
  refs_dead_class: {
    label: 'Santri menunjuk kelas terhapus',
    detail: 'Santri aktif masih terhubung ke kelas yang sudah diarsipkan (soft delete). Perbaikan akan melepas relasinya.',
    fixable: true,
  },
  refs_dead_dorm: {
    label: 'Santri menunjuk asrama terhapus',
    detail: 'Santri aktif masih terhubung ke asrama yang sudah diarsipkan. Perbaikan akan melepas relasinya.',
    fixable: true,
  },
  years_active_conflict: {
    label: 'Tahun akademik aktif ganda',
    detail: 'Lebih dari satu tahun akademik ditandai aktif, hanya boleh satu.',
    fixable: false,
  },
  dorms_over_capacity: {
    label: 'Asrama melebihi kapasitas',
    detail: 'Jumlah penghuni melebihi kapasitas yang tercatat.',
    fixable: false,
  },
  classes_no_homeroom: {
    label: 'Kelas tanpa wali kelas',
    detail: 'Kelas aktif yang belum memiliki wali kelas.',
    fixable: false,
  },
  teachers_no_account: {
    label: 'Guru tanpa akun',
    detail: 'Guru aktif yang belum terhubung ke akun pengguna (profile_id kosong).',
    fixable: false,
  },
  students_no_nis: {
    label: 'Santri tanpa NIS',
    detail: 'Santri aktif yang belum memiliki NIS terisi.',
    fixable: false,
  },
}

export async function fetchIntegrityIssues(): Promise<IntegrityIssue[]> {
  const { data, error } = await supabase.rpc('admin_integrity_checks')
  if (error) throw error
  const rows = (data ?? []) as { id: string; count: number }[]
  return rows.map((row) => {
    const meta = ISSUE_META[row.id]
    return {
      id: row.id,
      label: meta?.label ?? row.id,
      detail: meta?.detail ?? '',
      count: Number(row.count) || 0,
      fixable: meta?.fixable ?? false,
    }
  })
}

// ------------------------------------------------------------
// Storage
// ------------------------------------------------------------
export async function fetchBuckets(): Promise<BucketInfo[]> {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw error
  return (data ?? []) as BucketInfo[]
}

// Batas pengaman traversal rekursif (storage.list tidak punya mode rekursif)
const WALK_MAX_DEPTH = 3
const WALK_MAX_FILES = 5000

/**
 * Telusuri file bucket secara rekursif (queue folder, list per level).
 * `name` berisi path lengkap (termasuk folder) sehingga hapus via
 * remove([path]) tetap benar.
 */
async function walkBucketFiles(bucket: string, limitPerFolder = 200): Promise<StorageFileInfo[]> {
  const out: StorageFileInfo[] = []
  const queue: { prefix: string; depth: number }[] = [{ prefix: '', depth: 0 }]
  while (queue.length > 0 && out.length < WALK_MAX_FILES) {
    const { prefix, depth } = queue.shift() as { prefix: string; depth: number }
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: limitPerFolder,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) continue // folder tanpa izin baca dilewati saja
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id === null) {
        if (depth < WALK_MAX_DEPTH) queue.push({ prefix: path, depth: depth + 1 })
        continue
      }
      out.push({
        bucket,
        name: path,
        size: entry.metadata?.size ?? 0,
        updatedAt: entry.updated_at ?? null,
      })
    }
  }
  return out
}

// File terbesar dari semua bucket (rekursif hingga 3 level folder).
// Bucket tanpa izin baca dilewati.
export async function fetchLargestFiles(limit = 10): Promise<StorageFileInfo[]> {
  const buckets = await fetchBuckets()
  const perBucket = await Promise.all(buckets.map((b) => walkBucketFiles(b.name, 500)))
  return perBucket
    .flat()
    .sort((a, b) => b.size - a.size)
    .slice(0, limit)
}

/** Parse URL storage Supabase menjadi referensi bucket/path, atau null bila bukan URL storage. */
export function extractStorageRef(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/)
  if (!match) return null
  return { bucket: match[1], path: decodeURIComponent(match[2]) }
}

/**
 * Pemindai file orphan: file di bucket yang tidak dirujuk kolom URL mana
 * pun (profiles.avatar_url, students.photo_url, teachers.photo_url).
 * Referensi diambil via RPC admin_storage_refs (migrasi 0062) — base64
 * foto tidak pernah keluar dari DB, sebelumnya 3 full-column select.
 */
export async function fetchOrphanFiles(): Promise<StorageFileInfo[]> {
  const buckets = await fetchBuckets()
  const refsRes = await supabase.rpc('admin_storage_refs')
  if (refsRes.error) throw refsRes.error

  const referenced = new Set<string>()
  for (const row of (refsRes.data ?? []) as { bucket: string; path: string }[]) {
    referenced.add(`${row.bucket}/${decodeURIComponent(row.path)}`)
  }

  const perBucket = await Promise.all(buckets.map((b) => walkBucketFiles(b.name, 500)))
  return perBucket
    .flat()
    .filter((file) => !referenced.has(`${file.bucket}/${file.name}`))
}

export async function deleteStorageFiles(bucket: string, names: string[]): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove(names)
  if (error) throw error
}

// ------------------------------------------------------------
// Runner Otomasi (dijalankan manual dari AutomationPage)
// ------------------------------------------------------------
export async function runSyncStats(): Promise<Record<string, number>> {
  const [students, reports, classes, attendance] = await Promise.all([
    fetchTableCount('students', true),
    fetchTableCount('reports'),
    fetchTableCount('classes', true),
    fetchTableCount('student_attendance'),
  ])
  return { santriAktif: students, catatanPoin: reports, kelasAktif: classes, absensi: attendance }
}

// Lepas class_id/dorm_id santri aktif yang menunjuk kelas/asrama
// terarsip — satu-satunya bentuk "orphan" yang mungkin di V2.
export async function runDetachRefs(): Promise<{ classRefs: number; dormRefs: number }> {
  const issues = await fetchIntegrityIssues()
  const classIssue = issues.find((i) => i.id === 'refs_dead_class')
  const dormIssue = issues.find((i) => i.id === 'refs_dead_dorm')

  if (classIssue && classIssue.count > 0) {
    const studentsRes = await supabase
      .from('students')
      .select('id, class_id')
      .is('deleted_at', null)
      .not('class_id', 'is', null)
    if (studentsRes.error) throw studentsRes.error
    const deadClassIds = new Set(
      (await supabase.from('classes').select('id').not('deleted_at', 'is', null)).data?.map((r) => r.id) ?? [],
    )
    const ids = findOrphanIds((studentsRes.data ?? []).map((s) => s.class_id), deadClassIds)
    for (const part of chunk(ids, 500)) {
      const { error } = await supabase.from('students').update({ class_id: null }).in('id', part)
      if (error) throw error
    }
  }
  if (dormIssue && dormIssue.count > 0) {
    const studentsRes = await supabase
      .from('students')
      .select('id, dorm_id')
      .is('deleted_at', null)
      .not('dorm_id', 'is', null)
    if (studentsRes.error) throw studentsRes.error
    const deadDormIds = new Set(
      (await supabase.from('dorms').select('id').not('deleted_at', 'is', null)).data?.map((r) => r.id) ?? [],
    )
    const ids = findOrphanIds((studentsRes.data ?? []).map((s) => s.dorm_id), deadDormIds)
    for (const part of chunk(ids, 500)) {
      const { error } = await supabase.from('students').update({ dorm_id: null }).in('id', part)
      if (error) throw error
    }
  }
  return { classRefs: classIssue?.count ?? 0, dormRefs: dormIssue?.count ?? 0 }
}

/** Dry-run rotasi: hitung audit log yang akan dihapus tanpa menghapus (untuk modal konfirmasi). */
export async function previewRotateAuditLogs(days: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoff.toISOString())
  if (error) throw error
  return count ?? 0
}

export async function runRotateAuditLogs(days: number): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', cutoff.toISOString())
  if (error) throw error
  const total = count ?? 0
  if (total === 0) return 0
  const { error: delError } = await supabase
    .from('audit_logs')
    .delete()
    .lt('created_at', cutoff.toISOString())
  if (delError) throw delError
  return total
}

// ------------------------------------------------------------
// Riwayat eksekusi otomasi server-side (tabel task_runs, migrasi 0062) —
// pengganti localStorage agar persist lintas perangkat.
// ------------------------------------------------------------

export async function fetchAutomationRuns(): Promise<AutomationRun[]> {
  const { data, error } = await supabase
    .from('task_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    automationId: String(row.task_key) as AutomationRun['automationId'],
    startedAt: String(row.created_at),
    durationMs: Number(row.duration_ms ?? 0),
    ok: row.status === 'success',
    summary: String(row.detail ?? ''),
  }))
}

export async function insertAutomationRun(input: {
  automationId: string
  ok: boolean
  durationMs: number
  affected: Record<string, number> | null
  detail: string
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('task_runs').insert({
    task_key: input.automationId,
    status: input.ok ? 'success' : 'error',
    duration_ms: Math.round(input.durationMs),
    affected_rows: input.affected,
    detail: input.detail,
    created_by: user?.id ?? null,
  })
  if (error) throw error
}

/** Impor riwayat localStorage lama ke server (sekali, saat pertama load). */
export async function importAutomationRuns(runs: AutomationRun[]): Promise<void> {
  if (runs.length === 0) return
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('task_runs').insert(
    runs.map((run) => ({
      task_key: run.automationId,
      status: run.ok ? 'success' : 'error',
      duration_ms: Math.round(run.durationMs),
      affected_rows: null,
      detail: run.summary,
      created_at: run.startedAt,
      created_by: user?.id ?? null,
    })),
  )
  if (error) throw error
}
