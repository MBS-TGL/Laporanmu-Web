import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  activateInstrumentToken,
  createInstrument,
  deleteInstrument,
  fetchInstrumentResponses,
  fetchInstruments,
  revokeInstrumentToken,
  updateInstrumentQuestions,
} from './api'

export function useInstruments() {
  return useQuery({ queryKey: ['instruments'], queryFn: fetchInstruments })
}

export function useCreateInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      values,
      createdBy,
    }: {
      values: { kind: string; title: string; description: string | null; target_class_id: string; questions: unknown[] }
      createdBy: string | null
    }) => createInstrument(values, createdBy),
    onSuccess: (created) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'instruments',
        recordId: created.id,
        newData: { kind: created.kind, title: created.title },
      })
      void qc.invalidateQueries({ queryKey: ['instruments'] })
    },
  })
}

export function useUpdateInstrumentQuestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, questions }: { id: string; questions: unknown[] }) =>
      updateInstrumentQuestions(id, questions),
    onSuccess: (_d, vars) => {
      void logAudit({ action: 'UPDATE', source: 'OPERATIONAL', tableName: 'instruments', recordId: vars.id })
      void qc.invalidateQueries({ queryKey: ['instruments'] })
    },
  })
}

export function useDeleteInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteInstrument,
    onSuccess: (_d, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'instruments', recordId: id })
      void qc.invalidateQueries({ queryKey: ['instruments'] })
    },
  })
}

export function useActivateInstrumentToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateInstrumentToken,
    onSuccess: (_d, input) => {
      void logAudit({
        action: 'EXECUTE',
        source: 'OPERATIONAL',
        tableName: 'instruments',
        recordId: input.instrumentId,
        newData: { action: 'activate_token' },
      })
      void qc.invalidateQueries({ queryKey: ['instruments'] })
    },
  })
}

export function useRevokeInstrumentToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeInstrumentToken,
    onSuccess: (_d, instrumentId) => {
      void logAudit({
        action: 'EXECUTE',
        source: 'OPERATIONAL',
        tableName: 'instruments',
        recordId: instrumentId,
        newData: { action: 'revoke_token' },
      })
      void qc.invalidateQueries({ queryKey: ['instruments'] })
    },
  })
}

export function useInstrumentResponses(instrumentId: string | undefined) {
  return useQuery({
    queryKey: ['instrument-responses', instrumentId],
    queryFn: () => fetchInstrumentResponses(instrumentId as string),
    enabled: !!instrumentId,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })
}
