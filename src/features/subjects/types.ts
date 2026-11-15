export interface Subject {
  id: string
  name: string
  code: string | null
  weekly_hours: number
  category: string | null
  description: string | null
  is_active: boolean
  kkm: number | null
  phase: string | null
  curriculum_group: string | null
  sort_order: number
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface SubjectFormValues {
  name: string
  code?: string
  weekly_hours: number
  category?: string
  description?: string
  is_active: boolean
  kkm?: number
  phase?: string
  curriculum_group?: string
  sort_order?: number
}
