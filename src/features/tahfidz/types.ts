export type TahfidzKind = 'ziyadah' | 'murojaah'
export type TahfidzQuality = 'excellent' | 'good' | 'needs_work'

export interface TahfidzRecord {
  id: string
  student_id: string
  teacher_id: string | null
  kind: TahfidzKind
  surah: string
  from_ayat: number | null
  to_ayat: number | null
  quality: TahfidzQuality | null
  note: string | null
  recorded_at: string
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  student?: { id: string; name: string; registration_code: string } | null
  teacher?: { id: string; name: string } | null
}

export type TahfidzKindFilter = '' | TahfidzKind

export interface TahfidzFilters {
  search?: string
  kind?: TahfidzKindFilter
  quality?: TahfidzQuality | ''
  from?: string
  to?: string
  page: number
  pageSize: number
}

export interface TahfidzFormValues {
  student_id: string
  kind: TahfidzKind
  surah: string
  from_ayat?: number
  to_ayat?: number
  quality?: TahfidzQuality
  teacher_id?: string
  note?: string
  recorded_at: string
}

export interface TahfidzStats {
  total: number
  ziyadah: number
  murojaah: number
  week: number
}
