import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createStudent,
  deleteStudentsBulk,
  fetchArchivedStudents,
  fetchExistingStudentCodes,
  fetchStudentGuardians,
  fetchStudentStats,
  fetchStudents,
  fetchWaSettingsStatus,
  generateStudentPins,
  graduateStudentsBulk,
  moveStudentsBulk,
  resetPoints,
  restoreGraduationSnapshot,
  restoreStudent,
  restoreStudentsBulk,
  revertGraduation,
  saveStudentGuardians,
  sendWaBroadcast,
  softDeleteStudent,
  updateStudent,
  updateStudentPhoto,
  updateWaSettings,
  type WaRecipient,
} from './api'
import type { GraduationSnapshot, StudentFilters, StudentFormValues, StudentGuardianInput } from './types'

export interface ClassBrief {
  id: string
  name: string
}

/** Keanggotaan/status siswa berubah → angka jumlah santri per kelas di ClassesPage ikut basi */
function invalidateClassCounts(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['classes', 'gender-counts'] })
}

/** Daftar alumni (siswa berstatus lulus) untuk halaman Alumni — fetch sekali, filter di memori.
 *  `total` dari server dipakai untuk warning bila melebihi batas fetch 1000 baris. */
export function useAlumni() {
  return useQuery({
    queryKey: ['students', 'alumni'],
    queryFn: async () => {
      const { data, total } = await fetchStudents({
        status: 'graduated',
        sortBy: 'graduated_desc',
        page: 1,
        pageSize: 1000,
      })
      return { data, total }
    },
  })
}

export function useClassesBrief() {  return useQuery({
    queryKey: ['classes', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as ClassBrief[]
    },
  })
}

export interface DormBrief {
  id: string
  name: string
}

export function useDormsBrief() {
  return useQuery({
    queryKey: ['dorms', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dorms')
        .select('id, name')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as DormBrief[]
    },
  })
}

export function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => fetchStudents(filters),
  })
}

export function useStudentStats() {
  return useQuery({
    queryKey: ['students', 'stats'],
    queryFn: fetchStudentStats,
  })
}

export function useArchivedStudents(search?: string) {
  return useQuery({
    queryKey: ['students', 'archived', search ?? ''],
    queryFn: () => fetchArchivedStudents(search || undefined),
  })
}

/** Pra-cek duplikat untuk modal impor — hanya aktif saat diminta */
export function useExistingStudentCodes(enabled: boolean) {
  return useQuery({
    queryKey: ['students', 'existing-codes'],
    queryFn: fetchExistingStudentCodes,
    enabled,
  })
}

export function useCreateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: StudentFormValues) => createStudent(values),
    onSuccess: (student) => {
      void logAudit({ action: 'INSERT', source: 'MASTER', tableName: 'students', recordId: student.id, newData: { name: student.name, registration_code: student.registration_code } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useUpdateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: StudentFormValues }) =>
      updateStudent(id, values),
    onSuccess: (student) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', recordId: student.id, newData: { name: student.name } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useDeleteStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteStudent(id),
    onSuccess: (_data, variables) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'students', recordId: variables, newData: { soft_deleted: true } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useBulkDeleteStudents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => deleteStudentsBulk(ids),
    onSuccess: (_data, ids) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'students', newData: { bulk_soft_deleted: ids.length } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useRestoreStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restoreStudent(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', recordId: id, newData: { restored: true } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useBulkRestoreStudents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => restoreStudentsBulk(ids),
    onSuccess: (_data, ids) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { bulk_restored: ids.length } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useBulkMoveClassStudents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, classId }: { ids: string[]; classId: string }) =>
      moveStudentsBulk(ids, classId),
    onSuccess: (_data, { ids, classId }) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { bulk_move_class: ids.length, class_id: classId } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useGraduateStudentsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, graduationYear }: { ids: string[]; graduationYear: number }) =>
      graduateStudentsBulk(ids, graduationYear),
    onSuccess: (_data, { ids, graduationYear }) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { bulk_graduated: ids.length, graduation_year: graduationYear } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useRevertGraduation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revertGraduation(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', recordId: id, newData: { graduation_reverted: true } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

/** Pembatalan kelulusan massal (halaman Alumni) — revert berurutan, invalidasi & audit sekali di akhir */
export function useBulkRevertGraduation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await revertGraduation(id)
      return ids
    },
    onSuccess: (_data, ids) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { bulk_graduation_reverted: ids.length } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

/** Undo pembatalan kelulusan massal — pulihkan jejak kelulusan dari snapshot yang diambil sebelum revert */
export function useRestoreGraduationSnapshots() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: GraduationSnapshot[]) => {
      for (const row of rows) await restoreGraduationSnapshot(row)
      return rows.length
    },
    onSuccess: (count) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { graduation_restored: count } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useResetPoints() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (classId: string | null) => resetPoints(classId),
    onSuccess: (count, classId) => {
      void logAudit({ action: 'UPDATE', source: 'OPERATIONAL', tableName: 'students', newData: { reset_points: true, class_id: classId, affected: count } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateStudentPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, photoUrl }: { id: string; photoUrl: string }) => updateStudentPhoto(id, photoUrl),
    onSuccess: (_data, variables) => {
      // Nilai foto (base64 besar) tidak di-log — cukup penanda perubahan
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', recordId: variables.id, newData: { photo_url: true } })
      void qc.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

export function useGenerateStudentPins() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => generateStudentPins(ids),
    onSuccess: (results) => {
      // Nilai PIN tidak di-log — cukup jumlah yang dibuat (pola foto)
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'students',
        newData: { pins_generated: results.length },
      })
      void qc.invalidateQueries({ queryKey: ['students'] })
    },
  })
}

// ------------------------------------------------------------
// Data orang tua/wali (student_guardians — migration 0020)
// ------------------------------------------------------------

export function useStudentGuardians(studentId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['student-guardians', studentId],
    queryFn: () => fetchStudentGuardians(studentId as string),
    enabled: enabled && !!studentId,
  })
}

export function useSaveStudentGuardians() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentId, rows }: { studentId: string; rows: StudentGuardianInput[] }) =>
      saveStudentGuardians(studentId, rows),
    onSuccess: (_data, { studentId, rows }) => {
      // NIK/penghasilan tidak di-log — cukup ringkasan perubahan
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'student_guardians',
        recordId: studentId,
        newData: { guardians_saved: rows.length },
      })
      void qc.invalidateQueries({ queryKey: ['student-guardians', studentId] })
    },
  })
}

// ------------------------------------------------------------
// WhatsApp broadcast (Fonnte via Edge Function)
// ------------------------------------------------------------

export function useWaSettingsStatus() {
  return useQuery({
    queryKey: ['wa-settings', 'status'],
    queryFn: fetchWaSettingsStatus,
  })
}

export function useUpdateWaSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ token, senderName }: { token: string; senderName: string }) =>
      updateWaSettings(token, senderName),
    onSuccess: () => {
      // Token tidak di-log — kredensial akun Fonnte
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'wa_settings', newData: { updated: true } })
      void qc.invalidateQueries({ queryKey: ['wa-settings'] })
    },
  })
}

export function useSendWaBroadcast() {
  return useMutation({
    mutationFn: (recipients: WaRecipient[]) => sendWaBroadcast(recipients),
    onSuccess: (result, recipients) => {
      if (result.ok) {
        void logAudit({ action: 'BROADCAST', source: 'OPERATIONAL', tableName: 'students', newData: { broadcast_wa: recipients.length, via: 'fonnte' } })
      }
    },
  })
}
