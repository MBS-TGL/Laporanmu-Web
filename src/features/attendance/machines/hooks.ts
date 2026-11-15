import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../../shared/utils/auditLogger'
import {
  createMachine,
  fetchMachineLogs,
  fetchMachines,
  ingestMachineAttendance,
  manualMatchLog,
  softDeleteMachine,
  syncMachineToAttendance,
  updateMachine,
} from './api'
import type { IngestPayloadItem, MachineFormValues } from './types'

export function useAttendanceMachines() {
  return useQuery({
    queryKey: ['attendance-machines'],
    queryFn: fetchMachines,
  })
}

export function useMachineAttendanceLogs(filters: {
  date?: string
  machineId?: string
  matchedStatus?: string
  limit?: number
}) {
  return useQuery({
    queryKey: ['machine-attendance-logs', filters],
    queryFn: () => fetchMachineLogs(filters),
    refetchInterval: 15_000, // auto-refresh log scan setiap 15 detik
  })
}

export function useCreateMachine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: MachineFormValues) => createMachine(values),
    onSuccess: (data) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'attendance_machines',
        recordId: data.id,
        newData: { name: data.name, serial_no: data.serial_no },
      })
      void qc.invalidateQueries({ queryKey: ['attendance-machines'] })
    },
  })
}

export function useUpdateMachine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<MachineFormValues> }) =>
      updateMachine(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance-machines'] })
    },
  })
}

export function useDeleteMachine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteMachine(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance-machines'] })
    },
  })
}

export function useManualMatchLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ logId, studentId }: { logId: string; studentId: string }) =>
      manualMatchLog(logId, studentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['machine-attendance-logs'] })
    },
  })
}

export function useSyncMachineToAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (date: string) => syncMachineToAttendance(date),
    onSuccess: (_count, date) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'student_attendance',
        recordId: null,
        newData: { sync_machine: true, date },
      })
      void qc.invalidateQueries({ queryKey: ['machine-attendance-logs'] })
      void qc.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export function useIngestMachineAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      serialNo,
      apiKey,
      logs,
    }: {
      serialNo: string
      apiKey: string
      logs: IngestPayloadItem[]
    }) => ingestMachineAttendance(serialNo, apiKey, logs),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['machine-attendance-logs'] })
      void qc.invalidateQueries({ queryKey: ['attendance-machines'] })
      return result
    },
  })
}
