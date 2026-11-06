export type PermitStatus = 'issued' | 'departed' | 'returned' | 'overdue' | 'cancelled'

export interface LeavePermit {
  id: string
  student_id: string
  phone: string | null
  destination: string
  purpose: string
  leave_date: string
  return_deadline: string
  status: PermitStatus
  issued_by: string | null
  gate_log_id: string | null
  created_at?: string
  updated_at?: string
  student?: { name: string; registration_code: string } | null
  issuer?: { name: string } | null
}

export interface PermitFormValues {
  student_id: string
  phone?: string
  destination: string
  purpose: string
  leave_date: string
  return_date: string
  return_time: string
}

export interface PermitStudentBrief {
  id: string
  name: string
  registration_code: string
  phone: string | null
}
