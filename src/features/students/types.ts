export type StudentStatus = 'aktif' | 'lulus' | 'pindah' | 'keluar'
export type Gender = 'L' | 'P'

export interface Student {
  id: string
  registration_code: string
  pin: string | null
  nisn: string | null
  nis: string | null
  nik: string | null
  name: string
  gender: Gender | null
  status: StudentStatus
  total_points: number
  class_id: string | null
  dorm_id: string | null
  phone: string | null
  photo_url: string | null
  tags: string[] | null
  is_pinned: boolean | null
  guardian_name: string | null
  guardian_relation: string | null
  birth_place: string | null
  birth_date: string | null
  religion: string | null
  address: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  classes?: { name: string } | null
  dorms?: { name: string } | null
}

export interface StudentFormValues {
  name: string
  registration_code: string
  class_id: string
  dorm_id?: string
  gender?: Gender
  status: StudentStatus
  nisn?: string
  nis?: string
  phone?: string
  birth_place?: string
  birth_date?: string
  religion?: string
  address?: string
  guardian_name?: string
  guardian_relation?: string
  tags?: string[]
}

export type SortOption =
  | 'name_asc'
  | 'name_desc'
  | 'class_asc'
  | 'class_desc'
  | 'status_asc'
  | 'status_desc'
  | 'points_desc'
  | 'points_asc'
  | 'updated_desc'

export type MissingField = 'photo' | 'phone' | 'nisn' | 'any'
export type PointMode = 'negative' | 'positive'

export interface StudentFilters {
  search?: string
  classId?: string
  gender?: Gender
  status?: StudentStatus
  sortBy?: SortOption
  missing?: MissingField
  pointMode?: PointMode
  page: number
  pageSize: number
}

export interface StudentBrief {
  id: string
  name: string
  registration_code: string
}

export interface StudentTopPerformer {
  name: string
  points: number
}

export interface StudentWorstClass {
  id: string
  name: string
  avg: number
  count: number
}

export interface StudentStats {
  total: number
  putra: number
  putri: number
  avgPoints: number
  riskCount: number
  incompleteCount: number
  /** rata-rata poin dari laporan 7 hari terakhir, null bila tidak ada siswa */
  trend7d: number | null
  topPerformer: StudentTopPerformer | null
  worstClass: StudentWorstClass | null
}
