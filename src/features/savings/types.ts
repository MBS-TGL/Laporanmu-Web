export type SavingsStatus = 'active' | 'closed'
export type SavingsTxnKind = 'deposit' | 'withdrawal'

export interface SavingsAccount {
  id: string
  student_id: string
  balance: number
  status: SavingsStatus
  opened_at: string
  closed_at: string | null
  note: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
  students?: {
    id: string
    name: string
    registration_code: string
    classes?: { name: string } | null
  } | null
}

export interface SavingsTxn {
  id: string
  account_id: string
  kind: SavingsTxnKind
  amount: number
  balance_after: number
  note: string | null
  occurred_at: string
  created_by: string | null
  created_at?: string
  profiles?: { name: string } | null
}

export interface AccountFormValues {
  student_id: string
  note?: string
}

export interface TxnValues {
  kind: SavingsTxnKind
  amount: number
  note?: string
  occurred_at: string
}
