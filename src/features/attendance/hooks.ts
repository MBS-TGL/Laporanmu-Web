import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAttendanceRows,
  syncAttendanceToReportCards,
  upsertAttendance,
  type AttendanceUpsert,
} from './api'
import type { AttendanceDays } from './types'

export function useAttendanceRows(classId: string | undefined, year: number, month: number) {
  return useQuery({
    queryKey: ['attendance', classId, year, month],
    queryFn: () => fetchAttendanceRows(classId as string, year, month),
    enabled: !!classId,
  })
}

export function useSaveAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: AttendanceUpsert[]) => upsertAttendance(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}

export function useSyncAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      rows,
      classId,
      year,
      month,
      updatedBy,
    }: {
      rows: { student_id: string; days: AttendanceDays }[]
      classId: string
      year: number
      month: number
      updatedBy: string | null
    }) => syncAttendanceToReportCards(rows, classId, year, month, updatedBy),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-cards'] })
    },
  })
}
