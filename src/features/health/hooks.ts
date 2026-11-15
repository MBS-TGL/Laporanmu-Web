import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bulkInsertHealthLogs,
  bulkUpsertMedicines,
  createHealthLog,
  createMedicine,
  deleteHealthLog,
  deleteHealthLogsBulk,
  deleteMedicine,
  fetchHealthLogs,
  fetchMedicines,
  fetchStudentRoster,
  updateHealthLogStatus,
  updateMedicine,
  updateMedicineStock,
  type BulkInsertResult,
  type BulkUpsertResult,
  type CreateHealthLogInput,
  type MedicineUpsertPayload,
  type NewHealthLogRow,
} from './api'
import type { HealthFormValues, HealthMedicineFormValues, HealthStatus } from './types'

export function useMedicines() {
  return useQuery({
    queryKey: ['health', 'medicines'],
    queryFn: fetchMedicines,
  })
}

/** Roster santri untuk pencocokan impor — hanya aktif saat diminta (modal terbuka). */
export function useStudentRoster(enabled: boolean) {
  return useQuery({
    queryKey: ['health', 'roster'],
    queryFn: fetchStudentRoster,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useHealthLogs() {
  return useQuery({
    queryKey: ['health', 'logs'],
    queryFn: fetchHealthLogs,
  })
}

export function useCreateMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: HealthMedicineFormValues) => createMedicine(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useUpdateMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: HealthMedicineFormValues }) =>
      updateMedicine(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useDeleteMedicine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteMedicine(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useCreateHealthLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHealthLogInput) => createHealthLog(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useUpdateHealthLogStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: HealthStatus }) =>
      updateHealthLogStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useDeleteHealthLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteHealthLog(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useBulkInsertHealthLogs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rows, onProgress }: { rows: NewHealthLogRow[]; onProgress?: (processed: number, total: number) => void }) =>
      bulkInsertHealthLogs(rows, onProgress),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useDeleteHealthLogsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => deleteHealthLogsBulk(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useAdjustMedicineStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) => updateMedicineStock(id, stock),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export function useBulkUpsertMedicines() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      payloads,
      onProgress,
    }: {
      payloads: MedicineUpsertPayload[]
      onProgress?: (processed: number, total: number) => void
    }) => bulkUpsertMedicines(payloads, onProgress),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['health'] })
    },
  })
}

export type { HealthFormValues, BulkInsertResult, BulkUpsertResult }
