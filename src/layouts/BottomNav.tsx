import { useMemo } from 'react'
import { Grid, theme } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { DASHBOARD_ITEM, NAV_GROUPS, filterNavItems } from '../shared/constants/navItems'
import { useProfile } from '../shared/hooks/useProfile'
import { useFlagMap } from '../shared/hooks/useFeatureFlags'
import { useRbac } from '../shared/rbac/useRbac'

/** Tujuan utama bottom nav — urutan = urutan tampil. "Lainnya" membuka drawer menu lengkap. */
const DESIRED_TO: string[] = ['/dashboard', '/students', '/attendance', '/gate']

const SHORT_LABEL: Record<string, string> = {
  '/dashboard': 'Beranda',
  '/students': 'Siswa',
  '/attendance': 'Absensi',
  '/gate': 'Gerbang',
}

/**
 * Bottom nav hybrid (mobile <768px): 4 tujuan utama + "Lainnya" yang membuka
 * drawer menu lengkap. Item mengikuti filter role/flag/perm yang sama dengan
 * sidebar (satu sumber: navItems), aktif = longest-prefix seperti Sidebar.
 */
export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const location = useLocation()
  const { token } = theme.useToken()
  const { profile } = useProfile()
  const flagMap = useFlagMap()
  const { can } = useRbac()
  const role = profile?.role ?? null

  const items = useMemo(() => {
    const visible = [
      DASHBOARD_ITEM,
      ...NAV_GROUPS.flatMap((group) => filterNavItems(group.items, role, flagMap, can)),
    ]
    return DESIRED_TO.map((to) => visible.find((item) => item.to === to)).filter(
      (item): item is (typeof visible)[number] => Boolean(item),
    )
  }, [role, flagMap, can])

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(to + '/')

  // Desktop: tidak dirender. (Hook tetap dipanggil di atas — tanpa early return sebelum hook.)
  if (screens.md !== false) return null

  return (
    <nav
      aria-label="Navigasi utama"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: 'flex',
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item.to)
        return (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              color: active ? token.colorPrimary : token.colorTextSecondary,
              fontWeight: active ? 700 : 500,
            }}
          >
            <Icon style={{ fontSize: 18 }} />
            <span style={{ fontSize: 10.5 }}>{SHORT_LABEL[item.to] ?? item.label}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={onOpenMore}
        aria-label="Buka semua menu"
        style={{
          flex: 1,
          height: 56,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          padding: 0,
          color: token.colorTextSecondary,
          fontWeight: 500,
        }}
      >
        <AppstoreOutlined style={{ fontSize: 18 }} />
        <span style={{ fontSize: 10.5 }}>Lainnya</span>
      </button>
    </nav>
  )
}
