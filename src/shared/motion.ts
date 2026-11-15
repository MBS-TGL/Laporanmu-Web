import type { Transition, Variants } from 'motion/react'

/**
 * Primitif motion — dial MOTION 2 (DESIGN.md): subtil, ≤0.25s, tujuan tertulis.
 * Semua animasi otomatis hormati prefers-reduced-motion via MotionConfig di providers.
 */

/** Cubic-bezier standar produk (sama dengan reveal landing). */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** Transisi ganti route — orientasi (pindah halaman terasa jelas, tetap singkat). */
export const routeEnter: Transition = { duration: 0.18, ease: EASE }
export const routeExit: Transition = { duration: 0.12, ease: EASE }

/** Entrance shell — fade-up hierarki baca (judul dulu, lalu konten). */
export const shellVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}
export const shellTransition: Transition = { duration: 0.2, ease: EASE }

/** Bar aksi massal — muncul dari bawah, tetap terpusat via x: '-50%'. */
export const bulkBarVariants: Variants = {
  initial: { opacity: 0, y: 16, x: '-50%' },
  animate: { opacity: 1, y: 0, x: '-50%' },
  exit: { opacity: 0, y: 16, x: '-50%' },
}
export const bulkBarTransition: Transition = { duration: 0.18, ease: EASE }

/** Rail indigo sidebar — layoutId antar item aktif. */
export const railTransition: Transition = { duration: 0.2, ease: EASE }

/** Entrance halaman bertab — kontainer yang mengatur stagger anak (DESIGN.md #2, ≤60ms). */
export const pageShellVariants: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
}

/** Item halaman bertab (header, tab, konten) — fade-up mengikuti stagger shell. */
export const pageShellItemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}
export const pageShellItemTransition: Transition = { duration: 0.2, ease: EASE }

/** Expand/collapse anak grup sidebar — kontinuitas daftar saat struktur berubah (R-19).
 * Pasangkan dengan overflow: 'hidden' di elemen yang dianimasikan. */
export const collapseVariants: Variants = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
}
export const collapseTransition: Transition = { duration: 0.2, ease: EASE }

/** Micro-interaction mount ringan (chip filter) — fade-up singkat. */
export const microTransition: Transition = { duration: 0.15, ease: EASE }

/** Entrance isi modal — fade-up hierarki baca (header dulu, konten mengikuti).
 * Hanya membungkus konten buatan aplikasi; permukaan modal tetap milik antd. */
export const modalBodyVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
}

export const modalBodyTransition: Transition = { duration: 0.2, ease: EASE }

/** Pergantian state konten satu wadah (kosong/proses/hasil) — fade-up singkat
 * agar pergantian terasa jelas tanpa memindahkan fokus (orientasi, R-19).
 * Bungkus dengan AnimatePresence mode="wait" + key per state. */
export const swapVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export const swapTransition: Transition = { duration: 0.18, ease: EASE }
