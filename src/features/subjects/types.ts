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

export interface CpFormValues {
  subject: string
  phase: string
  description: string
  sort_order: number
}

export const PHASE_OPTIONS = [
  { value: 'A', label: 'Fase A (Kelas 1-2)' },
  { value: 'B', label: 'Fase B (Kelas 3-4)' },
  { value: 'C', label: 'Fase C (Kelas 5-6)' },
  { value: 'D', label: 'Fase D (Kelas 7-9)' },
  { value: 'E', label: 'Fase E (Kelas 10)' },
  { value: 'F', label: 'Fase F (Kelas 11-12)' },
]
