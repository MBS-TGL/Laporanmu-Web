export type HealthStatus = 'UKS' | 'Dormitory' | 'Returned'

export interface HealthMedicine {
  id: string
  name: string
  category: string | null
  stock: number
  unit: string
  min_stock: number
  description: string | null
  created_at?: string
  updated_at?: string
}

export interface HealthMedicineFormValues {
  name: string
  category?: string
  stock: number
  unit: string
  min_stock: number
  description?: string
}

export interface HealthLog {
  id: string
  date: string
  time: string
  student_id: string | null
  student_name: string
  class_name: string | null
  complaint: string
  diagnosis: string | null
  treatment: string | null
  medicine_id: string | null
  medicine_name: string | null
  medicine_qty: number
  status: HealthStatus
  created_at?: string
  updated_at?: string
}

export interface HealthFormValues {
  student_id: string
  date: string
  time: string
  complaint: string
  diagnosis?: string
  treatment: string
  medicine_id?: string
  medicine_qty?: number
  status: HealthStatus
}
