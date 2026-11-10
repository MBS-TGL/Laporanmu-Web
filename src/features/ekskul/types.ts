export interface Ekskul {
  id: string
  name: string
  coach_id: string | null
  schedule: string | null
  place: string | null
  description: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  teachers?: { id: string; name: string } | null
  /** hasil embed count PostgREST: [{ count: n }] */
  members?: { count: number }[]
}

export interface EkskulMember {
  id: string
  ekskul_id: string
  student_id: string
  role: string
  joined_at: string
  deleted_at: string | null
  students?: {
    id: string
    name: string
    registration_code: string
    classes?: { name: string } | null
  } | null
}

export interface EkskulFormValues {
  name: string
  coach_id?: string
  schedule?: string
  place?: string
  description?: string
}
