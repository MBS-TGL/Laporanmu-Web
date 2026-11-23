import { describe, expect, it } from 'vitest'
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  defaultPermissionsForRole,
  isValidPermission,
  permissionSummary,
} from './permissions'

describe('permissions registry', () => {
  it('developer dan admin mendapat semua permission', () => {
    expect(DEFAULT_ROLES.developer).toEqual(ALL_PERMISSIONS)
    expect(DEFAULT_ROLES.admin).toEqual(ALL_PERMISSIONS)
  })

  it('pending tidak mendapat permission apa pun', () => {
    expect(defaultPermissionsForRole('pending')).toEqual([])
  })

  it('role tak dikenal tidak mendapat permission', () => {
    expect(defaultPermissionsForRole('unknown')).toEqual([])
  })

  it('manager tidak mendapat akses admin', () => {
    expect(DEFAULT_ROLES.manager).not.toContain('admin:access')
    expect(DEFAULT_ROLES.manager).toContain('students:read')
    expect(DEFAULT_ROLES.manager).toContain('students:delete')
  })

  it('teacher read-only pada modul non-mengajar dan tanpa admin', () => {
    expect(DEFAULT_ROLES.teacher).toContain('students:read')
    expect(DEFAULT_ROLES.teacher).not.toContain('students:delete')
    expect(DEFAULT_ROLES.teacher).not.toContain('admin:access')
    expect(DEFAULT_ROLES.teacher).toContain('grades:create')
  })

  it('memvalidasi permission yang terdaftar saja', () => {
    expect(isValidPermission('students:read')).toBe(true)
    expect(isValidPermission('students:explode')).toBe(false)
  })

  it('menghitung ringkasan permission', () => {
    const summary = permissionSummary(new Set(['students:read', 'grades:read']))
    expect(summary.checked).toBe(2)
    expect(summary.total).toBe(ALL_PERMISSIONS.length)
  })
})
