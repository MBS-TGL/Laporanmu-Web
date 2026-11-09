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
