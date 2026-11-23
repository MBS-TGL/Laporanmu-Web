export interface Book {
  id: string
  code: string | null
  title: string
  author: string | null
  publisher: string | null
  year: number | null
  category: string | null
  copies: number
  shelf: string | null
  description: string | null
  deleted_at: string | null
  created_at?: string
  updated_at?: string
}

export interface BookLoan {
  id: string
  book_id: string
  student_id: string
  borrowed_at: string
  due_date: string | null
  returned_at: string | null
  notes: string | null
  /** Denda keterlambatan (0069) */
  fine_amount: number
  fine_paid: boolean
  condition_on_return: ItemCondition | null
  created_at?: string
  updated_at?: string
  students?: {
    id: string
    name: string
    registration_code: string
    classes?: { name: string } | null
  } | null
  books?: { id: string; title: string; code: string | null } | null
}

export type ItemCondition = 'good' | 'light_damaged' | 'heavy_damaged' | 'lost'

export const RETURN_CONDITION_LABEL: Record<ItemCondition, string> = {
  good: 'Baik',
  light_damaged: 'Rusak Ringan',
  heavy_damaged: 'Rusak Berat',
  lost: 'Hilang',
}

/** Denda keterlambatan: Rp 1.000 per hari setelah jatuh tempo. */
export const FINE_PER_DAY = 1000

export function computeFine(dueDate: string | null, returnedAt: string | null): number {
  if (!dueDate || !returnedAt) return 0
  const due = new Date(dueDate)
  const ret = new Date(returnedAt)
  const days = Math.floor((ret.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))
  return days > 0 ? days * FINE_PER_DAY : 0
}

export type LoanView = '' | 'active' | 'overdue' | 'returned'

export interface BookFormValues {
  title: string
  code?: string
  author?: string
  publisher?: string
  year?: number
  category?: string
  copies: number
  shelf?: string
  description?: string
}

export interface LoanFormValues {
  book_id: string
  student_id: string
  borrowed_at: string
  due_date?: string
  notes?: string
}
