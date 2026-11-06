export type CounselingCategory = 'pribadi' | 'sosial' | 'akademik' | 'karir'
export type CounselingUrgency = 'ringan' | 'sedang' | 'tinggi'
export type CounselingStatus = 'proses' | 'selesai'

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
  created_at?: string
  updated_at?: string
}

export interface CounselingFormValues {
  student_id: string
  counselor_name: string
  date: string
  time: string
  category: CounselingCategory
  complaint: string
  diagnosis?: string
  action_plan?: string
  urgency: CounselingUrgency
  status: CounselingStatus
}
