import type {
  MonthlyDraft,
  MonthlyReport,
  MonthlyReportPayload,
  SemesterDraft,
  SemesterReport,
  SemesterReportPayload,
  SemesterType,
} from './types'

export const MONTHLY_SCORE_KEYS = [
  'character_score',
  'worship_score',
  'cleanliness_score',
  'quran_score',
  'language_score',
] as const

export type MonthlyScoreKey = (typeof MONTHLY_SCORE_KEYS)[number]

export function monthlyHasContent(m: Partial<MonthlyDraft> | null | undefined): boolean {
  if (!m) return false
  return (
    MONTHLY_SCORE_KEYS.some((k) => typeof m[k] === 'number') ||
    Boolean(
      m.notes ||
        m.ziyadah ||
        m.murojaah ||
        m.total_hafalan ||
        m.weight_kg ||
        m.height_cm ||
        m.sholat ||
        m.sick_days ||
        m.excused_days ||
        m.absent_days ||
        m.early_leave_days ||
        m.violations ||
        m.achievements,
    )
  )
}

/** Gabungkan nilai tersimpan + draf menjadi payload upsert bulanan.
 * Return null bila belum ada baris tersimpan DAN draf kosong (tidak ada yang di-upsert). */
export function buildMonthlyPayload(args: {
  studentId: string
  draft: MonthlyDraft | undefined
  saved: MonthlyReport | undefined
  month: number
  year: number
  musyrifName: string | null
  updatedBy: string | null
}): MonthlyReportPayload | null {
  const { studentId, draft, saved, month, year, musyrifName, updatedBy } = args
  const merged: MonthlyDraft = {
    character_score: saved?.character_score ?? null,
    worship_score: saved?.worship_score ?? null,
    cleanliness_score: saved?.cleanliness_score ?? null,
    quran_score: saved?.quran_score ?? null,
    language_score: saved?.language_score ?? null,
    weight_kg: saved?.weight_kg ?? null,
    height_cm: saved?.height_cm ?? null,
    ziyadah: saved?.ziyadah ?? undefined,
    murojaah: saved?.murojaah ?? undefined,
    total_hafalan: saved?.total_hafalan ?? undefined,
    sholat: saved?.sholat ?? undefined,
    sick_days: saved?.sick_days ?? 0,
    excused_days: saved?.excused_days ?? 0,
    absent_days: saved?.absent_days ?? 0,
    early_leave_days: saved?.early_leave_days ?? 0,
    notes: saved?.notes ?? undefined,
    violations: saved?.violations ?? undefined,
    achievements: saved?.achievements ?? undefined,
    ...draft,
  }
  // Lewati hanya jika belum ada baris tersimpan DAN memang kosong.
  // Jika baris sudah ada, tetap disimpan agar pengosongan nilai ikut tersimpan.
  if (!saved && !monthlyHasContent(merged)) return null
  return {
    student_id: studentId,
    month,
    year,
    musyrif_name: musyrifName,
    character_score: merged.character_score ?? null,
    worship_score: merged.worship_score ?? null,
    cleanliness_score: merged.cleanliness_score ?? null,
    quran_score: merged.quran_score ?? null,
    language_score: merged.language_score ?? null,
    weight_kg: merged.weight_kg ?? null,
    height_cm: merged.height_cm ?? null,
    ziyadah: merged.ziyadah ?? null,
    murojaah: merged.murojaah ?? null,
    total_hafalan: merged.total_hafalan ?? null,
    sholat: merged.sholat ?? null,
    sick_days: merged.sick_days ?? 0,
    excused_days: merged.excused_days ?? 0,
    absent_days: merged.absent_days ?? 0,
    early_leave_days: merged.early_leave_days ?? 0,
    notes: merged.notes ?? null,
    violations: merged.violations ?? null,
    achievements: merged.achievements ?? null,
    updated_by: updatedBy,
  }
}

export function semesterHasContent(scores: Record<string, number | null>, extras: SemesterReport['extras']): boolean {
  return (
    Object.values(scores).some((v) => typeof v === 'number') ||
    Boolean(
      extras.notes ||
        extras.weight_kg ||
        extras.height_cm ||
        extras.sholat ||
        extras.sick_days ||
        extras.excused_days ||
        extras.absent_days ||
        extras.early_leave_days ||
        (extras.ekskul && extras.ekskul.length > 0),
    )
  )
}

/** Gabungkan hasil upsert ke cache query periode aktif tanpa refetch. */
export function mergeMonthlyRows(
  current: MonthlyReport[] | undefined,
  payloads: MonthlyReportPayload[],
): MonthlyReport[] {
  const map = new Map((current ?? []).map((row) => [row.student_id, row]))
  for (const payload of payloads) {
    const previous = map.get(payload.student_id)
    map.set(payload.student_id, {
      ...(previous ?? { id: payload.student_id }),
      ...payload,
    } as MonthlyReport)
  }
  return [...map.values()]
}

export function mergeSemesterRows(
  current: SemesterReport[] | undefined,
  payloads: SemesterReportPayload[],
): SemesterReport[] {
  const map = new Map((current ?? []).map((row) => [row.student_id, row]))
  for (const payload of payloads) {
    const previous = map.get(payload.student_id)
    map.set(payload.student_id, {
      ...(previous ?? { id: payload.student_id }),
      ...payload,
    } as SemesterReport)
  }
  return [...map.values()]
}

/** Gabungkan nilai tersimpan + draf menjadi payload upsert semester.
 * Return null bila belum ada baris tersimpan DAN draf kosong. */
export function buildSemesterPayload(args: {
  studentId: string
  draft: SemesterDraft | undefined
  saved: SemesterReport | undefined
  reportType: SemesterType
  semester: 1 | 2
  academicYearId: string
  musyrifName: string | null
  updatedBy: string | null
}): SemesterReportPayload | null {
  const { studentId, draft, saved, reportType, semester, academicYearId, musyrifName, updatedBy } = args
  const scores = { ...(saved?.scores ?? {}), ...draft?.scores }
  const extras = {
    weight_kg: draft?.weight_kg ?? saved?.extras?.weight_kg ?? null,
    height_cm: draft?.height_cm ?? saved?.extras?.height_cm ?? null,
    sholat: draft?.sholat ?? saved?.extras?.sholat ?? null,
    sick_days: draft?.sick_days ?? saved?.extras?.sick_days ?? 0,
    excused_days: draft?.excused_days ?? saved?.extras?.excused_days ?? 0,
    absent_days: draft?.absent_days ?? saved?.extras?.absent_days ?? 0,
    early_leave_days: draft?.early_leave_days ?? saved?.extras?.early_leave_days ?? 0,
    notes: draft?.notes ?? saved?.extras?.notes ?? null,
    ekskul: draft?.ekskul ?? saved?.extras?.ekskul,
  }
  if (!saved && !semesterHasContent(scores, extras)) return null
  return {
    student_id: studentId,
    report_type: reportType,
    semester,
    academic_year_id: academicYearId,
    scores,
    extras,
    musyrif_name: musyrifName,
    updated_by: updatedBy,
  }
}
