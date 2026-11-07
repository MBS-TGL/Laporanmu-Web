import { useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties } from 'react'
import {
  AutoComplete,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Input,
  Layout,
  Popover,
  Space,
  Typography,
} from 'antd'
import {
  ArrowRightOutlined,
  BellOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  DownOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DASHBOARD_ITEM,
  NAV_GROUPS,
  filterNavGroups,
  type NavItem,
} from '../shared/constants/navItems'
import { useProfile } from '../shared/hooks/useProfile'
import { useLogout } from '../features/auth/hooks'
import { useNotifications, type AppNotification } from '../shared/hooks/useNotifications'
import { ChatAssistant } from './ChatAssistant'

const { Header } = Layout

const ROLE_LABEL: Record<string, string> = {
  developer: 'Developer',
  admin: 'Admin',
  pengurus: 'Pengurus',
  guru: 'Guru',
  pending: 'Pending',
}

const NOTIF_TYPE: Record<
  AppNotification['type'],
  { bg: string; border: string; color: string; Icon: ComponentType }
> = {
  error: { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', Icon: CloseCircleOutlined },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#d97706', Icon: WarningOutlined },
  info: { bg: '#eff6ff', border: '#bfdbfe', color: '#2563eb', Icon: InfoCircleOutlined },
}

interface SearchItem extends NavItem {
  _groupLabel: string
}

interface SearchOption {
  value: string
  label: string
  desc?: string
  group: string
}

// ─── Style const kecil (menggantikan kelas CSS) ──────────────────────────────
const searchResultRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 8px',
}

const searchResultIconStyle: CSSProperties = {
  display: 'flex',
  width: 30,
  height: 30,
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  background: '#f1f5f9',
  color: '#64748b',
  fontSize: 14,
}

const searchResultTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

const searchResultLabelStyle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 700,
  color: '#0f172a',
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const searchResultDescStyle: CSSProperties = {
  fontSize: 11.5,
  color: '#64748b',
  lineHeight: 1.35,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const searchResultGroupStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#64748b',
  background: '#f1f5f9',
  borderRadius: 6,
  padding: '2px 7px',
  flexShrink: 0,
}

const kbdBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  padding: '1px 6px',
  lineHeight: 1.4,
  userSelect: 'none',
}

const dropdownFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 14px',
  borderTop: '1px solid #eef2f7',
  fontSize: 11,
  fontWeight: 600,
  color: '#94a3b8',
}

const notifIconBoxStyle: CSSProperties = {
  display: 'flex',
  width: 26,
  height: 26,
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  background: '#fff',
  fontSize: 13,
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
}

function useProfileMenu(onAction?: () => void) {
  const { profile } = useProfile()
  const logout = useLogout()

  return {
    profile,
    menu: {
      items: [
        { key: 'name', label: profile?.name ?? '-', disabled: true },
        {
          key: 'role',
          label: `Role: ${ROLE_LABEL[profile?.role ?? ''] ?? profile?.role ?? '-'}`,
          disabled: true,
        },
        { type: 'divider' as const },
        { key: 'logout', icon: <LogoutOutlined />, label: 'Keluar', danger: true },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'logout') {
          onAction?.()
          logout.mutate()
        }
      },
    },
  }
}

interface TopbarProps {
  isMobile: boolean
  /** Keadaan sidebar desktop — menentukan ikon toggle (desktop saja) */
  collapsed: boolean
  onToggleCollapse: () => void
  /** Mobile: buka drawer menu */
  onOpenDrawer: () => void
  /** Dipanggil setelah logout — menutup drawer mobile */
  onCloseDrawer: () => void
}

export function Topbar({
  isMobile,
  collapsed,
  onToggleCollapse,
  onOpenDrawer,
  onCloseDrawer,
}: TopbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useProfile()
  const { menu: profileMenu } = useProfileMenu(onCloseDrawer)
  const { notifications, loading, refreshing, dismiss, refresh } = useNotifications()

  const role = profile?.role ?? null

  // ── Pencarian halaman (AutoComplete — keyboard nav & klik-luar bawaan antd) ──
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const searchItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [{ ...DASHBOARD_ITEM, _groupLabel: '' }]
    filterNavGroups(NAV_GROUPS, role).forEach((group) => {
      group.items.forEach((item) => items.push({ ...item, _groupLabel: group.label }))
    })
    return items
  }, [role])

  const searchOptions = useMemo<SearchOption[]>(
    () =>
      searchItems.map((item) => ({
        value: item.to,
        label: item.label,
        desc: item.desc,
        group: item._groupLabel,
      })),
    [searchItems],
  )

  const itemByPath = useMemo(() => new Map(searchItems.map((item) => [item.to, item])), [searchItems])

  const filterSearchOption = (input: string, option?: { value?: string }): boolean => {
    const query = input.trim().toLowerCase()
    if (!query) return false
    const item = option ? itemByPath.get(String(option.value)) : undefined
    if (!item) return false
    return (
      item.label.toLowerCase().includes(query) ||
      (item.desc?.toLowerCase().includes(query) ?? false)
    )
  }

  // Bersihkan pencarian saat pindah halaman
  useEffect(() => {
    setSearchQuery('')
    setSearchFocused(false)
  }, [location.pathname])

  // Shortcut Ctrl+K / Cmd+K untuk fokus ke pencarian
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchFocused(true)
        searchWrapRef.current?.querySelector('input')?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSearchNavigate = (to: string) => {
    setSearchQuery('')
    setSearchFocused(false)
    navigate(to)
  }

  // ── Notifikasi ────────────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false)
  const urgentCount = notifications.filter((n) => n.type === 'error' || n.type === 'warning').length
  const badgeCount = urgentCount || notifications.length

  // ── Asisten AI ────────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false)

  const initials = (profile?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')

  const headerStyle = {
    background: '#fff',
    padding: isMobile ? '0 12px' : '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottom: '1px solid #eef2f7',
    height: 56,
    lineHeight: 'normal',
    position: 'sticky' as const,
    top: 0,
    zIndex: 20,
  }

  const profileTrigger = isMobile ? (
    <Avatar
      shape="square"
      size={34}
      style={{ background: '#4f46e5', color: '#fff', fontWeight: 600, fontSize: 13, borderRadius: 10, cursor: 'pointer' }}
    >
      {profile ? initials : <UserOutlined />}
    </Avatar>
  ) : (
    <Space size={10} style={{ cursor: 'pointer', padding: '4px 8px', borderRadius: 10 }}>
      <Avatar
        shape="square"
        size={34}
        style={{ background: '#4f46e5', color: '#fff', fontWeight: 600, fontSize: 13, borderRadius: 10 }}
      >
        {profile ? initials : <UserOutlined />}
      </Avatar>
      <div style={{ lineHeight: 1.3, textAlign: 'left' }}>
        <Typography.Text strong style={{ fontSize: 13, display: 'block' }}>
          {profile?.name ?? 'Pengguna'}
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {ROLE_LABEL[profile?.role ?? '']?.toLowerCase() ?? profile?.role ?? ''}
        </Typography.Text>
      </div>
      <DownOutlined style={{ fontSize: 10, color: '#94a3b8' }} />
    </Space>
  )

  // Konten panel notifikasi (dirender di dalam Popover)
  const notifContent = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          borderBottom: '1px solid #eef2f7',
          fontSize: 12,
          fontWeight: 600,
          color: '#0f172a',
        }}
      >
        <BellOutlined style={{ color: '#4f46e5', fontSize: 13 }} />
        <span>Notifikasi</span>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={refresh}
          disabled={refreshing}
          aria-label="Muat ulang notifikasi"
          style={{ marginLeft: 'auto', width: 24, height: 24 }}
        />
      </div>

      <div
        style={{
          maxHeight: 340,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowY: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {loading ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
            Memuat notifikasi…
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              padding: '28px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              textAlign: 'center',
              color: '#64748b',
              fontSize: 12,
            }}
          >
            <BellOutlined style={{ fontSize: 30, opacity: 0.15 }} />
            <div style={{ fontWeight: 700, color: '#334155' }}>Tidak ada notifikasi</div>
            <div>Semua aman, tidak ada yang perlu ditindak.</div>
          </div>
        ) : (
          notifications.map((notif) => {
            const type = NOTIF_TYPE[notif.type]
            const Icon = type.Icon
            return (
              <div
                key={notif.id}
                style={{
                  position: 'relative',
                  display: 'flex',
                  gap: 8,
                  padding: 10,
                  border: `1px solid ${type.border}`,
                  borderRadius: 10,
                  background: type.bg,
                }}
              >
                <span style={{ ...notifIconBoxStyle, color: type.color }}>
                  <Icon />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                    {notif.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4, marginTop: 2 }}>
                    {notif.body}
                  </div>
                  {notif.action && (
                    <Button
                      type="link"
                      size="small"
                      icon={<ArrowRightOutlined />}
                      iconPosition="end"
                      onClick={() => {
                        setNotifOpen(false)
                        navigate(notif.action!.route)
                      }}
                      style={{ padding: 0, marginTop: 4, height: 'auto', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: type.color }}
                    >
                      {notif.action.label}
                    </Button>
                  )}
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined style={{ fontSize: 11 }} />}
                  onClick={() => dismiss(notif.id)}
                  aria-label="Tutup notifikasi"
                  style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, minWidth: 20, color: '#94a3b8' }}
                />
              </div>
            )
          })
        )}
      </div>

      <div
        style={{
          padding: '7px 12px',
          background: '#f8fafc',
          borderTop: '1px solid #eef2f7',
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#94a3b8',
        }}
      >
        Diperbarui otomatis tiap 5 menit
      </div>
    </div>
  )

  return (
    <>
      <Header style={headerStyle}>
        {/* ── Kiri: toggle, kembali, pencarian ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          {!(isMobile && searchFocused) &&
            (isMobile ? (
              <Space size="small" align="center">
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={onOpenDrawer}
                  aria-label="Buka menu"
                />
                <img
                  src="/logo-icon.png"
                  alt="Logo Laporanmu"
                  width={22}
                  height={22}
                  style={{ borderRadius: 6 }}
                />
                <Typography.Text strong style={{ fontSize: 15 }}>
                  Laporanmu
                </Typography.Text>
              </Space>
            ) : (
              <>
                <Button
                  type="text"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={onToggleCollapse}
                  title={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                  aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
                  style={{ width: 36, height: 36, color: '#64748b', flexShrink: 0 }}
                />
                <Button
                  type="text"
                  icon={<LeftOutlined />}
                  onClick={() => navigate(-1)}
                  title="Kembali"
                  aria-label="Kembali"
                  style={{ width: 36, height: 36, color: '#64748b', flexShrink: 0 }}
                />
              </>
            ))}

          {isMobile && !searchFocused ? (
            <Button
              type="text"
              icon={<SearchOutlined />}
              onClick={() => setSearchFocused(true)}
              aria-label="Cari halaman"
              style={{ width: 36, height: 36, color: '#64748b', flexShrink: 0 }}
            />
          ) : (
            <div
              ref={searchWrapRef}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchQuery('')
              }}
              style={{ position: 'relative', flex: 1, minWidth: 0, maxWidth: 520 }}
            >
              <AutoComplete
                value={searchQuery}
                onChange={(value) => setSearchQuery(typeof value === 'string' ? value : '')}
                onSelect={(value) => handleSearchNavigate(String(value))}
                options={searchOptions}
                showSearch={{ filterOption: filterSearchOption }}
                open={searchFocused && searchQuery.trim().length > 0}
                onOpenChange={(open) => {
                  if (!open) setSearchFocused(false)
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                popupMatchSelectWidth={520}
                notFoundContent={
                  <div
                    style={{ padding: '22px 16px', textAlign: 'center', fontSize: 12.5, color: '#64748b' }}
                  >
                    Tidak ada halaman yang cocok dengan “{searchQuery.trim()}”
                  </div>
                }
                popupRender={(menu) => (
                  <>
                    {menu}
                    <div style={dropdownFooterStyle}>
                      <span>↑↓ Navigasi</span>
                      <span>↵ Buka</span>
                      <span>Esc Tutup</span>
                    </div>
                  </>
                )}
                optionRender={(option) => {
                  const item = itemByPath.get(String(option.value))
                  if (!item) return null
                  const Icon = item.icon
                  return (
                    <div style={searchResultRowStyle}>
                      <span style={searchResultIconStyle}>
                        <Icon />
                      </span>
                      <span style={searchResultTextStyle}>
                        <span style={searchResultLabelStyle}>{item.label}</span>
                        <span style={searchResultDescStyle}>{item.desc}</span>
                      </span>
                      {item._groupLabel && (
                        <span style={searchResultGroupStyle}>{item._groupLabel}</span>
                      )}
                    </div>
                  )
                }}
                style={{ width: '100%' }}
              >
                <Input
                  placeholder="Cari halaman…"
                  aria-label="Cari halaman"
                  prefix={<SearchOutlined style={{ color: '#64748b', fontSize: 15 }} />}
                  suffix={
                    searchFocused ? (
                      <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined style={{ fontSize: 12 }} />}
                        onClick={() => {
                          setSearchQuery('')
                          setSearchFocused(false)
                        }}
                        aria-label="Tutup pencarian"
                        style={{ width: 22, height: 22, minWidth: 22, color: '#94a3b8' }}
                      />
                    ) : (
                      <span style={kbdBadgeStyle}>{isMac ? '⌘ K' : 'Ctrl K'}</span>
                    )
                  }
                />
              </AutoComplete>
            </div>
          )}
        </div>

        {/* ── Kanan: asisten AI, notifikasi, profil ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Button
            icon={<RobotOutlined style={{ fontSize: 14 }} />}
            onClick={() => setChatOpen(true)}
            aria-label="Asisten AI"
            style={{
              height: 36,
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 600,
              paddingInline: isMobile ? 0 : 12,
              color: '#475569',
              flexShrink: 0,
            }}
          >
            {!isMobile && <span>Asisten AI</span>}
          </Button>

          <Popover
            trigger={['click']}
            placement="bottomRight"
            arrow={false}
            open={notifOpen}
            onOpenChange={setNotifOpen}
            styles={{
              root: { width: 330, maxWidth: 'calc(100vw - 24px)' },
              container: { padding: 0, overflow: 'hidden' },
            }}
            content={notifContent}
          >
            <Badge count={badgeCount} overflowCount={9} color="#ef4444">
              <Button
                type="text"
                icon={
                  <BellOutlined
                    style={{
                      fontSize: 17,
                      animation: urgentCount > 0 ? 'tbBellShake 2s ease-in-out infinite' : undefined,
                    }}
                  />
                }
                aria-label="Notifikasi"
                style={{ width: 36, height: 36, color: '#64748b' }}
              />
            </Badge>
          </Popover>

          {!isMobile && <div style={{ width: 1, height: 24, background: '#e2e8f0', margin: '0 6px' }} />}

          <Dropdown menu={profileMenu} placement="bottomRight" trigger={['click']}>
            {profileTrigger}
          </Dropdown>
        </div>
      </Header>

      <ChatAssistant open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  )
}
