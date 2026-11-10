import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createAcademicYear,
  fetchAcademicYears,
  setActiveAcademicYear,
  softDeleteAcademicYear,
  updateAcademicYear,
} from './api'
import type { AcademicYearFilters, YearFormValues } from './types'

export function useAcademicYears(filters: AcademicYearFilters) {
  return useQuery({
    queryKey: ['academic-years', filters],
    queryFn: () => fetchAcademicYears(filters),
  })
}

export function useCreateAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: YearFormValues) => createAcademicYear(values),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: created.id,
        newData: created,
      })
    },
  })
}

export function useUpdateAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: YearFormValues }) =>
      updateAcademicYear(id, values),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: updated.id,
        newData: updated,
      })
    },
  })
}

export function useDeleteAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteAcademicYear(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: id,
      })
    },
  })
}

export function useSetActiveAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setActiveAcademicYear(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: id,
        newData: { is_active: true },
      })
    },
  })
}
