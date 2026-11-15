export type PermitStatus = 'issued' | 'departed' | 'returned' | 'overdue' | 'cancelled'

export interface PermitStudentBriefInfo {
  name: string
  registration_code: string
  phone?: string | null
  classes?: { id: string; name: string } | null
}

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
  student?: PermitStudentBriefInfo | null
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
  classes?: { id: string; name: string } | null
}

/** Baris izin siap simpan untuk terbitkan massal (pulang massal / impor) */
export interface PermitBulkRow {
  student_id: string
  phone: string | null
  destination: string
  purpose: string
  leave_date: string
  return_deadline: string
}

/** Payload satu baris hasil validasi impor (deadline dihitung api) */
export interface PermitImportRowPayload {
  student_id: string
  phone: string | null
  destination: string
  purpose: string
  leave_date: string
  return_date: string
  return_time: string
}
