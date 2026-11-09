import { supabase } from '../../lib/supabase'
import type { Book, BookFormValues, BookLoan, LoanFormValues } from './types'

const LOAN_SELECT =
  '*, students(id, name, registration_code, classes(name)), books(id, title, code)'

// ------------------------------------------------------------
// Buku
// ------------------------------------------------------------

export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .is('deleted_at', null)
    .order('title')
    .limit(1000)
  if (error) throw error
  return (data ?? []) as Book[]
}

export async function createBook(values: BookFormValues): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: values.title.trim(),
      code: values.code?.trim() || null,
      author: values.author?.trim() || null,
      publisher: values.publisher?.trim() || null,
      year: values.year ?? null,
      category: values.category?.trim() || null,
      copies: values.copies ?? 1,
      shelf: values.shelf?.trim() || null,
      description: values.description?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Book
}

export async function updateBook(id: string, values: BookFormValues): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .update({
      title: values.title.trim(),
      code: values.code?.trim() || null,
      author: values.author?.trim() || null,
      publisher: values.publisher?.trim() || null,
      year: values.year ?? null,
      category: values.category?.trim() || null,
      copies: values.copies ?? 1,
      shelf: values.shelf?.trim() || null,
      description: values.description?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Book
}

export async function softDeleteBook(id: string): Promise<void> {
  const { error } = await supabase
    .from('books')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function bookCodeExists(code: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('code', code)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}

// ------------------------------------------------------------
// Peminjaman
// ------------------------------------------------------------

export async function fetchLoans(): Promise<BookLoan[]> {
  const { data, error } = await supabase
    .from('book_loans')
    .select(LOAN_SELECT)
    .order('borrowed_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as unknown as BookLoan[]
}

export async function createLoan(values: LoanFormValues): Promise<BookLoan> {
  const { data, error } = await supabase
    .from('book_loans')
    .insert({
      book_id: values.book_id,
      student_id: values.student_id,
      borrowed_at: values.borrowed_at,
      due_date: values.due_date || null,
      notes: values.notes?.trim() || null,
    })
    .select(LOAN_SELECT)
    .single()
  if (error) throw error
  return data as unknown as BookLoan
}

export async function returnLoan(id: string): Promise<void> {
  const { error } = await supabase
    .from('book_loans')
    .update({ returned_at: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
  if (error) throw error
}

export async function deleteLoan(id: string): Promise<void> {
  const { error } = await supabase.from('book_loans').delete().eq('id', id)
  if (error) throw error
}
