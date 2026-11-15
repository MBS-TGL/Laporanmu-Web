import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

export interface UseUrlTabOptions {
  /**
   * Tulis juga tab default ke URL. Default `false` agar address bar tetap
   * bersih: `/students` saja, bukan `/students?tab=aktif`.
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
  const { writeDefault = false, keys } = options
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab') ?? defaultTab
  const tab = keys && !keys.includes(raw) ? defaultTab : raw

  useEffect(() => {
    if (!writeDefault) return
    if (searchParams.get('tab') === tab) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true, preventScrollReset: true })
  }, [writeDefault, tab, searchParams, setSearchParams])

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
