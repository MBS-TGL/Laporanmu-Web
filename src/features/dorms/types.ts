export type DormGender = 'putra' | 'putri' | 'campur'
export type DormStatus = 'aktif' | 'penuh' | 'nonaktif'

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

export interface DormFilters {
  search?: string
  gender?: DormGender
  page: number
  pageSize: number
}
