import { supabase } from '../../lib/supabase'
import type {
  BehaviorReport,
  PointRule,
  PointRuleFilters,
  RuleFormValues,
  ReportFilters,
  ReportFormValues,
} from './types'

// students!inner agar filter embed (students.name) bisa dipakai
const REPORT_SELECT =
  '*, student:students!inner(id, name, registration_code), rule:point_rules(id, name, category), reporter:profiles(name)'

// ------------------------------------------------------------
// Aturan poin
// ------------------------------------------------------------

// Query dasar + filter bersama (dipakai list & ekspor CSV agar konsisten).
// Search di or() adalah string raw PostgREST, jadi koma/kurung dibersihkan.
function baseRuleQuery(filters: Partial<PointRuleFilters>) {
  const { search, category, kind } = filters
  const term = search?.replace(/[,()\\]/g, ' ').trim()

  let query = supabase
    .from('point_rules')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  if (term) query = query.or(`name.ilike.%${term}%,category.ilike.%${term}%`)
  if (category) query = query.eq('category', category)
  if (kind === 'negative') query = query.lt('points', 0)
  if (kind === 'positive') query = query.gt('points', 0)

  return query
}

function sortedRuleQuery(filters: Partial<PointRuleFilters>) {
  return baseRuleQuery(filters)
    .order(filters.sort ?? 'points', { ascending: filters.dir !== 'desc' })
    .order('name', { ascending: true })
}

export async function fetchPointRules(
  filters: PointRuleFilters,
): Promise<{ data: PointRule[]; total: number }> {
  const from = (filters.page - 1) * filters.pageSize

  const { data, count, error } = await sortedRuleQuery(filters).range(from, from + filters.pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as PointRule[], total: count ?? 0 }
}

// Semua aturan yang lolos filter (tanpa pagination) untuk ekspor CSV
export async function fetchPointRulesForExport(
  filters: Omit<PointRuleFilters, 'page' | 'pageSize'>,
): Promise<PointRule[]> {
  const { data, error } = await sortedRuleQuery(filters)
  if (error) throw error
  return (data ?? []) as PointRule[]
}

export async function createPointRule(values: RuleFormValues): Promise<PointRule> {
  const { data, error } = await supabase
    .from('point_rules')
    .insert({
      name: values.name,
      points: values.points,
      category: values.category || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as PointRule
}

export async function updatePointRule(id: string, values: RuleFormValues): Promise<PointRule> {
  const { data, error } = await supabase
    .from('point_rules')
    .update({
      name: values.name,
      points: values.points,
      category: values.category || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as PointRule
}

export async function softDeletePointRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('point_rules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function pointRuleNameExists(name: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from('point_rules')
    .select('id', { count: 'exact', head: true })
    .eq('name', name)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}

// ------------------------------------------------------------
// Catatan poin (pelanggaran & prestasi)
// ------------------------------------------------------------
export async function fetchReports(
  filters: ReportFilters,
): Promise<{ data: BehaviorReport[]; total: number }> {
  const { search, ruleId, kind, from, to, page, pageSize } = filters
  const fromIdx = (page - 1) * pageSize

  let query = supabase.from('reports').select(REPORT_SELECT, { count: 'exact' })

  if (search) query = query.ilike('students.name', `%${search}%`)
  if (ruleId) query = query.eq('rule_id', ruleId)
  if (kind === 'negative') query = query.lt('points', 0)
  if (kind === 'positive') query = query.gt('points', 0)
  if (from) query = query.gte('reported_at', from)
  if (to) query = query.lte('reported_at', to)

  const { data, count, error } = await query
    .order('reported_at', { ascending: false })
    .range(fromIdx, fromIdx + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as unknown as BehaviorReport[], total: count ?? 0 }
}

export async function createReport(values: ReportFormValues): Promise<BehaviorReport> {
  // Poin di-snapshot dari aturan saat pencatatan
  const { data: rule, error: ruleError } = await supabase
    .from('point_rules')
    .select('points')
    .eq('id', values.rule_id)
    .single()
  if (ruleError) throw ruleError

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('reports')
    .insert({
      student_id: values.student_id,
      rule_id: values.rule_id,
      reporter_id: userData.user?.id ?? null,
      points: (rule as { points: number }).points,
      notes: values.notes || null,
      reported_at: values.reported_at,
    })
    .select(REPORT_SELECT)
    .single()

  if (error) throw error
  return data as unknown as BehaviorReport
}

export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', id)
  if (error) throw error
}

// Riwayat poin satu siswa (dipakai drawer detail siswa)
export async function fetchReportsByStudent(
  studentId: string,
  limit = 10,
): Promise<BehaviorReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*, rule:point_rules(id, name, category), reporter:profiles(name)')
    .eq('student_id', studentId)
    .order('reported_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as BehaviorReport[]
}
