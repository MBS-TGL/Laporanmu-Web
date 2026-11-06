import type { ReactNode } from 'react'

interface SectionDividerProps {
  children: ReactNode
}

// Pemisah section pada form: aksen bar indigo + label tebal + garis tipis.
// Dipakai langsung di dalam Form; di dalam Row/Col bungkus dengan <Col span={24}>.
export function SectionDivider({ children }: SectionDividerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
        marginBottom: 10,
      }}
    >
      <span
        style={{
          width: 4,
          height: 14,
          borderRadius: 2,
          background: '#4f46e5',
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: '#334155',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </div>
  )
}
