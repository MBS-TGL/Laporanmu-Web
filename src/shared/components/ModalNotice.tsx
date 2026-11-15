import type { ReactNode } from 'react'
import { Alert } from 'antd'

type Tone = 'info' | 'success' | 'warning' | 'error'

interface ModalNoticeProps {
  tone: Tone
  title?: ReactNode
  children?: ReactNode
  /** Aksi kanan (mis. tombol retry). */
  action?: ReactNode
}

/**
 * Kotak notice semantik di dalam modal — satu sumber gaya (dulu 3 gaya campur:
 * antd Alert polos, div token, div hardcoded hex). Radius 10 seragam, tanpa
 * margin bawaan (penempatan dikendalikan pemanggil).
 */
export function ModalNotice({ tone, title, children, action }: ModalNoticeProps) {
  return (
    <Alert
      type={tone}
      showIcon
      message={title}
      description={children}
      action={action}
      style={{ borderRadius: 10 }}
    />
  )
}
