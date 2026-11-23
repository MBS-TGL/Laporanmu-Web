export type CounselingCategory = 'personal' | 'social' | 'academic' | 'career'
export type CounselingUrgency = 'low' | 'medium' | 'high'
export type CounselingStatus = 'in_progress' | 'completed'

export interface CounselingLog {
  id: string
  date: string
  time: string
  student_id: string | null
  student_name: string
  class_name: string | null
  counselor_name: string
  category: CounselingCategory
  complaint: string
  diagnosis: string | null
  action_plan: string | null
  urgency: CounselingUrgency
  status: CounselingStatus
  /** Tenggat tindak lanjut (0069); sesi proses tanpa tenggat bisa menggantung */
  next_session_date?: string | null
  /** Peserta sesi kelompok; baris counseling_participants (bukan student_name) */
  participants?: { student_id: string; name: string; class_name: string | null }[]
  created_at?: string
  updated_at?: string
}

export interface CounselingFormValues {
  student_id: string
  additional_student_ids?: string[]
  counselor_name: string
  date: string
  time: string
  category: CounselingCategory
  complaint: string
  diagnosis?: string
  action_plan?: string
  urgency: CounselingUrgency
  status: CounselingStatus
  next_session_date?: string | null
}

/** Filter daftar sesi — dipakai fetch daftar (server-side) & ekspor. */
export interface CounselingFilters {
  search?: string
  category?: CounselingCategory
  urgency?: CounselingUrgency
  status?: CounselingStatus
  from?: string
  to?: string
}

export interface CounselingListResult {
  data: CounselingLog[]
  total: number
}

/** Agregat statistik halaman — dihitung di DB (count head-only). */
export interface CounselingStats {
  total: number
  inProgress: number
  highUrgencyActive: number
  completedThisMonth: number
}

/** Jenis daftar untuk drawer statistik. */
export type CounselingStatListKind = 'in_progress' | 'high'
