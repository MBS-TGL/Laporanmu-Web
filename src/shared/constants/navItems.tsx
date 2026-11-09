import type { ComponentProps, ComponentType } from 'react'
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AudioOutlined,
  BankOutlined,
  BookOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GatewayOutlined,
  HddOutlined,
  HeartOutlined,
  HistoryOutlined,
  InboxOutlined,
  MoneyCollectOutlined,
  NotificationOutlined,
  ProfileOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  TrophyOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'

type IconType = ComponentType<ComponentProps<typeof TeamOutlined>>

export interface NavItem {
  to: string
  label: string
  icon: IconType
  desc: string
  requireRoles?: string[]
}

export interface NavGroup {
  key: string
  label: string
  icon: IconType
  items: NavItem[]
  hideForRoles?: string[]
}

export const DASHBOARD_ITEM: NavItem = {
  to: '/dashboard',
  label: 'Dashboard',
  icon: DashboardOutlined,
  desc: 'Ringkasan utama dan statistik sistem',
}

const MASTER_ITEMS: NavItem[] = [
  { to: '/master/students', label: 'Data Siswa', icon: TeamOutlined, desc: 'Pusat database seluruh santri aktif' },
  { to: '/master/students/alumni', label: 'Alumni', icon: SafetyCertificateOutlined, desc: 'Jejak siswa yang telah lulus' },
  { to: '/master/teachers', label: 'Data Guru', icon: ReadOutlined, desc: 'Data pengajar, musyrif, dan staf' },
  { to: '/master/classes', label: 'Data Kelas', icon: BankOutlined, desc: 'Struktur kelas dan wali kelas' },
  { to: '/master/subjects', label: 'Mata Pelajaran', icon: BookOutlined, desc: 'Daftar mapel, kelompok, dan beban JP' },
  { to: '/master/academic-years', label: 'Tahun Akademik', icon: CalendarOutlined, desc: 'Periode semester dan kalender akademik' },
  { to: '/master/inventory', label: 'Inventaris', icon: InboxOutlined, desc: 'Aset dan barang beserta kondisinya' },
  { to: '/master/admissions', label: 'PPDB', icon: UserAddOutlined, desc: 'Penerimaan santri baru dari daftar hingga daftar ulang' },
]

const ACADEMIC_ITEMS: NavItem[] = [
  { to: '/academic/tahfidz', label: 'Tahfidz', icon: AudioOutlined, desc: 'Setoran hafalan ziyadah & murojaah santri' },
  { to: '/academic/schedules', label: 'Jadwal KBM', icon: ScheduleOutlined, desc: 'Jadwal mengajar per kelas, mapel, dan guru' },
  { to: '/academic/halaqah', label: 'Halaqah', icon: DeploymentUnitOutlined, desc: 'Kelompok halaqah, musyrif, dan anggota' },
  { to: '/academic/ekskul', label: 'Ekstrakurikuler', icon: TrophyOutlined, desc: 'Kegiatan ekstrakurikuler dan pembina' },
  { to: '/academic/library', label: 'Perpustakaan', icon: BookOutlined, desc: 'Katalog buku dan peminjaman santri' },
]

const FINANCE_ITEMS: NavItem[] = [
  { to: '/finance/savings', label: 'Tabungan', icon: MoneyCollectOutlined, desc: 'Rekening tabungan, setor-tarik, dan buku tabungan' },
]

const BEHAVIOR_ITEMS: NavItem[] = [
  { to: '/points/rules', label: 'Aturan Poin', icon: FileDoneOutlined, desc: 'Daftar pelanggaran dan prestasi beserta bobot poin' },
  { to: '/points/reports', label: 'Catatan Poin', icon: ProfileOutlined, desc: 'Riwayat pelanggaran dan prestasi santri' },
]

const BOARDING_ITEMS: NavItem[] = [
  { to: '/attendance', label: 'Absensi Santri', icon: SolutionOutlined, desc: 'Kehadiran harian per kelas per bulan' },
  { to: '/boarding/dorms', label: 'Asrama', icon: ApartmentOutlined, desc: 'Kamar dan plotting santri asrama' },
  { to: '/boarding/health', label: 'Kesehatan', icon: HeartOutlined, desc: 'Rekam medis, observasi, stok obat' },
  { to: '/boarding/counseling', label: 'Bimbingan Konseling', icon: ProfileOutlined, desc: 'Sesi BK dan pembinaan santri' },
  { to: '/boarding/leave-permit', label: 'Izin Pulang', icon: FileTextOutlined, desc: 'Surat izin keluar pondok' },
  { to: '/suspension', label: 'Skorsing', icon: SafetyCertificateOutlined, desc: 'Skorsing & pembinaan di rumah' },
]

const GATE_ITEMS: NavItem[] = [
  { to: '/gate/logs', label: 'Gate Santri', icon: GatewayOutlined, desc: 'Log keluar-masuk santri di gerbang' },
]

const REPORT_CARD_ITEMS: NavItem[] = [
  { to: '/report-cards', label: 'Raport', icon: FileTextOutlined, desc: 'Input raport bulanan & semester per kelas' },
  { to: '/report-cards/archive', label: 'Arsip Raport', icon: FolderOpenOutlined, desc: 'Riwayat raport per kelas dan periode' },
]

const SETTINGS_ITEMS: NavItem[] = [
  { to: '/settings/announcements', label: 'Informasi', icon: NotificationOutlined, desc: 'Pengumuman untuk staf dan wali santri' },
  { to: '/settings/school', label: 'Profil Sekolah', icon: SettingOutlined, desc: 'Identitas sekolah untuk kop raport' },
]

const ADMIN_ITEMS: NavItem[] = [
  { to: '/admin', label: 'Dashboard Admin', icon: AppstoreOutlined, desc: 'Pusat pantauan teknis sistem', requireRoles: ['developer', 'admin'] },
  { to: '/insights', label: 'AI Insights', icon: RobotOutlined, desc: 'Analisis cerdas data pondok', requireRoles: ['developer', 'admin'] },
  { to: '/admin/database', label: 'Database', icon: DatabaseOutlined, desc: 'Kesehatan database & cek integritas', requireRoles: ['developer', 'admin'] },
  { to: '/admin/storage', label: 'Penyimpanan', icon: HddOutlined, desc: 'Bucket storage & pembersihan file', requireRoles: ['developer', 'admin'] },
  { to: '/admin/tasks', label: 'Otomasi', icon: ThunderboltOutlined, desc: 'Tugas pemeliharaan manual', requireRoles: ['developer', 'admin'] },
  { to: '/admin/settings', label: 'Pengaturan', icon: ToolOutlined, desc: 'Feature flags & mode maintenance', requireRoles: ['developer', 'admin'] },
  { to: '/admin/users', label: 'Pengguna', icon: UsergroupAddOutlined, desc: 'Kelola nama & role akun staff', requireRoles: ['developer', 'admin'] },
  { to: '/admin/audit-log', label: 'Audit Log', icon: HistoryOutlined, desc: 'Jejak perubahan data oleh pengguna', requireRoles: ['developer', 'admin'] },
]

export const NAV_GROUPS: NavGroup[] = [
  { key: 'master', label: 'Master Data', icon: TeamOutlined, items: MASTER_ITEMS },
  { key: 'behavior', label: 'Poin Santri', icon: FileDoneOutlined, items: BEHAVIOR_ITEMS },
  { key: 'boarding', label: 'Kesantrian', icon: ApartmentOutlined, items: BOARDING_ITEMS },
  { key: 'academic', label: 'Akademik', icon: ReadOutlined, items: ACADEMIC_ITEMS },
  { key: 'finance', label: 'Keuangan', icon: WalletOutlined, items: FINANCE_ITEMS },
  { key: 'report-cards', label: 'Raport', icon: FileTextOutlined, items: REPORT_CARD_ITEMS },
  { key: 'gate', label: 'Gerbang', icon: GatewayOutlined, items: GATE_ITEMS },
  { key: 'settings', label: 'Pengaturan', icon: SettingOutlined, items: SETTINGS_ITEMS },
  { key: 'admin', label: 'Admin', icon: SafetyOutlined, items: ADMIN_ITEMS },
]

const STAFF_ROLES = ['developer', 'admin', 'pengurus', 'guru']

export function filterNavItems(items: NavItem[], role: string | null | undefined): NavItem[] {
  return items.filter((item) => {
    if (item.requireRoles && item.requireRoles.length > 0) {
      if (!role || !item.requireRoles.includes(role)) return false
    }
    if (role && !STAFF_ROLES.includes(role)) return false
    return true
  })
}

export function filterNavGroups(groups: NavGroup[], role: string | null | undefined): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItems(group.items, role),
    }))
    .filter((group) => group.items.length > 0)
}
