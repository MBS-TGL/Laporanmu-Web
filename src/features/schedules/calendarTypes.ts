export type CalendarEventCategory = 'akademik' | 'pondok' | 'ujian' | 'libur' | 'umum'
export type CalendarEventTarget = 'ALL' | 'SMP' | 'SMA'

export interface CalendarEvent {
  id: string
  title: string
  category: CalendarEventCategory
  target_level: CalendarEventTarget
  start_date: string // 'YYYY-MM-DD'
  end_date: string   // 'YYYY-MM-DD'
  start_time: string | null // 'HH:mm' / 'HH:mm:ss'
  end_time: string | null
  location: string | null
  description: string | null
  color: string | null
  academic_year_id: string | null
  created_by: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface CalendarEventFormValues {
  title: string
  category: CalendarEventCategory
  target_level: CalendarEventTarget
  start_date: string
  end_date: string
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  description?: string | null
  color?: string | null
}
