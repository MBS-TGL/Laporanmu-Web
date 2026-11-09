import { supabase } from '../../lib/supabase'
import { findOrphanIds } from './tasks'
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
]

export async function fetchTableCount(table: string, activeOnly = false): Promise<number> {
  let query = supabase.from(table).select('*', { count: 'exact', head: true })
  if (activeOnly) query = query.is('deleted_at', null)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export async function fetchTableStats(): Promise<TableStat[]> {
  return Promise.all(
    TABLE_CONFIG.map(async (cfg) => {
      const { data, error } = await supabase
        .from(cfg.key)
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) throw error
      return {
        key: cfg.key,
        label: cfg.label,
        total: await fetchTableCount(cfg.key),
        active: cfg.softDelete ? await fetchTableCount(cfg.key, true) : null,
        latestCreatedAt: (data?.[0]?.created_at as string | undefined) ?? null,
      }
    }),
  )
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
// Diadaptasi ke skema V2: FK ketat berarti "orphan" nyata hanya
// terjadi lewat soft delete (child menunjuk parent terhapus).
// ------------------------------------------------------------
export async function fetchIntegrityIssues(): Promise<IntegrityIssue[]> {
  const [studentsRes, deadClassesRes, deadDormsRes, classesRes, teachersRes, dormsRes, occupancyRes, activeYearsRes] =
    await Promise.all([
      supabase.from('students').select('id, class_id, dorm_id, nis').is('deleted_at', null),
      supabase.from('classes').select('id').not('deleted_at', 'is', null),
      supabase.from('dorms').select('id').not('deleted_at', 'is', null),
      supabase.from('classes').select('id, homeroom_teacher_id').is('deleted_at', null),
      supabase.from('teachers').select('id, profile_id').is('deleted_at', null),
      supabase.from('dorms').select('id, name, capacity').is('deleted_at', null),
      supabase.from('dorm_occupancy').select('dorm_id, occupied'),
      supabase.from('academic_years').select('id').eq('is_active', true),
    ])
  for (const res of [studentsRes, deadClassesRes, deadDormsRes, classesRes, teachersRes, dormsRes, occupancyRes, activeYearsRes]) {
    if (res.error) throw res.error
  }

  const students = (studentsRes.data ?? []) as { id: string; class_id: string | null; dorm_id: string | null; nis: string | null }[]
  const deadClassIds = new Set((deadClassesRes.data ?? []).map((r) => r.id))
  const deadDormIds = new Set((deadDormsRes.data ?? []).map((r) => r.id))
  const classes = (classesRes.data ?? []) as { id: string; homeroom_teacher_id: string | null }[]
  const teachers = (teachersRes.data ?? []) as { id: string; profile_id: string | null }[]
  const dorms = (dormsRes.data ?? []) as { id: string; name: string; capacity: number }[]
  const occupancy = (occupancyRes.data ?? []) as { dorm_id: string; occupied: number }[]
  const activeYearCount = (activeYearsRes.data ?? []).length

  const deadClassRefs = findOrphanIds(students.map((s) => s.class_id), deadClassIds)
  const deadDormRefs = findOrphanIds(students.map((s) => s.dorm_id), deadDormIds)
  const capacityByName = new Map(dorms.map((d) => [d.id, d]))
  const overCapacity = occupancy.filter((o) => {
    const dorm = capacityByName.get(o.dorm_id)
    return dorm ? o.occupied > dorm.capacity : false
  })

  return [
    {
      id: 'refs_dead_class',
      label: 'Santri menunjuk kelas terhapus',
      detail: 'Santri aktif masih terhubung ke kelas yang sudah diarsipkan (soft delete). Perbaikan akan melepas relasinya.',
      count: deadClassRefs.length,
      fixable: true,
    },
    {
      id: 'refs_dead_dorm',
      label: 'Santri menunjuk asrama terhapus',
      detail: 'Santri aktif masih terhubung ke asrama yang sudah diarsipkan. Perbaikan akan melepas relasinya.',
      count: deadDormRefs.length,
      fixable: true,
    },
    {
      id: 'years_active_conflict',
      label: 'Tahun akademik aktif ganda',
      detail: 'Lebih dari satu tahun akademik ditandai aktif — hanya boleh satu.',
      count: Math.max(0, activeYearCount - 1),
      fixable: false,
    },
    {
      id: 'dorms_over_capacity',
      label: 'Asrama melebihi kapasitas',
      detail: 'Jumlah penghuni melebihi kapasitas yang tercatat.',
      count: overCapacity.length,
      fixable: false,
    },
    {
      id: 'classes_no_homeroom',
      label: 'Kelas tanpa wali kelas',
      detail: 'Kelas aktif yang belum memiliki wali kelas.',
      count: classes.filter((c) => !c.homeroom_teacher_id).length,
      fixable: false,
    },
    {
      id: 'teachers_no_account',
      label: 'Guru tanpa akun',
      detail: 'Guru aktif yang belum terhubung ke akun pengguna (profile_id kosong).',
      count: teachers.filter((t) => !t.profile_id).length,
      fixable: false,
    },
    {
      id: 'students_no_nis',
      label: 'Santri tanpa NIS',
      detail: 'Santri aktif yang belum memiliki NIS terisi.',
      count: students.filter((s) => !s.nis || s.nis.trim() === '').length,
      fixable: false,
    },
  ]
}

// ------------------------------------------------------------
// Storage
// ------------------------------------------------------------
export async function fetchBuckets(): Promise<BucketInfo[]> {
  const { data, error } = await supabase.storage.listBuckets()
  if (error) throw error
  return (data ?? []) as BucketInfo[]
}

// Ambil file root-level terbesar dari semua bucket (pola V1: list
// non-rekursif). Return kosong + error dilempar bila policy menolak.
export async function fetchLargestFiles(limit = 10): Promise<StorageFileInfo[]> {
  const buckets = await fetchBuckets()
  const all: StorageFileInfo[] = []
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket.name).list('', {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    if (error) continue // bucket tanpa izin baca dilewati saja
    for (const file of data ?? []) {
      if (file.id === null) continue // folder pseudo-entry
      all.push({
        bucket: bucket.name,
        name: file.name,
        size: file.metadata?.size ?? 0,
        updatedAt: file.updated_at ?? null,
      })
    }
  }
  return all.sort((a, b) => b.size - a.size).slice(0, limit)
}

/** Parse URL storage Supabase menjadi referensi bucket/path, atau null bila bukan URL storage. */
export function extractStorageRef(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/)
  if (!match) return null
  return { bucket: match[1], path: decodeURIComponent(match[2]) }
}

// Pemindai file orphan: file root-level di bucket yang tidak dirujuk
// kolom URL mana pun (profiles.avatar_url, students.photo_url, teachers.photo_url).
export async function fetchOrphanFiles(): Promise<StorageFileInfo[]> {
  const buckets = await fetchBuckets()
  const [avatarsRes, studentPhotosRes, teacherPhotosRes] = await Promise.all([
    supabase.from('profiles').select('avatar_url'),
    supabase.from('students').select('photo_url'),
    supabase.from('teachers').select('photo_url'),
  ])
  for (const res of [avatarsRes, studentPhotosRes, teacherPhotosRes]) {
    if (res.error) throw res.error
  }

  const referenced = new Set<string>()
  for (const rows of [avatarsRes.data, studentPhotosRes.data, teacherPhotosRes.data]) {
    for (const row of (rows ?? []) as Record<string, string | null>[]) {
      const ref = extractStorageRef(Object.values(row)[0])
      if (ref) referenced.add(`${ref.bucket}/${ref.path}`)
    }
  }

  const orphans: StorageFileInfo[] = []
  for (const bucket of buckets) {
    const { data, error } = await supabase.storage.from(bucket.name).list('', { limit: 500 })
    if (error) continue
    for (const file of data ?? []) {
      if (file.id === null) continue
      if (!referenced.has(`${bucket.name}/${file.name}`)) {
        orphans.push({
          bucket: bucket.name,
          name: file.name,
          size: file.metadata?.size ?? 0,
          updatedAt: file.updated_at ?? null,
        })
      }
    }
  }
  return orphans
}

export async function deleteStorageFiles(bucket: string, names: string[]): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove(names)
  if (error) throw error
}

// ------------------------------------------------------------
// Task runner — Otomasi (dieksekusi manual dari TasksPage)
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
    if (ids.length > 0) {
      const { error } = await supabase.from('students').update({ class_id: null }).in('id', ids)
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
    if (ids.length > 0) {
      const { error } = await supabase.from('students').update({ dorm_id: null }).in('id', ids)
      if (error) throw error
    }
  }
  return { classRefs: classIssue?.count ?? 0, dormRefs: dormIssue?.count ?? 0 }
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
