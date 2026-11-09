export interface HalaqahGroup {
  id: string
  name: string
  musyrif_id: string | null
  gender: 'L' | 'P' | null
  place: string | null
  schedule: string | null
  capacity: number
  notes: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  teachers?: { id: string; name: string } | null
  /** hasil embed count PostgREST: [{ count: n }] */
  members?: { count: number }[]
}

export interface HalaqahMember {
  id: string
  group_id: string
  student_id: string
  joined_at: string
  deleted_at: string | null
  students?: {
    id: string
    name: string
    registration_code: string
    classes?: { name: string } | null
  } | null
}

export interface HalaqahFormValues {
  name: string
  musyrif_id?: string
  gender?: 'L' | 'P'
  place?: string
  schedule?: string
  capacity: number
  notes?: string
}
