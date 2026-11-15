export interface Ekskul {
  id: string
  name: string
  coach_id: string | null
  schedule: string | null
  place: string | null
  description: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  teachers?: { id: string; name: string } | null
  /** hasil embed count PostgREST: [{ count: n }] */
  members?: { count: number }[]
}

export interface EkskulMember {
  id: string
  ekskul_id: string
  student_id: string
  role: string
  joined_at: string
  deleted_at: string | null
  students?: {
    id: string
    name: string
    registration_code: string
    phone: string | null
    status: string
    classes?: { name: string } | null
  } | null
}

/** Ringkasan santri untuk tambah anggota per kelas. */
export interface StudentBrief {
  id: string
  name: string
  registration_code: string
  classes?: { name: string } | null
}

// Reuse status presensi santri (H/S/I/A/P) — pola reuse lintas feature halaqah
import type { AttendanceStatus } from '../attendance/types'

export interface EkskulFormValues {
  name: string
  coach_id?: string
  schedule?: string
  place?: string
  description?: string
}

// ─── Presensi bulanan (format days sama dengan student_attendance) ─────────

export type EkskulAttendanceDays = Record<string, AttendanceStatus>

export interface EkskulAttendanceRow {
  id: string
  ekskul_id: string
  student_id: string
  year: number
  month: number
  days: EkskulAttendanceDays
  notes: string | null
}

export interface EkskulAttendanceUpsert {
  ekskul_id: string
  student_id: string
  year: number
  month: number
  days: EkskulAttendanceDays
  notes: string | null
  updated_by: string | null
}
