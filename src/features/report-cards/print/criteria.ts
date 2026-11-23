import { getCriteria } from '../constants'
import type { ReportCardType } from '../types'

export interface PrintCriterion {
  key: string
  id: string
  ar?: string
  desc?: string
}

export interface PrintFlags {
  hasFisik: boolean
  hasHafalan: boolean
  hasAttendance: boolean
  hasCatatan: boolean
}

const MONTHLY_CRITERIA: PrintCriterion[] = [
  { key: 'nilai_akhlak', id: 'Akhlak', ar: 'الأخلاق' },
  { key: 'nilai_ibadah', id: 'Ibadah', ar: 'العبادة' },
  { key: 'nilai_kebersihan', id: 'Kebersihan', ar: 'النظافة' },
  { key: 'nilai_quran', id: "Al-Qur'an", ar: 'تحسين القراءة وحفظ القرآن' },
  { key: 'nilai_bahasa', id: 'Bahasa', ar: 'اللغة' },
]

const AR_BY_KEY: Record<string, string> = {
  aqidah: 'العقيدة',
  akhlaq: 'الأخلاق',
  b_arab: 'اللغة العربية',
  fiqih: 'الفقه',
  quran: 'القرآن',
  hadits: 'الحديث',
  nahwu: 'القواعد',
  shorof: 'الصرف',
  tarikh: 'التاريخ الإسلامي',
  tarjih: 'الترجيح',
  u_quran: 'علوم القرآن',
  qawaid: 'القواعد',
  imla: 'الإملاء',
  wafa: 'تلاوة القرآن',
  hadith_arbain: 'حديث الأربعين النووي',
  daily_prayers: 'الدعاء اليومي',
  daily_hadith: 'الحديث اليومي',
  post_prayer_dhikr: 'الذكر والدعاء بعد الصلاة',
  morning_evening_dhikr: 'ذكر الصباح والمساء',
  tuhfatul_athfal: 'متن تحفة الأطفال',
  wudhu_practice: 'الوضوء',
  prostration_practice: 'السجود',
}

export function getPrintCriteria(type: ReportCardType, grade: string | null): PrintCriterion[] {
  if (type === 'monthly') return MONTHLY_CRITERIA
  return getCriteria(type, grade).map((criterion) => ({
    key: criterion.key,
    id: criterion.label,
    ar: AR_BY_KEY[criterion.key],
    desc: criterion.desc,
  }))
}

export function getPrintFlags(type: ReportCardType): PrintFlags {
  if (type === 'monthly') {
    return { hasFisik: true, hasHafalan: true, hasAttendance: true, hasCatatan: true }
  }
  if (type === 'pondok_oral') {
    return { hasFisik: false, hasHafalan: false, hasAttendance: false, hasCatatan: true }
  }
  return { hasFisik: true, hasHafalan: false, hasAttendance: true, hasCatatan: true }
}

export function maxScoreFor(type: ReportCardType): number {
  return type === 'monthly' ? 9 : 100
}
