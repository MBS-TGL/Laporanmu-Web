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
import { useRbac } from '../../shared/rbac/useRbac'

// `perm` menggerbangi tab via RBAC (useRbac.can) — tab tanpa permission
// hilang dari bar tab untuk role yang tidak berhak.
// `flag` (opsional) menggerbangi via feature flag module.*/system.*.
const ADMIN_TAB_ITEMS: Array<{ key: string; label: string; perm: string; flag?: string }> = [
  { key: 'ringkasan', label: 'Ringkasan', perm: 'admin:access' },
  { key: 'insights', label: 'AI Insights', perm: 'admin:access' },
  { key: 'pengguna', label: 'Pengguna', perm: 'admin:users' },
  { key: 'roles', label: 'Roles', perm: 'admin:roles' },
  { key: 'pengaturan', label: 'Pengaturan', perm: 'admin:settings' },
  { key: 'otomatisasi', label: 'Otomatisasi', perm: 'admin:automation' },
  { key: 'integrations', label: 'Integrasi', perm: 'admin:integrations', flag: 'system.api' },
  { key: 'database', label: 'Database', perm: 'admin:database' },
  { key: 'sampah', label: 'Sampah', perm: 'trash:read' },
  { key: 'penyimpanan', label: 'Penyimpanan', perm: 'admin:storage' },
  { key: 'media', label: 'Media', perm: 'media:read' },
  { key: 'audit', label: 'Audit Log', perm: 'admin:audit' },
]

// Judul & subtitle per-tab — di-render shell (konvensi halaman bertab:
// judul → tab bar → konten), PageHeader di dalam tab dihapus
const ADMIN_TAB_META: Record<string, { title: string; subtitle: string }> = {
  ringkasan: {
    title: 'Dashboard Admin',
    subtitle: 'Pusat pantauan teknis: volume data, aktivitas sistem, dan akses cepat alat developer',
  },
  insights: {
    title: 'AI Insights',
    subtitle: 'Analisis cerdas data pondok — ringkasan, temuan, dan saran tindak lanjut',
  },
  pengguna: {
    title: 'Manajemen Pengguna',
    subtitle: 'Kelola akun staff: role, keterhubungan data guru, dan pemulihan akses',
  },
  roles: {
    title: 'Roles & Permission',
    subtitle: 'Kelola daftar role dan matrix permission per modul aplikasi',
  },
  pengaturan: {
    title: 'Pengaturan Developer',
    subtitle: 'Feature flags, mode maintenance, dan alat diagnosis aplikasi',
  },
  otomatisasi: {
    title: 'Otomasi',
    subtitle: 'Picu tugas pemeliharaan berat secara manual — tanpa menunggu jadwal',
  },
  integrations: {
    title: 'Integrasi',
    subtitle: 'API key dan webhook PPDB — pendaftar dari formulir publik masuk otomatis',
  },
  database: {
    title: 'Kesehatan Database',
    subtitle: 'Hitungan tabel, cek integritas, dan pemeliharaan data',
  },
  penyimpanan: {
    title: 'Manajemen Penyimpanan',
    subtitle: 'Bucket storage, file terbesar, dan pembersihan file yatim (orphan)',
  },
  media: {
    title: 'Media Library',
    subtitle: 'Browse, unggah, dan kelola file storage dengan cek referensi sebelum hapus',
  },
  sampah: {
    title: 'Sampah',
    subtitle: 'Agregasi data ter-soft-delete dari seluruh modul: pulihkan atau hapus permanen',
  },
  audit: {
    title: 'Audit Log',
    subtitle: 'Jejak seluruh perubahan data oleh pengguna',
  },
}

function tabContent(key: string, onNavigateTab: (tab: string) => void, active: boolean) {
  switch (key) {
    case 'insights':
      return <InsightsPage active={active} />
    case 'pengguna':
      return <UsersPage active={active} />
    case 'roles':
      return <RolesPage />
    case 'pengaturan':
      return <FlagsPage active={active} />
    case 'otomatisasi':
      return <TasksPage active={active} />
    case 'integrations':
      return <IntegrationsPage active={active} />
    case 'database':
      return <DatabasePage active={active} />
    case 'sampah':
      return <TrashPage active={active} />
    case 'penyimpanan':
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
 * lihat SKILLS.md §Skill 2): ringkasan, AI insights, pengguna, pengaturan,
 * otomatisasi, database, penyimpanan, dan audit log.
 * Role guard developer/admin tetap di route (RoleRoute di router.tsx).
 * Konvensi shell bertab: judul (PageHeader) → tab bar → konten; aksi per-tab
 * portal ke kanan judul via ActionsSlot.
 */
export function AdminPage() {
  const { tab, setTab } = useUrlTab('ringkasan', { keys: ADMIN_TAB_ITEMS.map((t) => t.key) })
  const { can } = useRbac()
  const apiFlag = useFlag('system.api')
  // Tab yang tak berhak dilihat role ini disembunyikan (RBAC, bukan sekadar UI);
  // tab ber-flag hilang pula saat flag dimatikan.
  const visibleTabs = useMemo(
    () => ADMIN_TAB_ITEMS.filter((t) => can(t.perm) && (!t.flag || apiFlag)),
    [can, apiFlag],
  )
  const meta = ADMIN_TAB_META[tab] ?? ADMIN_TAB_META.ringkasan
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
