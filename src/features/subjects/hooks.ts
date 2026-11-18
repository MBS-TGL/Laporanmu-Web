import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createCurriculumCp,
  createCurriculumTp,
  deleteCurriculumCp,
  deleteCurriculumTp,
  fetchCurriculumCps,
  fetchCurriculumTps,
  moveCurriculumTp,
  updateCurriculumCp,
  updateCurriculumTp,
} from '../documents/api'
import { createSubject, fetchSubjects, softDeleteSubject, updateSubject } from './api'
import type { CpFormValues, SubjectFormValues } from './types'

/** Daftar mapel aktif untuk select (jadwal, dsb.) */
export function useSubjectsBrief() {
  return useQuery({
    queryKey: ['subjects', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, weekly_hours')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as { id: string; name: string; code: string | null; weekly_hours: number }[]
    },
    staleTime: 60_000,
  })
}

export function useSubjects() {
  return useQuery({
    queryKey: ['subjects', 'list'],
    queryFn: fetchSubjects,
  })
}

export function useCreateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: SubjectFormValues) => createSubject(values),
    onSuccess: (subject) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'subjects',
        recordId: subject.id,
        newData: { name: subject.name, code: subject.code },
      })
      void qc.invalidateQueries({ queryKey: ['subjects'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: SubjectFormValues }) =>
      updateSubject(id, values),
    onSuccess: (subject) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'subjects',
        recordId: subject.id,
        newData: { name: subject.name, code: subject.code, is_active: subject.is_active },
      })
      void qc.invalidateQueries({ queryKey: ['subjects'] })
    },
  })
}

export function useDeleteSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteSubject(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'subjects', recordId: id })
      void qc.invalidateQueries({ queryKey: ['subjects'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ─── Kurikulum CP/TP (tab di halaman ini; API di documents/api) ─────────────
// Audit create/update/delete ada di dalam api (pola file documents/api) —
// hooks cukup invalidate supaya tidak dobel log.

export function useCurriculumCps() {
  return useQuery({
    queryKey: ['curriculum', 'cps'],
    queryFn: fetchCurriculumCps,
  })
}

export function useCurriculumTps() {
  return useQuery({
    queryKey: ['curriculum', 'tps'],
    queryFn: fetchCurriculumTps,
  })
}

export function useCreateCp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: CpFormValues) => createCurriculumCp(values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}

export function useUpdateCp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CpFormValues }) =>
      updateCurriculumCp(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}

export function useDeleteCp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCurriculumCp(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}

export function useCreateTp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cpId, description, sortOrder }: { cpId: string; description: string; sortOrder: number }) =>
      createCurriculumTp(cpId, description, sortOrder),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}

export function useUpdateTp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      updateCurriculumTp(id, description),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}

export function useDeleteTp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCurriculumTp(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}

export function useMoveTp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dir }: { id: string; dir: 'up' | 'down' }) => moveCurriculumTp(id, dir),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['curriculum'] }),
  })
}
