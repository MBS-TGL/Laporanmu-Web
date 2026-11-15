export type TeacherStatus = 'active' | 'inactive' | 'on_leave'
export type TeacherType = 'guru' | 'pengabdian' | 'karyawan'
export type TeacherEmployment = 'GTY' | 'GTT' | 'Honorer' | 'PNS' | 'ASNP3K'
export type Gender = 'L' | 'P'

export const WORK_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const

export interface Teacher {
  id: string
  profile_id: string | null
  name: string
  gender: Gender | null
  nik: string | null
  nip: string | null
  nuptk: string | null
  nbm: string | null
  phone: string | null
  email: string | null
  subject: string | null
  status: TeacherStatus
  join_date: string | null
  address: string | null
  notes: string | null
  photo_url: string | null
  // Field tambahan (migration 0044)
  employment_status: TeacherEmployment | null
  type: TeacherType | null
  birth_place: string | null
  birth_date: string | null
  teaching_hours: number | null
  last_education: string | null
  major: string | null
  graduation_year: number | null
  work_days: string[] | null
  fingerspot_name: string | null
  is_pinned: boolean
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface TeacherFormValues {
  name: string
  nbm?: string
  subject?: string
  gender?: Gender
  phone?: string
  email?: string
  status: TeacherStatus
  join_date?: string
  nik?: string
  nip?: string
  nuptk?: string
  notes?: string
  address?: string
  photo_url?: string
  employment_status?: TeacherEmployment
  type?: TeacherType
  birth_place?: string
  birth_date?: string
  teaching_hours?: number
  last_education?: string
  major?: string
  graduation_year?: number
  work_days?: string[]
  fingerspot_name?: string
}

export type TeacherSort =
  | 'name_asc'
  | 'name_desc'
  | 'nbm_asc'
  | 'nbm_desc'
  | 'status_asc'
  | 'status_desc'
  | 'join_desc'
  | 'join_asc'

export interface TeacherFilters {
  search?: string
  status?: TeacherStatus
  gender?: Gender
  /** Filter mapel — server-side (dipakai ekspor) & client-side di halaman */
  subject?: string
  /** Jenis tugas: guru / pengabdian / karyawan */
  type?: TeacherType
  /** Guru tanpa nomor WhatsApp */
  missingWa?: boolean
  sortBy?: TeacherSort
  page: number
  pageSize: number
}

export const TEACHER_TYPE_LABEL: Record<TeacherType, string> = {
  guru: 'Guru',
  pengabdian: 'Pengabdian',
  karyawan: 'Karyawan',
}

export const TEACHER_STATUS_LABEL: Record<TeacherStatus, string> = {
  active: 'Aktif',
  inactive: 'Nonaktif',
  on_leave: 'Cuti',
}

export const TEACHER_EMPLOYMENT_LABEL: Record<TeacherEmployment, string> = {
  GTY: 'Tetap Yayasan (GTY/KTY)',
  GTT: 'Tidak Tetap (GTT/KTT)',
  Honorer: 'Honorer',
  PNS: 'PNS DPK',
  ASNP3K: 'ASN P3K',
}
