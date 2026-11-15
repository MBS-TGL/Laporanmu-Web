import { supabase } from '../../lib/supabase'
import {
  ASSESSMENT_TYPES,
  DEFAULT_WEIGHT,
  type Assessment,
  type AssessmentScoreRow,
  type AssessmentStudent,
  type AssessmentType,
  type ClassSubjectInfo,
  type GradeConfig,
  type GradeUpsert,
  type GradeWeight,
} from './types'

const CS_SELECT =
  'id, class_id, subject_id, teacher_id, kkm_override, ' +
  'classes(id, name, grade), subjects(id, name, code, kkm, weekly_hours), teachers(id, name)'

// ── Konfigurasi bobot ───────────────────────────────────────

export async function fetchGradeConfig(academicYearId: string): Promise<GradeConfig | null> {
  const { data, error } = await supabase
    .from('grade_configs')
    .select('id, academic_year_id, bobot')
    .eq('academic_year_id', academicYearId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return (data as GradeConfig) ?? null
}

export async function upsertGradeConfig(
  academicYearId: string,
  bobot: GradeWeight,
): Promise<void> {
  const { error } = await supabase
    .from('grade_configs')
    .upsert(
      { academic_year_id: academicYearId, bobot },
      { onConflict: 'academic_year_id' },
    )
  if (error) throw error
}

// ── Daftar class_subjects tahun ajaran ──────────────────────

export async function fetchClassSubjectsBrief(
  academicYearId: string,
): Promise<ClassSubjectInfo[]> {
  const { data, error } = await supabase
    .from('class_subjects')
    .select(CS_SELECT)
    .eq('academic_year_id', academicYearId)
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw error
  const rows = (data ?? []) as unknown as ClassSubjectInfo[]
  return rows.sort((a, b) => {
    const cn = (a.classes?.name ?? '').localeCompare(b.classes?.name ?? '', 'id')
    if (cn !== 0) return cn
    return (a.subjects?.name ?? '').localeCompare(b.subjects?.name ?? '', 'id')
  })
}

// ── Ulangan ─────────────────────────────────────────────────

export async function fetchAssessments(classSubjectId: string): Promise<Assessment[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('id, class_subject_id, type, title, assessment_date, max_score, sort_order, created_at')
    .eq('class_subject_id', classSubjectId)
    .is('deleted_at', null)
    .order('type')
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Assessment[]
}

export interface AssessmentFormValues {
  type: AssessmentType
  title: string
  assessment_date?: string
  max_score?: number
}

export async function createAssessment(
  classSubjectId: string,
  values: AssessmentFormValues,
): Promise<Assessment> {
  const { data, error } = await supabase
    .from('assessments')
    .insert({
      class_subject_id: classSubjectId,
      type: values.type,
      title: values.title,
      assessment_date: values.assessment_date || null,
      max_score: values.max_score ?? 100,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Assessment
}

export async function updateAssessment(
  id: string,
  values: Partial<AssessmentFormValues>,
): Promise<void> {
  const { error } = await supabase
    .from('assessments')
    .update({
      title: values.title,
      assessment_date: values.assessment_date || null,
      max_score: values.max_score,
    })
    .eq('id', id)
  if (error) throw error
}

export async function softDeleteAssessment(id: string): Promise<void> {
  const { error } = await supabase
    .from('assessments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── Nilai per santri ────────────────────────────────────────

export async function fetchAssessmentScores(
  classSubjectId: string,
): Promise<AssessmentScoreRow[]> {
  const { data, error } = await supabase
    .from('assessment_scores')
    .select('id, assessment_id, student_id, score')
    .in(
      'assessment_id',
      (await fetchAssessmentIds(classSubjectId)) as unknown as string[],
    )
  if (error) throw error
  return (data ?? []) as AssessmentScoreRow[]
}

async function fetchAssessmentIds(classSubjectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('assessments')
    .select('id')
    .eq('class_subject_id', classSubjectId)
    .is('deleted_at', null)
  if (error) throw error
  return (data ?? []).map((r) => r.id)
}

export async function fetchClassStudents(classId: string): Promise<AssessmentStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, registration_code')
    .eq('class_id', classId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as AssessmentStudent[]
}

/**
 * Simpan nilai massal: score null → hapus baris; selainnya upsert.
 */
export async function upsertAssessmentScores(payload: GradeUpsert[]): Promise<void> {
  const toUpsert = payload.filter((r) => typeof r.score === 'number')
  const toDelete = payload.filter((r) => r.score === null)

  if (toUpsert.length > 0) {
    const { error } = await supabase.from('assessment_scores').upsert(
      toUpsert.map((r) => ({
        assessment_id: r.assessment_id,
        student_id: r.student_id,
        score: r.score,
      })),
      { onConflict: 'assessment_id,student_id' },
    )
    if (error) throw error
  }

  if (toDelete.length > 0) {
    for (const r of toDelete) {
      const { error } = await supabase
        .from('assessment_scores')
        .delete()
        .eq('assessment_id', r.assessment_id)
        .eq('student_id', r.student_id)
      if (error) throw error
    }
  }
}

// ── Generate nilai ke rapor semester ────────────────────────

export async function generateSemesterGrade(
  classSubjectId: string,
  semester: 1 | 2,
): Promise<number> {
  const { data, error } = await supabase.rpc('generate_semester_grade', {
    p_class_subject_id: classSubjectId,
    p_semester: semester,
  })
  if (error) throw error
  return (data as number) ?? 0
}

// ── Fetch satu class_subject by ID ──────────────────────────

export async function fetchClassSubjectById(id: string): Promise<ClassSubjectInfo | null> {
  const { data, error } = await supabase
    .from('class_subjects')
    .select(CS_SELECT)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as ClassSubjectInfo) ?? null
}

// ── Nilai rapor semester untuk leger ────────────────────────

export interface SemesterScoresMap {
  // student_id -> { subject_id: score }
  [studentId: string]: Record<string, number | null>
}

export async function fetchSemesterScoresForClass(
  classId: string,
  academicYearId: string,
  semester: 1 | 2,
): Promise<SemesterScoresMap> {
  // 1. Ambil student_ids aktif di kelas
  const students = await fetchClassStudents(classId)
  if (students.length === 0) return {}
  const studentIds = students.map((s) => s.id)

  // 2. Ambil student_semester_reports type 'general'
  const { data, error } = await supabase
    .from('student_semester_reports')
    .select('student_id, scores')
    .eq('report_type', 'general')
    .eq('semester', semester)
    .eq('academic_year_id', academicYearId)
    .in('student_id', studentIds)
  if (error) throw error

  const result: SemesterScoresMap = {}
  for (const row of data ?? []) {
    result[row.student_id] = (row.scores as Record<string, number | null>) ?? {}
  }
  return result
}


/** Rata-rata satu jenis penilaian untuk satu santri */
export function averageByType(
  scores: AssessmentScoreRow[],
  assessments: Assessment[],
  studentId: string,
  type: AssessmentType,
): number | null {
  const ids = new Set(assessments.filter((a) => a.type === type).map((a) => a.id))
  const values = scores
    .filter((s) => ids.has(s.assessment_id) && s.student_id === studentId && s.score !== null)
    .map((s) => s.score as number)
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 100) / 100
}

/** Nilai akhir terboboti — jenis tanpa nilai dinormalisasi bobotnya */
export function weightedFinal(
  averages: Partial<Record<AssessmentType, number | null>>,
  bobot: GradeWeight = DEFAULT_WEIGHT,
): number | null {
  let num = 0
  let den = 0
  for (const type of ASSESSMENT_TYPES) {
    const avg = averages[type]
    if (typeof avg !== 'number') continue
    num += avg * bobot[type]
    den += bobot[type]
  }
  if (den === 0) return null
  return Math.round((num / den) * 100) / 100
}
