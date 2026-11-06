import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createStudent,
  fetchStudents,
  softDeleteStudent,
  updateStudent,
} from './api'
import type { StudentFilters, StudentFormValues } from './types'

export interface ClassBrief {
  id: string
  name: string
}

export function useClassesBrief() {
  return useQuery({
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

export function useCreateStudent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: StudentFormValues) => createStudent(values),
    onSuccess: (student) => {
      void logAudit({ action: 'INSERT', source: 'MASTER', tableName: 'students', recordId: student.id, newData: { name: student.name, registration_code: student.registration_code } })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
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
    },
  })
}
