import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFollowup,
  createSuspension,
  createTask,
  deleteTask,
  fetchDailyLogs,
  fetchFollowups,
  fetchSubmissions,
  fetchSuspensionById,
  fetchSuspensions,
  fetchTasks,
  fetchTokens,
  generateToken,
  gradeSubmission,
  revokeToken,
  updateSuspensionStatus,
  type CreateSuspensionInput,
  type TaskFormInput,
} from './api'
import type { SuspensionStatus } from './types'

export function useSuspensions() {
  return useQuery({
    queryKey: ['suspensions'],
    queryFn: fetchSuspensions,
  })
}

export function useSuspensionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['suspensions', 'detail', id],
    queryFn: () => fetchSuspensionById(id as string),
    enabled: !!id,
  })
}

export function useSuspensionTokens(id: string | undefined) {
  return useQuery({
    queryKey: ['suspensions', 'tokens', id],
    queryFn: () => fetchTokens(id as string),
    enabled: !!id,
  })
}

export function useSuspensionTasks(id: string | undefined) {
  return useQuery({
    queryKey: ['suspensions', 'tasks', id],
    queryFn: () => fetchTasks(id as string),
    enabled: !!id,
  })
}

export function useSuspensionSubmissions(id: string | undefined) {
  return useQuery({
    queryKey: ['suspensions', 'submissions', id],
    queryFn: () => fetchSubmissions(id as string),
    enabled: !!id,
  })
}

export function useSuspensionDailyLogs(id: string | undefined) {
  return useQuery({
    queryKey: ['suspensions', 'daily-logs', id],
    queryFn: () => fetchDailyLogs(id as string),
    enabled: !!id,
  })
}

export function useSuspensionFollowups(id: string | undefined) {
  return useQuery({
    queryKey: ['suspensions', 'followups', id],
    queryFn: () => fetchFollowups(id as string),
    enabled: !!id,
  })
}

export function useCreateSuspension() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSuspensionInput) => createSuspension(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions'] })
    },
  })
}

export function useUpdateSuspensionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SuspensionStatus }) =>
      updateSuspensionStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions'] })
    },
  })
}

export function useGenerateToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      suspensionId,
      daysValid,
      createdBy,
    }: {
      suspensionId: string
      daysValid: number
      createdBy: string | null
    }) => generateToken(suspensionId, daysValid, createdBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions', 'tokens'] })
    },
  })
}

export function useRevokeToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tokenId, revokedBy }: { tokenId: string; revokedBy: string | null }) =>
      revokeToken(tokenId, revokedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions', 'tokens'] })
    },
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskFormInput) => createTask(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions', 'tasks'] })
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions', 'tasks'] })
    },
  })
}

export function useGradeSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; score: number; comment?: string; gradedBy: string | null }) =>
      gradeSubmission(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions', 'submissions'] })
    },
  })
}

export function useCreateFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      suspensionId: string
      method: 'call' | 'wa' | 'visit'
      notes: string
      createdBy: string | null
    }) => createFollowup(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suspensions', 'followups'] })
    },
  })
}
