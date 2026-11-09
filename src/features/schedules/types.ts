export interface Schedule {
  id: string
  class_id: string
  subject_id: string | null
  teacher_id: string | null
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
  classes?: { id: string; name: string } | null
  subjects?: { id: string; name: string } | null
  teachers?: { id: string; name: string } | null
}

export interface ScheduleFormValues {
  class_id: string
  subject_id?: string
  teacher_id?: string
  day_of_week: number
  start_time: string // 'HH:mm'
  end_time: string
  room?: string
  notes?: string
}

/** Kandidat jadwal untuk deteksi bentrok (waktu 'HH:mm') */
export interface ScheduleCandidate {
  day_of_week: number
  start_time: string
  end_time: string
  class_id: string
  teacher_id?: string
  excludeId?: string
}

export interface ScheduleConflict {
  schedule: Schedule
  reason: 'class' | 'teacher'
}
