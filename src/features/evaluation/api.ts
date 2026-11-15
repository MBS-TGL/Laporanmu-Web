import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import { generateExamToken } from '../cbt/examUtil'
import type { Instrument, InstrumentResponse } from './types'

const INSTRUMENT_SELECT = '*, class:classes(id, name)'

// ------------------------------------------------------------
// Staf: kelola angket
// ------------------------------------------------------------
export async function fetchInstruments(): Promise<Instrument[]> {
  const { data, error } = await supabase
    .from('instruments')
    .select(INSTRUMENT_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data ?? []) as unknown as Instrument[]
}

export async function createInstrument(
  values: { kind: string; title: string; description: string | null; target_class_id: string; questions: unknown[] },
  createdBy: string | null,
): Promise<Instrument> {
  const { data, error } = await supabase
    .from('instruments')
    .insert({
      kind: values.kind,
      title: values.title.trim(),
      description: values.description?.trim() || null,
      target_class_id: values.target_class_id,
      questions: values.questions,
      created_by: createdBy,
    })
    .select(INSTRUMENT_SELECT)
    .single()
  if (error) throw error
  return data as unknown as Instrument
}

export async function updateInstrumentQuestions(
  id: string,
  questions: unknown[],
): Promise<void> {
  const { error } = await supabase.from('instruments').update({ questions }).eq('id', id)
  if (error) throw error
}

export async function deleteInstrument(id: string): Promise<void> {
  return softDelete('instruments', id)
}

export interface ActivateInstrumentInput {
  instrumentId: string
  tokenHash: string
  tokenPrefix: string
  tokenExpiresAt: string
}

/** Terbitkan angket: simpan hash token (ala CBT/suspension). */
export async function activateInstrumentToken(input: ActivateInstrumentInput): Promise<void> {
  const { error } = await supabase
    .from('instruments')
    .update({
      token_hash: input.tokenHash,
      token_prefix: input.tokenPrefix,
      token_expires_at: input.tokenExpiresAt,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq('id', input.instrumentId)
  if (error) throw error
}

export async function revokeInstrumentToken(instrumentId: string): Promise<void> {
  const { error } = await supabase
    .from('instruments')
    .update({
      token_hash: null,
      token_prefix: null,
      token_expires_at: null,
      is_published: false,
    })
    .eq('id', instrumentId)
  if (error) throw error
}

export async function generateInstrumentToken(): Promise<{ raw: string; display: string; hash: string; prefix: string }> {
  return generateExamToken() // alfabet & panjang sama dengan token CBT
}

// ------------------------------------------------------------
// Staf: respons
// ------------------------------------------------------------
export async function fetchInstrumentResponses(instrumentId: string): Promise<InstrumentResponse[]> {
  const { data, error } = await supabase
    .from('instrument_responses')
    .select(
      '*, student:students(id, name, registration_code, class:classes!students_class_id_fkey(name))',
    )
    .eq('instrument_id', instrumentId)
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as unknown as InstrumentResponse[]
}

// ------------------------------------------------------------
// Publik: isian santri
// ------------------------------------------------------------
export async function rpcEvalStart(token: string, studentCode: string) {
  const { data, error } = await supabase.rpc('eval_start', {
    p_token: token,
    p_student_code: studentCode,
  })
  if (error) throw error
  return data
}

export async function rpcEvalSubmit(token: string, studentCode: string, answers: Record<string, unknown>) {
  const { data, error } = await supabase.rpc('eval_submit', {
    p_token: token,
    p_student_code: studentCode,
    p_answers: answers,
  })
  if (error) throw error
  return data
}
