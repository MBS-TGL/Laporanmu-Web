import { getCriteria, PRACTICAL_KEYS } from '../constants'
import type { ReportCardType } from '../types'
import { toArabicNum } from './labels'

export interface PrintCriterion {
  key: string
  id: string
  ar?: string
  desc?: string
  /** Materi praktik: dicetak di bagian "Ujian Praktik", tidak ikut jumlah/rata-rata */
  practical?: boolean
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
  hadith_arbain: 'حديث الأربعين',
  daily_prayers: 'الدعاء اليومي',
  daily_hadith: 'الحديث اليومي',
  post_prayer_dhikr: 'الذكر والدعاء بعد الصلاة',
  morning_evening_dhikr: 'ذكر الصباح والمساء',
  tuhfatul_athfal: 'تحفة الأطفال',
  wudhu_practice: 'الوضوء',
  prostration_practice: 'سجود السهو والتلاوة',
  eid_prayer_practice: 'صلاة عيد الفطر',
}

function arabicNameFor(key: string): string | undefined {
  if (AR_BY_KEY[key]) return AR_BY_KEY[key]
  const juz = key.match(/^tahfidz_juz_(\d+)$/)
  return juz ? `تحفيظ القرآن الكريم جزء ${toArabicNum(juz[1])}` : undefined
}

export function getPrintCriteria(
  type: ReportCardType,
  grade: string | null,
  className?: string | null,
): PrintCriterion[] {
  if (type === 'monthly') return MONTHLY_CRITERIA
  return getCriteria(type, grade, className).map((criterion) => ({
    key: criterion.key,
    id: criterion.label,
    ar: arabicNameFor(criterion.key),
    desc: criterion.desc,
    practical: PRACTICAL_KEYS.has(criterion.key),
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
