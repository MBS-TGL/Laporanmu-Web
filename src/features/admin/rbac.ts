import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  defaultPermissionsForRole,
  isValidPermission,
} from '../../shared/rbac/permissions'
import { fetchRolePermissionRows, type RolePermissionRow } from '../../shared/rbac/useRbac'
import { logAudit } from '../../shared/utils/auditLogger'

// ------------------------------------------------------------
// RBAC — kelola roles & matrix permission (tab Roles)
// DB menyimpan override; default permission hidup di kode
// (shared/rbac/permissions.ts) agar modul baru tak butuh migrasi.
// ------------------------------------------------------------

export interface RbacRole {
  key: string
  label: string
  color: string
  description: string | null
  sort_order: number
  is_locked: boolean
}

export async function fetchRoles(): Promise<RbacRole[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as RbacRole[]
}

export async function fetchRoleUserCounts(): Promise<Record<string, number>> {
  // count head per role — profiles.role string bebas, kelompokkan di sisi aplikasi
  const { data, error } = await supabase.from('profiles').select('role')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { role: string | null }[]) {
    if (!row.role) continue
    counts[row.role] = (counts[row.role] ?? 0) + 1
  }
  return counts
}

/**
 * Simpan matrix permission satu role: hapus baris lamanya lalu insert
 * set baru (dua operasi, bukan transaksi — kegagalan tengah jalan hanya
 * meninggalkan role tanpa override, yang berarti fallback ke default kode).
 * Role developer selalu dipaksa mendapat SEMUA permission.
 */
export async function saveRolePermissions(roleKey: string, permissions: string[]): Promise<void> {
  const perms = roleKey === 'developer' ? ALL_PERMISSIONS : permissions
  for (const perm of perms) {
    if (!isValidPermission(perm)) throw new Error(`Permission tidak dikenal: ${perm}`)
  }
  const del = await supabase.from('role_permissions').delete().eq('role_key', roleKey)
  if (del.error) throw del.error
  if (perms.length === 0) {
    await logAudit({
      action: 'UPDATE',
      tableName: 'role_permissions',
      recordId: roleKey,
      newData: { permissions: [] },
    })
    return
  }
  const ins = await supabase
    .from('role_permissions')
    .insert(perms.map((permission) => ({ role_key: roleKey, permission })))
  if (ins.error) throw ins.error
  await logAudit({
    action: 'UPDATE',
    tableName: 'role_permissions',
    recordId: roleKey,
    newData: { permissions: perms },
  })
}

/** Kembalikan role ke set default kode (role kustom: kosongkan override). */
export async function resetRoleToDefault(roleKey: string): Promise<void> {
  return saveRolePermissions(roleKey, defaultPermissionsForRole(roleKey))
}

export interface RoleInput {
  key: string
  label: string
  color: string
  description?: string | null
  sort_order?: number
}

export async function createRole(input: RoleInput): Promise<void> {
  const { error } = await supabase.from('roles').insert({
    key: input.key,
    label: input.label,
    color: input.color,
    description: input.description ?? null,
    sort_order: input.sort_order ?? 100,
  })
  if (error) throw error
  await logAudit({ action: 'INSERT', tableName: 'roles', recordId: input.key, newData: { ...input } })
}

export async function updateRole(key: string, updates: Partial<RoleInput>): Promise<void> {
  const { data, error } = await supabase.from('roles').update(updates).eq('key', key).select()
  if (error) throw error
  await logAudit({ action: 'UPDATE', tableName: 'roles', recordId: key, newData: updates, oldData: data?.[0] })
}

/** Hapus role kustom — ditolak bila masih ada user memakainya. */
export async function deleteRole(key: string): Promise<void> {
  const counts = await fetchRoleUserCounts()
  if ((counts[key] ?? 0) > 0) {
    throw new Error(`Role masih dipakai ${counts[key]} pengguna. Pindahkan pengguna dulu sebelum menghapus.`)
  }
  const { error } = await supabase.from('roles').delete().eq('key', key)
  if (error) throw error
  await logAudit({ action: 'DELETE', tableName: 'roles', recordId: key })
}

// ------------------------------------------------------------
// Hooks
// ------------------------------------------------------------
export function useRoles(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: fetchRoles,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: opts?.enabled,
  })
}

export function useRolePermissionMap() {
  return useQuery({
    queryKey: ['rbac', 'role-permissions'],
    queryFn: fetchRolePermissionRows,
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function useRoleUserCounts() {
  return useQuery({
    queryKey: ['rbac', 'role-user-counts'],
    queryFn: fetchRoleUserCounts,
    staleTime: 5 * 60_000,
  })
}

function useInvalidateRbac() {
  const qc = useQueryClient()
  return () => {
    // ['rbac'] mengganti map permission di useRbac → sidebar & guard ikut segar
    void qc.invalidateQueries({ queryKey: ['rbac'] })
  }
}

export function useSaveRolePermissions() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: ({ roleKey, permissions }: { roleKey: string; permissions: string[] }) =>
      saveRolePermissions(roleKey, permissions),
    onSuccess: invalidate,
  })
}

export function useResetRoleToDefault() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: (roleKey: string) => resetRoleToDefault(roleKey),
    onSuccess: invalidate,
  })
}

export function useCreateRole() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: createRole,
    onSuccess: invalidate,
  })
}

export function useUpdateRole() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: ({ key, updates }: { key: string; updates: Partial<RoleInput> }) =>
      updateRole(key, updates),
    onSuccess: invalidate,
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidateRbac()
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: invalidate,
  })
}

// ------------------------------------------------------------
// Helper state matrix — dipakai RolesPage & RolesMatrix
// ------------------------------------------------------------

/** Map role → set permission: baris override DB, bila tidak ada fallback default kode. */
export function permissionMapFromRows(rows: RolePermissionRow[] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const row of rows ?? []) {
    if (!map.has(row.role_key)) map.set(row.role_key, new Set())
    map.get(row.role_key)!.add(row.permission)
  }
  return map
}

/** Permission efektif satu role (override DB ?? default kode). */
export function effectivePermissions(roleKey: string, rows: RolePermissionRow[] | undefined): Set<string> {
  const overrides = rows?.filter((r) => r.role_key === roleKey)
  if (overrides && overrides.length > 0) return new Set(overrides.map((r) => r.permission))
  return new Set(DEFAULT_ROLES[roleKey] ?? [])
}
