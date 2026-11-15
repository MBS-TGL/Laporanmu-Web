import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Slot aksi halaman bertab: tombol aksi per-tab dirender di kanan PageHeader
 * (sejajar judul halaman), bukan makan satu baris sendiri di dalam konten tab.
 *
 * Shell memasang host sebagai `extra` PageHeader di dalam `TabActionsContext.Provider`;
 * konten tab mengisinya via `useTabActions(active, <…>)`.
 */
export const TabActionsContext = createContext<HTMLElement | null>(null)

/**
 * Render node ke host tab bar. `active` wajib: antd Tabs tetap memasang pane yang
 * pernah dikunjungi (destroyInactiveTabPane=false), jadi tanpa gate aksi dua tab
 * bisa menumpuk di host yang sama.
 */
export function useTabActions(active: boolean, node: ReactNode): ReactNode {
  const host = useContext(TabActionsContext)
  if (!active || !host) return null
  return createPortal(node, host)
}
