export type OfficialLetterType = 'panggilan' | 'peringatan' | 'pujian'

export interface OfficialLetter {
  id: string
  student_id: string
  type: OfficialLetterType
  letter_no: string
  subject: string
  body_text: string
  verify_token: string
  issued_date: string
  related_report_id: string | null
  created_by: string | null
  created_at: string
  students?: {
    id: string
    name: string
    registration_code: string
    class_id: string | null
    classes?: { name: string } | null
    guardian_name: string | null
    guardian_relation: string | null
    phone: string | null
  } | null
}

export interface OfficialLetterPayload {
  student_id: string
  type: OfficialLetterType
  letter_no: string
  subject: string
  body_text: string
  issued_date?: string
  related_report_id?: string | null
}

export const LETTER_TYPE_META: Record<
  OfficialLetterType,
  { label: string; color: string; prefix: string }
> = {
  panggilan: { label: 'Surat Panggilan', color: 'rose', prefix: 'SP-ORTU' },
  peringatan: { label: 'Surat Peringatan (SP)', color: 'amber', prefix: 'SP-SANTRI' },
  pujian: { label: 'Surat Pujian / Prestasi', color: 'emerald', prefix: 'PIAGAM' },
}
