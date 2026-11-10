import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface RevealProps {
  children: ReactNode
  /** Jeda transisi (ms) — berguna untuk efek stagger antar kartu */
  delay?: number
  style?: CSSProperties
}

/**
 * Munculkan konten dengan fade-up saat pertama kali masuk viewport (sekali saja).
 * Hanya memakai transform/opacity agar tetap di GPU; dinonaktifkan saat
 * user memakai prefers-reduced-motion.
 */
export function Reveal({ children, delay = 0, style }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={shown ? 'reveal reveal-in' : 'reveal'}
      style={{ transitionDelay: shown && delay ? `${delay}ms` : undefined, ...style }}
    >
      {children}
    </div>
  )
}
