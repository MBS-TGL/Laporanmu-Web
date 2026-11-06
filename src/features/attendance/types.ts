export type AttendanceStatus = 'H' | 'S' | 'I' | 'A' | 'P'

// jsonb days: { "1": "H", "2": "S", ... } — key hari tanpa status dihapus
export type AttendanceDays = Record<string, AttendanceStatus>

export interface StudentAttendanceRow {
  id: string
  student_id: string
  class_id: string
  year: number
  month: number
  days: AttendanceDays
  updated_at?: string
}

export interface AttendanceSummary {
  H: number
  S: number
  I: number
  A: number
  P: number
}
