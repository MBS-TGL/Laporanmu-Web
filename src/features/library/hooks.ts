import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createBook,
  createLoan,
  deleteLoan,
  fetchBooks,
  fetchLoans,
  returnLoan,
  softDeleteBook,
  updateBook,
} from './api'
import type { BookFormValues, ItemCondition, LoanFormValues } from './types'

export function useBooks() {
  return useQuery({
    queryKey: ['books', 'list'],
    queryFn: fetchBooks,
  })
}

export function useLoans() {
  return useQuery({
    queryKey: ['book-loans', 'list'],
    queryFn: fetchLoans,
  })
}

export function useCreateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: BookFormValues) => createBook(values),
    onSuccess: (book) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'books',
        recordId: book.id,
        newData: { title: book.title },
      })
      void qc.invalidateQueries({ queryKey: ['books'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: BookFormValues }) => updateBook(id, values),
    onSuccess: (book) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'books',
        recordId: book.id,
      })
      void qc.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

export function useDeleteBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteBook(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'books', recordId: id })
      void qc.invalidateQueries({ queryKey: ['books'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: LoanFormValues) => createLoan(values),
    onSuccess: (loan) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'book_loans',
        recordId: loan.id,
        newData: { book_id: loan.book_id, student_id: loan.student_id },
      })
      void qc.invalidateQueries({ queryKey: ['book-loans'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useReturnLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; condition?: ItemCondition | null; dueDate?: string | null }) =>
      returnLoan(input.id, { condition: input.condition, dueDate: input.dueDate }),
    onSuccess: (_data, input) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'book_loans',
        recordId: input.id,
        newData: { returned: true, condition: input.condition ?? null },
      })
      void qc.invalidateQueries({ queryKey: ['book-loans'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLoan(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'book_loans',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['book-loans'] })
    },
  })
}
