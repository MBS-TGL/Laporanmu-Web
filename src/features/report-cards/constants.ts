import type { ReportCardType, SemesterType } from './types'

export const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export const SEMESTER_LABEL: Record<1 | 2, string> = {
  1: 'Semester 1 (Ganjil)',
  2: 'Semester 2 (Genap)',
}

export const REPORT_CARD_TYPE_LABEL: Record<ReportCardType, string> = {
  monthly: 'Raport Bulanan',
  pondok_oral: 'Pondok (Lisan)',
  pondok_subject: 'Pondok (Mapel)',
  general: 'Raport Umum',
}

export const BULANAN_MAX_SCORE = 9
export const SEMESTER_MAX_SCORE = 100
export const SEMESTER_KKM = 50

export interface Criterion {
  key: string
  label: string
}

// Kriteria raport bulanan (skala 1–9)
export const BULANAN_CRITERIA: Criterion[] = [
  { key: 'character_score', label: 'Akhlak' },
  { key: 'worship_score', label: 'Ibadah' },
  { key: 'cleanliness_score', label: 'Kebersihan' },
  { key: 'quran_score', label: "Al-Qur'an" },
  { key: 'language_score', label: 'Bahasa' },
]

// Kriteria raport semester — SMP = tingkat 7-9, SMA = 10-12
export const SEMESTER_CRITERIA: Record<SemesterType, { smp: Criterion[]; sma: Criterion[] }> = {
  pondok_oral: {
    smp: [
      { key: 'doa', label: 'Doa Harian' },
      { key: 'wafa', label: 'Wafa' },
      { key: 'h_arbain', label: 'Hadits Arbain' },
      { key: 'h_biru', label: 'Hadits Pilihan' },
      { key: 'd_sholat', label: 'Doa Sholat' },
      { key: 'pagi_petang', label: 'Pagi Petang' },
      { key: 'juz_30', label: 'Juz 30' },
      { key: 'juz_29', label: 'Juz 29' },
      { key: 'juz_28', label: 'Juz 28' },
      { key: 'juz_27', label: 'Juz 27' },
      { key: 'juz_26', label: 'Juz 26' },
      { key: 'praktek', label: 'Praktek Ibadah' },
    ],
    sma: [
      { key: 'doa', label: 'Doa Harian' },
      { key: 'wafa', label: 'Wafa' },
      { key: 'h_arbain', label: 'Hadits Arbain' },
      { key: 'h_biru', label: 'Hadits Pilihan' },
      { key: 'd_sholat', label: 'Doa Sholat' },
      { key: 'pagi_petang', label: 'Pagi Petang' },
      { key: 'juz_30', label: 'Juz 30' },
      { key: 'juz_29', label: 'Juz 29' },
      { key: 'juz_28', label: 'Juz 28' },
      { key: 'juz_27', label: 'Juz 27' },
      { key: 'praktek', label: 'Praktek Ibadah' },
    ],
  },
  pondok_subject: {
    smp: [
      { key: 'aqidah', label: 'Aqidah' },
      { key: 'akhlaq', label: 'Akhlaq' },
      { key: 'b_arab', label: 'B. Arab' },
      { key: 'fiqih', label: 'Fiqih' },
      { key: 'quran', label: 'Quran' },
      { key: 'hadits', label: 'Hadits' },
      { key: 'nahwu', label: 'Nahwu (Al-Qawaid)' },
      { key: 'shorof', label: 'Shorof' },
      { key: 'tarikh', label: 'Tarikh' },
    ],
    sma: [
      { key: 'aqidah', label: 'Aqidah' },
      { key: 'akhlaq', label: 'Akhlaq' },
      { key: 'tarjih', label: 'Tarjih' },
      { key: 'fiqih', label: 'Fiqih' },
      { key: 'u_quran', label: "Ulumul Qur'an" },
      { key: 'hadits', label: 'Hadits' },
      { key: 'qawaid', label: 'Qawaid (Nahwu-Shorof)' },
      { key: 'imla', label: "Imla'" },
    ],
  },
  general: {
    smp: [
      { key: 'matematika', label: 'Matematika' },
      { key: 'ipa', label: 'IPA (Sains)' },
      { key: 'ips', label: 'IPS' },
      { key: 'bahasa_indonesia', label: 'B. Indonesia' },
      { key: 'bahasa_inggris', label: 'B. Inggris' },
      { key: 'pkn', label: 'PKn / Pancasila' },
      { key: 'pai', label: 'PAI' },
      { key: 'seni_budaya', label: 'Seni Budaya' },
      { key: 'pjok', label: 'PJOK' },
    ],
    sma: [
      { key: 'matematika', label: 'Matematika' },
      { key: 'ipa', label: 'IPA (Sains)' },
      { key: 'ips', label: 'IPS' },
      { key: 'bahasa_indonesia', label: 'B. Indonesia' },
      { key: 'bahasa_inggris', label: 'B. Inggris' },
      { key: 'pkn', label: 'PKn / Pancasila' },
      { key: 'pai', label: 'PAI' },
      { key: 'seni_budaya', label: 'Seni Budaya' },
      { key: 'pjok', label: 'PJOK' },
    ],
  },
}

export function getCriteria(type: ReportCardType, grade: string | null): Criterion[] {
  if (type === 'monthly') return BULANAN_CRITERIA
  const level = isSmaClass(grade) ? 'sma' : 'smp'
  return SEMESTER_CRITERIA[type as SemesterType][level]
}

export function isSmaClass(grade: string | null): boolean {
  const g = Number(grade)
  return g === 10 || g === 11 || g === 12
}

// Kriteria praktik dikecualikan dari rata-rata (mengikuti V1)
export const PRACTICAL_KEYS = new Set(['praktek'])

export const HAFALAN_PRESETS = [
  '1/2 Halaman',
  '1 Halaman',
  '5 Halaman',
  '1 Juz',
  'Lancar',
  'Mutqin',
  'Juz 30',
  '30 Juz',
]

export const CATATAN_TEMPLATES = [
  'Alhamdulillah perkembangannya sangat baik bulan ini.',
  'Perkembangan cukup baik, perlu dipertahankan.',
  'Perlu perhatian lebih pada kedisiplinan.',
  'Aktif di kelas dan mandiri.',
  'Perlu peningkatan dalam menjaga kebersihan.',
  'Target hafalan belum tercapai, perlu pendampingan.',
  'Ibadah sholat sudah teratur.',
  'Sering terlambat kegiatan pagi.',
]

export function getGradePredicateMonthly(score: number | null): string {
  if (score === null || Number.isNaN(score)) return '-'
  if (score >= 9) return 'Sangat Baik'
  if (score >= 8) return 'Baik'
  if (score >= 6) return 'Cukup'
  if (score >= 4) return 'Kurang'
  return 'Kurang Baik'
}

export function getGradePredicateSemester(score: number | null): string {
  if (score === null || Number.isNaN(score)) return '-'
  if (score >= 90) return 'A - Sangat Baik'
  if (score >= 80) return 'B - Baik'
  if (score >= 70) return 'C - Cukup'
  if (score >= SEMESTER_KKM) return 'D - Kurang'
  return 'E - Kurang Baik'
}

export function getPredicate(type: ReportCardType, score: number | null): string {
  return type === 'monthly'
    ? getGradePredicateMonthly(score)
    : getGradePredicateSemester(score)
}

export function calcAverage(
  type: ReportCardType,
  scores: Record<string, number | null>,
  grade: string | null,
): number | null {
  const criteria = getCriteria(type, grade)
  const values = criteria
    .filter((c) => !PRACTICAL_KEYS.has(c.key))
    .map((c) => scores[c.key])
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v))
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 100) / 100
}

export function isComplete(
  type: ReportCardType,
  scores: Record<string, number | null>,
  grade: string | null,
): boolean {
  const criteria = getCriteria(type, grade)
  return criteria.every((c) => typeof scores[c.key] === 'number')
}

// Akademik tahun ajaran dari bulan (≥ Juli = YYYY/YYYY+1)
export function academicYearFromMonth(month: number, year: number): string {
  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`
}

export function periodKey(
  type: ReportCardType,
  opts: { month?: number; year?: number; semester?: 1 | 2; academicYearId?: string },
): string {
  return type === 'monthly'
    ? `monthly__${opts.year}__${opts.month}`
    : `${opts.semester}__${opts.academicYearId ?? ''}`
}

export function periodLabel(
  type: ReportCardType,
  opts: { month?: number; year?: number; semester?: 1 | 2; academicYear?: string },
): string {
  if (type === 'monthly') {
    const m = opts.month ?? 1
    return `${MONTH_NAMES[m - 1]} ${opts.year ?? ''}`
  }
  return `${SEMESTER_LABEL[(opts.semester ?? 1) as 1 | 2]} — ${opts.academicYear ?? ''}`
}
