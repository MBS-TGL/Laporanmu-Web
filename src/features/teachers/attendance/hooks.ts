import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../../shared/utils/auditLogger'
import { deleteTeacherAttendance, fetchTeacherAttendance, fetchTeacherAttendanceRange, upsertTeacherAttendance } from './api'
import type { TeacherAttendanceDeleteTarget, TeacherAttendancePayload } from './types'

export function useTeacherAttendance(date: string) {
  return useQuery({
    queryKey: ['teacher-attendance', date],
    queryFn: () => fetchTeacherAttendance(date),
    enabled: !!date,
  })
}

/** Rekap rentang tanggal (inklusif) — invalidasi otomatis oleh save via prefix ['teacher-attendance'] */
export function useTeacherAttendanceRange(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ['teacher-attendance', 'range', from, to],
    queryFn: () => fetchTeacherAttendanceRange(from, to),
    enabled: enabled && !!from && !!to,
  })
}

export function useSaveTeacherAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: TeacherAttendancePayload[]) => upsertTeacherAttendance(payload),
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teacher_attendance',
        recordId: variables[0]?.date ?? null,
        newData: { count: variables.length, date: variables[0]?.date },
      })
      void qc.invalidateQueries({ queryKey: ['teacher-attendance'] })
    },
  })
}

export interface TeacherGridSavePayload {
  upserts: TeacherAttendancePayload[]
  deletes: TeacherAttendanceDeleteTarget[]
}

/** Simpan perubahan grid bulanan: upsert sel berstatus + hapus sel yang dikosongkan. */
export function useSaveAttendanceGrid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ upserts, deletes }: TeacherGridSavePayload) => {
      await upsertTeacherAttendance(upserts)
      await deleteTeacherAttendance(deletes)
    },
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'teacher_attendance',
        newData: { upserts: variables.upserts.length, deletes: variables.deletes.length },
      })
      void qc.invalidateQueries({ queryKey: ['teacher-attendance'] })
    },
  })
}
