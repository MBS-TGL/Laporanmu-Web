import { useMemo, useState } from 'react'
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Tag, Typography } from 'antd'
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  DASHBOARD_ITEM,
  NAV_GROUPS,
  filterNavGroups,
  filterNavItems,
  type NavGroup,
  type NavItem,
} from '../shared/constants/navItems'
import { useProfile } from '../shared/hooks/useProfile'
import { useLogout } from '../features/auth/hooks'

const { Sider, Header, Content } = Layout

const ROLE_LABEL: Record<string, string> = {
  developer: 'Developer',
  admin: 'Admin',
  pengurus: 'Pengurus',
  guru: 'Guru',
  pending: 'Pending',
}

function buildMenuItems(groups: NavGroup[], dashboard: NavItem) {
  const dashboardItem = {
    key: dashboard.to,
    icon: <dashboard.icon />,
    label: <Link to={dashboard.to}>{dashboard.label}</Link>,
  }

  const groupItems = groups.map((group) => ({
    key: group.key,
    icon: <group.icon />,
    label: group.label,
    children: group.items.map((item) => ({
      key: item.to,
      icon: <item.icon />,
      label: <Link to={item.to}>{item.label}</Link>,
    })),
  }))

  return [dashboardItem, ...groupItems]
}

function BrandLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        padding: collapsed ? 0 : '0 20px',
        borderBottom: '1px solid #f1f5f9',
        flexShrink: 0,
      }}
    >
      <img src="/favicon.svg" alt="Logo Laporanmu" width={28} height={28} />
      {!collapsed && (
        <>
          <Typography.Text strong style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
            Laporanmu
          </Typography.Text>
          <Tag
            color="#eef2ff"
            style={{
              marginInlineStart: 'auto',
              color: '#4f46e5',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 6,
              lineHeight: '18px',
              paddingInline: 7,
            }}
          >
            V2
          </Tag>
        </>
      )}
    </div>
  )
}

export function MainLayout() {
  const location = useLocation()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const { profile } = useProfile()
  const logout = useLogout()

  const role = profile?.role ?? null
  const visibleGroups = useMemo(() => filterNavGroups(NAV_GROUPS, role), [role])
  const visibleDashboard = useMemo(
    () => filterNavItems([DASHBOARD_ITEM], role)[0] ?? DASHBOARD_ITEM,
    [role],
  )
  const menuItems = useMemo(
    () => buildMenuItems(visibleGroups, visibleDashboard),
    [visibleGroups, visibleDashboard],
  )

  const selectedKeys = useMemo(() => [location.pathname], [location.pathname])

  const handleLogout = () => {
    setDrawerOpen(false)
    logout.mutate()
  }

  const profileMenu = {
    items: [
      { key: 'name', label: profile?.name ?? '-', disabled: true },
      { key: 'role', label: `Role: ${ROLE_LABEL[profile?.role ?? ''] ?? profile?.role ?? '-'}`, disabled: true },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Keluar', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') handleLogout()
    },
  }

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={selectedKeys}
      items={menuItems}
      onClick={() => setDrawerOpen(false)}
      style={{ borderInlineEnd: 'none', background: 'transparent', paddingTop: 4 }}
    />
  )

  const initials = (profile?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          width={250}
          collapsedWidth={72}
          collapsed={collapsed}
          style={{ background: '#fff', borderRight: '1px solid #eef2f7' }}
          trigger={null}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
            <BrandLogo collapsed={collapsed} />
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 12 }}>{menu}</div>
          </div>
        </Sider>
      )}

      <Drawer
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={270}
        styles={{ body: { padding: 0 } }}
      >
        <BrandLogo />
        <div style={{ padding: '4px 0' }}>{menu}</div>
      </Drawer>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: isMobile ? '0 12px' : '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #eef2f7',
            height: 56,
            lineHeight: 'normal',
            position: 'sticky',
            top: 0,
            zIndex: 20,
          }}
        >
          <Space size="small" align="center">
            {isMobile ? (
              <>
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Buka menu"
                />
                <Typography.Text strong style={{ fontSize: 15 }}>
                  Laporanmu
                </Typography.Text>
              </>
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? 'Lebarkan menu' : 'Ciutkan menu'}
              />
            )}
          </Space>

          <Space size="middle">
            <Dropdown menu={profileMenu} placement="bottomRight" trigger={['click']}>
              <Space
                size={10}
                style={{ cursor: 'pointer', padding: '4px 6px', borderRadius: 10 }}
              >
                <Avatar
                  size={34}
                  style={{ background: '#e0e7ff', color: '#3730a3', fontWeight: 600, fontSize: 13 }}
                >
                  {profile ? initials : <UserOutlined />}
                </Avatar>
                {!isMobile && (
                  <div style={{ lineHeight: 1.25, textAlign: 'left' }}>
                    <Typography.Text strong style={{ fontSize: 13, display: 'block' }}>
                      {profile?.name ?? '...'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {ROLE_LABEL[profile?.role ?? ''] ?? profile?.role ?? ''}
                    </Typography.Text>
                  </div>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ padding: isMobile ? 12 : 20 }}>
          <div style={{ maxWidth: 1800, margin: '0 auto' }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
