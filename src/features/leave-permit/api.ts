import { supabase } from '../../lib/supabase'
import type {
  LeavePermit,
  PermitBulkRow,
  PermitFormValues,
  PermitStatus,
  PermitStudentBrief,
} from './types'

const SELECT_STR =
  '*, student:students(name, registration_code, phone, classes!students_class_id_fkey(id, name)), issuer:profiles(name)'

export async function fetchPermits(status?: PermitStatus): Promise<LeavePermit[]> {
  let query = supabase.from('leave_permits').select(SELECT_STR).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LeavePermit[]
}

export async function fetchPermitsByIds(ids: string[]): Promise<LeavePermit[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('leave_permits').select(SELECT_STR).in('id', ids)
  if (error) throw error
  return (data ?? []) as LeavePermit[]
}

/** Lookup seluruh santri aktif — dipakai impor (pencocokan kode/nama) & pulang massal */
export async function fetchAllPermitStudents(): Promise<PermitStudentBrief[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, registration_code, phone, classes!students_class_id_fkey(id, name)')
    .is('deleted_at', null)
    .order('name')
    .limit(5000)
  if (error) throw error
  // Tipe ter-generate embed classes berbentuk array sedangkan konsumen
  // memakai objek tunggal — konversi lewat unknown
  return (data ?? []) as unknown as PermitStudentBrief[]
}

export async function fetchPermitStudentByCode(code: string): Promise<PermitStudentBrief | null> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, registration_code, phone, classes!students_class_id_fkey(id, name)')
    .is('deleted_at', null)
    .ilike('registration_code', code)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as PermitStudentBrief) ?? null
}

/** Kunci izin aktif `${student_id}|${leave_date}` — deteksi duplikat saat impor */
export async function fetchActivePermitKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('leave_permits')
    .select('student_id, leave_date')
    .in('status', ['issued', 'departed'])
  if (error) throw error
  return (data ?? []).map((r) => `${r.student_id}|${r.leave_date}`)
}

export async function createPermit(
  values: PermitFormValues,
  issuedBy: string | null,
): Promise<LeavePermit> {
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
  return data as LeavePermit
}

/** Terbitkan banyak izin sekaligus (pulang massal / impor) — satu batch insert */
export async function createPermitsBulk(
  rows: PermitBulkRow[],
  issuedBy: string | null,
): Promise<LeavePermit[]> {
  if (rows.length === 0) return []
  const { data, error } = await supabase
    .from('leave_permits')
    .insert(
      rows.map((r) => ({
        student_id: r.student_id,
        phone: r.phone || null,
        destination: r.destination,
        purpose: r.purpose,
        leave_date: r.leave_date,
        return_deadline: r.return_deadline,
        status: 'issued',
        issued_by: issuedBy,
      })),
    )
    .select(SELECT_STR)
  if (error) throw error
  return (data ?? []) as LeavePermit[]
}

export async function updatePermit(id: string, values: PermitFormValues): Promise<void> {
  const returnDeadline = new Date(`${values.return_date}T${values.return_time}:00`).toISOString()
  const { error } = await supabase
    .from('leave_permits')
    .update({
      student_id: values.student_id,
      phone: values.phone || null,
      destination: values.destination,
      purpose: values.purpose,
      leave_date: values.leave_date,
      return_deadline: returnDeadline,
    })
    .eq('id', id)
  if (error) throw error
}

export async function updatePermitStatus(id: string, status: PermitStatus): Promise<void> {
  const { error } = await supabase.from('leave_permits').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deletePermit(id: string): Promise<void> {
  const { error } = await supabase.from('leave_permits').delete().eq('id', id)
  if (error) throw error
}

// Terbitkan → santri berangkat: catat ke gate_logs + link ke izin
export async function confirmDeparture(
  permit: LeavePermit,
  recordedBy: string | null,
): Promise<void> {
  const { data: gateLog, error: gateError } = await supabase
    .from('gate_logs')
    .insert({
      student_id: permit.student_id,
      direction: 'exit',
      occurred_at: new Date().toISOString(),
      recorded_by: recordedBy,
      note: `Izin keluar: ${permit.destination} — ${permit.purpose}`,
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
export async function confirmReturn(permit: LeavePermit): Promise<void> {
  const isOverdue = new Date() > new Date(permit.return_deadline)
  const { error } = await supabase
    .from('leave_permits')
    .update({ status: isOverdue ? 'overdue' : 'returned' })
    .eq('id', permit.id)
  if (error) throw error
  if (permit.gate_log_id) {
    await supabase.from('gate_logs').update({ direction: 'entry' }).eq('id', permit.gate_log_id)
  }
}

// ------------------------------------------------------------
// Export CSV / XLSX
// ------------------------------------------------------------