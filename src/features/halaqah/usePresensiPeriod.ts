import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useScopedHalaqah } from './useHalaqahScope'
import { loadThreshold } from './presensiStats'
import type { HalaqahSession } from './types'

/**
 * State periode presensi: halaqah terpilih, bulan/tahun (di-seed dari URL),
 * sesi, pencarian, preferensi tampilan, dan ambang alert.
 *
 * Navigasi bulan/grup/sesi di sini TANPA guard draf — pembungkus `guarded`
 * ada di PresensiTab yang sudah memegang dirtyCount & dropDrafts dari
 * usePresensiGrid (hindari dependensi melingkar antar hook).
 *
 * Perilaku URL mengikuti gotcha MEMORY: default TIDAK ditulis ke URL,
 * baru muncul setelah user mengubah periode/grup (pola AttendancePage).
 */
export function usePresensiPeriod() {
  const [searchParams, setSearchParams] = useSearchParams()

  const now = new Date()
  const [month, setMonth] = useState(
    (() => {
      const m = Number(searchParams.get('month'))
      return m >= 1 && m <= 12 ? m : now.getMonth() + 1
    })(),
  )
  const [year, setYear] = useState((() => {
    const y = Number(searchParams.get('year'))
    return y >= 2000 && y <= 2100 ? y : now.getFullYear()
  })())
  const [session, setSession] = useState<HalaqahSession>('mengaji')
  const [groupId, setGroupId] = useState<string | undefined>(searchParams.get('group') ?? undefined)
  const [search, setSearch] = useState('')
  const [hideWeekend, setHideWeekend] = useState(
    () => localStorage.getItem('halaqah_presensi_hide_weekend') === '1',
  )
  const [threshold, setThreshold] = useState(loadThreshold)

  const groupsQuery = useScopedHalaqah()
  const groups = useMemo(() => groupsQuery.groups ?? [], [groupsQuery.groups])
  const scoped = groupsQuery.scoped
  const activeGroupId =
    groupId && groups.some((g) => g.id === groupId) ? groupId : groups[0]?.id

  const syncParams = (next: { group?: string; month?: number; year?: number }) => {
    const sp = new URLSearchParams(searchParams)
    const g = next.group ?? activeGroupId
    const b = next.month ?? month
    const t = next.year ?? year
    if (g) sp.set('group', g)
    sp.set('month', String(b))
    sp.set('year', String(t))
    setSearchParams(sp, { replace: true, preventScrollReset: true })
  }

  /** Pindah bulan (mentah, tanpa guard). */
  const goMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    setMonth(m)
    setYear(y)
    syncParams({ month: m, year: y })
  }

  /** Ganti halaqah (mentah, tanpa guard). */
  const changeGroup = (id?: string) => {
    setGroupId(id)
    syncParams({ group: id })
  }

  /** Ganti sesi (mentah, tanpa guard). */
  const changeSession = (s: HalaqahSession) => {
    setSession(s)
  }

  const toggleWeekend = () => {
    setHideWeekend((v) => {
      localStorage.setItem('halaqah_presensi_hide_weekend', v ? '0' : '1')
      return !v
    })
  }

  const scrollToToday = () => {
    document.getElementById('presensi-today-col')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }

  return {
    groups,
    groupsQuery,
    scoped,
    /** loading gabungan: daftar halaqah + resolusi scope musyrif. */
    isLoading: groupsQuery.isLoading,
    activeGroupId,
    month,
    year,
    session,
    search,
    setSearch,
    hideWeekend,
    threshold,
    setThreshold,
    goMonth,
    changeGroup,
    changeSession,
    toggleWeekend,
    scrollToToday,
  }
}

export type PresensiPeriod = ReturnType<typeof usePresensiPeriod>
