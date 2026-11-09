export type Semester = 'Odd' | 'Even'

export interface AcademicYear {
  id: string
  name: string
  semester: Semester | null
  start_date: string | null
  end_date: string | null
  is_active: boolean | null
  is_locked: boolean | null
  curriculum: string | null
  description: string | null
  notes: string | null
  deleted_at: string | null
  created_at?: string
}

export interface YearFormValues {
  name: string
  semester: Semester
  start_date?: string
  end_date?: string
  curriculum?: string
  makeActive?: boolean
}

export interface AcademicYearFilters {
  search?: string
  page: number
  pageSize: number
}
