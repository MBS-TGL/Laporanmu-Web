/**
 * Registry permission RBAC — sumber tunggal daftar permission & role default.
 *
 * Format permission: `<module>:<action>` (contoh: `students:delete`).
 * Tabel `roles`/`role_permissions` di DB hanya menyimpan OVERRIDE — bila
 * sebuah role belum punya baris di DB, ia memakai set default di bawah
 * (fallback per-role, lihat useRbac.ts). Jangan seed permission di SQL:
 * registry ini yang mengikuti perkembangan modul aplikasi.
 */

export interface RbacActionMeta {
  key: string
  label: string
}

export interface RbacModuleMeta {
  key: string
  label: string
  /** Aksi per modul; permission final = `${key}:${action.key}` */
  actions: RbacActionMeta[]
}

const CRUD = [
  { key: 'read', label: 'Lihat' },
  { key: 'create', label: 'Tambah' },
  { key: 'update', label: 'Ubah' },
  { key: 'delete', label: 'Hapus' },
]

// Modul operasional — satu per halaman nav (navItems.tsx). Urutan mengikuti
// sidebar agar matrix roles terbaca dengan orientasi yang sama.
export const MODULE_REGISTRY: RbacModuleMeta[] = [
  { key: 'dashboard', label: 'Dashboard', actions: [{ key: 'read', label: 'Lihat' }] },
  // Kesantrian
  { key: 'attendance', label: 'Absensi', actions: CRUD },
  { key: 'leave_permit', label: 'Izin Keluar', actions: CRUD },
  { key: 'gate', label: 'Gerbang', actions: CRUD },
  { key: 'dorms', label: 'Asrama', actions: CRUD },
  { key: 'health', label: 'Kesehatan', actions: CRUD },
  { key: 'counseling', label: 'Bimbingan Konseling', actions: CRUD },
  { key: 'discipline', label: 'Poin & Disiplin', actions: CRUD },
  // Akademik
  { key: 'grades', label: 'Penilaian', actions: CRUD },
  { key: 'cbt', label: 'CBT', actions: CRUD },
  { key: 'evaluation', label: 'Pusat Evaluasi', actions: CRUD },
  { key: 'schedules', label: 'Jadwal KBM', actions: CRUD },
  { key: 'teaching_load', label: 'Beban Mengajar', actions: [{ key: 'read', label: 'Lihat' }] },
  { key: 'report_cards', label: 'Raport', actions: CRUD },
  { key: 'library', label: 'Perpustakaan', actions: CRUD },
  // Kegiatan Santri
  { key: 'tahfidz', label: 'Tahfidz', actions: CRUD },
  { key: 'halaqah', label: 'Halaqah', actions: CRUD },
  { key: 'ekskul', label: 'Ekstrakurikuler', actions: CRUD },
  // Keuangan & Aset
  { key: 'finance', label: 'Keuangan SPP', actions: CRUD },
  { key: 'savings', label: 'Tabungan', actions: CRUD },
  { key: 'inventory', label: 'Inventaris', actions: CRUD },
  // Master Data
  { key: 'students', label: 'Data Siswa', actions: CRUD },
  { key: 'teachers', label: 'Data Guru', actions: CRUD },
  { key: 'classes', label: 'Data Kelas', actions: CRUD },
  { key: 'subjects', label: 'Mata Pelajaran', actions: CRUD },
  { key: 'academic_years', label: 'Tahun Akademik', actions: CRUD },
  // Sistem umum
  { key: 'announcements', label: 'Informasi', actions: CRUD },
  { key: 'school', label: 'Profil Sekolah', actions: CRUD },
  // Admin & developer tools (aksi = sub-halaman admin)
  {
    key: 'admin',
    label: 'Admin & Developer Tools',
    actions: [
      { key: 'access', label: 'Akses area admin' },
      { key: 'users', label: 'Pengguna' },
      { key: 'roles', label: 'Roles & Permission' },
      { key: 'settings', label: 'Pengaturan Developer' },
      { key: 'automation', label: 'Otomasi' },
      { key: 'database', label: 'Kesehatan Database' },
      { key: 'audit', label: 'Audit Log' },
    ],
  },
  { key: 'media', label: 'Media Library', actions: [{ key: 'read', label: 'Lihat' }, { key: 'upload', label: 'Unggah' }, { key: 'delete', label: 'Hapus' }] },
  { key: 'trash', label: 'Sampah', actions: [{ key: 'read', label: 'Lihat' }, { key: 'restore', label: 'Pulihkan' }, { key: 'purge', label: 'Hapus Permanen' }] },
]

/** Semua permission yang sah, diturunkan dari registry. */
export const ALL_PERMISSIONS: string[] = MODULE_REGISTRY.flatMap((m) =>
  m.actions.map((a) => `${m.key}:${a.key}`),
)

const PERMISSION_SET = new Set(ALL_PERMISSIONS)

export function isValidPermission(perm: string): boolean {
  return PERMISSION_SET.has(perm)
}

/** Jumlah permission tercentang dari total semua permission sah. */
export function permissionSummary(value: Set<string>): { checked: number; total: number } {
  return { checked: ALL_PERMISSIONS.filter((p) => value.has(p)).length, total: ALL_PERMISSIONS.length }
}

/** Permission modul operasional (non-admin) — set default manager. */
function operationalPermissions(): string[] {
  return MODULE_REGISTRY
    .filter((m) => m.key !== 'admin' && m.key !== 'media' && m.key !== 'trash')
    .flatMap((m) => m.actions.map((a) => `${m.key}:${a.key}`))
}

/**
 * Permission default guru — terbatas pada modul mengajar (CRUD penuh),
 * modul lain hanya lihat. Sinkron dengan matrix di MEMORY.md.
 */
const TEACHING_MODULES = ['attendance', 'grades', 'cbt', 'tahfidz', 'halaqah', 'report_cards']
const READ_ONLY_MODULES = ['dashboard', 'students', 'classes', 'schedules', 'subjects', 'teaching_load', 'dorms', 'health', 'counseling', 'discipline', 'leave_permit', 'gate', 'library', 'ekskul', 'finance', 'savings', 'inventory', 'academic_years', 'announcements', 'evaluation']

function teacherPermissions(): string[] {
  const perms: string[] = []
  for (const key of TEACHING_MODULES) {
    const mod = MODULE_REGISTRY.find((m) => m.key === key)
    if (mod) perms.push(...mod.actions.map((a) => `${key}:${a.key}`))
  }
  for (const key of READ_ONLY_MODULES) perms.push(`${key}:read`)
  return perms
}

/**
 * Permission default per role — matrix akses aplikasi:
 * developer & admin lihat semuanya, manager CRUD semua modul operasional
 * (+ unggah media), teacher terbatas (matrix di atas), pending tidak melihat
 * apa pun.
 */
export const DEFAULT_ROLES: Record<string, string[]> = {
  developer: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: [...operationalPermissions(), 'media:read', 'media:upload'],
  teacher: teacherPermissions(),
  pending: [],
}

/** Permission default sebuah role; role tak dikenal tidak mendapat apa pun. */
export function defaultPermissionsForRole(roleKey: string): string[] {
  return DEFAULT_ROLES[roleKey] ?? []
}
