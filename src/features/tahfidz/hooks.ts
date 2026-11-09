import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import { useTeachersBrief } from '../teachers/hooks'
import {
  createTahfidz,
  deleteTahfidz,
  fetchTahfidz,
  fetchTahfidzByStudent,
  fetchTahfidzStats,
  updateTahfidz,
} from './api'
import type { TahfidzFilters, TahfidzFormValues } from './types'

export { useTeachersBrief }

export function useTahfidz(filters: TahfidzFilters) {
  return useQuery({
    queryKey: ['tahfidz', filters],
    queryFn: () => fetchTahfidz(filters),
    placeholderData: keepPreviousData,
  })
}

export function useTahfidzStats() {
  return useQuery({
    queryKey: ['tahfidz', 'stats'],
    queryFn: fetchTahfidzStats,
    staleTime: 60_000,
  })
}

export function useTahfidzByStudent(studentId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ['tahfidz', 'student', studentId, limit],
    queryFn: () => fetchTahfidzByStudent(studentId as string, limit),
    enabled: !!studentId,
    staleTime: 30_000,
  })
}

export function useCreateTahfidz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: TahfidzFormValues) => createTahfidz(values),
    onSuccess: (record) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'tahfidz_records',
        recordId: record.id,
        newData: { student_id: record.student_id, surah: record.surah, kind: record.kind },
      })
      void qc.invalidateQueries({ queryKey: ['tahfidz'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTahfidz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TahfidzFormValues }) =>
      updateTahfidz(id, values),
    onSuccess: (record) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'tahfidz_records',
        recordId: record.id,
      })
      void qc.invalidateQueries({ queryKey: ['tahfidz'] })
    },
  })
}

export function useDeleteTahfidz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTahfidz(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'tahfidz_records',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['tahfidz'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
