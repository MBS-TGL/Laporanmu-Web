import { supabase } from '../../../lib/supabase'
import type { AttendanceMachine, IngestPayloadItem, MachineAttendanceLog, MachineFormValues } from './types'

// ── Master Mesin ────────────────────────────────────────────

export async function fetchMachines(): Promise<AttendanceMachine[]> {
  const { data, error } = await supabase
    .from('attendance_machines')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as AttendanceMachine[]
}

export function generateRandomApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = 'lm_live_'
  for (let i = 0; i < 24; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

export async function createMachine(values: MachineFormValues): Promise<AttendanceMachine> {
  const { data, error } = await supabase
    .from('attendance_machines')
    .insert({
      name: values.name.trim(),
      serial_no: values.serial_no.trim(),
      location: values.location?.trim() || null,
      api_key: values.api_key?.trim() || generateRandomApiKey(),
      is_active: values.is_active ?? true,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as AttendanceMachine
}

export async function updateMachine(id: string, values: Partial<MachineFormValues>): Promise<void> {
  const { error } = await supabase
    .from('attendance_machines')
    .update({
      name: values.name?.trim(),
      serial_no: values.serial_no?.trim(),
      location: values.location?.trim(),
      api_key: values.api_key?.trim(),
      is_active: values.is_active,
    })
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteMachine(id: string): Promise<void> {
  const { error } = await supabase
    .from('attendance_machines')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Log Scan Mesin ──────────────────────────────────────────

const LOG_SELECT =
  'id, machine_id, device_user_id, scan_time, scan_type, matched_student_id, ' +
  'matched_status, synced_at, created_at, ' +
  'attendance_machines(name, serial_no), ' +
  'students(id, name, registration_code, class_id, classes!students_class_id_fkey(name))'

export async function fetchMachineLogs(filters: {
  date?: string
  machineId?: string
  matchedStatus?: string
  limit?: number
}): Promise<MachineAttendanceLog[]> {
  let q = supabase
    .from('machine_attendance_logs')
    .select(LOG_SELECT)
    .order('scan_time', { ascending: false })
    .limit(filters.limit ?? 200)

  if (filters.date) {
    q = q.gte('scan_time', `${filters.date}T00:00:00Z`).lte('scan_time', `${filters.date}T23:59:59Z`)
  }
  if (filters.machineId) {
    q = q.eq('machine_id', filters.machineId)
  }
  if (filters.matchedStatus) {
    q = q.eq('matched_status', filters.matchedStatus)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as MachineAttendanceLog[]
}

// Pencocokan manual santri untuk scan yang unmatched
export async function manualMatchLog(logId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('machine_attendance_logs')
    .update({
      matched_student_id: studentId,
      matched_status: 'manual',
    })
    .eq('id', logId)
  if (error) throw error
}

// Sinkronkan scan tanggal tertentu ke tabel student_attendance
export async function syncMachineToAttendance(date: string): Promise<number> {
  const { data, error } = await supabase.rpc('sync_machine_to_daily_attendance', {
    p_date: date,
  })
  if (error) throw error
  return (data as number) ?? 0
}

export interface IngestResult {
  success: boolean
  inserted: number
  matched: number
}

// Ingest batch scan manual dari impor file offline (Excel / CSV)
export async function ingestMachineAttendance(
  serialNo: string,
  apiKey: string,
  logs: IngestPayloadItem[],
): Promise<IngestResult> {
  if (logs.length === 0) return { success: true, inserted: 0, matched: 0 }

  const { data, error } = await supabase.rpc('ingest_machine_attendance', {
    p_serial: serialNo,
    p_api_key: apiKey,
    p_logs: logs,
  })
  if (error) throw error
  return data as IngestResult
}
