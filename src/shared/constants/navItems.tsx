import type { ComponentProps, ComponentType } from 'react'
import {
  AccountBookOutlined,
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
  desc: 'Ringkasan utama dan statistik sistem',
  perm: 'dashboard:read',
}

// ─── Kesantrian: operasional harian santri ──────────────────────────────────
const BOARDING_ITEMS: NavItem[] = [
  { to: '/attendance', label: 'Absensi', icon: SolutionOutlined, desc: 'Absensi santri, guru & karyawan, dan mesin presensi', perm: 'attendance:read' },
  { to: '/leave-permit', label: 'Izin Keluar', icon: ExportOutlined, desc: 'Surat izin keluar pondok', flag: 'module.leave_permit', perm: 'leave_permit:read' },
  { to: '/gate', label: 'Gerbang', icon: GatewayOutlined, desc: 'Log keluar-masuk santri di gerbang', flag: 'module.gate', perm: 'gate:read' },
  { to: '/dorms', label: 'Asrama', icon: ApartmentOutlined, desc: 'Kamar dan plotting santri asrama', flag: 'module.dorms', perm: 'dorms:read' },
  { to: '/health', label: 'Kesehatan', icon: MedicineBoxOutlined, desc: 'Rekam medis, observasi, stok obat', flag: 'module.health', perm: 'health:read' },
  { to: '/counseling', label: 'Bimbingan Konseling', icon: CommentOutlined, desc: 'Sesi BK dan pembinaan santri', flag: 'module.counseling', perm: 'counseling:read' },
  { to: '/disiplin', label: 'Poin & Disiplin', icon: AuditOutlined, desc: 'Catatan poin, aturan pelanggaran-prestasi, dan skorsing santri', perm: 'disiplin:read' },
]

// ─── Akademik: KBM dan penilaian ────────────────────────────────────────────
const ACADEMIC_ITEMS: NavItem[] = [
  { to: '/grades', label: 'Penilaian', icon: FileDoneOutlined, desc: 'Nilai formatif, sumatif, PTS, PAS, dan leger', flag: 'module.grades', perm: 'grades:read' },
  { to: '/cbt', label: 'CBT', icon: FileProtectOutlined, desc: 'Bank soal, ujian ber-token, dan pemantauan ujian', flag: 'module.cbt', perm: 'cbt:read' },
  { to: '/schedules', label: 'Jadwal KBM', icon: ScheduleOutlined, desc: 'Jadwal mengajar per kelas, mapel, dan guru', flag: 'module.schedules', perm: 'schedules:read' },
  { to: '/teaching-load', label: 'Beban Mengajar', icon: FieldTimeOutlined, desc: 'Distribusi jam mengajar guru dan cakupan kelas', perm: 'teaching_load:read' },
  { to: '/report-cards', label: 'Raport', icon: FileTextOutlined, desc: 'Input raport bulanan & semester per kelas', flag: 'module.report_cards', perm: 'report_cards:read' },
  { to: '/library', label: 'Perpustakaan', icon: BookOutlined, desc: 'Katalog buku dan peminjaman santri', flag: 'module.library', perm: 'library:read' },
]

// ─── Kegiatan Santri: kegiatan pembinaan di luar KBM ────────────────────────
const ACTIVITY_ITEMS: NavItem[] = [
  { to: '/halaqah', label: 'Halaqah', icon: DeploymentUnitOutlined, desc: 'Presensi halaqah, setoran hafalan (ziyadah & murojaah), dan kelompok', flag: 'module.halaqah', perm: 'halaqah:read' },
  { to: '/ekskul', label: 'Ekstrakurikuler', icon: FlagOutlined, desc: 'Kegiatan ekstrakurikuler dan pembina', flag: 'module.ekskul', perm: 'ekskul:read' },
]

// ─── Keuangan & Aset ────────────────────────────────────────────────────────
const FINANCE_ITEMS: NavItem[] = [
  { to: '/keuangan', label: 'Keuangan SPP', icon: AccountBookOutlined, desc: 'Kewajiban biaya, pembayaran, dan tunggakan per santri', flag: 'module.keuangan_spp', perm: 'keuangan:read' },
  { to: '/savings', label: 'Tabungan', icon: MoneyCollectOutlined, desc: 'Rekening tabungan, setor-tarik, dan buku tabungan', flag: 'module.savings', perm: 'savings:read' },
  { to: '/inventory', label: 'Inventaris', icon: InboxOutlined, desc: 'Aset dan barang beserta kondisinya', flag: 'module.inventory', perm: 'inventory:read' },
]

// ─── Master Data: referensi inti sistem ─────────────────────────────────────
const MASTER_ITEMS: NavItem[] = [
  { to: '/students', label: 'Data Siswa', icon: TeamOutlined, desc: 'Pusat database seluruh santri aktif', perm: 'students:read' },
  { to: '/teachers', label: 'Data Guru', icon: IdcardOutlined, desc: 'Data pengajar, musyrif, dan staf', perm: 'teachers:read' },
  { to: '/classes', label: 'Data Kelas', icon: BankOutlined, desc: 'Struktur kelas dan wali kelas', perm: 'classes:read' },
  { to: '/subjects', label: 'Mata Pelajaran', icon: OrderedListOutlined, desc: 'Daftar mapel, kelompok, dan beban JP', perm: 'subjects:read' },
  { to: '/academic-years', label: 'Tahun Akademik', icon: CalendarOutlined, desc: 'Periode semester, slot jam KBM, dan ruang kelas', perm: 'academic_years:read' },
]

// ─── Sistem: pengaturan umum + admin ────────────────────────────────────────
const SYSTEM_ITEMS: NavItem[] = [
  { to: '/announcements', label: 'Informasi', icon: NotificationOutlined, desc: 'Pengumuman untuk staf dan wali santri', perm: 'announcements:read' },
  { to: '/school', label: 'Profil Sekolah', icon: SettingOutlined, desc: 'Identitas sekolah untuk kop raport', perm: 'school:read' },
  { to: '/admin', label: 'Dashboard Admin', icon: AppstoreOutlined, desc: 'Pusat kendali teknis: insights, pengguna, roles, database, storage, media, sampah, audit', perm: 'admin:access' },
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
