export interface AttendanceMachine {
  id: string
  name: string
  serial_no: string
  location: string | null
  api_key: string
  is_active: boolean
  last_seen_at: string | null
  created_at?: string
}

export type ScanType = 'check_in' | 'check_out' | 'auto'
export type MatchStatus = 'matched' | 'unmatched' | 'manual'

export interface MachineAttendanceLog {
  id: string
  machine_id: string | null
  device_user_id: string
  scan_time: string
  scan_type: ScanType
  matched_student_id: string | null
  matched_status: MatchStatus
  synced_at: string | null
  created_at: string
  attendance_machines?: { name: string; serial_no: string } | null
  students?: { id: string; name: string; registration_code: string; class_id: string; classes?: { name: string } | null } | null
}

export interface MachineFormValues {
  name: string
  serial_no: string
  location?: string
  api_key?: string
  is_active?: boolean
}

export interface IngestPayloadItem {
  user_id: string
  time: string
  type?: ScanType
}
