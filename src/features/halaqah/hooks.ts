import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  addHalaqahMembers,
  createHalaqah,
  fetchHalaqah,
  fetchHalaqahMembers,
  removeHalaqahMember,
  softDeleteHalaqah,
  updateHalaqah,
} from './api'
import type { HalaqahFormValues } from './types'

export function useHalaqah() {
  return useQuery({
    queryKey: ['halaqah', 'list'],
    queryFn: fetchHalaqah,
  })
}

export function useHalaqahMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['halaqah-members', groupId],
    queryFn: () => fetchHalaqahMembers(groupId as string),
    enabled: !!groupId,
  })
}

export function useCreateHalaqah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: HalaqahFormValues) => createHalaqah(values),
    onSuccess: (group) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'halaqah_groups',
        recordId: group.id,
        newData: { name: group.name },
      })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateHalaqah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: HalaqahFormValues }) =>
      updateHalaqah(id, values),
    onSuccess: (group) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_groups',
        recordId: group.id,
      })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
    },
  })
}

export function useDeleteHalaqah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteHalaqah(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_groups',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAddHalaqahMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, studentIds }: { groupId: string; studentIds: string[] }) =>
      addHalaqahMembers(groupId, studentIds),
    onSuccess: (_count, vars) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'halaqah_members',
        newData: { group_id: vars.groupId, count: vars.studentIds.length },
      })
      void qc.invalidateQueries({ queryKey: ['halaqah-members', vars.groupId] })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
    },
  })
}

export function useRemoveHalaqahMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeHalaqahMember(memberId),
    onSuccess: (_data, memberId) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_members',
        recordId: memberId,
      })
      // group_id tidak diketahui di sini — invalidate semua daftar anggota
      void qc.invalidateQueries({ queryKey: ['halaqah-members'] })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
    },
  })
}

export { useTeachersBrief } from '../teachers/hooks';
