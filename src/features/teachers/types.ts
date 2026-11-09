export type TeacherStatus = 'active' | 'inactive' | 'on_leave'
export type Gender = 'L' | 'P'

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
}

export interface TeacherFilters {
  search?: string
  status?: TeacherStatus
  gender?: Gender
  page: number
  pageSize: number
}
