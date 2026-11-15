import { ClockCircleOutlined, CodeOutlined, ReadOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { useRoles } from './rbac'

export interface UserRoleMeta {
  value: string
  label: string
  /** Nama warna preset AntD Tag */
  color: string
  icon: ReactNode
}

/** Meta role aplikasi — fallback statis saat tabel roles belum ada/migrasi belum jalan. */
export const ROLE_META: UserRoleMeta[] = [
  { value: 'developer', label: 'Developer', color: 'purple', icon: <CodeOutlined /> },
  { value: 'admin', label: 'Admin', color: 'geekblue', icon: <SafetyCertificateOutlined /> },
  { value: 'manager', label: 'Pengurus', color: 'cyan', icon: <TeamOutlined /> },
  { value: 'teacher', label: 'Guru', color: 'green', icon: <ReadOutlined /> },
  { value: 'pending', label: 'Pending', color: 'default', icon: <ClockCircleOutlined /> },
]

function iconForRole(key: string): ReactNode {
  return ROLE_META.find((r) => r.value === key)?.icon ?? <UserOutlined />
}

/**
 * Daftar role dari tabel roles (migrasi 0039) yang digabung ROLE_META statis:
 * role DB menang (label/warna terbaru), role statis yang belum ada di DB
 * tetap tampil agar pilihan tidak hilang sebelum seed lengkap.
 */
export function useRoleMeta(): UserRoleMeta[] {
  const rolesQuery = useRoles()
  const dbRoles = rolesQuery.data ?? []
  if (dbRoles.length === 0) return ROLE_META
  const dbMetas: UserRoleMeta[] = dbRoles.map((r) => ({
    value: r.key,
    label: r.label,
    color: r.color,
    icon: iconForRole(r.key),
  }))
  const dbKeys = new Set(dbMetas.map((r) => r.value))
  return [...dbMetas, ...ROLE_META.filter((r) => !dbKeys.has(r.value))]
}

export function roleMetaOf(role: string | null | undefined, metas: UserRoleMeta[] = ROLE_META): UserRoleMeta {
  return (
    metas.find((r) => r.value === role) ?? {
      value: role ?? '',
      label: role ?? '—',
      color: 'default',
      icon: <UserOutlined />,
    }
  )
}
