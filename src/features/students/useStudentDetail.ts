import { createContext, useContext } from 'react'

export interface StudentDetailContextValue {
  /** Buka drawer detail siswa dari modul mana saja (cukup id). */
  open: (studentId: string) => void
  close: () => void
}

export const StudentDetailContext = createContext<StudentDetailContextValue | null>(null)

/** Akses drawer detail siswa global — pakai di dalam DetailProvider. */
export function useStudentDetail(): StudentDetailContextValue {
  const ctx = useContext(StudentDetailContext)
  if (!ctx) throw new Error('useStudentDetail harus dipakai di dalam DetailProvider')
  return ctx
}
