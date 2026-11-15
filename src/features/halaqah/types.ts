import type { AttendanceStatus } from '../attendance/types'

export interface HalaqahGroup {
  id: string
  name: string
  musyrif_id: string | null
  gender: 'L' | 'P' | null
  place: string | null
  schedule: string | null
  capacity: number
  notes: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  teachers?: { id: string; name: string } | null
  /** hasil embed count PostgREST: [{ count: n }] */
  members?: { count: number }[]
}

export interface HalaqahMember {
  id: string
  group_id: string
  student_id: string
  joined_at: string
  deleted_at: string | null
  students?: {
    id: string
    name: string
    registration_code: string
    classes?: { name: string } | null
  } | null
}

export interface HalaqahFormValues {
  name: string
  musyrif_id?: string
  gender?: 'L' | 'P'
  place?: string
  schedule?: string
  capacity: number
  notes?: string
}

// ─── Presensi halaqah ────────────────────────────────────────────────────────

/** Sesi halaqah — paritas V1: Mengaji Wafa & Tahfidz. */
export type HalaqahSession = 'mengaji' | 'tahfidz'

/** jsonb days: { "1": "H", "2": "S", ... } — key hari tanpa status dihapus. */
export type HalaqahAttendanceDays = Record<string, AttendanceStatus>

export interface HalaqahAttendanceRow {
  id: string
  group_id: string
  student_id: string
  session: HalaqahSession
  year: number
  month: number
  days: HalaqahAttendanceDays
  notes: string | null
  updated_at?: string
}

export interface HalaqahAttendanceUpsert {
  group_id: string
  student_id: string
  session: HalaqahSession
  year: number
  month: number
  days: HalaqahAttendanceDays
  notes: string | null
  updated_by: string | null
}

// ─── Setoran hafalan (tahfidz) ───────────────────────────────────────────────

export type TahfidzKind = 'ziyadah' | 'murojaah'
export type TahfidzQuality = 'excellent' | 'good' | 'needs_work'

export interface TahfidzRecord {
  id: string
  student_id: string
  teacher_id: string | null
  kind: TahfidzKind
  surah: string
  from_ayat: number | null
  to_ayat: number | null
  quality: TahfidzQuality | null
  note: string | null
  recorded_at: string
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  student?: { id: string; name: string; registration_code: string } | null
  teacher?: { id: string; name: string } | null
}

export type TahfidzKindFilter = '' | TahfidzKind

export interface TahfidzFilters {
  search?: string
  kind?: TahfidzKindFilter
  quality?: TahfidzQuality | ''
  from?: string
  to?: string
  /** Scope musyrif: hanya setoran santri anggota kelompok guru tsb. */
  studentIds?: string[]
  page: number
  pageSize: number
}

export interface TahfidzFormValues {
  student_id: string
  kind: TahfidzKind
  surah: string
  from_ayat?: number
  to_ayat?: number
  quality?: TahfidzQuality
  teacher_id?: string
  note?: string
  recorded_at: string
}

export interface TahfidzStats {
  total: number
  ziyadah: number
  murojaah: number
  week: number
}
