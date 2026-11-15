// Tipe domain modul Keuangan SPP (kewajiban biaya & pembayaran)

export type SppFrequency = 'sekali' | 'bulanan' | 'semester'
export type SppMethod = 'tunai' | 'transfer' | 'qris'

export const FREQUENCY_LABEL: Record<SppFrequency, string> = {
  sekali: 'Sekali',
  bulanan: 'Bulanan',
  semester: 'Per Semester',
}

export const METHOD_LABEL: Record<SppMethod, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
}

export interface SppComponent {
  id: string
  academic_year_id: string
  name: string
  amount: number
  frequency: SppFrequency
  grade: '7' | '8' | '9' | null
  created_at: string
  academic_year?: { id: string; name: string } | null
}

export interface SppObligation {
  id: string
  student_id: string
  component_id: string
  academic_year_id: string
  amount: number
  period: string | null
  due_date: string | null
  created_at: string
  student?: {
    id: string
    name: string
    registration_code: string
    class: { id: string; name: string } | null
  } | null
  component?: { id: string; name: string; frequency: SppFrequency } | null
  /** Diisi client-side setelah agregasi pembayaran */
  paid?: number
}

export interface SppPayment {
  id: string
  obligation_id: string
  amount: number
  method: SppMethod
  paid_at: string
  note: string | null
  created_at: string
  obligation?: {
    id: string
    period: string | null
    amount: number
    academic_year_id: string
    component?: { name: string } | null
    student?: {
      id: string
      name: string
      registration_code: string
      class: { name: string } | null
    } | null
  } | null
  creator?: { name: string } | null
}

// ─── Form ────────────────────────────────────────────────────────────────────

export interface ComponentFormValues {
  name: string
  amount: number
  frequency: SppFrequency
  grade?: '7' | '8' | '9' | null
}

export interface PaymentFormValues {
  obligation_id: string
  amount: number
  method: SppMethod
  paid_at: string
  note?: string
}
