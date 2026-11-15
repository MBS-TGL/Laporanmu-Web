import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import {
  pageShellItemTransition,
  pageShellItemVariants,
  pageShellVariants,
} from '../motion'

/**
 * Entrance halaman bertab (DESIGN.md #2 — hierarki baca: header dulu, lalu konten).
 * Bungkus `ShellStagger` di luar, lalu tiap bagian shell (PageHeader, Tabs, dsb.)
 * dengan `ShellItem` agar fade-up berurutan dengan stagger 60ms.
 */
export function ShellStagger({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={pageShellVariants} initial="initial" animate="animate">
      {children}
    </motion.div>
  )
}

export function ShellItem({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={pageShellItemVariants} transition={pageShellItemTransition}>
      {children}
    </motion.div>
  )
}
