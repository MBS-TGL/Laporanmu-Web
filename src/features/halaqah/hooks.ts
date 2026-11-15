import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import { supabase } from '../../lib/supabase'
import {
  addHalaqahMembers,
  createHalaqah,
  createTahfidz,
  deleteTahfidz,
  fetchHalaqah,
  fetchHalaqahAttendance,
  fetchHalaqahMembers,
  fetchTahfidz,
  fetchTahfidzByStudent,
  fetchTahfidzStats,
  removeHalaqahMember,
  saveHalaqahAttendance,
  softDeleteHalaqah,
  updateHalaqah,
  updateTahfidz,
} from './api'
import type {
  HalaqahAttendanceUpsert,
  HalaqahFormValues,
  HalaqahSession,
  TahfidzFilters,
  TahfidzFormValues,
} from './types'

export function useHalaqah() {
  return useQuery({
    queryKey: ['halaqah', 'list'],
    queryFn: fetchHalaqah,
  })
}

export function useHalaqahMembers(groupId: string | undefined) {
  return useQuery({
    queryKey: ['halaqah-members', groupId],
    queryFn: () => fetchHalaqahMembers(groupId as string),
    enabled: !!groupId,
  })
}

export function useCreateHalaqah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: HalaqahFormValues) => createHalaqah(values),
    onSuccess: (group) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'halaqah_groups',
        recordId: group.id,
        newData: { name: group.name },
      })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateHalaqah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: HalaqahFormValues }) =>
      updateHalaqah(id, values),
    onSuccess: (group) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_groups',
        recordId: group.id,
      })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
    },
  })
}

export function useDeleteHalaqah() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteHalaqah(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_groups',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useAddHalaqahMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupId, studentIds }: { groupId: string; studentIds: string[] }) =>
      addHalaqahMembers(groupId, studentIds),
    onSuccess: (_count, vars) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'halaqah_members',
        newData: { group_id: vars.groupId, count: vars.studentIds.length },
      })
      void qc.invalidateQueries({ queryKey: ['halaqah-members', vars.groupId] })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
    },
  })
}

export function useRemoveHalaqahMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => removeHalaqahMember(memberId),
    onSuccess: (_data, memberId) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_members',
        recordId: memberId,
      })
      // group_id tidak diketahui di sini — invalidate semua daftar anggota
      void qc.invalidateQueries({ queryKey: ['halaqah-members'] })
      void qc.invalidateQueries({ queryKey: ['halaqah'] })
    },
  })
}

// ─── Presensi halaqah ────────────────────────────────────────────────────────

export function useHalaqahAttendance(
  groupId: string | undefined,
  session: HalaqahSession,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: ['halaqah-attendance', groupId, session, year, month],
    queryFn: () => fetchHalaqahAttendance(groupId as string, session, year, month),
    enabled: !!groupId,
  })
}

export function useSaveHalaqahAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: HalaqahAttendanceUpsert[]) => {
      const { data: userData } = await supabase.auth.getUser()
      const updatedBy = userData.user?.id ?? null
      return saveHalaqahAttendance(payload.map((p) => ({ ...p, updated_by: updatedBy })))
    },
    onSuccess: (_data, payload) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'halaqah_attendance',
        newData: {
          group_id: payload[0]?.group_id,
          session: payload[0]?.session,
          year: payload[0]?.year,
          month: payload[0]?.month,
          members: payload.length,
        },
      })
      void qc.invalidateQueries({ queryKey: ['halaqah-attendance'] })
    },
  })
}

export { useTeachersBrief } from '../teachers/hooks';

// ─── Setoran hafalan (tahfidz) ───────────────────────────────────────────────

export function useTahfidz(filters: TahfidzFilters) {
  return useQuery({
    queryKey: ['tahfidz', filters],
    queryFn: () => fetchTahfidz(filters),
    placeholderData: keepPreviousData,
  })
}

export function useTahfidzStats(studentIds?: string[]) {
  return useQuery({
    queryKey: ['tahfidz', 'stats', studentIds ?? null],
    queryFn: () => fetchTahfidzStats(studentIds),
    staleTime: 60_000,
  })
}

export function useTahfidzByStudent(studentId: string | undefined, limit = 5) {
  return useQuery({
    queryKey: ['tahfidz', 'student', studentId, limit],
    queryFn: () => fetchTahfidzByStudent(studentId as string, limit),
    enabled: !!studentId,
    staleTime: 30_000,
  })
}

export function useCreateTahfidz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: TahfidzFormValues) => createTahfidz(values),
    onSuccess: (record) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'tahfidz_records',
        recordId: record.id,
        newData: { student_id: record.student_id, surah: record.surah, kind: record.kind },
      })
      void qc.invalidateQueries({ queryKey: ['tahfidz'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTahfidz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TahfidzFormValues }) =>
      updateTahfidz(id, values),
    onSuccess: (record) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'tahfidz_records',
        recordId: record.id,
      })
      void qc.invalidateQueries({ queryKey: ['tahfidz'] })
    },
  })
}

export function useDeleteTahfidz() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTahfidz(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'tahfidz_records',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['tahfidz'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
