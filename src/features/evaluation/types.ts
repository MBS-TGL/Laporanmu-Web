// Tipe domain Pusat Evaluasi (engine kuesioner generik)

export type InstrumentKind = 'akpd' | 'sosiometri' | 'mbti' | 'edom' | 'custom'

export const INSTRUMENT_KIND_LABEL: Record<InstrumentKind, string> = {
  akpd: 'AKPD',
  sosiometri: 'Sosiometri',
  mbti: 'MBTI',
  edom: 'EDOM Guru',
  custom: 'Kustom',
}

/** Tipe pertanyaan angket */
export type EvalQuestionType = 'skala' | 'pilihan' | 'teks' | 'teman'

export interface EvalQuestion {
  id: string
  text: string
  type: EvalQuestionType
  /** Kelompok analisis (dimensi AKPD/EDOM, pasangan MBTI 'EI', dst.) */
  dimension?: string
  /** Untuk skala: nilai maksimum (default 5) */
  max?: number
  /** Untuk pilihan: opsi jawaban */
  options?: { key: string; text: string }[]
  /** Untuk teman: maksimal pilihan (sosiometri, default 3) */
  maxChoices?: number
}

export interface InstrumentClass {
  id: string
  name: string
}

export interface Instrument {
  id: string
  kind: InstrumentKind
  title: string
  description: string | null
  target_class_id: string
  questions: EvalQuestion[]
  token_hash: string | null
  token_prefix: string | null
  token_expires_at: string | null
  is_published: boolean
  published_at: string | null
  created_at: string
  class?: InstrumentClass | null
}

export interface InstrumentResponse {
  id: string
  instrument_id: string
  student_id: string
  answers: Record<string, unknown>
  submitted_at: string | null
  student?: {
    id: string
    name: string
    registration_code: string
    class: { name: string } | null
  } | null
}

// ─── Publik (isian santri) ───────────────────────────────────────────────────

export interface SurveyClassmate {
  key: string
  text: string
}

export interface SurveyStartResult {
  status: 'in_progress' | 'submitted'
  student_name: string
  instrument_title?: string
  kind?: InstrumentKind
  answers?: Record<string, unknown>
  classmates?: SurveyClassmate[]
  questions?: EvalQuestion[]
}
