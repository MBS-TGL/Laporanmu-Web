import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ShortcutItem {
  /** Rangkaian tombol, mis. ['Ctrl', 'K'], ['Esc'], ['N'], ['?'] */
  keys: string[]
  label: string
  description?: string
  /** Judul seksi di palet, mis. 'Navigasi' | 'Aksi' | 'Tampilan' */
  group: string
  icon?: ReactNode
  run: () => void
  /** false = tidak terikat & disembunyikan dari palet */
  when?: boolean
}

export interface ShortcutSection {
  group: string
  items: ShortcutItem[]
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

function matchBinding(e: KeyboardEvent, keys: string[]): boolean {
  const needsCtrl = keys.includes('Ctrl')
  const main = keys[keys.length - 1]

  if (needsCtrl) {
    if (!(e.ctrlKey || e.metaKey)) return false
  } else if (e.ctrlKey || e.metaKey || e.altKey) {
    return false
  }

  if (main === 'Esc') return e.key === 'Escape'
  // Huruf/angka dengan Shift hampir selalu salah tekan ('?' memang pakai Shift,
  // tapi bukan alfanumerik sehingga lolos dari pengecualian ini)
  if (e.shiftKey && /^[a-z0-9]$/i.test(main)) return false
  return e.key.toLowerCase() === main.toLowerCase()
}

interface UsePageShortcutsOptions {
  items: ShortcutItem[]
  /** true = semua binding diabaikan (mis. saat modal halaman terbuka) */
  isBlocked?: boolean
}

export function useShortcuts({ items, isBlocked = false }: UsePageShortcutsOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const itemsRef = useRef(items)
  const isOpenRef = useRef(isOpen)
  const blockedRef = useRef(isBlocked)

  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])
  useEffect(() => {
    blockedRef.current = isBlocked
  }, [isBlocked])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // urutan: tutup palet → keluar dari input → serahkan ke item ['Esc'] halaman
        if (isOpenRef.current) {
          setIsOpen(false)
          e.preventDefault()
          return
        }
        const active = document.activeElement
        if (isTypingTarget(active) && active instanceof HTMLElement) {
          active.blur()
          return
        }
      }

      if (blockedRef.current) return

      // Jangan ikat tombol halaman saat sedang mengetik di input
      // (Esc sudah ditangani di atas: tutup palet → blur)
      if (isTypingTarget(document.activeElement)) return

      for (const item of itemsRef.current) {
        if (item.when === false) continue
        if (!matchBinding(e, item.keys)) continue
        e.preventDefault()
        item.run()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const sections = useMemo<ShortcutSection[]>(() => {
    const visible = items.filter((i) => i.when !== false)
    const groups: ShortcutSection[] = []
    for (const item of visible) {
      const last = groups[groups.length - 1]
      if (last && last.group === item.group) last.items.push(item)
      else groups.push({ group: item.group, items: [item] })
    }
    return groups
  }, [items])

  return { isOpen, open, close, toggle, sections }
}
