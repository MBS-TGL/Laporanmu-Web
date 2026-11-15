import { useMemo } from 'react'
import { useAcademicYearsBrief, useClassSubjectsByYear } from '../classes/hooks'

/**
 * Opsi "Kelas · Mapel" tahun ajaran aktif — dipakai filter Bank Soal,
 * ExamModal, dan ExamDrawer. Cache react-query mendedupe fetch.
 */
export function useSubjectOptions() {
  const yearsQuery = useAcademicYearsBrief()
  const activeYear = useMemo(
    () => yearsQuery.data?.find((y) => y.is_active) ?? yearsQuery.data?.[0],
    [yearsQuery.data],
  )
  const csQuery = useClassSubjectsByYear(activeYear?.id)

  const options = useMemo(
    () =>
      (csQuery.data ?? [])
        .map((cs) => ({
          value: cs.id,
          label: `${cs.classes?.name ?? '?'} · ${cs.subjects?.name ?? '?'}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [csQuery.data],
  )

  const labelOf = (id: string | undefined) =>
    options.find((o) => o.value === id)?.label ?? ''

  return { options, loading: csQuery.isPending, labelOf }
}
