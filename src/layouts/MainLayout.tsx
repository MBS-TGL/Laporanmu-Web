import { useState } from 'react'
import { Drawer, Grid, Layout } from 'antd'
import { DebugPanel } from '../shared/components/DebugPanel'
import { MaintenanceGate } from '../shared/components/MaintenanceGate'
import { DetailProvider } from '../features/students/DetailProvider'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const { Sider, Content } = Layout

export function MainLayout() {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <DetailProvider>
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          width={250}
          collapsedWidth={56}
          collapsed={collapsed}
          style={{ background: '#fff', borderRight: '1px solid #eef2f7' }}
          trigger={null}
        >
          <div style={{ height: '100vh', position: 'sticky', top: 0 }}>
            <Sidebar collapsed={collapsed} />
          </div>
        </Sider>
      )}

      <Drawer
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={270}
        styles={{ body: { padding: 0, scrollbarWidth: 'none' } }}
      >
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Layout>
        <Topbar
          isMobile={isMobile}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenDrawer={() => setDrawerOpen(true)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />

        <Content style={{ padding: isMobile ? '12px 12px 76px' : 20 }}>
          <div style={{ maxWidth: 1800, margin: '0 auto' }}>
            <MaintenanceGate />
          </div>
        </Content>
      </Layout>
      {isMobile && <BottomNav onOpenMore={() => setDrawerOpen(true)} />}
      <DebugPanel />
    </Layout>
    </DetailProvider>
  )
}
