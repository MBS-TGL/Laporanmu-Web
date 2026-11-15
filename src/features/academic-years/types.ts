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

/** Baris time_slots (0031) — slot jam KBM per tahun ajaran */
export interface TimeSlot {
  id: string
  academic_year_id: string
  name: string
  start_time: string
  end_time: string
  sort_order: number
  is_break: boolean
  deleted_at: string | null
  created_at?: string
}

export interface SlotFormValues {
  name: string
  start_time: string
  end_time: string
  sort_order: number
  is_break: boolean
}

/** Baris rooms (0036) — master ruangan KBM */
export interface Room {
  id: string
  name: string
  code: string | null
  capacity: number | null
  notes: string | null
  is_active: boolean
  deleted_at: string | null
  created_at?: string
}

export interface RoomFormValues {
  name: string
  code?: string
  capacity?: number
  notes?: string
  is_active: boolean
}
