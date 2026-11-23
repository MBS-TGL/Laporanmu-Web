import type { ReactNode } from 'react'
import { Typography, theme } from 'antd'
import { motion } from 'motion/react'
import { EASE } from '../motion'

export type StatusTone = 'neutral' | 'error' | 'warning'

interface StatusViewProps {
  /** Angka/kode besar, mis. "404". Kosongkan bila memakai `icon`. */
  code?: string
  /** Ikon pengganti kode, mis. ikon peringatan untuk halaman error. */
  icon?: ReactNode
  title: string
  description?: ReactNode
  tone?: StatusTone
  /** true untuk halaman penuh (404 publik), false untuk error di dalam layout. */
  fullscreen?: boolean
  actions?: ReactNode
  children?: ReactNode
}

const TONE_COLOR: Record<StatusTone, 'colorPrimary' | 'colorError' | 'colorWarning'> = {
  neutral: 'colorPrimary',
  error: 'colorError',
  warning: 'colorWarning',
}

const TONE_BG: Record<StatusTone, 'colorPrimaryBg' | 'colorErrorBg' | 'colorWarningBg'> = {
  neutral: 'colorPrimaryBg',
  error: 'colorErrorBg',
  warning: 'colorWarningBg',
}

/**
 * Halaman status seragam: 404, gagal render, modul nonaktif, maintenance.
 * Satu komposisi, copy berbeda. Tanpa gradient (DESIGN.md: gradient hanya
 * untuk PortalCard dan hero landing).
 */
export function StatusView({
  code,
  icon,
  title,
  description,
  tone = 'neutral',
  fullscreen = false,
  actions,
  children,
}: StatusViewProps) {
  const { token } = theme.useToken()
  const accent = token[TONE_COLOR[tone]]
  const tint = token[TONE_BG[tone]]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      role={tone === 'error' ? 'alert' : undefined}
      style={{
        minHeight: fullscreen ? '100dvh' : '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: fullscreen ? token.colorBgLayout : undefined,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 520 }}>
        {code ? (
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: accent,
              letterSpacing: '-0.04em',
              lineHeight: 1,
            }}
          >
            {code}
          </div>
        ) : null}

        {!code && icon ? (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              margin: '0 auto 16px',
              display: 'grid',
              placeItems: 'center',
              background: tint,
              color: accent,
              fontSize: 26,
            }}
          >
            {icon}
          </div>
        ) : null}

        <Typography.Title
          level={3}
          style={{
            margin: code ? '14px 0 4px' : '0 0 8px',
            fontSize: 22,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </Typography.Title>

        {description ? (
          <Typography.Paragraph
            type="secondary"
            style={{ marginBottom: actions || children ? 24 : 0 }}
          >
            {description}
          </Typography.Paragraph>
        ) : null}

        {actions ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {actions}
          </div>
        ) : null}

        {children}
      </div>
    </motion.div>
  )
}
