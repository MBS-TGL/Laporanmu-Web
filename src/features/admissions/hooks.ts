import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  archiveAdmission,
  convertAdmission,
  fetchAdmissions,
  restoreAdmission,
  updateAdmissionNotes,
  updateAdmissionStage,
} from './api'
import type { AdmissionFilters, AdmissionStage, ConversionInput } from './types'

export function useAdmissions(filters: AdmissionFilters) {
  return useQuery({
    queryKey: ['admissions', filters],
    queryFn: () => fetchAdmissions(filters),
    placeholderData: (prev) => prev,
  })
}

function useAdmissionInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['admissions'] })
    void qc.invalidateQueries({ queryKey: ['students', 'list'] })
    void qc.invalidateQueries({ queryKey: ['student-stats'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'table-stats'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useUpdateAdmissionStage() {
  const invalidate = useAdmissionInvalidate()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: AdmissionStage }) =>
      updateAdmissionStage(id, stage),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: vars.id,
        newData: { stage: vars.stage },
      })
      invalidate()
    },
  })
}

export function useUpdateAdmissionNotes() {
  const invalidate = useAdmissionInvalidate()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      updateAdmissionNotes(id, notes),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: vars.id,
        newData: { notes_updated: true },
      })
      invalidate()
    },
  })
}

export function useArchiveAdmission() {
  const invalidate = useAdmissionInvalidate()
  return useMutation({
    mutationFn: (id: string) => archiveAdmission(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: id,
        newData: { soft_deleted: true },
      })
      invalidate()
    },
  })
}

export function useRestoreAdmission() {
  const invalidate = useAdmissionInvalidate()
  return useMutation({
    mutationFn: (id: string) => restoreAdmission(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'admissions',
        recordId: id,
        newData: { restored: true },
      })
      invalidate()
    },
  })
}

export function useConvertAdmission() {
  const invalidate = useAdmissionInvalidate()
  return useMutation({
    mutationFn: (input: ConversionInput) => convertAdmission(input),
    onSuccess: (studentId, input) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'students',
        recordId: studentId,
        newData: { converted_from_admission: input.admissionId, class_id: input.classId },
      })
      invalidate()
    },
  })
}
