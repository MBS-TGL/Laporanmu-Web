import { supabase } from '../../lib/supabase'
import type {
  Suspension,
  SuspensionStatus,
  SuspensionTask,
  SuspensionTaskStatus,
  SuspensionFollowup,
} from './types'

const SUS_SELECT = '*, student:students(id, name, registration_code)'

// ------------------------------------------------------------
// Staff: suspensions
// ------------------------------------------------------------
export async function fetchSuspensions(): Promise<Suspension[]> {
  const { data, error } = await supabase
    .from('suspensions')
    .select(SUS_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Suspension[]
}

export async function fetchSuspensionById(id: string): Promise<Suspension> {
  const { data, error } = await supabase
    .from('suspensions')
    .select(SUS_SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Suspension
}

export interface CreateSuspensionInput {
  student_id: string
  level: 'SMP' | 'SMA'
  start_date: string
  end_date: string
  reason_summary: string
  violation_report_id: string | null
  createdBy: string | null
}

export async function createSuspension(input: CreateSuspensionInput): Promise<Suspension> {
  const { data, error } = await supabase
    .from('suspensions')
    .insert({
      student_id: input.student_id,
      level: input.level,
      start_date: input.start_date,
      end_date: input.end_date,
      reason_summary: input.reason_summary,
      violation_report_id: input.violation_report_id,
      created_by: input.createdBy,
    })
    .select(SUS_SELECT)
    .single()
  if (error) throw error
  return data as Suspension
}

export async function updateSuspensionStatus(
  id: string,
  status: SuspensionStatus,
): Promise<void> {
  const { error } = await supabase.from('suspensions').update({ status }).eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Staff: tokens
// ------------------------------------------------------------
export interface GenerateTokenResult {
  id: string
  token: string // raw — hanya muncul sekali di sini
  expires_at: string
}

export async function generateToken(
  suspensionId: string,
  daysValid: number,
  createdBy: string | null,
): Promise<GenerateTokenResult> {
  // 32 byte acak → 43 char base64url
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const raw = Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 43)

  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString()

  // hash dihitung DB-side lewat RPC mini agar raw tidak pernah dikirim balik?
  // Tidak — hash dihitung di sini (pgcrypto.digest pada RPC publik memakai
  // sha256 hex dari raw yang sama).
  const hash = await sha256Hex(raw)

  const { data, error } = await supabase
    .from('suspension_tokens')
    .insert({
      suspension_id: suspensionId,
      token_hash: hash,
      token_prefix: raw.slice(0, 8),
      expires_at: expiresAt,
      created_by: createdBy,
    })
    .select('id, token_prefix, expires_at')
    .single()
  if (error) throw error
  return { ...(data as { id: string; token_prefix: string; expires_at: string }), token: raw }
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function fetchTokens(suspensionId: string) {
  const { data, error } = await supabase
    .from('suspension_tokens')
    .select('id, token_prefix, expires_at, revoked_at, last_used_at, use_count, created_at')
    .eq('suspension_id', suspensionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as {
    id: string
    token_prefix: string
    expires_at: string
    revoked_at: string | null
    last_used_at: string | null
    use_count: number
    created_at?: string
  }[]
}

export async function revokeToken(tokenId: string, revokedBy: string | null): Promise<void> {
  const { error } = await supabase
    .from('suspension_tokens')
    .update({ revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq('id', tokenId)
  if (error) throw error
}

// ------------------------------------------------------------
// Staff: tasks
// ------------------------------------------------------------
export async function fetchTasks(suspensionId: string): Promise<SuspensionTask[]> {
  const { data, error } = await supabase
    .from('suspension_tasks')
    .select('*, creator:profiles(name)')
    .eq('suspension_id', suspensionId)
    .order('due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []).map((t) => {
    const row = t as unknown as SuspensionTask & { creator?: { name: string } | null }
    return { ...row, created_by_name: row.creator?.name ?? null }
  })
}

export interface TaskFormInput {
  suspensionId: string
  subject: string
  title: string
  description?: string
  dueDate?: string
  createdBy: string | null
}

export async function createTask(input: TaskFormInput): Promise<SuspensionTask> {
  const { data, error } = await supabase
    .from('suspension_tasks')
    .insert({
      suspension_id: input.suspensionId,
      subject: input.subject,
      title: input.title,
      description: input.description || null,
      due_date: input.dueDate || null,
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as SuspensionTask
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('suspension_tasks').delete().eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Staff: submissions (review + penilaian)
// ------------------------------------------------------------
export interface StaffSubmission {
  id: string
  task_id: string
  status: SuspensionTaskStatus
  score: number | null
  teacher_comment: string | null
  note: string | null
  photo_data: string[]
  submitted_at: string
}

export async function fetchSubmissions(suspensionId: string): Promise<StaffSubmission[]> {
  const { data, error } = await supabase
    .from('suspension_task_submissions')
    .select('id, task_id, status, score, teacher_comment, note, photo_data, submitted_at')
    .eq('suspension_id', suspensionId)
  if (error) throw error
  return (data ?? []) as StaffSubmission[]
}

export interface GradeInput {
  id: string
  score: number
  comment?: string
  gradedBy: string | null
}

export async function gradeSubmission(input: GradeInput): Promise<void> {
  const { error } = await supabase
    .from('suspension_task_submissions')
    .update({
      status: 'graded',
      score: input.score,
      teacher_comment: input.comment || null,
      graded_by: input.gradedBy,
      graded_at: new Date().toISOString(),
    })
    .eq('id', input.id)
  if (error) throw error
}

// ------------------------------------------------------------
// Staff: daily logs + followups
// ------------------------------------------------------------
export interface StaffDailyLog {
  id: string
  log_date: string
  entries: Record<string, unknown>
  note_optional: string | null
  updated_at: string
}

export async function fetchDailyLogs(suspensionId: string): Promise<StaffDailyLog[]> {
  const { data, error } = await supabase
    .from('suspension_daily_logs')
    .select('id, log_date, entries, note_optional, updated_at')
    .eq('suspension_id', suspensionId)
    .order('log_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as StaffDailyLog[]
}

export async function fetchFollowups(suspensionId: string): Promise<SuspensionFollowup[]> {
  const { data, error } = await supabase
    .from('suspension_followups')
    .select('*')
    .eq('suspension_id', suspensionId)
    .order('contacted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SuspensionFollowup[]
}

export async function createFollowup(input: {
  suspensionId: string
  method: SuspensionFollowup['method']
  notes: string
  createdBy: string | null
}): Promise<SuspensionFollowup> {
  const { data, error } = await supabase
    .from('suspension_followups')
    .insert({
      suspension_id: input.suspensionId,
      method: input.method,
      notes: input.notes,
      created_by: input.createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as SuspensionFollowup
}

// ------------------------------------------------------------
// Publik (halaman wali) — semuanya via RPC security-definer
// ------------------------------------------------------------
export async function rpcValidateToken(token: string) {
  const { data, error } = await supabase.rpc('validate_suspension_token', { p_token: token })
  if (error) throw error
  return data as unknown as {
    suspension_id: string
    student_name: string
    class_name: string | null
    level: 'SMP' | 'SMA'
    start_date: string
    end_date: string
    days: string[]
  }
}

export async function rpcGetDay(token: string, date: string) {
  const { data, error } = await supabase.rpc('get_suspension_day', {
    p_token: token,
    p_date: date,
  })
  if (error) throw error
  return data as unknown as {
    templates: {
      id: string
      block_key: 'dinihari' | 'pagi' | 'sore' | 'malam'
      item_key: string
      label_id: string
      input_type: 'check' | 'choice' | 'text' | 'surah' | 'wafa' | 'tugas_ref'
      options: string[]
      sort_order: number
    }[]
    tasks: { id: string; subject: string; title: string; description: string | null; due_date: string | null }[]
    log: {
      entries: Record<string, unknown>
      note_optional: string | null
      submitted_at: string
      updated_at: string
    } | null
    submissions: {
      task_id: string
      status: SuspensionTaskStatus
      score: number | null
      teacher_comment: string | null
      photo_count: number
      note: string | null
      submitted_at: string
    }[]
  }
}

export async function rpcSaveLog(token: string, date: string, entries: Record<string, unknown>, note: string) {
  const { data, error } = await supabase.rpc('save_suspension_log', {
    p_token: token,
    p_date: date,
    p_entries: entries,
    p_note: note,
  })
  if (error) throw error
  return data as unknown as { ok: boolean; log_id: string }
}

export async function rpcSubmitTask(
  token: string,
  taskId: string,
  photosBase64: string[],
  note: string,
) {
  const { data, error } = await supabase.rpc('submit_suspension_task', {
    p_token: token,
    p_task_id: taskId,
    p_photos_base64: photosBase64,
    p_note: note,
  })
  if (error) throw error
  return data as unknown as { ok: boolean; submission_id: string; photo_count: number }
}
