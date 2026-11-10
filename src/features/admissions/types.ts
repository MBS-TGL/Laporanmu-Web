export type AdmissionStage = 'registered' | 'selection' | 'accepted' | 'rejected' | 'enrolled'

export interface Admission {
  id: string
  registration_number: string
  full_name: string
  gender: 'L' | 'P' | null
  birth_place: string | null
  birth_date: string | null
  origin_school: string | null
  target_grade: string | null
  parent_name: string | null
  parent_phone: string | null
  address: string | null
  stage: AdmissionStage
  notes: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface AdmissionFormValues {
  full_name: string
  gender?: 'L' | 'P'
  birth_place?: string
  birth_date?: string
  origin_school?: string
  target_grade?: string
  parent_name?: string
  parent_phone?: string
  address?: string
  notes?: string
}
