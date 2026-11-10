import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createClass,
  fetchClasses,
  fetchClassGenderCounts,
  setClassesHomeroomBulk,
  softDeleteClass,
  softDeleteClassesBulk,
  updateClass,
} from './api'
import type { ClassFilters, ClassFormValues } from './types'

export function useClasses(filters: ClassFilters) {
  return useQuery({
    queryKey: ['classes', filters],
    queryFn: () => fetchClasses(filters),
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
    staleTime: 60_000,
  })
}
