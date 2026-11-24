/**
 * Util murni Pusat Dokumen (P4): predikat, deskripsi otomatis raport,
 * dan hitungan yudisium. Tanpa I/O — testable.
 */

export type Predikat = 'A' | 'B' | 'C' | 'D'

/** Band predikat Kurmer (absolut, konsisten antar mapel):
 *  A ≥86, B ≥71, C ≥56, D <56. */
export function predikatOf(score: number | null): Predikat | null {
  if (score === null) return null
  if (score >= 86) return 'A'
  if (score >= 71) return 'B'
  if (score >= 56) return 'C'
  return 'D'
}

const PREDIKAT_LABEL: Record<Predikat, string> = {
  A: 'Sangat Baik',
  B: 'Baik',
  C: 'Cukup',
  D: 'Perlu Bimbingan',
}

export function predikatLabel(p: Predikat): string {
  return PREDIKAT_LABEL[p]
}

/** Deskripsi otomatis raport per mapel dari band nilai. */
export function autoDescription(subject: string, score: number | null): string {
  const p = predikatOf(score)
  if (p === null) return `${subject}: nilai belum lengkap.`
  const value = score ?? 0
  switch (p) {
    case 'A':
      return `${subject}: menunjukkan penguasaan yang sangat baik (nilai ${value}). Sangat konsisten dan mampu mengaplikasikan materi.`
    case 'B':
      return `${subject}: menunjukkan penguasaan yang baik (nilai ${value}). Cukup konsisten dan mampu mengaplikasikan materi.`
    case 'C':
      return `${subject}: penguasaan materi cukup (nilai ${value}). Perlu penguatan latihan dan konsistensi.`
    case 'D':
      return `${subject}: penguasaan materi masih perlu bimbingan (nilai ${value}). Butuh pendampingan dan remedial.`
  }
}

export interface YudisiumRequirement {
  key: string
  label: string
  pass: boolean
  detail: string
}

export interface YudisiumInput {
  /** Semua mapel kelas punya nilai semester */
  gradesComplete: boolean
  subjectsMissing: number
  /** Jumlah setoran tahfidz vs target */
  tahfidzCount: number
  tahfidzTarget: number
  /** Tagihan SPP belum lunas (rupiah) */
  sppOutstanding: number
  /** Total poin pelanggaran vs batas */
  totalPoints: number
  pointsLimit: number
}

/** Cek kelulusan yudisium per santri — semua syarat harus lulus. */
export function yudisiumChecks(input: YudisiumInput): YudisiumRequirement[] {
  return [
    {
      key: 'grades',
      label: 'Nilai lengkap',
      pass: input.gradesComplete,
      detail: input.gradesComplete
        ? 'Semua mapel punya nilai semester'
        : `${input.subjectsMissing} mapel belum bernilai`,
    },
    {
      key: 'tahfidz',
      label: 'Target tahfidz',
      pass: input.tahfidzCount >= input.tahfidzTarget,
      detail: `${input.tahfidzCount}/${input.tahfidzTarget} setoran`,
    },
    {
      key: 'spp',
      label: 'SPP lunas',
      pass: input.sppOutstanding <= 0,
      detail: input.sppOutstanding > 0 ? `Tunggakan ${input.sppOutstanding.toLocaleString('id-ID')}` : 'Lunas',
    },
    {
      key: 'points',
      label: 'Poin disiplin aman',
      pass: input.totalPoints >= input.pointsLimit,
      detail: `${input.totalPoints} poin (batas ${input.pointsLimit})`,
    },
  ]
}

export function yudisiumPassed(requirements: YudisiumRequirement[]): boolean {
  return requirements.every((r) => r.pass)
}

/** Peta singkatan cerdas untuk nama mapel panjang di diagram grafik (agar tidak terpotong) */
const COMMON_SUBJECT_SHORTEN: Record<string, string> = {
  'pendidikan agama islam': 'PAI',
  'pendidikan agama islam dan budi pekerti': 'PAI & BP',
  'pendidikan pancasila dan kewarganegaraan': 'PPKn',
  'pendidikan pancasila': 'Pancasila',
  'bahasa indonesia': 'B. Indo',
  'bahasa inggris': 'B. Inggris',
  'bahasa arab': 'B. Arab',
  'matematika': 'MTK',
  'ilmu pengetahuan alam': 'IPA',
  'ilmu pengetahuan sosial': 'IPS',
  'pendidikan jasmani, olahraga, dan kesehatan': 'PJOK',
  'seni budaya dan prakarya': 'SBdP',
  'seni budaya': 'Seni Budaya',
  'teknologi informasi dan komunikasi': 'TIK',
  'informatika': 'Informatika',
  'bimbingan dan konseling': 'BK',
}

export function formatRadarSubjectName(name: string): string {
  const clean = name.trim()
  const lower = clean.toLowerCase()
  if (COMMON_SUBJECT_SHORTEN[lower]) return COMMON_SUBJECT_SHORTEN[lower]
  if (clean.length <= 13) return clean
  // Jika lebih dari 13 karakter dan ada kata pertama & kedua, ambil ringkasan
  const words = clean.split(/\s+/)
  if (words.length > 2) {
    return words.slice(0, 2).join(' ') + '…'
  }
  return clean.slice(0, 11) + '…'
}

export interface RadarDataPoint {
  subject: string
  fullName: string
  score: number
  kkm: number
}

export function transformToRadarData(
  items: Array<{ subject: string; score: number | null; kkm: number }>,
): RadarDataPoint[] {
  return items.map((item) => ({
    subject: formatRadarSubjectName(item.subject),
    fullName: item.subject,
    score: item.score ?? 0,
    kkm: item.kkm ?? 75,
  }))
}

