export interface ClassRow {
  id: string
  name: string
  grade: string | null
  major: string | null
  homeroom_teacher_id: string | null
  academic_year_id: string | null
  created_at?: string
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
