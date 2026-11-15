import { supabase } from '../../../lib/supabase'
import type { OfficialLetter, OfficialLetterPayload } from './types'

function generateVerifyToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let res = 'LT-'
  for (let i = 0; i < 12; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return res
}

export function generateLetterNumber(prefix: string): string {
  const year = new Date().getFullYear()
  const randomSeq = Math.floor(100 + Math.random() * 900)
  return `${randomSeq}/${prefix}/SMPM-4/${year}`
}

export async function fetchOfficialLetters(): Promise<OfficialLetter[]> {
  const { data, error } = await supabase
    .from('official_letters')
    .select('*, students(id, name, registration_code, class_id, classes!students_class_id_fkey(name), guardian_name, guardian_relation, phone)')
    .is('deleted_at', null)
    .order('issued_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as OfficialLetter[]
}

export async function createOfficialLetter(payload: OfficialLetterPayload): Promise<OfficialLetter> {
  const verifyToken = generateVerifyToken()

  const { data, error } = await supabase
    .from('official_letters')
    .insert({
      student_id: payload.student_id,
      type: payload.type,
      letter_no: payload.letter_no.trim(),
      subject: payload.subject.trim(),
      body_text: payload.body_text.trim(),
      issued_date: payload.issued_date || new Date().toISOString().slice(0, 10),
      verify_token: verifyToken,
      related_report_id: payload.related_report_id || null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as OfficialLetter
}

export async function softDeleteOfficialLetter(id: string): Promise<void> {
  const { error } = await supabase
    .from('official_letters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
