import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../../shared/utils/auditLogger'
import { createOfficialLetter, fetchOfficialLetters, softDeleteOfficialLetter } from './api'
import type { OfficialLetterPayload } from './types'
import { maybeSendLetterWa } from '../waAuto'

export function useOfficialLetters() {
  return useQuery({
    queryKey: ['official-letters'],
    queryFn: fetchOfficialLetters,
  })
}

export function useCreateOfficialLetter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: OfficialLetterPayload) => createOfficialLetter(payload),
    onSuccess: (data) => {
      void maybeSendLetterWa(data)
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'official_letters',
        recordId: data.id,
        newData: { letter_no: data.letter_no, type: data.type },
      })
      void qc.invalidateQueries({ queryKey: ['official-letters'] })
    },
  })
}

export function useDeleteOfficialLetter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteOfficialLetter(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['official-letters'] })
    },
  })
}
