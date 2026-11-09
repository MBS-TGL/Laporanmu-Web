import { Button, Result, Spin } from 'antd'
import { Link, Outlet } from 'react-router-dom'
import { useProfile, type ProfileRole } from '../hooks/useProfile'

interface RoleRouteProps {
  roles: ProfileRole[]
}

// Guard tingkat route (sebelumnya admin hanya dilindungi RLS +
// sembunyi di sidebar). Role yang tidak lolos melihat 403.
export function RoleRoute({ roles }: RoleRouteProps) {
  const { role, isLoading } = useProfile()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!role || !roles.includes(role)) {
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
