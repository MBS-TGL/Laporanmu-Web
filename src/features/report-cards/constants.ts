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
  monthly: 'Rapor Bulanan',
  pondok_oral: 'Pondok (Lisan)',
  pondok_subject: 'Pondok (Mapel)',
  general: 'Rapor Umum',
}

export const BULANAN_MAX_SCORE = 9
export const SEMESTER_MAX_SCORE = 100
export const SEMESTER_KKM = 50

export interface Criterion {
  key: string
  label: string
  desc?: string
}

// 9 Poin Penilaian Ujian Pondok (Lisan) dengan detail tingkatan per jenjang kelas (7-12)
// Key menggunakan standar English naming, didukung pemetaan fallback legacy key
export const PONDOK_ORAL_CRITERIA_BY_GRADE: Record<number, Criterion[]> = {
  // --- KELAS 7 ---
  7: [
    { key: 'wafa', label: 'Wafa', desc: 'Tilawah/Tajwid/Ghorib sesuai tingkatan santri' },
    { key: 'hadith_arbain', label: 'Hadist Arbain An-Nawawi', desc: 'Hadits 1 s/d 7' },
    { key: 'daily_prayers', label: "Do'a Sehari-hari", desc: 'Target Doa No. 1 s/d 29' },
    { key: 'daily_hadith', label: 'Hadist Sehari-hari', desc: 'Target Hadits No. 1 s/d 17' },
    { key: 'post_prayer_dhikr', label: 'Dzikir Setelah Sholat', desc: 'Dzikir Setelah Sholat' },
    { key: 'morning_evening_dhikr', label: 'Dzikir Pagi dan Petang', desc: 'Dzikir Pagi dan Petang' },
    { key: 'tuhfatul_athfal', label: 'Matan Tuhfatul Athfal', desc: 'Bait Mukaddimah & Hukum Nun Mati' },
    { key: 'wudhu_practice', label: 'Praktek Wudhu', desc: 'Rukun, sunnah, doa, dan tata cara wudhu' },
    { key: 'prostration_practice', label: 'Praktek Sujud', desc: 'Tata cara & bacaan Sujud Sahwi / Tilawah' },
  ],
  // --- KELAS 8 ---
  8: [
    { key: 'wafa', label: 'Wafa', desc: 'Tilawah/Tajwid/Ghorib sesuai tingkatan santri' },
    { key: 'hadith_arbain', label: 'Hadist Arbain An-Nawawi', desc: 'Hadits 8 s/d 14' },
    { key: 'daily_prayers', label: "Do'a Sehari-hari", desc: 'Target Doa No. 30 s/d 61' },
    { key: 'daily_hadith', label: 'Hadist Sehari-hari', desc: 'Target Hadits No. 18 s/d 34' },
    { key: 'post_prayer_dhikr', label: 'Dzikir Setelah Sholat', desc: 'Dzikir Setelah Sholat' },
    { key: 'morning_evening_dhikr', label: 'Dzikir Pagi dan Petang', desc: 'Dzikir Pagi dan Petang' },
    { key: 'tuhfatul_athfal', label: 'Matan Tuhfatul Athfal', desc: 'Hukum Mim Mati & Idgham' },
    { key: 'wudhu_practice', label: 'Praktek Wudhu', desc: 'Pengujian rukun & sunnah wudhu sempurna' },
    { key: 'prostration_practice', label: 'Praktek Sujud', desc: 'Praktek Sujud Sahwi dan Sujud Tilawah' },
  ],
  // --- KELAS 9 ---
  9: [
    { key: 'wafa', label: 'Wafa', desc: 'Tilawah/Tajwid/Ghorib sesuai tingkatan santri' },
    { key: 'hadith_arbain', label: 'Hadist Arbain An-Nawawi', desc: 'Hadits 15 s/d 21' },
    { key: 'daily_prayers', label: "Do'a Sehari-hari", desc: 'Target Doa No. 62 s/d 88' },
    { key: 'daily_hadith', label: 'Hadist Sehari-hari', desc: 'Target Hadits No. 35 s/d 50' },
    { key: 'post_prayer_dhikr', label: 'Dzikir Setelah Sholat', desc: 'Dzikir Setelah Sholat' },
    { key: 'morning_evening_dhikr', label: 'Dzikir Pagi dan Petang', desc: 'Dzikir Pagi dan Petang' },
    { key: 'tuhfatul_athfal', label: 'Matan Tuhfatul Athfal', desc: 'Hukum Mad dan Pembagiannya' },
    { key: 'wudhu_practice', label: 'Praktek Wudhu', desc: 'Praktek thaharah & tata cara sholat sunnah' },
    { key: 'prostration_practice', label: 'Praktek Sujud', desc: 'Praktek Sujud Sahwi dan Sujud Tilawah' },
  ],
  // --- KELAS 10 ---
  10: [
    { key: 'wafa', label: 'Wafa', desc: 'Tilawah/Tajwid/Ghorib tingkat lanjut' },
    { key: 'hadith_arbain', label: 'Hadist Arbain An-Nawawi', desc: 'Hadits 22 s/d 28' },
    { key: 'daily_prayers', label: "Do'a Sehari-hari", desc: 'Target Doa No. 89 s/d 103' },
    { key: 'daily_hadith', label: 'Hadist Sehari-hari', desc: 'Target Hadits No. 51 s/d 64' },
    { key: 'post_prayer_dhikr', label: 'Dzikir Setelah Sholat', desc: 'Dzikir Setelah Sholat' },
    { key: 'morning_evening_dhikr', label: 'Dzikir Pagi dan Petang', desc: 'Dzikir Pagi dan Petang' },
    { key: 'tuhfatul_athfal', label: 'Matan Tuhfatul Athfal', desc: 'Matan Tuhfatul Athfal lanjutan' },
    { key: 'wudhu_practice', label: 'Praktek Wudhu', desc: 'Fiqih thaharah & evaluasi wudhu' },
    { key: 'prostration_practice', label: 'Praktek Sujud', desc: 'Praktek Sujud Sahwi dan Sujud Tilawah' },
  ],
  // --- KELAS 11 ---
  11: [
    { key: 'wafa', label: 'Wafa', desc: 'Tilawah/Tajwid/Ghorib tingkat lanjut' },
    { key: 'hadith_arbain', label: 'Hadist Arbain An-Nawawi', desc: 'Hadits 29 s/d 35' },
    { key: 'daily_prayers', label: "Do'a Sehari-hari", desc: 'Target Doa No. 104 s/d 121' },
    { key: 'daily_hadith', label: 'Hadist Sehari-hari', desc: 'Target Hadits No. 65 s/d 73' },
    { key: 'post_prayer_dhikr', label: 'Dzikir Setelah Sholat', desc: 'Dzikir Setelah Sholat' },
    { key: 'morning_evening_dhikr', label: 'Dzikir Pagi dan Petang', desc: 'Dzikir Pagi dan Petang' },
    { key: 'tuhfatul_athfal', label: 'Matan Tuhfatul Athfal', desc: 'Matan Tuhfatul Athfal lanjutan' },
    { key: 'wudhu_practice', label: 'Praktek Wudhu', desc: 'Fiqih thaharah & evaluasi wudhu' },
    { key: 'prostration_practice', label: 'Praktek Sujud', desc: 'Praktek Sujud Sahwi dan Sujud Tilawah' },
  ],
  // --- KELAS 12 ---
  12: [
    { key: 'wafa', label: 'Wafa', desc: 'Tilawah/Tajwid/Ghorib tingkat mutqin' },
    { key: 'hadith_arbain', label: 'Hadist Arbain An-Nawawi', desc: 'Hadits 36 s/d 42' },
    { key: 'daily_prayers', label: "Do'a Sehari-hari", desc: 'Target Doa No. 122 s/d 142' },
    { key: 'daily_hadith', label: 'Hadist Sehari-hari', desc: 'Target Hadits No. 74 s/d 82' },
    { key: 'post_prayer_dhikr', label: 'Dzikir Setelah Sholat', desc: 'Dzikir Setelah Sholat' },
    { key: 'morning_evening_dhikr', label: 'Dzikir Pagi dan Petang', desc: 'Dzikir Pagi dan Petang' },
    { key: 'tuhfatul_athfal', label: 'Matan Tuhfatul Athfal', desc: 'Matan Tuhfatul Athfal tuntas' },
    { key: 'wudhu_practice', label: 'Praktek Wudhu', desc: 'Evaluasi praktek thaharah komprehensif' },
    { key: 'prostration_practice', label: 'Praktek Sujud', desc: 'Praktek Sujud Sahwi dan Sujud Tilawah' },
  ],
}

// Peta alias legacy key -> English key untuk kompatibilitas data nilai lama
export const ORAL_LEGACY_KEY_MAP: Record<string, string> = {
  h_arbain: 'hadith_arbain',
  doa: 'daily_prayers',
  h_biru: 'daily_hadith',
  d_sholat: 'post_prayer_dhikr',
  pagi_petang: 'morning_evening_dhikr',
  praktek: 'wudhu_practice',
  praktek_wudhu: 'wudhu_practice',
  sujud_sahwi_tilawah: 'prostration_practice',
}

/** Membaca nilai kriteria dengan fallback ke key lama jika data DB masih format legacy */
export function getScoreWithFallback(scores: Record<string, number | null>, key: string): number | null {
  if (typeof scores[key] === 'number') return scores[key]
  // Coba cari via legacy key kebalikannya
  for (const [legacy, modern] of Object.entries(ORAL_LEGACY_KEY_MAP)) {
    if (modern === key && typeof scores[legacy] === 'number') {
      return scores[legacy]
    }
    if (legacy === key && typeof scores[modern] === 'number') {
      return scores[modern]
    }
  }
  return null
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
    smp: PONDOK_ORAL_CRITERIA_BY_GRADE[7],
    sma: PONDOK_ORAL_CRITERIA_BY_GRADE[10],
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
  if (type === 'pondok_oral') {
    const gNum = Number(grade)
    if (gNum in PONDOK_ORAL_CRITERIA_BY_GRADE) {
      return PONDOK_ORAL_CRITERIA_BY_GRADE[gNum]
    }
    const level = isSmaClass(grade) ? 'sma' : 'smp'
    return SEMESTER_CRITERIA.pondok_oral[level]
  }
  const level = isSmaClass(grade) ? 'sma' : 'smp'
  return SEMESTER_CRITERIA[type as SemesterType][level]
}

/**
 * Versi getCriteria untuk rapor 'general' yang membaca dari tabel subjects.
 * Jika subjectsList diberikan (dari hook useSubjects), pakai itu;
 * jika kosong/undefined, fallback ke hardcode SEMESTER_CRITERIA.general.
 * Ini memungkinkan transisi bertahap — rapor pondok tetap hardcode,
 * rapor umum bisa dinamis begitu tabel subjects terisi.
 */
export function getGeneralCriteriaFromSubjects(
  subjectsList?: { id: string; name: string; sort_order: number }[],
): Criterion[] {
  if (!subjectsList || subjectsList.length === 0) {
    return SEMESTER_CRITERIA.general.smp // fallback ke hardcode
  }
  return subjectsList
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'id'))
    .map((s) => ({ key: s.id, label: s.name }))
}

/**
 * getCriteria versi enhanced — menerima opsional subjects list.
 * Untuk type='general': jika subjects tersedia, pakai itu;
 * untuk type lain: selalu hardcode.
 */
export function getCriteriaEnhanced(
  type: ReportCardType,
  grade: string | null,
  subjectsList?: { id: string; name: string; sort_order: number }[],
): Criterion[] {
  if (type === 'monthly') return BULANAN_CRITERIA
  if (type === 'general' && subjectsList && subjectsList.length > 0) {
    return getGeneralCriteriaFromSubjects(subjectsList)
  }
  if (type === 'pondok_oral') {
    const gNum = Number(grade)
    if (gNum in PONDOK_ORAL_CRITERIA_BY_GRADE) {
      return PONDOK_ORAL_CRITERIA_BY_GRADE[gNum]
    }
  }
  const level = isSmaClass(grade) ? 'sma' : 'smp'
  return SEMESTER_CRITERIA[type as SemesterType][level]
}

export function isSmaClass(grade: string | null): boolean {
  const g = Number(grade)
  return g === 10 || g === 11 || g === 12
}

// Kriteria praktik dikecualikan dari rata-rata (mengikuti V1)
export const PRACTICAL_KEYS = new Set([
  'praktek',
  'praktek_wudhu',
  'wudhu_practice',
  'sujud_sahwi_tilawah',
  'prostration_practice',
])

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

// Tint latar sel nilai sesuai band predikat (pemisahan visual input ala V1).
// Pakai warna status tema (emerald/amber/red) dengan alpha rendah agar teks tetap terbaca.
export function scoreTint(type: ReportCardType, value: number | null): string | null {
  if (value === null || Number.isNaN(value)) return null
  if (type === 'monthly') {
    if (value >= 8) return 'rgba(16, 185, 129, 0.16)'
    if (value >= 6) return 'rgba(245, 158, 11, 0.18)'
    if (value >= 4) return 'rgba(245, 158, 11, 0.32)'
    return 'rgba(239, 68, 68, 0.18)'
  }
  if (value >= 80) return 'rgba(16, 185, 129, 0.16)'
  if (value >= SEMESTER_KKM) return 'rgba(245, 158, 11, 0.20)'
  return 'rgba(239, 68, 68, 0.18)'
}

export function calcAverage(
  type: ReportCardType,
  scores: Record<string, number | null>,
  grade: string | null,
  subjectsList?: { id: string; name: string; sort_order: number }[],
): number | null {
  const criteria = getCriteriaEnhanced(type, grade, subjectsList)
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
  subjectsList?: { id: string; name: string; sort_order: number }[],
): boolean {
  const criteria = getCriteriaEnhanced(type, grade, subjectsList)
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
