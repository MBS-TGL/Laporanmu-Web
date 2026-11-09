export type SuspensionStatus = 'active' | 'completed' | 'cancelled'
export type SuspensionLevel = 'SMP' | 'SMA'
export type SuspensionTaskStatus = 'pending' | 'submitted' | 'graded'

export interface Suspension {
  id: string
  student_id: string
  level: SuspensionLevel
  start_date: string
  end_date: string
  reason_summary: string
  violation_report_id: string | null
  status: SuspensionStatus
  created_by: string | null
  created_at?: string
  updated_at?: string
  student?: { name: string; registration_code: string } | null
}

export interface SuspensionToken {
  id: string
  suspension_id: string
  token_prefix: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  use_count: number
  created_at?: string
}

export interface SuspensionTask {
  id: string
  suspension_id: string
  subject: string
  title: string
  description: string | null
  due_date: string | null
  created_by: string
  created_by_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface SuspensionSubmission {
  id: string
  task_id: string
  suspension_id: string
  photo_count?: number
  note: string | null
  status: SuspensionTaskStatus
  score: number | null
  teacher_comment: string | null
  submitted_at: string
  updated_at?: string
}

export interface SuspensionFollowup {
  id: string
  suspension_id: string
  contacted_at: string
  method: 'call' | 'wa' | 'visit'
  notes: string
  created_at?: string
}

export interface SuspensionDailyLog {
  entries: Record<string, unknown>
  note_optional: string | null
  submitted_at: string
  updated_at: string
}

// ---- Bentuk RPC publik (halaman wali) ----

export interface GuardianTokenInfo {
  suspension_id: string
  student_name: string
  class_name: string | null
  level: SuspensionLevel
  start_date: string
  end_date: string
  days: string[]
}

export interface GuardianTemplateItem {
  id: string
  block_key: 'dinihari' | 'pagi' | 'sore' | 'malam'
  item_key: string
  label_id: string
  input_type: 'check' | 'choice' | 'text' | 'surah' | 'wafa' | 'tugas_ref'
  options: string[]
  sort_order: number
}

export interface GuardianTask {
  id: string
  subject: string
  title: string
  description: string | null
  due_date: string | null
  created_at: string
}

export interface GuardianSubmission {
  task_id: string
  status: SuspensionTaskStatus
  score: number | null
  teacher_comment: string | null
  photo_count: number
  note: string | null
  submitted_at: string
}

export interface GuardianDayData {
  templates: GuardianTemplateItem[]
  tasks: GuardianTask[]
  log: SuspensionDailyLog | null
  submissions: GuardianSubmission[]
}

export interface GuardianLogEntry {
  checked?: boolean
  value?: string
  text?: string
  surah?: string
  ayat?: string
  wafa_jilid?: string
  wafa_halaman?: string
}

export type GuardianEntries = Record<string, GuardianLogEntry>
