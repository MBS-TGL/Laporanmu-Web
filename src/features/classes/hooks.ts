import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { createClass, fetchClasses, softDeleteClass, updateClass } from './api'
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ClassFormValues }) =>
      updateClass(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
    },
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteClass(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['classes'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export interface ClassSize {
  class_id: string
  total: number
}

// View class_sizes (0009_views.sql) — jumlah santri AKTIF per kelas.
// Kalau view belum ada, kembalikan array kosong agar halaman tetap jalan.
export function useClassSizes() {
  return useQuery({
    queryKey: ['class-sizes'],
    queryFn: async (): Promise<ClassSize[]> => {
      try {
        const { data, error } = await supabase.from('class_sizes').select('*')
        if (error) return []
        return (data ?? []) as ClassSize[]
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })
}
