import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface UseUrlTabOptions {
  /**
   * Tulis juga tab default ke URL. Default `false` agar address bar tetap
   * bersih: `/students` saja, bukan `/students?tab=active`.
   *
   * Aktifkan untuk halaman yang seluruh tab-nya harus bisa di-deep-link,
   * misalnya `/attendance?tab=students`.
   */
  writeDefault?: boolean
  /**
   * Daftar kunci tab yang sah. Bila diberikan dan nilai `?tab=` tidak ada
   * di daftar (URL usang / typo), jatuh ke `defaultTab` — bukan merender
   * panel kosong karena `activeKey` tidak cocok item mana pun.
   */
  keys?: readonly string[]
  /**
   * Peta nilai `?tab=` lama → baru (renaman tab). Nilai lama dari
   * bookmark/tautan masih berfungsi dan otomatis ditulis ulang ke URL baru.
   */
  legacy?: Record<string, string>
}

/**
 * Sinkronisasi tab AntD dengan query param `?tab=` — pola wajib halaman
 * besar multi-fungsi (lihat SKILLS.md §Skill 2, contoh: CounselingPage).
 */
export function useUrlTab(
  defaultTab: string,
  options: UseUrlTabOptions = {},
): {
  tab: string
  setTab: (key: string) => void
} {
  const { writeDefault = false, keys, legacy } = options
  const [searchParams, setSearchParams] = useSearchParams()
  const rawParam = searchParams.get('tab')
  const raw = rawParam ?? defaultTab
  const legacyTo = rawParam ? legacy?.[rawParam] : undefined
  const resolved = legacyTo ?? raw
  const tab = keys && !keys.includes(resolved) ? defaultTab : resolved
  // Nilai legacy selalu ditulis ulang ke URL baru, walau default tidak ditulis
  const rewriteLegacy = legacyTo !== undefined && legacyTo !== tab

  useEffect(() => {
    if (!writeDefault && !rewriteLegacy) return
    if (rawParam === tab) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true, preventScrollReset: true })
  }, [writeDefault, rewriteLegacy, tab, rawParam, searchParams, setSearchParams])

  const setTab = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams)
      if (key === defaultTab && !writeDefault) next.delete('tab')
      else next.set('tab', key)
      setSearchParams(next, { preventScrollReset: true })
    },
    [searchParams, setSearchParams, defaultTab, writeDefault],
  )

  return { tab, setTab }
}
