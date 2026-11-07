import { useEffect, useMemo, useState } from 'react'
import { Button, Popover, Tooltip } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { DownOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DASHBOARD_ITEM,
  NAV_GROUPS,
  filterNavGroups,
  filterNavItems,
  type NavGroup,
  type NavItem,
} from '../shared/constants/navItems'
import { useProfile } from '../shared/hooks/useProfile'
import { supabase } from '../lib/supabase'

/** Tahun akademik aktif untuk subjudul brand di sidebar (mis. "TA 2026/2027"). */
function useActiveAcademicYear() {
  return useQuery({
    queryKey: ['active-academic-year'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('name')
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      return (data as { name: string } | null)?.name ?? null
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

// ─── Persistensi grup terbuka (mengikuti sidebar legacy) ────────────────────
// v2: default semua grup terbuka — key dinaikkan agar state lama yang
// tersimpan (semua tertutup) tidak menimpa default baru.
const GROUPS_KEY = 'sidebar-groups-open-v2'

const DEFAULT_GROUPS_OPEN: Record<string, boolean> = {
  master: true,
  behavior: true,
  boarding: true,
  raport: true,
  gate: true,
  settings: true,
}

function getInitialGroupsOpen(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(GROUPS_KEY)
    return stored ? { ...DEFAULT_GROUPS_OPEN, ...JSON.parse(stored) } : DEFAULT_GROUPS_OPEN
  } catch {
    return DEFAULT_GROUPS_OPEN
  }
}

// ─── Item navigasi (antd Button — hover/active dari token) ──────────────────
interface NavItemButtonProps {
  item: NavItem
  active: boolean
  /** Rail ciut: tanpa label, ikon rata tengah */
  iconOnly?: boolean
  /** Anak grup: indikator menempel di guide line (left: -4) */
  inGroup?: boolean
  onClick: () => void
}

function NavItemButton({ item, active, iconOnly = false, inGroup = false, onClick }: NavItemButtonProps) {
  const Icon = item.icon
  return (
    <div style={{ position: 'relative' }}>
      {/* Indikator aktif — bar tipis di tepi kiri */}
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: inGroup ? -4 : 0,
            width: 3,
            borderRadius: 999,
            background: '#4f46e5',
          }}
        />
      )}
      <Button
        type="text"
        onClick={onClick}
        aria-label={iconOnly ? item.label : undefined}
        style={{
          width: '100%',
          height: 38,
          paddingInline: iconOnly ? 0 : 12,
          justifyContent: iconOnly ? 'center' : 'flex-start',
          gap: iconOnly ? 0 : 10,
          fontSize: 14,
          fontWeight: active ? 600 : 500,
          color: active ? '#4f46e5' : 'rgba(15, 23, 42, 0.8)',
          background: active ? 'rgba(79, 70, 229, 0.1)' : undefined,
          borderRadius: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            display: 'flex',
            width: 18,
            flexShrink: 0,
            alignItems: 'center',
            justifyContent: 'center',
            color: active ? '#4f46e5' : '#64748b',
          }}
        >
          <Icon style={{ fontSize: 17 }} />
        </span>
        {!iconOnly && (
          <span
            style={{
              overflow: 'hidden',
              lineHeight: '20px',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </span>
        )}
      </Button>
    </div>
  )
}

interface SidebarProps {
  /** Rail ciut: ikon per kategori dengan flyout Popover */
  collapsed?: boolean
  /** Dipanggil setelah item diklik — dipakai drawer mobile untuk menutup diri */
  onNavigate?: () => void
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useProfile()
  const activeYear = useActiveAcademicYear()
  const role = profile?.role ?? null

  const visibleGroups = useMemo(() => filterNavGroups(NAV_GROUPS, role), [role])
  const visibleDashboard = useMemo(
    () => filterNavItems([DASHBOARD_ITEM], role)[0] ?? DASHBOARD_ITEM,
    [role],
  )

  const allItems = useMemo(
    () => [visibleDashboard, ...visibleGroups.flatMap((group) => group.items)],
    [visibleDashboard, visibleGroups],
  )

  // Item paling spesifik yang cocok dengan path saat ini (mis. /raport/arsip > /raport)
  const activeItem = useMemo(() => {
    const matches = allItems.filter(
      (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
    )
    return matches.sort((a, b) => b.to.length - a.to.length)[0] ?? null
  }, [allItems, location.pathname])

  const activeGroupKey = useMemo(
    () =>
      visibleGroups.find((group) => group.items.some((item) => item.to === activeItem?.to))?.key ??
      null,
    [visibleGroups, activeItem],
  )

  const [groupsOpen, setGroupsOpen] = useState(getInitialGroupsOpen)
  // Rail ciut: kategori yang flyout-nya sedang terbuka (hover)
  const [railOpenKey, setRailOpenKey] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(groupsOpen))
    } catch {
      /* ignore */
    }
  }, [groupsOpen])

  const toggleGroup = (key: string) => setGroupsOpen((prev) => ({ ...prev, [key]: !prev[key] }))

  const goTo = (to: string) => {
    navigate(to)
    onNavigate?.()
  }

  const renderNavItem = (item: NavItem, inGroup = false) => {
    const button = (
      <NavItemButton
        item={item}
        active={activeItem?.to === item.to}
        iconOnly={collapsed}
        inGroup={inGroup}
        onClick={() => goTo(item.to)}
      />
    )
    // Rail ciut: label hilang, gantikan dengan tooltip di kanan
    return collapsed ? (
      <Tooltip key={item.to} title={item.label} placement="right" mouseEnterDelay={0.2}>
        {button}
      </Tooltip>
    ) : (
      <div key={item.to}>{button}</div>
    )
  }

  // ─── Brand ────────────────────────────────────────────────────────────────
  const brand = (
    <div
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? 0 : '0 12px',
        borderBottom: '1px solid #eef2f7',
      }}
    >
      <img
        title="Laporanmu"
        src="/logo-icon.png"
        alt="Logo Laporanmu"
        width={36}
        height={36}
        style={{ borderRadius: 9, flexShrink: 0 }}
      />
      {!collapsed && (
        <div style={{ minWidth: 0, lineHeight: 1.3 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Laporanmu
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', color: '#64748b' }}>
            {activeYear.data ? `TA ${activeYear.data}` : 'Admin Panel'}
          </div>
        </div>
      )}
    </div>
  )

  // ─── Navigasi ─────────────────────────────────────────────────────────────
  const nav = (
    <nav
      aria-label="Navigasi utama"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {renderNavItem(visibleDashboard)}

      {!collapsed && (
        <>
          {/* Pemisah antara menu utama dan grup fitur */}
          <div
            aria-hidden="true"
            style={{ height: 1, background: '#e2e8f0', margin: '8px 4px', flexShrink: 0 }}
          />

          {visibleGroups.map((group: NavGroup) => {
            const isOpen = groupsOpen[group.key] ?? true
            // Auto-expand saat halaman di dalam grup ini aktif
            const showChildren = isOpen || activeGroupKey === group.key
            return (
              <div key={group.key} style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                <Button
                  type="text"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={showChildren}
                  style={{
                    width: '100%',
                    height: 36,
                    marginTop: 4,
                    paddingInline: 12,
                    justifyContent: 'space-between',
                    borderRadius: 8,
                    color: '#64748b',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.label}
                  </span>
                  <DownOutlined
                    style={{
                      fontSize: 12,
                      opacity: 0.6,
                      flexShrink: 0,
                      transform: showChildren ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </Button>

                {/* Anak grup: indent + guide line sebagai penanda hierarki */}
                {showChildren && (
                  <div
                    style={{
                      margin: '4px 4px 0 10px',
                      padding: '4px 0 4px 4px',
                      borderLeft: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {group.items.map((item) => renderNavItem(item, true))}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* Rail ciut: satu ikon per kategori; hover memunculkan flyout berisi itemnya */}
      {collapsed &&
        visibleGroups.map((group: NavGroup) => {
          const hasActive = activeGroupKey === group.key
          return (
            <Popover
              key={group.key}
              placement="rightTop"
              trigger="hover"
              mouseEnterDelay={0.15}
              open={railOpenKey === group.key}
              onOpenChange={(open) => setRailOpenKey(open ? group.key : null)}
              styles={{ container: { padding: 6 } }}
              content={
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 200 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: '#64748b',
                      padding: '4px 12px 6px',
                    }}
                  >
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <NavItemButton
                      key={item.to}
                      item={item}
                      active={activeItem?.to === item.to}
                      onClick={() => {
                        goTo(item.to)
                        setRailOpenKey(null)
                      }}
                    />
                  ))}
                </div>
              }
            >
              <NavItemButton
                item={{ to: group.key, label: group.label, icon: group.icon, desc: '' }}
                active={hasActive}
                iconOnly
                onClick={() => undefined}
              />
            </Popover>
          )
        })}
    </nav>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {brand}
      {nav}
    </div>
  )
}
