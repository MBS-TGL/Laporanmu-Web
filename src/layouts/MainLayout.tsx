import { useState } from 'react'
import { Drawer, Grid, Layout } from 'antd'
import { DebugPanel } from '../shared/components/DebugPanel'
import { MaintenanceGate } from '../shared/components/MaintenanceGate'
import { DetailProvider } from '../features/students/DetailProvider'
import { useDocumentTitle } from '../shared/hooks/useDocumentTitle'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const { Sider, Content } = Layout

export function MainLayout() {
  useDocumentTitle()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <DetailProvider>
    <Layout style={{ minHeight: '100dvh' }}>
      {!isMobile && (
        <Sider
          width={250}
          collapsedWidth={56}
          collapsed={collapsed}
          style={{ background: '#fff', borderRight: '1px solid #eef2f7' }}
          trigger={null}
        >
          <div style={{ height: '100dvh', position: 'sticky', top: 0 }}>
            <Sidebar collapsed={collapsed} />
          </div>
        </Sider>
      )}

      <Drawer
        placement="left"
        open={isMobile && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="min(270px, 86vw)"
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

        <Content
          style={{
            padding: isMobile
              ? '12px 12px calc(56px + env(safe-area-inset-bottom) + 16px)'
              : 20,
          }}
        >
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
