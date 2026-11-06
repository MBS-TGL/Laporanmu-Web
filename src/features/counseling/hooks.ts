import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCounselingLog,
  deleteCounselingLog,
  fetchCounselingLogs,
  updateCounselingStatus,
  type CounselingFilters,
  type CreateCounselingInput,
} from './api'
import type { CounselingStatus } from './types'

export function useCounselingLogs(filters: CounselingFilters) {
  return useQuery({
    queryKey: ['counseling', filters],
    queryFn: () => fetchCounselingLogs(filters),
  })
}

export function useCreateCounseling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCounselingInput) => createCounselingLog(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counseling'] })
    },
  })
}

export function useUpdateCounselingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CounselingStatus }) =>
      updateCounselingStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counseling'] })
    },
  })
}

export function useDeleteCounseling() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCounselingLog(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['counseling'] })
    },
  })
}
