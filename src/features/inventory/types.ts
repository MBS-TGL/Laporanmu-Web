export type ItemCondition = 'good' | 'light_damaged' | 'heavy_damaged' | 'lost'

export interface InventoryItem {
  id: string
  code: string | null
  name: string
  category: string | null
  quantity: number
  unit: string | null
  condition: ItemCondition
  location: string | null
  min_quantity: number
  acquired_at: string | null
  price: number | null
  source: string | null
  notes: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface ItemFormValues {
  name: string
  code?: string
  category?: string
  quantity: number
  unit?: string
  condition: ItemCondition
  location?: string
  min_quantity: number
  acquired_at?: string
  price?: number
  source?: string
  notes?: string
}
