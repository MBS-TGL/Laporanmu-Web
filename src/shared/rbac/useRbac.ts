import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useProfile } from '../hooks/useProfile'
import { defaultPermissionsForRole } from './permissions'

export interface RolePermissionRow {
  role_key: string
  permission: string
}

/**
 * Baca seluruh baris role_permissions — OVERRIDE per role.
 * Tabel belum ada (migrasi 0039 belum dijalankan) → return kosong,
 * pemakai fallback ke default kode (fail-open, perilaku tak berubah).
 */
export async function fetchRolePermissionRows(): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase.from('role_permissions').select('role_key, permission')
  if (error) return []
  return (data ?? []) as RolePermissionRow[]
}

export interface RbacState {
  /** Role pengguna saat ini (string mentah profiles.role). */
  role: string | null
  /** Permission efektif role saat ini (override DB ?? default kode). */
  permissions: string[]
  /** Cek permission `<module>:<action>` — satu-satunya gerbang akses UI. */
  can: (perm: string) => boolean
  isLoading: boolean
}

/**
 * Sumber tunggal cek permission di aplikasi (ganti cek role string).
 * Override per role dibaca dari tabel role_permissions; bila role
 * belum punya baris override, ia memakai DEFAULT_ROLES dari kode.
 */
export function useRbac(): RbacState {
  const { role, isLoading: profileLoading } = useProfile()

  const overridesQuery = useQuery({
    queryKey: ['rbac', 'role-permissions'],
    queryFn: fetchRolePermissionRows,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const permissions = useMemo(() => {
    if (!role) return []
    const rows = overridesQuery.data ?? []
    const hasOverride = rows.some((r) => r.role_key === role)
    if (hasOverride) return rows.filter((r) => r.role_key === role).map((r) => r.permission)
    return defaultPermissionsForRole(role)
  }, [role, overridesQuery.data])

  const permissionSet = useMemo(() => new Set(permissions), [permissions])

  const isLoading = profileLoading || overridesQuery.isPending

  const can = useCallback(
    (perm: string) => {
      // Fail-open selama profil/override belum termuat — sidebar & route
      // menampilkan spinner/di-filter setelah data siap, tanpa kedipan menu.
      if (isLoading) return true
      return permissionSet.has(perm)
    },
    [isLoading, permissionSet],
  )

  return {
    role,
    permissions,
    can,
    isLoading,
  }
}
