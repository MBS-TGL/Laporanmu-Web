/** Kategori butir ibadah (0055). */
export type WorshipCategory = 'wudhu' | 'sholat' | 'hafalan_hadist' | 'hafalan_doa'

export interface WorshipItem {
  id: string
  category: WorshipCategory
  label: string
  sort_order: number
  is_preset: boolean
}

export interface WorshipMasteryRow {
  id: string
  student_id: string
  item_id: string
  mastered: boolean
  mastered_at: string | null
}

export interface WorshipScoreRow {
  id: string
  student_id: string
  item_id: string
  year: number
  month: number
  grade: number
}

export interface WorshipFormValues {
  category: WorshipCategory
  label: string
  sort_order: number
}

export const WORSHIP_CATEGORY_LABEL: Record<WorshipCategory, string> = {
  wudhu: 'Wudhu',
  sholat: 'Sholat',
  hafalan_hadist: 'Hafalan Hadis',
  hafalan_doa: 'Hafalan Doa',
}
