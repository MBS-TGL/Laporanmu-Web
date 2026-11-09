import { Result, Spin } from 'antd'
import { Outlet } from 'react-router-dom'
import { ToolOutlined } from '@ant-design/icons'
import { useFlag } from '../hooks/useFeatureFlags'
import { useProfile } from '../hooks/useProfile'

// Pintu maintenance: saat flag system.maintenance aktif, semua role
// kecuali developer dilayar penuh pesan pemeliharaan. Fail-open —
// kalau query flag gagal, aplikasi tetap terbuka.
export function MaintenanceGate() {
  const maintenance = useFlag('system.maintenance', false)
  const { role, isLoading } = useProfile()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (maintenance && role !== 'developer') {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', padding: 24 }}>
        <Result
          icon={<ToolOutlined style={{ color: '#f59e0b' }} />}
          status="warning"
          title="Sistem Sedang dalam Pemeliharaan"
          subTitle="Aplikasi sementara ditutup untuk perawatan. Silakan coba beberapa saat lagi."
        />
      </div>
    )
  }

  return <Outlet />
}
