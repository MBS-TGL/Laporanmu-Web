export interface TimeSlot {
  id: string
  academic_year_id: string
  name: string
  start_time: string
  end_time: string
  sort_order: number
  is_break: boolean
}

export interface SubstitutionLog {
  id: string
  schedule_id: string
  date: string
  original_teacher_id: string | null
  substitute_teacher_id: string
  note: string | null
  substitute_teacher?: { id: string; name: string } | null
  original_teacher?: { id: string; name: string } | null
}

export interface Schedule {
  id: string
  class_id: string
  subject_id: string | null
  teacher_id: string | null
  time_slot_id?: string | null
  /** 1=Senin … 7=Minggu */
  day_of_week: number
  /** 'HH:mm:ss' */
  start_time: string
  end_time: string
  room: string | null
  notes: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  classes?: { id: string; name: string; grade?: string | null } | null
  subjects?: { id: string; name: string } | null
  teachers?: { id: string; name: string } | null
  time_slots?: { id: string; name: string; start_time: string; end_time: string } | null
}

export interface ScheduleFormValues {
  class_id: string
  subject_id?: string
  teacher_id?: string
  time_slot_id?: string
  day_of_week: number
  start_time: string // 'HH:mm'
  end_time: string
  room?: string
  notes?: string
}

/** Kandidat jadwal untuk deteksi bentrok (waktu 'HH:mm' atau 'HH:mm:ss') */
export interface ScheduleCandidate {
  day_of_week: number
  start_time: string
  end_time: string
  class_id: string
  teacher_id?: string
  room?: string
  excludeId?: string
}

export interface ScheduleConflict {
  schedule: Schedule
  reason: 'class' | 'teacher' | 'room'
  message?: string
}

export interface DetectedConflictGroup {
  id: string // composite key
  day_of_week: number
  start_time: string
  end_time: string
  reason: 'teacher' | 'class' | 'room'
  targetName: string // nama guru / nama kelas / nama ruang
  schedules: Schedule[]
}
