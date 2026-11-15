import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createAssessment,
  fetchAssessmentScores,
  fetchAssessments,
  fetchClassStudents,
  fetchClassSubjectById,
  fetchClassSubjectsBrief,
  fetchGradeConfig,
  fetchSemesterScoresForClass,
  generateSemesterGrade,
  softDeleteAssessment,
  updateAssessment,
  upsertAssessmentScores,
  upsertGradeConfig,
  type AssessmentFormValues,
} from './api'
import type { GradeUpsert, GradeWeight } from './types'

export function useClassSubject(id: string | undefined) {
  return useQuery({
    queryKey: ['grades', 'class-subject', id],
    queryFn: () => fetchClassSubjectById(id as string),
    enabled: !!id,
  })
}

export function useSemesterScoresForClass(
  classId: string | undefined,
  academicYearId: string | undefined,
  semester: 1 | 2,
) {
  return useQuery({
    queryKey: ['grades', 'semester-scores', classId, academicYearId, semester],
    queryFn: () => fetchSemesterScoresForClass(classId as string, academicYearId as string, semester),
    enabled: !!classId && !!academicYearId,
  })
}


export function useGradeConfig(academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['grade-config', academicYearId],
    queryFn: () => fetchGradeConfig(academicYearId as string),
    enabled: !!academicYearId,
  })
}

export function useSaveGradeConfig(academicYearId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bobot: GradeWeight) => {
      if (!academicYearId) throw new Error('Pilih tahun ajaran dulu')
      return upsertGradeConfig(academicYearId, bobot)
    },
    onSuccess: () => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'grade_configs',
        recordId: academicYearId ?? null,
        newData: { bobot: 'updated' },
      })
      void qc.invalidateQueries({ queryKey: ['grade-config'] })
    },
  })
}

export function useClassSubjectsBrief(academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['grades', 'class-subjects', academicYearId],
    queryFn: () => fetchClassSubjectsBrief(academicYearId as string),
    enabled: !!academicYearId,
  })
}

export function useAssessments(classSubjectId: string | undefined) {
  return useQuery({
    queryKey: ['assessments', classSubjectId],
    queryFn: () => fetchAssessments(classSubjectId as string),
    enabled: !!classSubjectId,
  })
}

export function useAssessmentScores(classSubjectId: string | undefined) {
  return useQuery({
    queryKey: ['assessment-scores', classSubjectId],
    queryFn: () => fetchAssessmentScores(classSubjectId as string),
    enabled: !!classSubjectId,
  })
}

export function useClassStudents(classId: string | undefined) {
  return useQuery({
    queryKey: ['students', 'grades', classId],
    queryFn: () => fetchClassStudents(classId as string),
    enabled: !!classId,
  })
}

export function useCreateAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ classSubjectId, values }: { classSubjectId: string; values: AssessmentFormValues }) =>
      createAssessment(classSubjectId, values),
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'assessments',
        recordId: variables.classSubjectId,
        newData: { type: variables.values.type, title: variables.values.title },
      })
      void qc.invalidateQueries({ queryKey: ['assessments'] })
    },
  })
}

export function useUpdateAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<AssessmentFormValues> }) =>
      updateAssessment(id, values),
    onSuccess: () => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'assessments',
        recordId: null,
        newData: {},
      })
      void qc.invalidateQueries({ queryKey: ['assessments'] })
    },
  })
}

export function useDeleteAssessment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteAssessment(id),
    onSuccess: () => {
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'assessments',
        recordId: null,
        newData: {},
      })
      void qc.invalidateQueries({ queryKey: ['assessments'] })
      void qc.invalidateQueries({ queryKey: ['assessment-scores'] })
    },
  })
}

export function useSaveAssessmentScores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GradeUpsert[]) => upsertAssessmentScores(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assessment-scores'] })
    },
  })
}

export function useGenerateSemesterGrade() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ classSubjectId, semester }: { classSubjectId: string; semester: 1 | 2 }) =>
      generateSemesterGrade(classSubjectId, semester),
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'student_semester_reports',
        recordId: variables.classSubjectId,
        newData: { generate: true, semester: variables.semester },
      })
      void qc.invalidateQueries({ queryKey: ['semester-reports'] })
      void qc.invalidateQueries({ queryKey: ['leger'] })
    },
  })
}
