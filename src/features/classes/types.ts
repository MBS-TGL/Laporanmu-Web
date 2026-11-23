/** Urutan sort halaman kelas — pasangan [asc, desc] di components/ClassColumns SORT_PAIRS */
export type ClassSort = 'name_asc' | 'name_desc' | 'grade_asc' | 'grade_desc' | 'count_desc' | 'count_asc'

export interface ClassRow {
  id: string
  name: string
  grade: string | null
  major: string | null
  homeroom_teacher_id: string | null
  academic_year_id: string | null
  created_at?: string
  deleted_at?: string | null
  students?: { count: number }[] | { count: number } | null
  homeroom_teacher?: { name: string } | null
  academic_year?: { name: string } | null
}

export interface ClassFormValues {
  name: string
  grade: string
  major?: string
  academic_year_id: string
  homeroom_teacher_id?: string
}

export interface ClassFilters {
  search?: string
  academicYearId?: string
  page: number
  pageSize: number
}

// ── class_subjects ──────────────────────────────────────────

export interface ClassSubject {
  id: string
  class_id: string
  subject_id: string
  teacher_id: string | null
  academic_year_id: string
  kkm_override: number | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  subjects?: { id: string; name: string; code: string | null; kkm: number | null; weekly_hours: number } | null
  teachers?: { id: string; name: string } | null
  classes?: { id: string; name: string; grade: string | null } | null
}

export interface ClassSubjectRow {
  subject_id: string
  teacher_id: string | null
  kkm_override: number | null
}
