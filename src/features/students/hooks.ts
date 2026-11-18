import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createAlumni,
  createStudent,
  deleteStudentsBulk,
  fetchArchivedStudents,
  fetchClassesForPromotion,
  fetchExistingAlumniKeys,
  fetchExistingStudentCodes,
  fetchStudentGuardians,
  fetchStudentStats,
  fetchStudents,
  fetchWaSettingsStatus,
  generateStudentPins,
  graduateStudentsBulk,
  hardDeleteStudent,
  hardDeleteStudentsBulk,
  importAlumniBatch,
  moveStudentsBulk,
  promoteStudents,
  resetPoints,
  restoreGraduationSnapshots,
  restoreStudent,
  restoreStudentsBulk,
  revertGraduation,
  revertGraduationsBulk,
  saveStudentGuardians,
  sendWaBroadcast,
  softDeleteStudent,
  undoPromotion,
  updateAlumni,
  updateStudent,
  updateStudentPhoto,
  updateWaSettings,
  fetchStudentPhotos,
  type AlumniFormValues,
  type ImportAlumniRowPayload,
  type WaRecipient,
} from './api'
import type { GraduationSnapshot, PromotionMove, StudentFilters, StudentFormValues, StudentGuardianInput } from './types'

export interface ClassBrief {
  id: string
  name: string
}

/**
 * A3: Invalidation granular (cegah stampede). Memperbarui satu siswa tidak
 * perlu menarik ulang daftar alumni (1.000 baris) atau arsip.
 */
interface StudentInvalidateOptions {
  list?: boolean
  stats?: boolean
  alumni?: boolean
  archived?: boolean
  codes?: boolean
  alumniKeys?: boolean
  detailId?: string
  /** Segarkan query lintas-fitur (search, by-class, grades, dll.) */
  cross?: boolean
}

function invalidateStudents(qc: QueryClient, opts: StudentInvalidateOptions) {
  if (opts.list) void qc.invalidateQueries({ queryKey: ['students', 'list'] })
  if (opts.stats) void qc.invalidateQueries({ queryKey: ['student-stats'] })
  if (opts.alumni) void qc.invalidateQueries({ queryKey: ['students', 'alumni'] })
  if (opts.archived) void qc.invalidateQueries({ queryKey: ['students', 'archived'] })
  if (opts.codes) void qc.invalidateQueries({ queryKey: ['students', 'codes'] })
  if (opts.alumniKeys) void qc.invalidateQueries({ queryKey: ['students', 'alumni-keys'] })
  if (opts.detailId) void qc.invalidateQueries({ queryKey: ['students', 'detail', opts.detailId] })
  if (opts.cross) {
    void qc.invalidateQueries({ queryKey: ['students', 'search'] })
    void qc.invalidateQueries({ queryKey: ['students', 'by-class'] })
    void qc.invalidateQueries({ queryKey: ['students', 'by-classes'] })
    void qc.invalidateQueries({ queryKey: ['students', 'grades'] })
    void qc.invalidateQueries({ queryKey: ['students', 'preset'] })
  }
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
    staleTime: 1000 * 60 * 30, // A7: 30 menit untuk daftar berat
  })
}

export function useClassesBrief() {
  return useQuery({
    queryKey: ['classes', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, grade')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as (ClassBrief & { grade?: string | null })[]
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

export function useStudents(filters: StudentFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['students', 'list', filters],
    queryFn: () => fetchStudents(filters),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 30, // A7: 30 menit
  })
}

export function useStudentStats() {
  return useQuery({
    queryKey: ['student-stats'],
    queryFn: fetchStudentStats,
    staleTime: 1000 * 60 * 30, // A7: 30 menit
  })
}

export function useArchivedStudents() {
  return useQuery({
    queryKey: ['students', 'archived'],
    queryFn: fetchArchivedStudents,
    staleTime: 1000 * 60 * 30,
  })
}

/** Pra-cek duplikat untuk modal impor — hanya aktif saat diminta */
export function useExistingStudentCodes(enabled: boolean) {
  return useQuery({
    queryKey: ['students', 'codes'],
    queryFn: fetchExistingStudentCodes,
    enabled,
    staleTime: 1000 * 60 * 10,
  })
}

/** Foto siswa on-demand untuk baris tabel / kartu / drawer */
export function useStudentPhotos(ids: string[]) {
  const sortedIds = [...new Set(ids)].sort()
  const enabled = sortedIds.length > 0
  return useQuery({
    queryKey: ['students', 'photos', sortedIds],
    queryFn: () => fetchStudentPhotos(sortedIds),
    enabled,
    staleTime: 1000 * 60 * 60, // 1 jam, foto jarang berubah
  })
}

export function useCreateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: StudentFormValues) => createStudent(values),
    onSuccess: (student) => {
      void logAudit({ action: 'INSERT', source: 'MASTER', tableName: 'students', recordId: student.id, newData: { name: student.name, registration_code: student.registration_code } })
      invalidateStudents(qc, { list: true, stats: true, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, detailId: student.id, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, archived: true, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, archived: true, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, archived: true, detailId: id, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, archived: true, codes: true, alumniKeys: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useHardDeleteStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => hardDeleteStudent(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'students', recordId: id, newData: { permanent: true } })
      invalidateStudents(qc, { stats: true, archived: true, codes: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useHardDeleteStudentsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => hardDeleteStudentsBulk(ids),
    onSuccess: (_data, ids) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'students', newData: { bulk_permanent_deleted: ids.length } })
      invalidateStudents(qc, { stats: true, archived: true, codes: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useClassesForPromotion() {
  return useQuery({
    queryKey: ['classes', 'for-promotion'],
    queryFn: fetchClassesForPromotion,
    staleTime: 60_000,
  })
}

export function usePromoteStudents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (moves: PromotionMove[]) => promoteStudents(moves),
    onSuccess: (batchId, moves) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'students',
        newData: { bulk_promoted: moves.length, batch_id: batchId },
      })
      invalidateStudents(qc, { list: true, stats: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

export function useUndoPromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (batchId: string) => undoPromotion(batchId),
    onSuccess: (count, batchId) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'students',
        newData: { promotion_undone: count, batch_id: batchId },
      })
      invalidateStudents(qc, { list: true, stats: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, detailId: ids.length === 1 ? ids[0] : undefined, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, alumni: true, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true, alumni: true, detailId: id, codes: true, alumniKeys: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

/** Pembatalan kelulusan massal (halaman Alumni) — revert berurutan, invalidasi & audit sekali di akhir */
export function useBulkRevertGraduation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => revertGraduationsBulk(ids),
    onSuccess: (_data, ids) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { bulk_graduation_reverted: ids.length } })
      invalidateStudents(qc, { list: true, stats: true, alumni: true, codes: true, alumniKeys: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      invalidateClassCounts(qc)
    },
  })
}

/** Ambil data kunci seluruh siswa untuk pra-cek duplikat alumni */
export function useExistingAlumniKeys(enabled: boolean = true) {
  return useQuery({
    queryKey: ['students', 'alumni-keys'],
    queryFn: fetchExistingAlumniKeys,
    enabled,
    staleTime: 1000 * 60 * 10,
  })
}

export function useCreateAlumni() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: AlumniFormValues) => createAlumni(values),
    onSuccess: (student) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'students',
        recordId: student.id,
        newData: { name: student.name, graduation_year: student.graduation_year, status: 'graduated' },
      })
      invalidateStudents(qc, { alumni: true, list: true, stats: true, codes: true, alumniKeys: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateAlumni() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AlumniFormValues }) => updateAlumni(id, values),
    onSuccess: (student) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'students',
        recordId: student.id,
        newData: { name: student.name, graduation_year: student.graduation_year },
      })
      invalidateStudents(qc, { alumni: true, list: true, stats: true, detailId: student.id })
    },
  })
}

export function useImportAlumni() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      rows,
      onProgress,
    }: {
      rows: ImportAlumniRowPayload[]
      onProgress?: (processed: number, total: number) => void
    }) => importAlumniBatch(rows, onProgress),
    onSuccess: (results) => {
      const successful = results.filter((r) => r.ok).length
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'students',
        newData: { bulk_alumni_imported: successful, total_rows: results.length },
      })
      invalidateStudents(qc, { alumni: true, list: true, stats: true, codes: true, alumniKeys: true, cross: true })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Undo pembatalan kelulusan massal — pulihkan jejak kelulusan dari snapshot yang diambil sebelum revert */
export function useRestoreGraduationSnapshots() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: GraduationSnapshot[]) => restoreGraduationSnapshots(rows),
    onSuccess: (count) => {
      void logAudit({ action: 'UPDATE', source: 'MASTER', tableName: 'students', newData: { graduation_restored: count } })
      invalidateStudents(qc, { alumni: true, list: true, stats: true, codes: true, alumniKeys: true, cross: true })
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
      invalidateStudents(qc, { list: true, stats: true })
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
      invalidateStudents(qc, { list: true, stats: true, detailId: variables.id })
      // Foto juga basi di cache foto on-demand
      void qc.invalidateQueries({ queryKey: ['students', 'photos'] })
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
      invalidateStudents(qc, { list: true, detailId: results.length === 1 ? results[0].student_id : undefined })
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
    mutationFn: ({
      token,
      senderName,
      autoViolation,
      autoBk,
      autoSavings,
      autoSpp,
      autoCbt,
      autoAbsenMapel,
      autoRohani,
    }: {
      token: string
      senderName: string
      autoViolation?: boolean
      autoBk?: boolean
      autoSavings?: boolean
      autoSpp?: boolean
      autoCbt?: boolean
      autoAbsenMapel?: boolean
      autoRohani?: boolean
    }) =>
      updateWaSettings(
        token,
        senderName,
        autoViolation,
        autoBk,
        autoSavings,
        autoSpp,
        autoCbt,
        autoAbsenMapel,
        autoRohani,
      ),
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
