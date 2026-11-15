import { useMemo, useRef, useState } from 'react'
import type { Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import type { InputRef } from 'antd'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useClassesBrief } from '../students/hooks'
import type { FilterChip } from '../../shared/components/FilterChips'
import { filterPermits, STATUS_META, type PermitFilters } from './permitUtils'
import type { LeavePermit, PermitStatus } from './types'

/**
 * Seluruh state filter halaman izin: pencarian (debounced), rentang tanggal,
 * kelas, status (tersinkron ke URL ?status=), chips filter aktif, dan
 * hasil filter in-memory. Dipakai PermitPage.
 */
export function usePermitFilters(permits: LeavePermit[]) {
  const [searchParams, setSearchParams] = useSearchParams()

  const [statusFilter, setStatusFilter] = useState<PermitStatus | ''>(
    (searchParams.get('status') as PermitStatus | null) ?? '',
  )
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const searchInputRef = useRef<InputRef | null>(null)

  const classesQuery = useClassesBrief()

  const filters = useMemo<PermitFilters>(
    () => ({
      search: debouncedSearch,
      status: statusFilter,
      classId,
      from: dateRange?.[0]?.format('YYYY-MM-DD'),
      to: dateRange?.[1]?.format('YYYY-MM-DD'),
    }),
    [debouncedSearch, statusFilter, classId, dateRange],
  )

  const filtered = useMemo(() => filterPermits(permits, filters), [permits, filters])

  /** Ganti status + sinkronkan ke URL untuk deep-link */
  const changeStatus = (next: PermitStatus | '') => {
    setStatusFilter(next)
    setSearchParams(next ? { status: next } : {}, { replace: true })
  }

  const chips = useMemo<FilterChip[]>(() => {
    const list: FilterChip[] = []
    if (statusFilter)
      list.push({ key: 'status', label: `Status: ${STATUS_META[statusFilter].label}`, onClear: () => changeStatus('') })
    if (debouncedSearch) list.push({ key: 'search', label: `Cari: ${debouncedSearch}`, onClear: () => setSearch('') })
    if (classId) {
      const name = classesQuery.data?.find((c) => c.id === classId)?.name ?? classId
      list.push({ key: 'class', label: `Kelas: ${name}`, onClear: () => setClassId(undefined) })
    }
    if (dateRange) {
      list.push({
        key: 'date',
        label: `Tanggal: ${dateRange[0].format('DD MMM')} – ${dateRange[1].format('DD MMM')}`,
        onClear: () => setDateRange(null),
      })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, debouncedSearch, classId, dateRange, classesQuery.data])

  return {
    search,
    setSearch,
    debouncedSearch,
    searchInputRef,
    dateRange,
    setDateRange,
    classId,
    setClassId,
    statusFilter,
    changeStatus,
    classesQuery,
    chips,
    filters,
    filtered,
  }
}
