import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import { searchStudents } from '../students/api'
import {
  createPointRule,
  createReport,
  deleteReport,
  fetchPointRules,
  fetchReports,
  softDeletePointRule,
  updatePointRule,
} from './api'
import type {
  PointRuleFilters,
  RuleFormValues,
  ReportFilters,
  ReportFormValues,
} from './types'

// ------------------------------------------------------------
// Aturan poin
// ------------------------------------------------------------
export function usePointRules(filters: PointRuleFilters) {
  return useQuery({
    queryKey: ['point-rules', filters],
    queryFn: () => fetchPointRules(filters),
    // Data lama tetap tampil saat ganti halaman/filter, tanpa kedip spinner
    placeholderData: keepPreviousData,
  })
}

export function usePointRulesBrief() {
  return useQuery({
    queryKey: ['point-rules', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('point_rules')
        .select('id, name, points, category, is_negative')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as {
        id: string
        name: string
        points: number
        category: string | null
        is_negative: boolean
      }[]
    },
    staleTime: 60_000,
  })
}

export function useCreatePointRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: RuleFormValues) => createPointRule(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['point-rules'] })
    },
  })
}

export function useUpdatePointRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: RuleFormValues }) =>
      updatePointRule(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['point-rules'] })
    },
  })
}

export function useDeletePointRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeletePointRule(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['point-rules'] })
    },
  })
}

// ------------------------------------------------------------
// Catatan poin
// ------------------------------------------------------------
export function useReports(filters: ReportFilters) {
  return useQuery({
    queryKey: ['behavior-reports', filters],
    queryFn: () => fetchReports(filters),
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ReportFormValues) => createReport(values),
    onSuccess: (report) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'reports',
        recordId: report.id,
        newData: { student_id: report.student_id, points: report.points, rule_id: report.rule_id },
      })
      void qc.invalidateQueries({ queryKey: ['behavior-reports'] })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: (_data, variables) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'reports', recordId: variables })
      void qc.invalidateQueries({ queryKey: ['behavior-reports'] })
      void qc.invalidateQueries({ queryKey: ['students'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useStudentsSearch(search: string) {
  return useQuery({
    queryKey: ['students', 'search', search],
    queryFn: () => searchStudents(search),
    staleTime: 30_000,
  })
}
