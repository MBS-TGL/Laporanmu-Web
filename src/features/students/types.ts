export type StudentStatus = 'active' | 'graduated' | 'transferred' | 'left'
export type Gender = 'L' | 'P'

/** Snapshot jejak kelulusan — dipakai untuk undo pembatalan kelulusan massal */
export type GraduationSnapshot = Pick<
  Student,
  'id' | 'graduated_at' | 'graduation_year' | 'last_class_id'
>

/** Hubungan orang tua/wali — baris student_guardians (0020) */
export type GuardianRelation = 'father' | 'mother' | 'guardian'

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
  /** kolom perluasan Dapodik (0020) — semuanya nullable */
  nickname: string | null
  kk_number: string | null
  child_status: string | null
  child_number: number | null
  siblings_count: number | null
  home_phone: string | null
  origin_school: string | null
  origin_graduation_year: number | null
  admitted_at: string | null
  uniform_size: string | null
  /** diisi saat siswa diluluskan */
  graduated_at: string | null
  graduation_year: number | null
  /** snapshot kelas terakhir sebelum kelulusan (class_id dikosongkan) */
  last_class_id: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  classes?: { name: string } | null
  dorms?: { name: string } | null
  last_class?: { name: string } | null
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
  nik?: string
  phone?: string
  birth_place?: string
  birth_date?: string
  religion?: string
  address?: string
  guardian_name?: string
  guardian_relation?: string
  tags?: string[]
  nickname?: string
  kk_number?: string
  child_status?: string
  child_number?: number
  siblings_count?: number
  home_phone?: string
  origin_school?: string
  origin_graduation_year?: number
  admitted_at?: string
  uniform_size?: string
  /** baris ayah/ibu/wali — disimpan via RPC save_student_guardians */
  guardians?: StudentGuardianInput[]
}

export interface StudentGuardian {
  id: string
  student_id: string
  relation: GuardianRelation
  name: string | null
  nik: string | null
  birth_year: number | null
  education: string | null
  occupation: string | null
  income_range: string | null
  phone: string | null
  address: string | null
}

/** Payload satu baris guardian dari form — field kosong jadi undefined */
export interface StudentGuardianInput {
  relation: GuardianRelation
  name?: string
  nik?: string
  birth_year?: number
  education?: string
  occupation?: string
  income_range?: string
  phone?: string
  address?: string
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
  | 'graduated_desc'
  | 'graduated_asc'
  | 'year_desc'
  | 'year_asc'

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
  /** filter khusus alumni (halaman Alumni) */
  graduationYear?: number
  lastClassId?: string
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

/** Rekap kelengkapan data satu kelas (PRD §6.1b poin 4) */
export interface ClassCompleteness {
  id: string
  name: string
  total: number
  incomplete: number
  percent: number
}

export interface StudentStats {
  total: number
  male: number
  female: number
  avgPoints: number
  riskCount: number
  incompleteCount: number
  /** kelengkapan per kelas, terendah dulu */
  classCompleteness: ClassCompleteness[]
  /** kelas dengan % kelengkapan terendah (hanya bila ada field kosong), null bila semua lengkap */
  worstCompleteness: ClassCompleteness | null
  /** rata-rata poin dari laporan 7 hari terakhir, null bila tidak ada siswa */
  trend7d: number | null
  topPerformer: StudentTopPerformer | null
  worstClass: StudentWorstClass | null
}
