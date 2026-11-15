import type { ReactNode } from 'react'
import { Typography } from 'antd'
import { IconBox } from './IconBox'

const { Text } = Typography

interface ModalSectionProps {
  title: string
  desc?: string
  /** Diberikan → baris ber-ikon (kotak indigo 36px, pola "Data referensi"). */
  icon?: ReactNode
  /** Slot kanan: aksi kecil (Semua/Reset, Unduh Template). */
  trailing?: ReactNode
  style?: React.CSSProperties
}

/**
 * Header section di dalam body modal — dua varian yang sebelumnya berbeda-beda:
 * bare bold label ("Cakupan", "Kolom") dan baris ikon+judul+desc ("Data referensi").
 * Dengan `trailing` menjadi baris space-between.
 */
export function ModalSection({ title, desc, icon, trailing, style }: ModalSectionProps) {
  const label = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'inherit' }}>{title}</div>
      {desc && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {desc}
        </Text>
      )}
    </div>
  )

  if (!icon && !trailing) {
    return (
      <div style={{ marginBottom: 8, ...style }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {desc && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {desc}
          </Text>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
        minWidth: 0,
        ...style,
      }}
    >
      {icon && <IconBox icon={icon} size={36} />}
      {label}
      {trailing && <div style={{ marginLeft: 'auto', flexShrink: 0 }}>{trailing}</div>}
    </div>
  )
}
