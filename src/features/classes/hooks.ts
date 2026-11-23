import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createClass,
  createClassesBulk,
  fetchArchivedClasses,
  fetchAllClasses,
  fetchClassSubjects,
  fetchClassSubjectsByYear,
  saveClassSubjects,
  saveTeacherAssignments,
  fetchClasses,
  fetchClassGenderCounts,
  restoreClass,
  setClassesHomeroomBulk,
  softDeleteClass,
  softDeleteClassesBulk,
  updateClass,
} from './api'
import type { ClassFilters, ClassFormValues, ClassSubjectRow } from './types'



// ─── Class subjects hooks (mantan classSubjectsHooks.ts) ───────────────────

export function useClassSubjects(classId: string | undefined, academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['class-subjects', classId, academicYearId],
    queryFn: () => fetchClassSubjects(classId as string, academicYearId as string),
    enabled: !!classId && !!academicYearId,
  })
}

/** Semua assignment mapel-kelas-guru satu tahun ajaran (untuk beban mengajar guru) */
export function useClassSubjectsByYear(academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['class-subjects', 'by-year', academicYearId],
    queryFn: () => fetchClassSubjectsByYear(academicYearId as string),
    enabled: !!academicYearId,
  })
}

export function useSaveClassSubjects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ classId, academicYearId, rows }: { classId: string; academicYearId: string; rows: ClassSubjectRow[] }) =>
      saveClassSubjects(classId, academicYearId, rows),
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'class_subjects',
        recordId: variables.classId,
        newData: { count: variables.rows.length },
      })
      void qc.invalidateQueries({ queryKey: ['class-subjects'] })
      void qc.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

export function useSaveTeacherAssignments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      teacherId,
      academicYearId,
      rows,
    }: {
      teacherId: string
      academicYearId: string
      rows: { class_id: string; subject_id: string; assigned: boolean }[]
    }) => saveTeacherAssignments(teacherId, academicYearId, rows),
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'class_subjects',
        recordId: variables.teacherId,
        newData: { teacher_id: variables.teacherId, count: variables.rows.length },
      })
      void qc.invalidateQueries({ queryKey: ['class-subjects'] })
    },
  })
}

export function useClasses(filters: ClassFilters) {
  return useQuery({
    queryKey: ['classes', filters],
    queryFn: () => fetchClasses(filters),
  })
}

/**
 * Muat-semua kelas aktif tanpa pagination (kelas belasan — filter & sort di
 * memori). Tanpa `count: 'exact'`, jadi lebih ringan dari useClasses 1×1000.
 */
export function useAllClasses() {
  return useQuery({
    queryKey: ['classes', 'all'],
    queryFn: () => fetchAllClasses({}),
  })
}

/** Kelas terarsip — hanya diambil saat tab Arsip aktif. */
export function useArchivedClasses(enabled = true) {
  return useQuery({
    queryKey: ['classes', 'archived'],
    queryFn: fetchArchivedClasses,
    enabled,
  })
}

export function useRestoreClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restoreClass(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'classes',
        recordId: id,
        newData: { restored: true },
      })
    },
  })
}

/** Impor batch kelas — invalidasi & audit dijalankan per pemanggilan mutateAsync */
export function useImportClasses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createClassesBulk,
    onSuccess: (count) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'classes',
        recordId: null,
        newData: { bulk_import: true, count },
      })
    },
  })
}

export function useAcademicYearsBrief() {
  return useQuery({
    queryKey: ['academic-years', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, is_active')
        .is('deleted_at', null)
        .order('name', { ascending: false })
      if (error) throw error
      return (data ?? []) as { id: string; name: string; is_active: boolean | null }[]
    },
  })
}

export function useTeachersBriefForClasses() {
  return useQuery({
    queryKey: ['teachers', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as { id: string; name: string }[]
    },
  })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ClassFormValues) => createClass(values),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'classes',
        recordId: created.id,
        newData: created,
      })
    },
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ClassFormValues }) =>
      updateClass(id, values),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'classes',
        recordId: updated.id,
        newData: updated,
      })
    },
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteClass(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'classes',
        recordId: id,
      })
    },
  })
}

export function useBulkDeleteClasses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => softDeleteClassesBulk(ids),
    onSuccess: (_void, ids) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'classes',
        recordId: null,
        newData: { bulk_ids: ids },
      })
    },
  })
}

export function useSetClassesHomeroomBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, teacherId }: { ids: string[]; teacherId: string | null }) =>
      setClassesHomeroomBulk(ids, teacherId),
    onSuccess: (_void, { ids, teacherId }) => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'classes',
        recordId: null,
        newData: { bulk_homeroom: { count: ids.length, teacher_id: teacherId } },
      })
    },
  })
}

// Jumlah santri aktif + split gender per kelas. Key di bawah prefix ['classes']
// agar ikut ter-invalidate setiap mutasi kelas, dan di-invalidate eksplisit
// oleh mutasi siswa (pindah/buat/hapus) di features/students/hooks.
export function useClassGenderCounts() {
  return useQuery({
    queryKey: ['classes', 'gender-counts'],
    queryFn: async () => {
      try {
        return await fetchClassGenderCounts()
      } catch {
        // Kalau query gagal (mis. RLS), halaman tetap jalan tanpa angka.
        return new Map<string, { total: number; male: number; female: number }>()
      }
    },
    // Cache 5 menit: angka hanya berubah lewat mutasi kelas/santri, dan semua
    // mutasi tersebut sudah invalidateQueries eksplisit — jadi staleTime panjang aman.
    staleTime: 300_000,
  })
}
