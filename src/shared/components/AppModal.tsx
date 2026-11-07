import type { ReactNode } from 'react'
import { Modal, Typography, theme, type ModalProps } from 'antd'
import { IconBox } from './IconBox'

const { Text } = Typography

interface AppModalProps extends ModalProps {
  /** Ikon di kotak kiri judul. */
  icon?: ReactNode
  /** Teks kecil di bawah judul. */
  subtitle?: string
}

// Modal seragam aplikasi: selalu centered. Scroll modal dikelola penuh lewat
// inline `styles` (root/container/header/footer/body) — tanpa CSS global:
// modal panjang tidak meluber keluar layar, scroll terjadi di body saja,
// header & footer tetap terlihat. Garis pemisah header/body/footer memakai
// token warna border antd.
//
// Judul seragam: kalau `icon` / `subtitle` diberikan, header dirender
// sebagai [kotak ikon] + judul + subjudul. Tanpa keduanya, judul
// tetap string biasa seperti bawaan antd.
export function AppModal({ styles, title, icon, subtitle, ...props }: AppModalProps) {
  const { token } = theme.useToken()
  const hasRichTitle = Boolean(icon || subtitle)
  const divider = `1px solid ${token.colorBorderSecondary}`

  return (
    <Modal
      centered
      okText="Simpan"
      cancelText="Batal"
      title={
        hasRichTitle ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {icon && <IconBox icon={icon} />}
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{title}</div>
              {subtitle && (
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                  {subtitle}
                </Text>
              )}
            </div>
          </div>
        ) : (
          title
        )
      }
      styles={{
        root: { maxWidth: 'calc(100vw - 24px)' },
        container: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 48px)',
          overflow: 'hidden',
        },
        header: {
          flexShrink: 0,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: divider,
        },
        footer: {
          flexShrink: 0,
          marginTop: 16,
          paddingTop: 12,
          borderTop: divider,
        },
        body: {
          flex: '1 1 auto',
          minHeight: 0,
          maxHeight: 'calc(100dvh - 220px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          paddingRight: 4,
        },
        ...styles,
      }}
      {...props}
    />
  )
}
