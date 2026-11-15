import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import type { CbtExam, ExamFormValues } from './types'
import {
  activateExamToken,
  createCbtExam,
  createCbtQuestion,
  deleteCbtExam,
  deleteCbtQuestion,
  deleteCbtQuestionsMany,
  fetchCbtAttempts,
  fetchCbtExams,
  fetchCbtQuestions,
  forceSubmitAttempt,
  gradeEssays,
  revokeExamToken,
  updateCbtExam,
  updateCbtQuestion,
} from './api'
import type { QuestionInput } from './api'

// ------------------------------------------------------------
// Bank soal
// ------------------------------------------------------------
export function useCbtQuestions(classSubjectId?: string) {
  return useQuery({
    queryKey: ['cbt-questions', classSubjectId ?? 'all'],
    queryFn: () => fetchCbtQuestions(classSubjectId),
    placeholderData: keepPreviousData,
  })
}

export function useCreateCbtQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCbtQuestion,
    onSuccess: (created) => {
      void logAudit({ action: 'INSERT', source: 'OPERATIONAL', tableName: 'cbt_questions', recordId: created.id, newData: { class_subject_id: created.class_subject_id } })
      void qc.invalidateQueries({ queryKey: ['cbt-questions'] })
    },
  })
}

export function useUpdateCbtQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: QuestionInput }) => updateCbtQuestion(id, input),
    onSuccess: (_data, vars) => {
      void logAudit({ action: 'UPDATE', source: 'OPERATIONAL', tableName: 'cbt_questions', recordId: vars.id })
      void qc.invalidateQueries({ queryKey: ['cbt-questions'] })
    },
  })
}

export function useDeleteCbtQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCbtQuestion,
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'cbt_questions', recordId: id })
      void qc.invalidateQueries({ queryKey: ['cbt-questions'] })
    },
  })
}

export function useBulkDeleteCbtQuestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCbtQuestionsMany,
    onSuccess: (_data, ids) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'cbt_questions', newData: { bulk_archived: ids.length } })
      void qc.invalidateQueries({ queryKey: ['cbt-questions'] })
    },
  })
}

// ------------------------------------------------------------
// Sesi ujian
// ------------------------------------------------------------
export function useCbtExams() {
  return useQuery({ queryKey: ['cbt-exams'], queryFn: fetchCbtExams })
}

export function useCreateCbtExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, createdBy }: { values: ExamFormValues; createdBy: string | null }) =>
      createCbtExam(values, createdBy),
    onSuccess: (created) => {
      void logAudit({ action: 'INSERT', source: 'OPERATIONAL', tableName: 'cbt_exams', recordId: created.id, newData: { title: created.title } })
      void qc.invalidateQueries({ queryKey: ['cbt-exams'] })
    },
  })
}

export function useUpdateCbtExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ExamFormValues }) => updateCbtExam(id, values),
    onSuccess: (_data, vars) => {
      void logAudit({ action: 'UPDATE', source: 'OPERATIONAL', tableName: 'cbt_exams', recordId: vars.id })
      void qc.invalidateQueries({ queryKey: ['cbt-exams'] })
    },
  })
}

export function useDeleteCbtExam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCbtExam,
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'cbt_exams', recordId: id })
      void qc.invalidateQueries({ queryKey: ['cbt-exams'] })
      void qc.invalidateQueries({ queryKey: ['cbt-attempts'] })
    },
  })
}

export function useActivateExamToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: activateExamToken,
    onSuccess: (_data, input) => {
      void logAudit({ action: 'EXECUTE', source: 'OPERATIONAL', tableName: 'cbt_exams', recordId: input.examId, newData: { action: 'activate_token' } })
      void qc.invalidateQueries({ queryKey: ['cbt-exams'] })
    },
  })
}

export function useRevokeExamToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeExamToken,
    onSuccess: (_data, examId) => {
      void logAudit({ action: 'EXECUTE', source: 'OPERATIONAL', tableName: 'cbt_exams', recordId: examId, newData: { action: 'revoke_token' } })
      void qc.invalidateQueries({ queryKey: ['cbt-exams'] })
    },
  })
}

// ------------------------------------------------------------
// Attempt (monitoring, polling 15 detik)
// ------------------------------------------------------------
export function useCbtAttempts(examId: string | undefined) {
  return useQuery({
    queryKey: ['cbt-attempts', examId],
    queryFn: () => fetchCbtAttempts(examId as string),
    enabled: !!examId,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  })
}

export function useForceSubmitAttempt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: forceSubmitAttempt,
    onSuccess: (_data, attemptId) => {
      void logAudit({ action: 'EXECUTE', source: 'OPERATIONAL', tableName: 'cbt_attempts', recordId: attemptId, newData: { action: 'force_submit' } })
      void qc.invalidateQueries({ queryKey: ['cbt-attempts'] })
    },
  })
}

/** Nilai essay attempt (guru/staf) — finalisasi skor saat lengkap. */
export function useGradeEssays() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ attemptId, scores }: { attemptId: string; scores: Record<string, number> }) =>
      gradeEssays(attemptId, scores),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'cbt_attempts',
        recordId: vars.attemptId,
        newData: { action: 'grade_essays', count: Object.keys(vars.scores).length },
      })
      void qc.invalidateQueries({ queryKey: ['cbt-attempts'] })
    },
  })
}

/** Rekap satu ujian untuk drawer & ekspor. */
export function useExamRecap(exam: CbtExam | undefined) {
  const attempts = useCbtAttempts(exam?.id)
  return attempts
}
