import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createHealthLog,
  createMedicine,
  deleteHealthLog,
  deleteMedicine,
  fetchHealthLogs,
  fetchMedicines,
  updateHealthLogStatus,
  updateMedicine,
  type CreateHealthLogInput,
} from './api'
import type { HealthFormValues, HealthMedicineFormValues, HealthStatus } from './types'

export function useMedicines() {
  return useQuery({
    queryKey: ['health', 'medicines'],
    queryFn: fetchMedicines,
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

export type { HealthFormValues }
