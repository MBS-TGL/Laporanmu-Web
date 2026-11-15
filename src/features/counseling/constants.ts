import type { CounselingCategory, CounselingStatus, CounselingUrgency } from './types'

export const CATEGORY_LABEL: Record<CounselingCategory, string> = {
  personal: 'Pribadi',
  social: 'Sosial',
  academic: 'Belajar',
  career: 'Karir',
}

export const URGENCY_META: Record<CounselingUrgency, { label: string; color: string }> = {
  low: { label: 'Ringan', color: 'green' },
  medium: { label: 'Sedang', color: 'orange' },
  high: { label: 'Tinggi', color: 'red' },
}

export const STATUS_META: Record<CounselingStatus, { label: string; color: string }> = {
  in_progress: { label: 'Dalam Proses', color: 'gold' },
  completed: { label: 'Selesai', color: 'green' },
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([value, label]) => ({
  value: value as CounselingCategory,
  label,
}))

export const URGENCY_OPTIONS = Object.entries(URGENCY_META).map(([value, m]) => ({
  value: value as CounselingUrgency,
  label: m.label,
}))

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({
  value: value as CounselingStatus,
  label: m.label,
}))
