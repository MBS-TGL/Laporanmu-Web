import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import { softDeleteMany } from '../../shared/api/crud'
import {
  addActivityMembers,
  bulkCreateActivity,
  createActivity,
  fetchActivity,
  fetchActivityAttendance,
  fetchActivityByStudent,
  fetchActivityMembers,
  fetchStudentsByClasses,
  removeActivityMember,
  removeActivityMembers,
  saveActivityAttendance,
  setMemberRole,
  softDeleteActivity,
  updateActivity,
} from './api'
import type { ActivityAttendanceUpsert, ActivityFormValues } from './types'

export function useActivity() {
  return useQuery({
    queryKey: ['activity', 'list'],
    queryFn: fetchActivity,
  })
}

export function useActivityMembers(activityId: string | undefined) {
  return useQuery({
    queryKey: ['activity-members', activityId],
    queryFn: () => fetchActivityMembers(activityId as string),
    enabled: !!activityId,
  })
}

export function useActivityAttendance(
  activityId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: ['activity-attendance', activityId, year, month],
    queryFn: () => fetchActivityAttendance(activityId as string, year, month),
    enabled: !!activityId,
  })
}

/** Keikutsertaan activity satu santri — dipakai penilaian raport semester. */
export function useActivityByStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: ['activity', 'by-student', studentId],
    queryFn: () => fetchActivityByStudent(studentId as string),
    enabled: !!studentId,
  })
}

/** Upsert presensi bulanan — pola useSaveHalaqahAttendance (updated_by + audit + invalidate). */
export function useSaveActivityAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ActivityAttendanceUpsert[]) => {
      const { data: userData } = await supabase.auth.getUser()
      const updatedBy = userData.user?.id ?? null
      return saveActivityAttendance(payload.map((p) => ({ ...p, updated_by: updatedBy })))
    },
    onSuccess: (_data, payload) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'ekskul_attendance',
        newData: {
          ekskul_id: payload[0]?.ekskul_id,
          year: payload[0]?.year,
          month: payload[0]?.month,
          members: payload.length,
        },
      })
      void qc.invalidateQueries({ queryKey: ['activity-attendance'] })
    },
  })
}

/** Santri aktif dari kelas-kelas terpilih — urutan id dinormalkan agar cache stabil. */
export function useStudentsByClasses(classIds: string[]) {
  const sortedKey = [...classIds].sort()
  return useQuery({
    queryKey: ['students', 'by-classes', sortedKey],
    queryFn: () => fetchStudentsByClasses(sortedKey),
    enabled: sortedKey.length > 0,
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ActivityFormValues) => createActivity(values),
    onSuccess: (activity) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: activity.id,
        newData: { name: activity.name },
      })
      void qc.invalidateQueries({ queryKey: ['activity'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ActivityFormValues }) => updateActivity(id, values),
    onSuccess: (activity) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: activity.id,
      })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteActivity(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['activity'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBulkCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ActivityFormValues[]) => bulkCreateActivity(values),
    onSuccess: (res) => {
      if (res.inserted > 0) {
        void logAudit({
          action: 'INSERT',
          source: 'OPERATIONAL',
          tableName: 'extracurriculars',
          newData: { bulk_imported: res.inserted },
        })
      }
      void qc.invalidateQueries({ queryKey: ['activity'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBulkDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => softDeleteMany('extracurriculars', ids),
    onSuccess: (_data, ids) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        newData: { bulk_archived: ids.length },
      })
      void qc.invalidateQueries({ queryKey: ['activity'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAddActivityMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ activityId, studentIds }: { activityId: string; studentIds: string[] }) =>
      addActivityMembers(activityId, studentIds),
    onSuccess: (_count, vars) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        newData: { ekskul_id: vars.activityId, count: vars.studentIds.length },
      })
      void qc.invalidateQueries({ queryKey: ['activity-members', vars.activityId] })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useRemoveActivityMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeActivityMember(memberId),
    onSuccess: (_data, memberId) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        recordId: memberId,
      })
      void qc.invalidateQueries({ queryKey: ['activity-members'] })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useRemoveActivityMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberIds: string[]) => removeActivityMembers(memberIds),
    onSuccess: (_data, ids) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        newData: { count: ids.length },
      })
      void qc.invalidateQueries({ queryKey: ['activity-members'] })
      void qc.invalidateQueries({ queryKey: ['activity'] })
    },
  })
}

export function useSetMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      setMemberRole(memberId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activity-members'] })
    },
  })
}

export { useTeachersBrief } from '../teachers/hooks';
