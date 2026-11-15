// Tipe domain modul CBT (bank soal, sesi ujian, attempt santri)

export interface QuestionOption {
  key: string
  text: string
}

export type QuestionType = 'pg' | 'pg_multi' | 'true_false' | 'matching' | 'essay'
export type Difficulty = 'mudah' | 'sedang' | 'sulit'

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  pg: 'Pilihan Ganda',
  pg_multi: 'PG Kompleks',
  true_false: 'Benar-Salah',
  matching: 'Menjodohkan',
  essay: 'Uraian',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  mudah: 'Mudah',
  sedang: 'Sedang',
  sulit: 'Sulit',
}

export interface MatchingPairs {
  rights: { key: string; text: string }[]
  correct: Record<string, string> // leftKey -> rightKey
}

export interface CbtQuestionClassSubject {
  id: string
  class: { id: string; name: string; grade?: string | null } | null
  subject: { id: string; name: string } | null
}

export interface CbtQuestion {
  id: string
  class_subject_id: string
  question: string
  options: QuestionOption[]
  answer_key: string
  type: QuestionType
  difficulty: Difficulty
  answer: unknown
  pairs: MatchingPairs | null
  points: number
  explanation: string | null
  created_at: string
  class_subject?: CbtQuestionClassSubject | null
}

export type ExamType = 'formatif' | 'sumatif' | 'pts' | 'pas'

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  formatif: 'Formatif',
  sumatif: 'Sumatif',
  pts: 'PTS',
  pas: 'PAS',
}

export interface CbtExam {
  id: string
  title: string
  class_subject_id: string
  duration_minutes: number
  exam_type: ExamType
  question_count: number | null
  difficulty_mix: { mudah?: number; sedang?: number; sulit?: number } | null
  shuffle_questions: boolean
  shuffle_options: boolean
  assessment_id: string | null
  token_hash: string | null
  token_prefix: string | null
  token_expires_at: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  class_subject?: CbtQuestionClassSubject | null
}

export interface CbtAttempt {
  id: string
  exam_id: string
  student_id: string
  status: 'in_progress' | 'submitted' | 'grading'
  started_at: string
  deadline_at: string
  submitted_at: string | null
  score: number | null
  correct_count: number | null
  answers: Record<string, unknown>
  essay_scores: Record<string, number> | null
  question_order: string[]
  client_meta: Record<string, unknown> | null
  student?: {
    id: string
    name: string
    registration_code: string
    class: { name: string } | null
  } | null
}

// ─── Bentuk form ─────────────────────────────────────────────────────────────

export interface QuestionFormValues {
  question: string
  type: QuestionType
  difficulty: Difficulty
  options: { text: string }[]
  answer_key: string
  answer_multi?: string[]
  answer_tf?: 'B' | 'S'
  rights?: { text: string }[]
  correct_pairs?: Record<string, string>
  points: number
  explanation?: string
}

export interface ExamFormValues {
  title: string
  class_subject_id: string
  duration_minutes: number
  exam_type: ExamType
  question_count?: number | null
  difficulty_mix?: { mudah?: number; sedang?: number; sulit?: number } | null
  shuffle_questions: boolean
  shuffle_options: boolean
}

// ─── Hasil RPC publik (dikonsumsi halaman ujian santri) ─────────────────────

export interface PublicExamQuestion {
  id: string
  question: string
  points: number
  type: QuestionType
  difficulty: Difficulty
  options: QuestionOption[]
  pairs: MatchingPairs | null
}

export interface StartExamResult {
  status: 'in_progress' | 'submitted' | 'grading'
  student_name: string
  exam_title?: string
  exam_type?: ExamType
  duration_minutes?: number
  deadline_at?: string
  answers?: Record<string, unknown>
  questions?: PublicExamQuestion[]
  score?: number | null
  correct_count?: number | null
  submitted_at?: string | null
  warnings?: number
}

export interface SubmitExamResult {
  score: number | null
  correct_count: number | null
  already_submitted: boolean
}
