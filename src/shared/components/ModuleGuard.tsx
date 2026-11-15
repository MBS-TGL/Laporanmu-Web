import { Result } from 'antd'
import type { ReactNode } from 'react'
import { LockOutlined } from '@ant-design/icons'
import { useFlag } from '../hooks/useFeatureFlags'

// Gerbang modul: route modul (mis. /dorms, /library) menampilkan pesan
// "Modul dinonaktifkan" bila flag `module.*`-nya MATI. Fail-open — bila
// flag belum termuat atau belum di-seed, modul tetap terbuka. Menu sidebar
// juga menyembunyikan item yang sama via NavItem.flag (navItems.tsx).
export function ModuleGuard({ flag, children }: { flag: string; children: ReactNode }) {
  const enabled = useFlag(flag, true)

  if (!enabled) {
    return (
      <Result
        icon={<LockOutlined style={{ color: '#64748b' }} />}
        status="info"
        title="Modul Dinonaktifkan"
        subTitle="Modul ini sedang dimatikan oleh developer. Hubungi admin jika Anda membutuhkan akses ke modul ini."
      />
    )
  }
  return <>{children}</>
}
