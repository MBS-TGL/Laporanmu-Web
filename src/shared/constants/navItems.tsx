import type { ComponentProps, ComponentType } from 'react'
import {
  ApartmentOutlined,
  BankOutlined,
  CalendarOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GatewayOutlined,
  HeartOutlined,
  ProfileOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
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
  { to: '/master/teachers', label: 'Data Guru', icon: ReadOutlined, desc: 'Data pengajar, musyrif, dan staf' },
  { to: '/master/classes', label: 'Data Kelas', icon: BankOutlined, desc: 'Struktur kelas dan wali kelas' },
  { to: '/master/academic-years', label: 'Tahun Akademik', icon: CalendarOutlined, desc: 'Periode semester dan kalender akademik' },
]

const BEHAVIOR_ITEMS: NavItem[] = [
  { to: '/poin/rules', label: 'Aturan Poin', icon: FileDoneOutlined, desc: 'Daftar pelanggaran dan prestasi beserta bobot poin' },
  { to: '/poin/reports', label: 'Catatan Poin', icon: ProfileOutlined, desc: 'Riwayat pelanggaran dan prestasi santri' },
]

const BOARDING_ITEMS: NavItem[] = [
  { to: '/absensi', label: 'Absensi Santri', icon: SolutionOutlined, desc: 'Kehadiran harian per kelas per bulan' },
  { to: '/boarding/dorms', label: 'Asrama', icon: ApartmentOutlined, desc: 'Kamar dan plotting santri asrama' },
  { to: '/boarding/kesehatan', label: 'Klinik & Kesehatan', icon: HeartOutlined, desc: 'Rekam medis, observasi, stok obat' },
  { to: '/boarding/bk', label: 'Bimbingan Konseling', icon: ProfileOutlined, desc: 'Sesi BK dan pembinaan santri' },
  { to: '/boarding/izin-pulang', label: 'Izin Pulang', icon: FileTextOutlined, desc: 'Surat izin keluar pondok' },
  { to: '/skorsing', label: 'Skorsing', icon: SafetyCertificateOutlined, desc: 'Skorsing & pembinaan di rumah' },
]

const GATE_ITEMS: NavItem[] = [
  { to: '/gate/logs', label: 'Gate Santri', icon: GatewayOutlined, desc: 'Log keluar-masuk santri di gerbang' },
]

const RAPORT_ITEMS: NavItem[] = [
  { to: '/raport', label: 'Raport', icon: FileTextOutlined, desc: 'Input raport bulanan & semester per kelas' },
  { to: '/raport/arsip', label: 'Arsip Raport', icon: FolderOpenOutlined, desc: 'Riwayat raport per kelas dan periode' },
]

const SETTINGS_ITEMS: NavItem[] = [
  { to: '/pengaturan/pengguna', label: 'Pengguna', icon: UsergroupAddOutlined, desc: 'Kelola nama & role akun staff', requireRoles: ['developer', 'admin'] },
  { to: '/pengaturan/audit-log', label: 'Audit Log', icon: SettingOutlined, desc: 'Jejak perubahan data oleh pengguna', requireRoles: ['developer', 'admin'] },
  { to: '/pengaturan/sekolah', label: 'Profil Sekolah', icon: SettingOutlined, desc: 'Identitas sekolah untuk kop raport' },
]

export const NAV_GROUPS: NavGroup[] = [
  { key: 'master', label: 'Master Data', icon: TeamOutlined, items: MASTER_ITEMS },
  { key: 'behavior', label: 'Poin Santri', icon: FileDoneOutlined, items: BEHAVIOR_ITEMS },
  { key: 'boarding', label: 'Kesantrian', icon: ApartmentOutlined, items: BOARDING_ITEMS },
  { key: 'raport', label: 'Raport', icon: FileTextOutlined, items: RAPORT_ITEMS },
  { key: 'gate', label: 'Gerbang', icon: GatewayOutlined, items: GATE_ITEMS },
  { key: 'settings', label: 'Pengaturan', icon: SettingOutlined, items: SETTINGS_ITEMS },
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
