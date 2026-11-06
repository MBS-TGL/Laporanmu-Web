export interface PointRule {
  id: string
  name: string
  points: number
  category: string | null
  is_negative: boolean
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface PointRuleFormValues {
  name: string
  points: number
  category?: string
}

export interface PointRuleFilters {
  search?: string
  page: number
  pageSize: number
}

export interface BehaviorReport {
  id: string
  student_id: string
  rule_id: string
  reporter_id: string | null
  points: number
  notes: string | null
  reported_at: string
  created_at?: string
  student?: { name: string; registration_code: string } | null
  rule?: { name: string; category: string | null } | null
  reporter?: { name: string } | null
}

export type ReportKind = '' | 'negative' | 'positive'

export interface ReportFilters {
  search?: string
  ruleId?: string
  kind?: ReportKind
  from?: string
  to?: string
  page: number
  pageSize: number
}

export interface ReportFormValues {
  student_id: string
  rule_id: string
  notes?: string
  reported_at: string
}
