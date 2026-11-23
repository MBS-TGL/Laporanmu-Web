import type { ComponentProps, ComponentType } from 'react'
import {
  AccountBookOutlined,
  FundProjectionScreenOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  CalendarOutlined,
  CommentOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExportOutlined,
  FieldTimeOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  FlagOutlined,
  StarOutlined,
  GatewayOutlined,
  HomeOutlined,
  IdcardOutlined,
  InboxOutlined,
  MedicineBoxOutlined,
  MoneyCollectOutlined,
  NotificationOutlined,
  OrderedListOutlined,
  ReadOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'

type IconType = ComponentType<ComponentProps<typeof TeamOutlined>>

export interface NavItem {
  to: string
  label: string
  icon: IconType
  desc: string
  /**
   * Permission `<module>:<action>` yang dibutuhkan item ini (RBAC,
   * dicek lewat useRbac().can). Item tanpa perm terlihat semua staff.
   */
  perm?: string
  /** Key feature flag `module.*` — item hilang dari menu saat flag MATI */
  flag?: string
}

export interface NavGroup {
  key: string
  label: string
  icon: IconType
  items: NavItem[]
}

export type CanFn = (perm: string) => boolean

export const DASHBOARD_ITEM: NavItem = {
  to: '/dashboard',
  label: 'Dashboard',
  icon: DashboardOutlined,
  desc: 'Ringkasan kegiatan dan kondisi sekolah',
  perm: 'dashboard:read',
}

// ─── Kesantrian: operasional harian santri ──────────────────────────────────
const BOARDING_ITEMS: NavItem[] = [
  { to: '/attendance', label: 'Absensi', icon: SolutionOutlined, desc: 'Absensi harian santri, guru, dan mesin presensi', perm: 'attendance:read' },
  { to: '/leave-permit', label: 'Izin Keluar', icon: ExportOutlined, desc: 'Surat izin keluar dan pemantauan status', flag: 'module.leave_permit', perm: 'leave_permit:read' },
  { to: '/gate', label: 'Gerbang', icon: GatewayOutlined, desc: 'Catatan keluar-masuk santri di gerbang', flag: 'module.gate', perm: 'gate:read' },
  { to: '/admissions', label: 'PPDB', icon: UserAddOutlined, desc: 'Pendaftar baru dan konversi menjadi santri', flag: 'module.ppdb', perm: 'admissions:read' },
  { to: '/dorms', label: 'Asrama', icon: ApartmentOutlined, desc: 'Kamar dan penempatan santri asrama', flag: 'module.dorms', perm: 'dorms:read' },
  { to: '/health', label: 'Kesehatan', icon: MedicineBoxOutlined, desc: 'Rekam medis, observasi, dan stok obat', flag: 'module.health', perm: 'health:read' },
  { to: '/counseling', label: 'Bimbingan Konseling', icon: CommentOutlined, desc: 'Sesi konseling, pembinaan, dan surat resmi', flag: 'module.counseling', perm: 'counseling:read' },
  { to: '/discipline', label: 'Poin & Disiplin', icon: AuditOutlined, desc: 'Catatan poin, aturan, dan skorsing santri', perm: 'discipline:read' },
]

// ─── Akademik: KBM dan penilaian ────────────────────────────────────────────
const ACADEMIC_ITEMS: NavItem[] = [
  { to: '/grades', label: 'Penilaian', icon: FileDoneOutlined, desc: 'Nilai ulangan, leger, dan ketuntasan belajar', flag: 'module.grades', perm: 'grades:read' },
  { to: '/instruments', label: 'Evaluasi', icon: FundProjectionScreenOutlined, desc: 'Angket dan asesmen santri: AKPD, sosiometri, MBTI, dan EDOM', flag: 'module.evaluation', perm: 'evaluation:read' },
  { to: '/cbt', label: 'CBT', icon: FileProtectOutlined, desc: 'Bank soal, sesi ujian, dan pemantauan', flag: 'module.cbt', perm: 'cbt:read' },
  { to: '/schedules', label: 'Jadwal & Kalender', icon: ScheduleOutlined, desc: 'Jadwal pelajaran, kalender akademik, dan agenda pondok', flag: 'module.schedules', perm: 'schedules:read' },
  { to: '/teaching-load', label: 'Beban Mengajar', icon: FieldTimeOutlined, desc: 'Sebaran jam mengajar dan cakupan kelas', perm: 'teaching_load:read' },
  { to: '/report-cards', label: 'Rapor', icon: FileTextOutlined, desc: 'Rapor bulanan dan semester per kelas', flag: 'module.report_cards', perm: 'report_cards:read' },
  { to: '/documents', label: 'Dokumen Akademik', icon: FileProtectOutlined, desc: 'Rapor, KHS, transkrip, buku induk, dan yudisium', flag: 'module.documents', perm: 'documents:read' },
  { to: '/library', label: 'Perpustakaan', icon: BookOutlined, desc: 'Katalog buku dan peminjaman santri', flag: 'module.library', perm: 'library:read' },
]

// ─── Kegiatan Santri: kegiatan pembinaan di luar KBM ────────────────────────
const ACTIVITY_ITEMS: NavItem[] = [
  { to: '/halaqah', label: 'Halaqah', icon: DeploymentUnitOutlined, desc: 'Absensi, setoran hafalan, dan kelompok halaqah', flag: 'module.halaqah', perm: 'halaqah:read' },
  { to: '/extracurricular', label: 'Ekstrakurikuler', icon: FlagOutlined, desc: 'Kegiatan, pembina, dan anggota ekstrakurikuler', flag: 'module.ekskul', perm: 'ekskul:read' },
  { to: '/worship', label: 'Ibadah', icon: StarOutlined, desc: 'Kemahiran ibadah dan nilai bulanan santri', flag: 'module.spiritual', perm: 'worship:read' },
]

// ─── Keuangan & Aset ────────────────────────────────────────────────────────
const FINANCE_ITEMS: NavItem[] = [
  { to: '/finance', label: 'Keuangan SPP', icon: AccountBookOutlined, desc: 'Tagihan, pembayaran, dan tunggakan SPP', flag: 'module.finance_spp', perm: 'finance:read' },
  { to: '/savings', label: 'Tabungan', icon: MoneyCollectOutlined, desc: 'Rekening, setor-tarik, dan buku tabungan santri', flag: 'module.savings', perm: 'savings:read' },
  { to: '/inventory', label: 'Inventaris', icon: InboxOutlined, desc: 'Aset dan barang beserta kondisi', flag: 'module.inventory', perm: 'inventory:read' },
]

// ─── Master Data: referensi inti sistem ─────────────────────────────────────
const MASTER_ITEMS: NavItem[] = [
  { to: '/students', label: 'Santri', icon: TeamOutlined, desc: 'Data induk santri aktif', perm: 'students:read' },
  { to: '/teachers', label: 'Guru', icon: IdcardOutlined, desc: 'Data guru, musyrif, dan tenaga kependidikan', perm: 'teachers:read' },
  { to: '/classes', label: 'Kelas', icon: BankOutlined, desc: 'Struktur kelas, tingkat, dan wali kelas', perm: 'classes:read' },
  { to: '/subjects', label: 'Mata Pelajaran', icon: OrderedListOutlined, desc: 'Daftar mata pelajaran, CP/TP, dan beban jam', perm: 'subjects:read' },
  { to: '/academic-years', label: 'Tahun Akademik', icon: CalendarOutlined, desc: 'Tahun ajaran, semester, slot jam, dan ruang', perm: 'academic_years:read' },
]

// ─── Sistem: pengaturan umum + admin ────────────────────────────────────────
const SYSTEM_ITEMS: NavItem[] = [
  { to: '/announcements', label: 'Pengumuman', icon: NotificationOutlined, desc: 'Pengumuman untuk staf dan wali', perm: 'announcements:read' },
  { to: '/school', label: 'Profil Sekolah', icon: SettingOutlined, desc: 'Identitas sekolah pada kop rapor', perm: 'school:read' },
  { to: '/admin', label: 'Administrasi', icon: AppstoreOutlined, desc: 'Pengguna, peran, basis data, media, dan jejak audit', perm: 'admin:access' },
]

export const NAV_GROUPS: NavGroup[] = [
  { key: 'boarding', label: 'Kesantrian', icon: HomeOutlined, items: BOARDING_ITEMS },
  { key: 'academic', label: 'Akademik', icon: ReadOutlined, items: ACADEMIC_ITEMS },
  { key: 'activity', label: 'Kegiatan Santri', icon: TrophyOutlined, items: ACTIVITY_ITEMS },
  { key: 'finance', label: 'Keuangan & Aset', icon: WalletOutlined, items: FINANCE_ITEMS },
  { key: 'master', label: 'Master Data', icon: DatabaseOutlined, items: MASTER_ITEMS },
  { key: 'system', label: 'Sistem', icon: SafetyOutlined, items: SYSTEM_ITEMS },
]

const STAFF_ROLES = ['developer', 'admin', 'manager', 'teacher']

/** Peta key flag → enabled. Bila undefined/ belum termuat, item bert-flag tetap tampil (fail-open). */
export function buildFlagMap(flags?: { key: string; enabled: boolean }[] | null): Record<string, boolean> | undefined {
  if (!flags) return undefined
  const map: Record<string, boolean> = {}
  for (const f of flags) map[f.key] = f.enabled
  return map
}

/**
 * Filter item menu berdasarkan permission RBAC + flag modul.
 * `can` dari useRbac().can — fail-open saat data RBAC belum termuat
 * (hook return true selama loading), sehingga menu tidak berkedip.
 * Item tanpa perm terlihat oleh semua staff (perilaku lama).
 */
export function filterNavItems(
  items: NavItem[],
  role: string | null | undefined,
  flags?: Record<string, boolean>,
  can?: CanFn,
): NavItem[] {
  return items.filter((item) => {
    if (can && item.perm && !can(item.perm)) return false
    if (role && !STAFF_ROLES.includes(role)) return false
    if (item.flag && flags?.[item.flag] === false) return false
    return true
  })
}

export function filterNavGroups(
  groups: NavGroup[],
  role: string | null | undefined,
  flags?: Record<string, boolean>,
  can?: CanFn,
): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, role, flags, can),
    }))
    .filter((group) => group.items.length > 0)
}
