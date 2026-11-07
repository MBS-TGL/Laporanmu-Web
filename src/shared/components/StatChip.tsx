import { useState, type ReactNode } from 'react'
import { Spin, theme } from 'antd'

export type StatChipColor = 'indigo' | 'sky' | 'rose' | 'emerald' | 'amber' | 'purple'

const CHIP_COLORS: Record<StatChipColor, string> = {
  indigo: '#6366f1',
  sky: '#0ea5e9',
  rose: '#f43f5e',
  emerald: '#10b981',
  amber: '#f59e0b',
  purple: '#7c3aed',
}

interface StatChipProps {
  icon: ReactNode
  label: string
  value: ReactNode
  color?: StatChipColor
  loading?: boolean
  active?: boolean
  onClick?: () => void
}

export function StatChip({
  icon,
  label,
  value,
  color = 'indigo',
  loading = false,
  active = false,
  onClick,
}: StatChipProps) {
  const { token } = theme.useToken()
  const [hovered, setHovered] = useState(false)
  const c = CHIP_COLORS[color]
  const interactive = Boolean(onClick)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 14px 7px 10px',
        fontFamily: 'inherit',
        borderRadius: 12,
        border: `1px solid ${active || hovered ? `${c}66` : token.colorBorderSecondary}`,
        background: active || hovered ? `${c}0F` : token.colorBgContainer,
        cursor: interactive ? 'pointer' : 'default',
        textAlign: 'left',
        transition: 'border-color 0.2s, background 0.2s',
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: `${c}1A`,
          color: c,
          display: 'grid',
          placeItems: 'center',
          fontSize: 15,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, color: token.colorText }}>
        {loading ? <Spin size="small" /> : value}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: token.colorTextSecondary, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}
