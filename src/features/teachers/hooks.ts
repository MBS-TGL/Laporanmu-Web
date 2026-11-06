import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTeacher, fetchTeachers, softDeleteTeacher, updateTeacher } from './api'
import type { TeacherFilters, TeacherFormValues } from './types'

export function useTeachers(filters: TeacherFilters) {
  return useQuery({
    queryKey: ['teachers', filters],
    queryFn: () => fetchTeachers(filters),
  })
}

export function useTeachersBrief() {
  return useQuery({
    queryKey: ['teachers', 'brief'],
    queryFn: async () => {
      const { data } = await fetchTeachers({ page: 1, pageSize: 500 })
      return data.map((t) => ({ id: t.id, name: t.name }))
    },
  })
}

export function useCreateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: TeacherFormValues) => createTeacher(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TeacherFormValues }) =>
      updateTeacher(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

export function useDeleteTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteTeacher(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
