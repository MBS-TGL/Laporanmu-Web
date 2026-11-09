import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createAdmission,
  fetchAdmissions,
  nextRegistrationNumber,
  setAdmissionStage,
  softDeleteAdmission,
  updateAdmission,
} from './api'
import type { AdmissionFormValues, AdmissionStage } from './types'

export function useAdmissions() {
  return useQuery({
    queryKey: ['admissions', 'list'],
    queryFn: fetchAdmissions,
  })
}

export function useCreateAdmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, regNumber }: { values: AdmissionFormValues; regNumber: string }) =>
      createAdmission(values, regNumber),
    onSuccess: (admission) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: admission.id,
        newData: { registration_number: admission.registration_number, name: admission.full_name },
      })
      void qc.invalidateQueries({ queryKey: ['admissions'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateAdmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AdmissionFormValues }) =>
      updateAdmission(id, values),
    onSuccess: (admission) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: admission.id,
      })
      void qc.invalidateQueries({ queryKey: ['admissions'] })
    },
  })
}

export function useSetAdmissionStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: AdmissionStage }) =>
      setAdmissionStage(id, stage),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: vars.id,
        newData: { stage: vars.stage },
      })
      void qc.invalidateQueries({ queryKey: ['admissions'] })
    },
  })
}

export function useDeleteAdmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteAdmission(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['admissions'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export { nextRegistrationNumber }
