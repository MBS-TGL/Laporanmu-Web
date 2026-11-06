import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAcademicYear,
  fetchAcademicYears,
  setActiveAcademicYear,
  softDeleteAcademicYear,
  updateAcademicYear,
} from './api'
import type { AcademicYearFilters, AcademicYearFormValues } from './types'

export function useAcademicYears(filters: AcademicYearFilters) {
  return useQuery({
    queryKey: ['academic-years', filters],
    queryFn: () => fetchAcademicYears(filters),
  })
}

export function useCreateAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: AcademicYearFormValues) => createAcademicYear(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
  })
}

export function useUpdateAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AcademicYearFormValues }) =>
      updateAcademicYear(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
  })
}

export function useDeleteAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteAcademicYear(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
  })
}

export function useSetActiveAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setActiveAcademicYear(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
    },
  })
}
