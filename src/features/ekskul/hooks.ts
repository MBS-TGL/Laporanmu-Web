import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import { softDeleteMany } from '../../shared/api/crud'
import {
  addEkskulMembers,
  bulkCreateEkskul,
  createEkskul,
  fetchEkskul,
  fetchEkskulAttendance,
  fetchEkskulByStudent,
  fetchEkskulMembers,
  fetchStudentsByClasses,
  removeEkskulMember,
  removeEkskulMembers,
  saveEkskulAttendance,
  setMemberRole,
  softDeleteEkskul,
  updateEkskul,
} from './api'
import type { EkskulAttendanceUpsert, EkskulFormValues } from './types'

export function useEkskul() {
  return useQuery({
    queryKey: ['ekskul', 'list'],
    queryFn: fetchEkskul,
  })
}

export function useEkskulMembers(ekskulId: string | undefined) {
  return useQuery({
    queryKey: ['ekskul-members', ekskulId],
    queryFn: () => fetchEkskulMembers(ekskulId as string),
    enabled: !!ekskulId,
  })
}

export function useEkskulAttendance(
  ekskulId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: ['ekskul-attendance', ekskulId, year, month],
    queryFn: () => fetchEkskulAttendance(ekskulId as string, year, month),
    enabled: !!ekskulId,
  })
}

/** Keikutsertaan ekskul satu santri — dipakai penilaian raport semester. */
export function useEkskulByStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: ['ekskul', 'by-student', studentId],
    queryFn: () => fetchEkskulByStudent(studentId as string),
    enabled: !!studentId,
  })
}

/** Upsert presensi bulanan — pola useSaveHalaqahAttendance (updated_by + audit + invalidate). */
export function useSaveEkskulAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: EkskulAttendanceUpsert[]) => {
      const { data: userData } = await supabase.auth.getUser()
      const updatedBy = userData.user?.id ?? null
      return saveEkskulAttendance(payload.map((p) => ({ ...p, updated_by: updatedBy })))
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
      void qc.invalidateQueries({ queryKey: ['ekskul-attendance'] })
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

export function useCreateEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: EkskulFormValues) => createEkskul(values),
    onSuccess: (ekskul) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: ekskul.id,
        newData: { name: ekskul.name },
      })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: EkskulFormValues }) => updateEkskul(id, values),
    onSuccess: (ekskul) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: ekskul.id,
      })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useDeleteEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteEkskul(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurriculars',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBulkCreateEkskul() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: EkskulFormValues[]) => bulkCreateEkskul(values),
    onSuccess: (res) => {
      if (res.inserted > 0) {
        void logAudit({
          action: 'INSERT',
          source: 'OPERATIONAL',
          tableName: 'extracurriculars',
          newData: { bulk_imported: res.inserted },
        })
      }
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBulkDeleteEkskul() {
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
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAddEkskulMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ekskulId, studentIds }: { ekskulId: string; studentIds: string[] }) =>
      addEkskulMembers(ekskulId, studentIds),
    onSuccess: (_count, vars) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        newData: { ekskul_id: vars.ekskulId, count: vars.studentIds.length },
      })
      void qc.invalidateQueries({ queryKey: ['ekskul-members', vars.ekskulId] })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useRemoveEkskulMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeEkskulMember(memberId),
    onSuccess: (_data, memberId) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        recordId: memberId,
      })
      void qc.invalidateQueries({ queryKey: ['ekskul-members'] })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useRemoveEkskulMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberIds: string[]) => removeEkskulMembers(memberIds),
    onSuccess: (_data, ids) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'extracurricular_members',
        newData: { count: ids.length },
      })
      void qc.invalidateQueries({ queryKey: ['ekskul-members'] })
      void qc.invalidateQueries({ queryKey: ['ekskul'] })
    },
  })
}

export function useSetMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      setMemberRole(memberId, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ekskul-members'] })
    },
  })
}

export { useTeachersBrief } from '../teachers/hooks';
