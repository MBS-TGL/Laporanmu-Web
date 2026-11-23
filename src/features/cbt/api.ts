import { supabase } from '../../lib/supabase'
import { softDelete, softDeleteMany } from '../../shared/api/crud'
import type { CbtAttempt, CbtExam, CbtQuestion, ExamFormValues } from './types'

// Embed class_subjects: FK ke tabel berbeda, tanpa ambiguitas (tanpa hint).
// Embed classes dari students WAJIB hint FK — students punya 3 FK ke classes.
const CS_EMBED = 'class_subject:class_subjects(id, class:classes(id, name, grade), subject:subjects(id, name))'
const ATTEMPT_SELECT =
  '*, student:students(id, name, registration_code, class:classes!students_class_id_fkey(name))'

// ------------------------------------------------------------
// Bank soal
// ------------------------------------------------------------
export async function fetchCbtQuestions(classSubjectId?: string): Promise<CbtQuestion[]> {
  let query = supabase
    .from('cbt_questions')
    .select(`*, ${CS_EMBED}`)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(2000)
  if (classSubjectId) query = query.eq('class_subject_id', classSubjectId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as CbtQuestion[]
}

export interface QuestionInput {
  class_subject_id: string
  question: string
  type?: string
  difficulty?: string
  options: { key: string; text: string }[]
  answer_key: string
  answer?: unknown
  pairs?: unknown
  points: number
  explanation?: string | null
}

export async function createCbtQuestion(input: QuestionInput): Promise<CbtQuestion> {
  const { data, error } = await supabase
    .from('cbt_questions')
    .insert(input)
    .select(`*, ${CS_EMBED}`)
    .single()
  if (error) throw error
  return data as unknown as CbtQuestion
}

export async function updateCbtQuestion(id: string, input: QuestionInput): Promise<void> {
  const { error } = await supabase.from('cbt_questions').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteCbtQuestion(id: string): Promise<void> {
  return softDelete('cbt_questions', id)
}

export async function deleteCbtQuestionsMany(ids: string[]): Promise<void> {
  return softDeleteMany('cbt_questions', ids)
}

export async function createCbtQuestionsBulk(rows: QuestionInput[]): Promise<number> {
  const { error } = await supabase.from('cbt_questions').insert(rows)
  if (error) throw error
  return rows.length
}

// ------------------------------------------------------------
// Sesi ujian
// ------------------------------------------------------------
export async function fetchCbtExams(): Promise<CbtExam[]> {
  const { data, error } = await supabase
    .from('cbt_exams')
    .select(`*, ${CS_EMBED}`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as unknown as CbtExam[]
}

export async function createCbtExam(values: ExamFormValues, createdBy: string | null): Promise<CbtExam> {
  const { data, error } = await supabase
    .from('cbt_exams')
    .insert({
      title: values.title.trim(),
      class_subject_id: values.class_subject_id,
      duration_minutes: values.duration_minutes,
      exam_type: values.exam_type,
      question_count: values.question_count || null,
      show_explanations: values.show_explanations ?? false,
      show_leaderboard: values.show_leaderboard ?? false,
      difficulty_mix: values.difficulty_mix ?? {},
      shuffle_questions: values.shuffle_questions,
      shuffle_options: values.shuffle_options,
      created_by: createdBy,
    })
    .select(`*, ${CS_EMBED}`)
    .single()
  if (error) throw error
  return data as unknown as CbtExam
}

export async function updateCbtExam(id: string, values: ExamFormValues): Promise<void> {
  const { error } = await supabase
    .from('cbt_exams')
    .update({
      title: values.title.trim(),
      class_subject_id: values.class_subject_id,
      duration_minutes: values.duration_minutes,
      exam_type: values.exam_type,
      question_count: values.question_count || null,
      show_explanations: values.show_explanations ?? false,
      show_leaderboard: values.show_leaderboard ?? false,
      difficulty_mix: values.difficulty_mix ?? {},
      shuffle_questions: values.shuffle_questions,
      shuffle_options: values.shuffle_options,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCbtExam(id: string): Promise<void> {
  return softDelete('cbt_exams', id)
}

export interface ActivateExamInput {
  examId: string
  /** Ujian yang sudah pernah punya assessment tidak membuat ulang. */
  assessment: { class_subject_id: string; type: string; title: string } | null
  tokenHash: string
  tokenPrefix: string
  tokenExpiresAt: string
}

/**
 * Terbitkan ujian + aktifkan token: buat assessment (pipeline nilai)
 * sekali, lalu simpan hash token. Tiga langkah berurutan — RLS staf
 * biasa cukup, tanpa RPC khusus.
 */
export async function activateExamToken(input: ActivateExamInput): Promise<void> {
  const current = await supabase
    .from('cbt_exams')
    .select('id, assessment_id, is_published')
    .eq('id', input.examId)
    .single()
  if (current.error) throw current.error

  let assessmentId = current.data.assessment_id as string | null
  if (!assessmentId && input.assessment) {
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        class_subject_id: input.assessment.class_subject_id,
        type: input.assessment.type,
        title: input.assessment.title,
        max_score: 100,
      })
      .select('id')
      .single()
    if (error) throw error
    assessmentId = data.id
  }

  const { error: upErr } = await supabase
    .from('cbt_exams')
    .update({
      token_hash: input.tokenHash,
      token_prefix: input.tokenPrefix,
      token_expires_at: input.tokenExpiresAt,
      is_published: true,
      published_at: new Date().toISOString(),
      assessment_id: assessmentId,
    })
    .eq('id', input.examId)
  if (upErr) throw upErr
}

export async function revokeExamToken(examId: string): Promise<void> {
  const { error } = await supabase
    .from('cbt_exams')
    .update({
      token_hash: null,
      token_prefix: null,
      token_expires_at: null,
      is_published: false,
    })
    .eq('id', examId)
  if (error) throw error
}

// ------------------------------------------------------------
// Attempt (monitoring pengawas)
// ------------------------------------------------------------
export async function fetchCbtAttempts(examId: string): Promise<CbtAttempt[]> {
  const { data, error } = await supabase
    .from('cbt_attempts')
    .select(ATTEMPT_SELECT)
    .eq('exam_id', examId)
    .order('started_at', { ascending: true })
    .limit(500)
  if (error) throw error
  return (data ?? []) as unknown as CbtAttempt[]
}

export async function forceSubmitAttempt(attemptId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('cbt_force_submit_checked', { p_attempt_id: attemptId })
  if (error) throw error
  return (data as number | null) ?? null
}

/** Nilai essay attempt (staf) — finalisasi skor saat semua essay ternilai. */
export async function gradeEssays(attemptId: string, scores: Record<string, number>): Promise<number | null> {
  const { data, error } = await supabase.rpc('cbt_grade_essays_checked', {
    p_attempt_id: attemptId,
    p_scores: scores,
  })
  if (error) throw error
  return (data as number | null) ?? null
}

// ------------------------------------------------------------
// RPC publik (halaman ujian santri, anon)
// ------------------------------------------------------------
export async function rpcStartExam(token: string, studentCode: string) {
  const { data, error } = await supabase.rpc('cbt_start_attempt', {
    p_token: token,
    p_student_code: studentCode,
  })
  if (error) throw error
  return data
}

export async function rpcSaveExamAnswers(token: string, studentCode: string, answers: Record<string, unknown>) {
  const { error } = await supabase.rpc('cbt_save_answers', {
    p_token: token,
    p_student_code: studentCode,
    p_answers: answers,
  })
  if (error) throw error
}

export async function rpcSubmitExam(token: string, studentCode: string, answers: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('cbt_submit_attempt', {
    p_token: token,
    p_student_code: studentCode,
    p_answers: answers,
  })
  if (error) throw error
  return data
}

/** Lapor event kecurangan (pindah tab, blur, dsb) — fire-and-forget dari halaman ujian. */
export async function rpcReportExamEvent(token: string, studentCode: string, event: string, meta?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('cbt_report_event', {
    p_token: token,
    p_student_code: studentCode,
    p_event: event,
    p_meta: meta ?? null,
  })
  if (error) throw error
  return data
}
// ------------------------------------------------------------
// Review jawaban pasca-ujian (publik, anon)
// ------------------------------------------------------------
export async function rpcReviewAnswers(token: string, studentCode: string) {
  const { data, error } = await supabase.rpc('cbt_review_answers', {
    p_token: token,
    p_student_code: studentCode,
  })
  if (error) throw error
  return data
}
// ------------------------------------------------------------
// Papan peringkat anonim (publik, anon; hanya jika show_leaderboard)
// ------------------------------------------------------------
export async function rpcLeaderboard(token: string) {
  const { data, error } = await supabase.rpc('cbt_leaderboard', { p_token: token })
  if (error) throw error
  return data
}
// ------------------------------------------------------------
// Remedial: salin ujian (soal bank sama, token diaktifkan terpisah)
// ------------------------------------------------------------
export async function createRemedialExam(source: CbtExam, createdBy: string | null): Promise<CbtExam> {
  const { data, error } = await supabase
    .from('cbt_exams')
    .insert({
      title: source.title + ' (Remedial)',
      class_subject_id: source.class_subject_id,
      duration_minutes: source.duration_minutes,
      exam_type: source.exam_type,
      question_count: source.question_count,
      shuffle_questions: source.shuffle_questions,
      shuffle_options: source.shuffle_options,
      is_remedial_of: source.id,
      created_by: createdBy,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as CbtExam
}
