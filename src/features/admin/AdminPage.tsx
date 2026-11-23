import { useMemo, useState } from 'react'
import { Tabs } from 'antd'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { PageHeader } from '../../shared/components/PageHeader'
import { TabActionsContext } from '../../shared/components/ActionsSlot'
import { useFlag } from '../../shared/hooks/useFeatureFlags'
import { useTableStats } from './hooks'
import { TABLE_CONFIG } from './api'
import { AdminDashboardTab } from './DashboardPage'
import { InsightsPage } from '../insights/InsightsPage'
import { UsersPage } from './UsersPage'
import { RolesPage } from './RolesPage'
import { FlagsPage } from './FlagsPage'
import { TasksPage } from './TasksPage'
import { DatabasePage } from './DatabasePage'
import { TrashPage } from './TrashPage'
import { StoragePage } from './StoragePage'
import { MediaPage } from './MediaPage'
import { AuditPage } from './AuditPage'
import { IntegrationsPage } from './IntegrationsPage'
import { PortalAccessPage } from './PortalAccessPage'
import { useRbac } from '../../shared/rbac/useRbac'

// `perm` menggerbangi tab via RBAC (useRbac.can) — tab tanpa permission
// hilang dari bar tab untuk role yang tidak berhak.
// `flag` (opsional) menggerbangi via feature flag module.*/system.*.
const ADMIN_TAB_ITEMS: Array<{ key: string; label: string; perm: string; flag?: string }> = [
  { key: 'overview', label: 'Ringkasan', perm: 'admin:access' },
  { key: 'insights', label: 'Analisis AI', perm: 'admin:access' },
  { key: 'users', label: 'Pengguna', perm: 'admin:users' },
  { key: 'roles', label: 'Peran & Hak Akses', perm: 'admin:roles' },
  { key: 'settings', label: 'Pengaturan Sistem', perm: 'admin:settings' },
  { key: 'automation', label: 'Otomasi', perm: 'admin:automation' },
  { key: 'integrations', label: 'Integrasi', perm: 'admin:integrations', flag: 'system.api' },
  { key: 'portal', label: 'Akses Portal', perm: 'admin:access' },
  { key: 'database', label: 'Basis Data', perm: 'admin:database' },
  { key: 'trash', label: 'Sampah', perm: 'trash:read' },
  { key: 'storage', label: 'Penyimpanan', perm: 'admin:storage' },
  { key: 'media', label: 'Media', perm: 'media:read' },
  { key: 'audit', label: 'Jejak Audit', perm: 'admin:audit' },
]

// Judul & subtitle per-tab — di-render shell (konvensi halaman bertab:
// judul → tab bar → konten), PageHeader di dalam tab dihapus
const ADMIN_TAB_META: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: 'Administrasi',
    subtitle: 'Pantauan data, aktivitas sistem, dan akses cepat',
  },
  insights: {
    title: 'Analisis AI',
    subtitle: 'Ringkasan, temuan, dan saran dari data sekolah',
  },
  users: {
    title: 'Pengguna',
    subtitle: 'Kelola akun staf, peran, dan pemulihan akses',
  },
  roles: {
    title: 'Peran & Hak Akses',
    subtitle: 'Atur peran dan hak akses per modul',
  },
  settings: {
    title: 'Pengaturan Sistem',
    subtitle: 'Saklar fitur, mode perawatan, dan diagnosis aplikasi',
  },
  automation: {
    title: 'Otomasi',
    subtitle: 'Jalankan tugas pemeliharaan secara manual',
  },
  integrations: {
    title: 'Integrasi',
    subtitle: 'Kunci API dan penerimaan pendaftar otomatis',
  },
  portal: {
    title: 'Akses Portal',
    subtitle: 'Sesi portal, percobaan login, dan langganan notifikasi',
  },
  database: {
    title: 'Basis Data',
    subtitle: 'Volume tabel, integritas, dan pemeliharaan data',
  },
  storage: {
    title: 'Penyimpanan',
    subtitle: 'Berkas terbesar dan pembersihan berkas yatim',
  },
  media: {
    title: 'Media',
    subtitle: 'Unggah dan kelola berkas dengan cek referensi',
  },
  trash: {
    title: 'Sampah',
    subtitle: 'Data terhapus: pulihkan atau hapus permanen',
  },
  audit: {
    title: 'Jejak Audit',
    subtitle: 'Jejak perubahan data oleh pengguna',
  },
}

function tabContent(key: string, onNavigateTab: (tab: string) => void, active: boolean) {
  switch (key) {
    case 'insights':
      return <InsightsPage active={active} />
    case 'users':
      return <UsersPage active={active} />
    case 'roles':
      return <RolesPage />
    case 'settings':
      return <FlagsPage active={active} />
    case 'automation':
      return <TasksPage active={active} />
    case 'integrations':
      return <IntegrationsPage active={active} />
    case 'portal':
      return <PortalAccessPage active={active} />
    case 'database':
      return <DatabasePage active={active} />
    case 'trash':
      return <TrashPage active={active} />
    case 'storage':
      return <StoragePage active={active} />
    case 'media':
      return <MediaPage active={active} />
    case 'audit':
      return <AuditPage />
    default:
      return <AdminDashboardTab onNavigateTab={onNavigateTab} active={active} />
  }
}

/**
 * Halaman Admin & developer tools — satu route bertab (pola ?tab=,
 * lihat SKILLS.md §Skill 2): overview, AI insights, users, settings,
 * automation, database, storage, dan audit log.
 * Role guard developer/admin tetap di route (RoleRoute di router.tsx).
 * Konvensi shell bertab: judul (PageHeader) → tab bar → konten; aksi per-tab
 * portal ke kanan judul via ActionsSlot.
 */
export function AdminPage() {
  const { tab, setTab } = useUrlTab('overview', {
    keys: ADMIN_TAB_ITEMS.map((t) => t.key),
    legacy: {
      ringkasan: 'overview',
      pengguna: 'users',
      pengaturan: 'settings',
      otomatisasi: 'automation',
      sampah: 'trash',
      penyimpanan: 'storage',
    },
  })
  const { can } = useRbac()
  const apiFlag = useFlag('system.api')
  // Tab yang tak berhak dilihat role ini disembunyikan (RBAC, bukan sekadar UI);
  // tab ber-flag hilang pula saat flag dimatikan.
  const visibleTabs = useMemo(
    () => ADMIN_TAB_ITEMS.filter((t) => can(t.perm) && (!t.flag || apiFlag)),
    [can, apiFlag],
  )
  const meta = ADMIN_TAB_META[tab] ?? ADMIN_TAB_META.overview
  // Subtitle dinamis untuk tab database — cache dibagi dengan useTableStats di tab (tanpa fetch ganda)
  const statsQuery = useTableStats()
  const dbRows = (statsQuery.data ?? []).reduce((sum, t) => sum + t.total, 0)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title={meta.title}
            subtitle={
              tab === 'database' && statsQuery.data
                ? `${TABLE_CONFIG.length} tabel terpantau · ${dbRows.toLocaleString('id-ID')} total baris`
                : meta.subtitle
            }
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center', gap: 8 }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
            items={visibleTabs.map((t) => ({
              key: t.key,
              label: t.label,
              children: tabContent(t.key, setTab, tab === t.key),
            }))}
          />
        </ShellItem>
      </ShellStagger>
    </TabActionsContext.Provider>
  )
}
