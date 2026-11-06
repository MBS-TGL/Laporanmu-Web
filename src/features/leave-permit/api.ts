import { supabase } from '../../lib/supabase'
import type { PermitFormValues, PermitStatus, PermitStudentBrief } from './types'

const SELECT_STR = '*, student:students(name, registration_code), issuer:profiles(name)'

export async function fetchPermits(status?: PermitStatus): Promise<
  import('./types').LeavePermit[]
> {
  let query = supabase.from('leave_permits').select(SELECT_STR).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as import('./types').LeavePermit[]
}

export async function fetchPermitStudents(search: string): Promise<PermitStudentBrief[]> {
  let query = supabase
    .from('students')
    .select('id, name, registration_code, phone')
    .is('deleted_at', null)
    .order('name')
    .limit(20)
  if (search) query = query.ilike('name', `%${search}%`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as PermitStudentBrief[]
}

export async function createPermit(
  values: PermitFormValues,
  issuedBy: string | null,
): Promise<import('./types').LeavePermit> {
  const returnDeadline = new Date(`${values.return_date}T${values.return_time}:00`).toISOString()
  const { data, error } = await supabase
    .from('leave_permits')
    .insert({
      student_id: values.student_id,
      phone: values.phone || null,
      destination: values.destination,
      purpose: values.purpose,
      leave_date: values.leave_date,
      return_deadline: returnDeadline,
      status: 'issued',
      issued_by: issuedBy,
    })
    .select(SELECT_STR)
    .single()
  if (error) throw error
  return data as import('./types').LeavePermit
}

export async function updatePermitStatus(id: string, status: PermitStatus): Promise<void> {
  const { error } = await supabase.from('leave_permits').update({ status }).eq('id', id)
  if (error) throw error
}

// Terbitkan → santri berangkat: catat ke gate_logs + link ke izin
export async function confirmDeparture(
  permit: import('./types').LeavePermit,
  recordedBy: string | null,
): Promise<void> {
  const { data: gateLog, error: gateError } = await supabase
    .from('gate_logs')
    .insert({
      student_id: permit.student_id,
      direction: 'keluar',
      occurred_at: new Date().toISOString(),
      recorded_by: recordedBy,
      note: `Izin pulang: ${permit.destination} — ${permit.purpose}`,
    })
    .select('id')
    .single()
  if (gateError) throw gateError

  const { error } = await supabase
    .from('leave_permits')
    .update({ status: 'departed', gate_log_id: (gateLog as { id: string }).id })
    .eq('id', permit.id)
  if (error) throw error
}

// Santri kembali: tandai returned / overdue (lewat batas)
export async function confirmReturn(permit: import('./types').LeavePermit): Promise<void> {
  const isOverdue = new Date() > new Date(permit.return_deadline)
  const { error } = await supabase
    .from('leave_permits')
    .update({ status: isOverdue ? 'overdue' : 'returned' })
    .eq('id', permit.id)
  if (error) throw error
  if (permit.gate_log_id) {
    await supabase.from('gate_logs').update({ direction: 'masuk' }).eq('id', permit.gate_log_id)
  }
}
