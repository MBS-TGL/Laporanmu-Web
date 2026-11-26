import { PRACTICAL_KEYS } from '../constants'
import type { ReportCardType } from '../types'

export type V1ReportType = 'bulanan' | 'pondok_lisan' | 'pondok_mapel' | 'umum'

export interface GradeInfo {
  label: string
  id: string
  bg?: string
  border?: string
  uiColor?: string
  color?: string
  letter?: string
}

/** Sistem Penilaian Ujian Lisan (sama dengan tabel di Excel) */
export const ORAL_GRADE_SCALE = [
  { min: 90, max: 100, ar: 'ممتاز', id: 'Istimewa' },
  { min: 80, max: 89, ar: 'جيد جدا', id: 'Sangat Baik' },
  { min: 60, max: 79, ar: 'جيد', id: 'Baik' },
  { min: 50, max: 59, ar: 'مقبول', id: 'Cukup' },
  { min: 0, max: 49, ar: 'راسب', id: 'Tidak Lulus' },
] as const

/** Predikat Praktik (A/B/C) seperti di Excel */
export const ORAL_PRACTICAL_SCALE = [
  { ar: 'أ', id: 'A', range: '90 - 95' },
  { ar: 'ب', id: 'B', range: '80 - 89' },
  { ar: 'ج', id: 'C', range: '< 79' },
] as const

export function toV1ReportType(type: ReportCardType): V1ReportType {
  if (type === 'pondok_oral') return 'pondok_lisan'
  if (type === 'pondok_subject') return 'pondok_mapel'
  if (type === 'general') return 'umum'
  return 'bulanan'
}

export function getClassLevel(
  classObj: { name?: string | null; grade?: string | null } | string | null,
): 'SMP' | 'SMA' {
  if (!classObj) return 'SMP'
  const name = (typeof classObj === 'string' ? classObj : (classObj.name || '')).toLowerCase()
  const grade = typeof classObj === 'string' ? '' : String(classObj.grade || '')
  if (
    grade === '10' ||
    grade === '11' ||
    grade === '12' ||
    grade.includes('X') ||
    grade.includes('XI') ||
    grade.includes('XII')
  ) {
    return 'SMA'
  }
  if (
    name.includes('sma') ||
    name.includes('aliyah') ||
    name.includes('ma ') ||
    name.endsWith(' ma') ||
    name.includes(' ulya')
  ) {
    return 'SMA'
  }
  return 'SMP'
}

const isEmptyScore = (score: number | string | null | undefined) =>
  score === null || score === undefined || score === ''

export function GRADE(score: number | null | undefined): GradeInfo {
  if (isEmptyScore(score)) return { label: '—', id: '—', color: '#6b7280' }
  const num = Number(score)
  if (Number.isNaN(num)) return { label: '—', id: '—', color: '#6b7280' }
  if (num >= 9) return { label: 'ممتاز', id: 'Sangat Baik', bg: '#10b98115', border: '#10b98140', uiColor: '#10b981', color: '#000' }
  if (num >= 8) return { label: 'جيد جدا', id: 'Baik', bg: '#3b82f615', border: '#3b82f640', uiColor: '#3b82f6', color: '#000' }
  if (num >= 6) return { label: 'جيد', id: 'Cukup', bg: '#6366f115', border: '#6366f140', uiColor: '#6366f1', color: '#000' }
  if (num >= 4) return { label: 'مقبول', id: 'Kurang', bg: '#f59e0b15', border: '#f59e0b40', uiColor: '#f59e0b', color: '#000' }
  return { label: 'راسب', id: 'Kurang Baik', bg: '#ef444415', border: '#ef444440', uiColor: '#ef4444', color: '#ef4444' }
}

export function getGradePredicate(
  score: number | null | undefined,
  reportType: V1ReportType,
  criterionKey = '',
): GradeInfo {
  if (isEmptyScore(score)) return { label: '—', id: '—', color: '#6b7280' }
  const value = Number(score)
  if (Number.isNaN(value)) return { label: '—', id: '—', color: '#6b7280' }

  if (reportType === 'bulanan') return GRADE(value)

  if (reportType === 'umum') {
    if (value >= 90) return { label: 'أ / A', id: 'Sangat Baik', bg: '#10b98115', border: '#10b98140', uiColor: '#10b981', color: '#000', letter: 'A' }
    if (value >= 80) return { label: 'ب / B', id: 'Baik', bg: '#3b82f615', border: '#3b82f640', uiColor: '#3b82f6', color: '#000', letter: 'B' }
    if (value >= 70) return { label: 'ج / C', id: 'Cukup', bg: '#f59e0b15', border: '#f59e0b40', uiColor: '#f59e0b', color: '#000', letter: 'C' }
    return { label: 'د / D', id: 'Kurang', bg: '#ef444415', border: '#ef444440', uiColor: '#ef4444', color: '#ef4444', letter: 'D' }
  }

  if (reportType === 'pondok_lisan' && (criterionKey === 'praktek' || PRACTICAL_KEYS.has(criterionKey))) {
    if (value >= 90) return { label: 'أ', id: 'A', bg: '#10b98115', border: '#10b98140', uiColor: '#10b981', color: '#000', letter: 'أ' }
    if (value >= 80) return { label: 'ب', id: 'B', bg: '#3b82f615', border: '#3b82f640', uiColor: '#3b82f6', color: '#000', letter: 'ب' }
    return { label: 'ج', id: 'C', bg: '#f59e0b15', border: '#f59e0b40', uiColor: '#f59e0b', color: '#000', letter: 'ج' }
  }

  if (reportType === 'pondok_lisan') {
    if (value >= 90) return { label: 'ممتاز', id: 'Istimewa', bg: '#10b98115', border: '#10b98140', uiColor: '#10b981', color: '#000', letter: 'أ' }
    if (value >= 80) return { label: 'جيد جدا', id: 'Sangat Baik', bg: '#3b82f615', border: '#3b82f640', uiColor: '#3b82f6', color: '#000', letter: 'ب' }
    if (value >= 60) return { label: 'جيد', id: 'Baik', bg: '#6366f115', border: '#6366f140', uiColor: '#6366f1', color: '#000', letter: 'ج' }
    if (value >= 50) return { label: 'مقبول', id: 'Cukup', bg: '#f59e0b15', border: '#f59e0b40', uiColor: '#f59e0b', color: '#000', letter: 'د' }
    return { label: 'راسب', id: 'Tidak Lulus', bg: '#ef444415', border: '#ef444440', uiColor: '#ef4444', color: '#ef4444', letter: 'هـ' }
  }

  if (value >= 90) return { label: 'ممتاز جدا', id: 'Sangat Baik', bg: '#10b98115', border: '#10b98140', uiColor: '#10b981', color: '#000', letter: 'أ' }
  if (value >= 80) return { label: 'جيد جدا', id: 'Baik', bg: '#3b82f615', border: '#3b82f640', uiColor: '#3b82f6', color: '#000', letter: 'ب' }
  if (value >= 60) return { label: 'جيد', id: 'Cukup', bg: '#6366f115', border: '#6366f140', uiColor: '#6366f1', color: '#000', letter: 'ج' }
  if (value >= 50) return { label: 'مقبول', id: 'Kurang', bg: '#f59e0b15', border: '#f59e0b40', uiColor: '#f59e0b', color: '#000', letter: 'د' }
  return { label: 'ضعيف', id: 'Kurang Baik', bg: '#ef444415', border: '#ef444440', uiColor: '#ef4444', color: '#ef4444', letter: 'هـ' }
}
