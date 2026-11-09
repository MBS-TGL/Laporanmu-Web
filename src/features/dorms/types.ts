export type DormGender = 'male' | 'female' | 'mixed'
export type DormStatus = 'active' | 'full' | 'inactive'

export interface Dorm {
  id: string
  name: string
  gender: DormGender | null
  capacity: number
  musyrif_id: string | null
  status: DormStatus
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  musyrif?: { name: string } | null
}

export interface DormFormValues {
  name: string
  gender?: DormGender
  capacity: number
  musyrif_id?: string
  status: DormStatus
}

/** Kamar untuk penempatan: brief + okupansi terisi */
export interface DormRoom {
  id: string
  name: string
  gender: DormGender | null
  capacity: number
  occupied: number
}

export interface DormFilters {
  search?: string
  gender?: DormGender
  status?: DormStatus
}

export type StudentGender = 'L' | 'P'

/** Santri untuk tab penempatan (join kelas & asrama) */
export interface Placement {
  id: string
  name: string
  gender: StudentGender | null
  class_id: string | null
  classes?: { name: string } | null
  dorm_id: string | null
  dorms?: { name: string } | null
}

export interface PlacementFilters {
  search?: string
  placement: 'all' | 'unassigned' | 'assigned'
  gender?: StudentGender
  classId?: string
  page: number
  pageSize: number
}
