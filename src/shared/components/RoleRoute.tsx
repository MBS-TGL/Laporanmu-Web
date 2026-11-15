import { Button, Result, Spin } from 'antd'
import { Link, Outlet } from 'react-router-dom'
import { useProfile, type ProfileRole } from '../hooks/useProfile'
import { useRbac } from '../rbac/useRbac'

interface RoleRouteProps {
  /**
   * Guard berbasis permission (`<module>:<action>`) — cara baru.
   * `roles` masih didukung untuk guard berbasis nama role lama.
   */
  perm?: string
  roles?: ProfileRole[]
}

// Guard tingkat route (sebelumnya admin hanya dilindungi RLS +
// sembunyi di sidebar). Role/permission yang tidak lolos melihat 403.
export function RoleRoute({ perm, roles }: RoleRouteProps) {
  const { role, isLoading } = useProfile()
  const { can, isLoading: rbacLoading } = useRbac()

  if (isLoading || (perm && rbacLoading)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  const allowed = perm ? can(perm) : !!role && !!roles?.includes(role as ProfileRole)

  if (!allowed) {
    return (
      <Result
        status="403"
        title="Akses Ditolak"
        subTitle="Maaf, Anda tidak memiliki izin untuk mengakses halaman ini."
        extra={
          <Link to="/dashboard">
            <Button type="primary">Kembali ke Dashboard</Button>
          </Link>
        }
      />
    )
  }

  return <Outlet />
}
