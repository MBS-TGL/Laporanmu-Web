import { Spin } from 'antd'
import type { ReactNode } from 'react'
import { useFlag } from '../hooks/useFeatureFlags'
import { useMaintenanceMessage } from '../hooks/useAppSettings'
import { MaintenanceNotice } from './MaintenanceNotice'

// Gate maintenance untuk route publik (/, /check, /verify). Beda dengan
// MaintenanceGate di MainLayout: di sini belum ada sesi/role, jadi halaman
// publik tertutup penuh saat flag aktif (fail-open bila query gagal).
// /login sengaja TIDAK digate: developer butuh bisa masuk saat maintenance
// untuk memperbaiki sistem. /suspension/:token juga tetap terbuka karena
// berisi surat resmi wali santri yang tidak boleh terputus.
export function PublicGate({ children }: { children: ReactNode }) {
  const maintenance = useFlag('system.maintenance', false)
  const { message, until, isLoading } = useMaintenanceMessage()

  if (maintenance) {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      )
    }
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f8fafc' }}>
        <MaintenanceNotice title="Sistem Sedang dalam Pemeliharaan" message={message} until={until} />
      </div>
    )
  }
  return <>{children}</>
}
