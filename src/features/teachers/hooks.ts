import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createTeacher,
  fetchArchivedTeachers,
  fetchExistingNbms,
  fetchTeachers,
  hardDeleteTeacher,
  hardDeleteTeachersBulk,
  restoreTeacher,
  restoreTeachersBulk,
  setTeacherPinned,
  setTeacherStatusBulk,
  softDeleteTeacher,
  softDeleteTeachersBulk,
  updateTeacher,
} from './api'
import type { Teacher, TeacherFilters, TeacherFormValues, TeacherStatus } from './types'

/** Data guru untuk audit — photo_url dibuang: tidak informatif & tadinya base64 membengkakkan log */
function auditTeacherData(teacher: Teacher) {
  return { ...teacher, photo_url: undefined }
}

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

export function useHardDeleteTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => hardDeleteTeacher(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: id,
        newData: { permanent: true },
      })
    },
  })
}

export function useHardDeleteTeachersBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => hardDeleteTeachersBulk(ids),
    onSuccess: (_void, ids) => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: null,
        newData: { bulk_permanent_deleted: ids.length },
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
        newData: auditTeacherData(created),
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
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: updated.id,
        newData: auditTeacherData(updated),
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
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
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

interface TeacherPageData {
  data: Teacher[]
  total: number
}

export function useSetTeacherPinned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      setTeacherPinned(id, isPinned),
    // Optimistic: pin langsung terasa di daftar, rollback bila server menolak
    onMutate: async ({ id, isPinned }) => {
      await qc.cancelQueries({ queryKey: ['teachers'] })
      const previous = qc.getQueriesData({ queryKey: ['teachers'] })
      for (const [key, value] of previous) {
        const page = value as TeacherPageData | undefined
        if (!page?.data) continue
        qc.setQueryData(key, {
          ...page,
          data: page.data.map((t) => (t.id === id ? { ...t, is_pinned: isPinned } : t)),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      for (const [key, value] of context?.previous ?? []) {
        qc.setQueryData(key, value)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
    },
    onSuccess: (_void, vars) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teachers',
        recordId: vars.id,
        newData: { is_pinned: vars.isPinned },
      })
    },
  })
}
