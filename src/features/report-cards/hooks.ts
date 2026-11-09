import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import type {
  MonthlyReportPayload,
  SchoolSettings,
  SemesterReportPayload,
  SemesterType,
} from './types'

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
    mutationFn: (payload: MonthlyReportPayload[]) => upsertMonthlyRows(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}

export function useSaveSemester() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SemesterReportPayload[]) => upsertSemesterRows(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}

export function useResetMonthlyPeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentIds, month, year }: { studentIds: string[]; month: number; year: number }) =>
      deleteMonthlyPeriod(studentIds, month, year),
    onSuccess: () => {
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
    onSuccess: () => {
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
