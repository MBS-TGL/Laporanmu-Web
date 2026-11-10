import { useEffect, useRef, useState } from 'react'

/** Deteksi elemen masuk viewport sekali saja (untuk memicu animasi count-up). */
export function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, inView }
}

/**
 * Angka menghitung naik saat `run` bernilai true (dipicu Reveal di stats strip).
 * Langsung tampilkan nilai akhir bila user memakai prefers-reduced-motion.
 */
export function useCountUp(target: number, run: boolean, durationMs = 1100): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, target, durationMs])

  return value
}

/**
 * Scrollspy sederhana: kembalikan id section yang sedang berada di area pandang
 * (untuk menandai link navbar landing page aktif).
 */
export function useScrollSpy(ids: string[], topOffset = 96): string | null {
  const [active, setActive] = useState<string | null>(null)
  const idsKey = ids.join(',')

  useEffect(() => {
    const idList = idsKey.split(',')
    const els = idList
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el)
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') return

    const visible = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set((e.target as HTMLElement).id, e.isIntersecting)
        setActive(idList.find((id) => visible.get(id)) ?? null)
      },
      { rootMargin: `-${topOffset}px 0px -55% 0px`, threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [idsKey, topOffset])

  return active
}
