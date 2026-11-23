import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { AcademicYear } from '../academic-years/types'
import {
  createCocurricularDim,
  deleteCocurricularDim,
  fetchCocurricularDims,
  fetchCocurricularScores,
  saveCocurricularScores,
  updateCocurricularDim,
  type CocurricularScoreInput,
} from './api'

/** Tahun ajaran aktif untuk dokumen (raport, yudisium). */
export async function fetchActiveAcademicYear(): Promise<AcademicYear | null> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('start_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as AcademicYear) ?? null
}

export async function fetchAllAcademicYears(): Promise<AcademicYear[]> {
  const { data, error } = await supabase
    .from('academic_years')
    .select('*')
    .is('deleted_at', null)
    .order('start_date', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as AcademicYear[]
}

export function useActiveAcademicYear() {
  return useQuery({
    queryKey: ['academic-years', 'active'],
    queryFn: fetchActiveAcademicYear,
    staleTime: 5 * 60_000,
  })
}

export function useAcademicYearsList() {
  return useQuery({
    queryKey: ['academic-years', 'all-docs'],
    queryFn: fetchAllAcademicYears,
    staleTime: 5 * 60_000,
  })
}

// ─── Data semester bersama (rapor/khs/transcript) ───────────────────────────

import { fetchClassSubjectsBrief, fetchSemesterScoresForClass, fetchClassStudents } from '../grades/api'
import type { ClassSubjectInfo } from '../grades/types'
import type { AssessmentStudent } from '../grades/types'

export interface DocSubjectRow {
  cs: ClassSubjectInfo
}

export function useDocClassSubjects(_classId: string | undefined, ayId: string | undefined) {
  return useQuery({
    queryKey: ['doc-class-subjects', ayId],
    queryFn: () => fetchClassSubjectsBrief(ayId!),
    enabled: Boolean(ayId),
  })
}

export function useDocStudents(classId: string | undefined) {
  return useQuery({
    queryKey: ['doc-students', classId],
    queryFn: () => fetchClassStudents(classId!),
    enabled: Boolean(classId),
  })
}

export function useDocSemesterScores(
  classId: string | undefined,
  ayId: string | undefined,
  semester: 1 | 2,
) {
  return useQuery({
    queryKey: ['doc-semester-scores', classId, ayId, semester],
    queryFn: () => fetchSemesterScoresForClass(classId!, ayId!, semester),
    enabled: Boolean(classId) && Boolean(ayId),
  })
}

export type { AssessmentStudent }

// ─── Dimensi kokurikuler (tab di halaman ini) ───────────────────────────────
// Audit create/update/delete ada di dalam api (pola documents/api) — hooks
// cukup invalidate supaya tidak dobel log.

export function useCocurricularDims() {
  return useQuery({
    queryKey: ['cocurricular-dims'],
    queryFn: fetchCocurricularDims,
  })
}

export function useCreateDim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, sortOrder }: { name: string; sortOrder: number }) =>
      createCocurricularDim(name, sortOrder),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cocurricular-dims'] }),
  })
}

export function useUpdateDim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name: string; sort_order: number } }) =>
      updateCocurricularDim(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cocurricular-dims'] }),
  })
}

export function useDeleteDim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCocurricularDim(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cocurricular-dims'] }),
  })
}

export function useCocurricularScores(
  classId: string | undefined,
  academicYearId: string | undefined,
  semester: 'Odd' | 'Even',
) {
  return useQuery({
    queryKey: ['cocurricular-scores', classId, academicYearId, semester],
    queryFn: () => fetchCocurricularScores(classId!, academicYearId!, semester),
    enabled: Boolean(classId && academicYearId),
  })
}

export function useSaveCocurricularScores() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: CocurricularScoreInput[]) => saveCocurricularScores(rows),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cocurricular-scores'] }),
  })
}
