import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createGateLog, fetchGateLogs } from './api'
import { logAudit } from '../../shared/utils/auditLogger'

import type { GateDirection, GateLogFilters } from './types'

export function useGateLogs(filters: GateLogFilters) {
  return useQuery({
    queryKey: ['gate-logs', filters],
    queryFn: () => fetchGateLogs(filters),
  })
}

export function useCreateGateLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentId, direction, note }: { studentId: string; direction: GateDirection; note?: string }) =>
      createGateLog(studentId, direction, note),
    onSuccess: (log, variables) => {
      void logAudit({ action: 'INSERT', source: 'OPERATIONAL', tableName: 'gate_logs', recordId: log.id, newData: { student_id: variables.studentId, direction: variables.direction } })
      void qc.invalidateQueries({ queryKey: ['gate-logs'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
