import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmDeparture,
  confirmReturn,
  createPermit,
  fetchPermitStudents,
  fetchPermits,
  updatePermitStatus,
} from './api'
import type { PermitFormValues, PermitStatus } from './types'

export function usePermits(status?: PermitStatus) {
  return useQuery({
    queryKey: ['leave-permits', status ?? 'all'],
    queryFn: () => fetchPermits(status),
  })
}

export function usePermitStudents(search: string) {
  return useQuery({
    queryKey: ['leave-permits', 'students', search],
    queryFn: () => fetchPermitStudents(search),
    staleTime: 30_000,
  })
}

export function useCreatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, issuedBy }: { values: PermitFormValues; issuedBy: string | null }) =>
      createPermit(values, issuedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
    },
  })
}

export function useUpdatePermitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PermitStatus }) =>
      updatePermitStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
    },
  })
}

export function useConfirmDeparture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ permit, recordedBy }: { permit: import('./types').LeavePermit; recordedBy: string | null }) =>
      confirmDeparture(permit, recordedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
      void qc.invalidateQueries({ queryKey: ['gate-logs'] })
    },
  })
}

export function useConfirmReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (permit: import('./types').LeavePermit) => confirmReturn(permit),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
      void qc.invalidateQueries({ queryKey: ['gate-logs'] })
    },
  })
}
