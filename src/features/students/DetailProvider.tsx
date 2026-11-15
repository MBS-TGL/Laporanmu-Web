import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Spin } from 'antd'
import { fetchStudentById } from './api'
import { StudentDetailContext } from './useStudentDetail'

// Lazy: DetailDrawer menarik recharts (~370 KB) — jangan ikut graph eager
// MainLayout agar tidak masuk first load (lihat audit performa 2026-11-14).
const DetailDrawer = lazy(() =>
  import('./components/DetailDrawer').then((m) => ({ default: m.DetailDrawer })),
)

/**
 * Provider drawer detail siswa — dipasang SEKALI di MainLayout.
 * Modul lain (gate, tahfidz, halaqah, ekskul, tabungan, perpustakaan)
 * tinggal `useStudentDetail().open(id)` pada nama santri (hook ada di
 * useStudentDetail.ts). Halaman yang butuh aksi Edit (mis. StudentsPage)
 * tetap memakai instance DetailDrawer sendiri dengan onEdit.
 */
export function DetailProvider({ children }: { children: ReactNode }) {
  const [studentId, setStudentId] = useState<string | null>(null)
  // Chunk DetailDrawer (recharts) baru diunduh saat drawer pertama dibuka.
  const [drawerMounted, setDrawerMounted] = useState(false)

  const studentQuery = useQuery({
    queryKey: ['students', 'detail', studentId],
    queryFn: () => fetchStudentById(studentId!),
    enabled: !!studentId,
  })

  const value = useMemo(
    () => ({
      open: (id: string) => {
        setDrawerMounted(true)
        setStudentId(id)
      },
      close: () => setStudentId(null),
    }),
    [],
  )

  return (
    <StudentDetailContext.Provider value={value}>
      {children}
      {drawerMounted && (
        <Suspense fallback={<Spin />}>
          <DetailDrawer
            open={studentId !== null}
            student={studentQuery.data ?? null}
            onClose={() => setStudentId(null)}
          />
        </Suspense>
      )}
    </StudentDetailContext.Provider>
  )
}
