import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import {
  deleteMonthlyPeriod,
  deleteSemesterPeriod,
  fetchAllMonthlyRows,
  fetchAllSemesterRows,
  fetchAllStudentClasses,
  fetchBehaviorForMonth,
  fetchMonthlyRows,
  fetchMonthlyRowsForMonth,
  fetchReportCardClasses,
  fetchReportCardStudents,
  fetchSchoolSettings,
  fetchSemesterRows,
  upsertMonthlyRows,
  upsertSchoolSettings,
  upsertSemesterRows,
} from './api'
import { logAudit } from '../../shared/utils/auditLogger'
import { mergeMonthlyRows, mergeSemesterRows } from './savePayloads'
import type {
  MonthlyReport,
  MonthlyReportPayload,
  SchoolSettings,
  SemesterReport,
  SemesterReportPayload,
  SemesterType,
} from './types'

export type SaveRowsArgs<P> = {
  payloads: P[]
  silent?: boolean
  queryKey?: QueryKey
}

export function useReportCardClasses() {
  return useQuery({
    queryKey: ['report-cards', 'classes'],
    queryFn: fetchReportCardClasses,
    staleTime: 60_000,
  })
}

export function useReportCardStudents(classId: string | undefined) {
  return useQuery({
    queryKey: ['report-cards', 'students', classId],
    queryFn: () => fetchReportCardStudents(classId as string),
    enabled: !!classId,
  })
}

export function useAllStudentClasses() {
  return useQuery({
    queryKey: ['report-cards', 'student-classes'],
    queryFn: fetchAllStudentClasses,
    staleTime: 60_000,
  })
}

export function useMonthlyRows(studentIds: string[], month: number, year: number) {
  return useQuery({
    queryKey: ['report-cards', 'monthly', year, month, studentIds.length, studentIds[0]],
    queryFn: () => fetchMonthlyRows(studentIds, month, year),
    enabled: studentIds.length > 0,
  })
}

export function useMonthlyRowsForMonth(month: number, year: number) {
  return useQuery({
    queryKey: ['report-cards', 'monthly-overview', year, month],
    queryFn: () => fetchMonthlyRowsForMonth(month, year),
  })
}

export function useAllMonthlyRows() {
  return useQuery({
    queryKey: ['report-cards', 'monthly-all'],
    queryFn: fetchAllMonthlyRows,
  })
}

export function useSemesterRows(
  studentIds: string[],
  reportType: SemesterType,
  semester: 1 | 2,
  academicYearId: string | undefined,
) {
  return useQuery({
    queryKey: ['report-cards', 'semester', reportType, semester, academicYearId, studentIds.length, studentIds[0]],
    queryFn: () => fetchSemesterRows(studentIds, reportType, semester, academicYearId as string),
    enabled: studentIds.length > 0 && !!academicYearId,
  })
}

export function useAllSemesterRows(reportType: SemesterType) {
  return useQuery({
    queryKey: ['report-cards', 'semester-overview', reportType],
    queryFn: () => fetchAllSemesterRows(reportType),
  })
}

export function useBehaviorForMonth(studentIds: string[], startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['report-cards', 'behavior', startDate, studentIds.length, studentIds[0]],
    queryFn: () => fetchBehaviorForMonth(studentIds, startDate, endDate),
    enabled: studentIds.length > 0,
  })
}

export function useSaveMonthly() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ payloads }: SaveRowsArgs<MonthlyReportPayload>) => upsertMonthlyRows(payloads),
    onSuccess: (_data, { payloads, silent, queryKey }) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'student_monthly_reports',
        newData: { upserted: payloads.length, month: payloads[0]?.month, year: payloads[0]?.year },
      })
      if (queryKey) {
        const cached = qc.getQueryData<MonthlyReport[]>(queryKey)
        if (cached) qc.setQueryData<MonthlyReport[]>(queryKey, mergeMonthlyRows(cached, payloads))
        else void qc.invalidateQueries({ queryKey })
      }
      if (!silent) void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}

export function useSaveSemester() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ payloads }: SaveRowsArgs<SemesterReportPayload>) => upsertSemesterRows(payloads),
    onSuccess: (_data, { payloads, silent, queryKey }) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'student_semester_reports',
        newData: {
          upserted: payloads.length,
          report_type: payloads[0]?.report_type,
          semester: payloads[0]?.semester,
        },
      })
      if (queryKey) {
        const cached = qc.getQueryData<SemesterReport[]>(queryKey)
        if (cached) qc.setQueryData<SemesterReport[]>(queryKey, mergeSemesterRows(cached, payloads))
        else void qc.invalidateQueries({ queryKey })
      }
      if (!silent) void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}

export function useResetMonthlyPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentIds, month, year }: { studentIds: string[]; month: number; year: number }) =>
      deleteMonthlyPeriod(studentIds, month, year),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'student_monthly_reports',
        newData: { studentIds: vars.studentIds.length, month: vars.month, year: vars.year },
      })
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}

export function useResetSemesterPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      studentIds,
      reportType,
      semester,
      academicYearId,
    }: {
      studentIds: string[]
      reportType: SemesterType
      semester: 1 | 2
      academicYearId: string
    }) => deleteSemesterPeriod(studentIds, reportType, semester, academicYearId),
    onSuccess: (_data, vars) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'student_semester_reports',
        newData: {
          studentIds: vars.studentIds.length,
          report_type: vars.reportType,
          semester: vars.semester,
        },
      })
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}

export function useSchoolSettings() {
  return useQuery({
    queryKey: ['school-settings'],
    queryFn: fetchSchoolSettings,
    staleTime: 60_000,
  })
}

export function useSaveSchoolSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ values, updatedBy }: { values: SchoolSettings; updatedBy: string | null }) =>
      upsertSchoolSettings(values, updatedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-settings'] })
    },
  })
}
