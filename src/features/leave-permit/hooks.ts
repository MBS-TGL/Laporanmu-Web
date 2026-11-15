import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  confirmDeparture,
  confirmReturn,
  createPermit,
  createPermitsBulk,
  deletePermit,
  fetchActivePermitKeys,
  fetchAllPermitStudents,
  fetchPermits,
  updatePermit,
  updatePermitStatus,
} from './api'
import { logAudit } from '../../shared/utils/auditLogger'
import type { LeavePermit, PermitBulkRow, PermitFormValues, PermitStatus } from './types'

export function usePermits(status?: PermitStatus) {
  return useQuery({
    queryKey: ['leave-permits', status ?? 'all'],
    queryFn: () => fetchPermits(status),
    // Halaman ini dipakai di gerbang — data status izin di-refresh ringan
    refetchInterval: 60_000,
  })
}

/** Seluruh santri aktif untuk lookup impor/pulang massal — hanya saat dibutuhkan */
export function useAllPermitStudents(enabled = true) {
  return useQuery({
    queryKey: ['leave-permits', 'all-students'],
    queryFn: fetchAllPermitStudents,
    enabled,
    staleTime: 60_000,
  })
}

/** Kunci izin aktif untuk deteksi duplikat impor — hanya saat modal impor terbuka */
export function useActivePermitKeys(enabled = true) {
  return useQuery({
    queryKey: ['leave-permits', 'active-keys'],
    queryFn: fetchActivePermitKeys,
    enabled,
    staleTime: 60_000,
  })
}

function invalidatePermitData(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['leave-permits'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
}

export function useCreatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, issuedBy }: { values: PermitFormValues; issuedBy: string | null }) =>
      createPermit(values, issuedBy),
    onSuccess: (permit, vars) => {
      invalidatePermitData(qc)
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'leave_permits',
        recordId: permit.id,
        newData: { student: permit.student?.name, destination: vars.values.destination },
      })
    },
  })
}

export function useUpdatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: PermitFormValues }) => updatePermit(id, values),
    onSuccess: (_data, vars) => {
      invalidatePermitData(qc)
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'leave_permits',
        recordId: vars.id,
        newData: { destination: vars.values.destination, purpose: vars.values.purpose },
      })
    },
  })
}

export function useCreatePermitsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rows, issuedBy }: { rows: PermitBulkRow[]; issuedBy: string | null }) =>
      createPermitsBulk(rows, issuedBy),
    onSuccess: (created) => {
      invalidatePermitData(qc)
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'leave_permits',
        newData: { count: created.length, mode: 'bulk' },
      })
    },
  })
}

export function useDeletePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePermit(id),
    onSuccess: (_data, id) => {
      invalidatePermitData(qc)
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'leave_permits',
        recordId: id,
      })
    },
  })
}

export function useUpdatePermitStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PermitStatus }) => updatePermitStatus(id, status),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'leave_permits',
        recordId: vars.id,
        newData: { status: vars.status },
      })
    },
  })
}

export function useConfirmDeparture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ permit, recordedBy }: { permit: LeavePermit; recordedBy: string | null }) =>
      confirmDeparture(permit, recordedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
      void qc.invalidateQueries({ queryKey: ['gate-logs'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useConfirmReturn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (permit: LeavePermit) => confirmReturn(permit),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-permits'] })
      void qc.invalidateQueries({ queryKey: ['gate-logs'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
