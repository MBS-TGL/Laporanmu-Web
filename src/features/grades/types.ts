export type AssessmentType = 'formatif' | 'sumatif' | 'pts' | 'pas'

export const ASSESSMENT_TYPE_LABEL: Record<AssessmentType, string> = {
  formatif: 'Formatif',
  sumatif: 'Sumatif',
  pts: 'PTS',
  pas: 'PAS',
}

export interface GradeWeight {
  formatif: number
  sumatif: number
  pts: number
  pas: number
}

export const DEFAULT_WEIGHT: GradeWeight = {
  formatif: 30,
  sumatif: 20,
  pts: 20,
  pas: 30,
}

export interface GradeConfig {
  id: string
  academic_year_id: string
  bobot: GradeWeight
}

export interface Assessment {
  id: string
  class_subject_id: string
  type: AssessmentType
  title: string
  assessment_date: string | null
  max_score: number
  sort_order: number
  created_at?: string
}

export interface AssessmentScoreRow {
  id: string
  assessment_id: string
  student_id: string
  score: number | null
}

/** Baris class_subject + nama terkait — untuk halaman penilaian */
export interface ClassSubjectInfo {
  id: string
  class_id: string
  subject_id: string
  teacher_id: string | null
  kkm_override: number | null
  classes: { id: string; name: string; grade: string | null } | null
  subjects: { id: string; name: string; code: string | null; kkm: number | null; weekly_hours: number } | null
  teachers: { id: string; name: string } | null
}

export interface AssessmentStudent {
  id: string
  name: string
  registration_code: string
}

export interface GradeUpsert {
  assessment_id: string
  student_id: string
  score: number | null
}

export const ASSESSMENT_TYPES: AssessmentType[] = ['formatif', 'sumatif', 'pts', 'pas']
