import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  addEkskulMembers,
  createEkskul,
  fetchEkskul,
  fetchEkskulMembers,
  removeEkskulMember,
  setMemberRole,
  softDeleteEkskul,
  updateEkskul,
} from './api'
import type { EkskulFormValues } from './types'

export function useEkskul() {
  return useQuery({
    queryKey: ['ekskul', 'list'],
    queryFn: fetchEkskul,
  })
}

export function useEkskulMembers(ekskulId: string | undefined) {
  return useQuery({
    queryKey: ['ekskul-members', ekskulId],
    queryFn: () => fetchEkskulMembers(ekskulId as string),
    enabled: !!ekskulId,
  })
}

export function useCreateEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: EkskulFormValues) => createEkskul(values),
    onSuccess: (ekskul) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: ekskul.id,
        newData: { name: ekskul.name },
      })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: EkskulFormValues }) => updateEkskul(id, values),
    onSuccess: (ekskul) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: ekskul.id,
      })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useDeleteEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteEkskul(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAddEkskulMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ekskulId, studentIds }: { ekskulId: string; studentIds: string[] }) =>
      addEkskulMembers(ekskulId, studentIds),
    onSuccess: (_count, vars) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        newData: { ekskul_id: vars.ekskulId, count: vars.studentIds.length },
      })
      void qc.invalidateQueries({ queryKey: ['ekskul-members', vars.ekskulId] })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useRemoveEkskulMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeEkskulMember(memberId),
    onSuccess: (_data, memberId) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        recordId: memberId,
      })
      void qc.invalidateQueries({ queryKey: ['ekskul-members'] })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useSetMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      setMemberRole(memberId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ekskul-members'] })
    },
  })
}

export { useTeachersBrief } from '../teachers/hooks';
