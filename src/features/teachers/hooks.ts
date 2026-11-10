import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createTeacher,
  fetchArchivedTeachers,
  fetchExistingNbms,
  fetchTeachers,
  restoreTeacher,
  restoreTeachersBulk,
  setTeacherStatusBulk,
  softDeleteTeacher,
  softDeleteTeachersBulk,
  updateTeacher,
} from './api'
import type { TeacherFilters, TeacherFormValues, TeacherStatus } from './types'

export function useTeachers(filters: TeacherFilters) {
  return useQuery({
    queryKey: ['teachers', filters],
    queryFn: () => fetchTeachers(filters),
  })
}

/** Daftar guru di arsip (soft delete) + aksi pulihkan */
export function useArchivedTeachers(search?: string) {
  return useQuery({
    queryKey: ['teachers', 'archived', search ?? ''],
    queryFn: () => fetchArchivedTeachers(search || undefined),
  })
}

export function useRestoreTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restoreTeacher(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: id,
        newData: { restored: true },
      })
    },
  })
}

export function useBulkRestoreTeachers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => restoreTeachersBulk(ids),
    onSuccess: (_void, ids) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teachers',
        newData: { bulk_restored: ids.length },
      })
    },
  })
}

/** Pra-cek duplikat NBM untuk modal impor — hanya aktif saat diminta */
export function useExistingNbms(enabled: boolean) {
  return useQuery({
    queryKey: ['teachers', 'existing-nbms'],
    queryFn: fetchExistingNbms,
    enabled,
  })
}

export function useTeachersBrief() {
  return useQuery({
    queryKey: ['teachers', 'brief'],
    queryFn: async () => {
      const { data } = await fetchTeachers({ page: 1, pageSize: 500 })
      return data.map((t) => ({ id: t.id, name: t.name }))
    },
  })
}

export function useCreateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: TeacherFormValues) => createTeacher(values),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: created.id,
        newData: created,
      })
    },
  })
}

export function useUpdateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TeacherFormValues }) =>
      updateTeacher(id, values),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: updated.id,
        newData: updated,
      })
    },
  })
}

export function useDeleteTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteTeacher(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: id,
      })
    },
  })
}

export function useBulkDeleteTeachers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => softDeleteTeachersBulk(ids),
    onSuccess: (_void, ids) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: null,
        newData: { bulk_ids: ids },
      })
    },
  })
}

export function useSetTeacherStatusBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: TeacherStatus }) =>
      setTeacherStatusBulk(ids, status),
    onSuccess: (_void, vars) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: null,
        newData: { bulk_ids: vars.ids, status: vars.status },
      })
    },
  })
}
