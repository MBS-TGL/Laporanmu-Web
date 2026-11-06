import { Spin, Result } from 'antd'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { isRoleAllowed, useProfile, useSession } from '../hooks/useProfile'

export function ProtectedRoute() {
  const sessionQuery = useSession()
  const { profile, isLoading } = useProfile()
  const location = useLocation()

  if (sessionQuery.isPending || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!sessionQuery.data?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <Result
        status="warning"
        title="Profil tidak ditemukan"
        subTitle="Akun Anda tidak memiliki profil terdaftar. Hubungi administrator."
      />
    )
  }

  if (!isRoleAllowed(profile.role)) {
    return (
      <Result
        status="403"
        title="Akses Ditolak"
        subTitle={`Akun Anda memiliki role "${profile.role}" dan tidak memiliki akses ke aplikasi ini. Hubungi administrator.`}
      />
    )
  }

  return <Outlet />
}

export function PublicRoute() {
  const sessionQuery = useSession()
  const { isLoading } = useProfile()

  if (sessionQuery.isPending || isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (sessionQuery.data?.user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
