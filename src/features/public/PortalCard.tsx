import type { ReactNode } from 'react'
import { Card, Typography } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'

const PANEL_BG = {
  indigo: 'linear-gradient(165deg, #4f46e5 0%, #6366f1 60%, #818cf8 100%)',
  green: 'linear-gradient(165deg, #059669 0%, #10b981 60%, #34d399 100%)',
} as const

interface PortalCardProps {
  tint?: keyof typeof PANEL_BG
  icon: ReactNode
  title: string
  description: string
  bullets: string[]
  footnote?: string
  children: ReactNode
}

/**
 * Kartu dua panel untuk halaman portal: kiri panel brand berwarna,
 * kanan panel form. Turun jadi satu kolom di layar kecil.
 */
export function PortalCard({
  tint = 'indigo',
  icon,
  title,
  description,
  bullets,
  footnote,
  children,
}: PortalCardProps) {
  return (
    <Card
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid #e8edf3',
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.10)',
      }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 270px',
            minWidth: 270,
            background: PANEL_BG[tint],
            color: '#fff',
            padding: '34px 30px 26px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: 'rgba(255,255,255,0.16)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 21,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <Typography.Title
            level={4}
            style={{ color: '#fff', marginTop: 18, marginBottom: 6, letterSpacing: '-0.02em' }}
          >
            {title}
          </Typography.Title>
          <Typography.Paragraph
            style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.65, marginBottom: 0 }}
          >
            {description}
          </Typography.Paragraph>
          <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
            {bullets.map((b) => (
              <li
                key={b}
                style={{
                  display: 'flex',
                  gap: 9,
                  alignItems: 'flex-start',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.92)',
                }}
              >
                <CheckCircleOutlined style={{ marginTop: 2, color: 'rgba(255,255,255,0.75)' }} />
                {b}
              </li>
            ))}
          </ul>
          {footnote && (
            <Typography.Text
              style={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: 11.5,
                marginTop: 'auto',
                paddingTop: 22,
              }}
            >
              {footnote}
            </Typography.Text>
          )}
        </div>
        <div
          style={{
            flex: '1 1 330px',
            minWidth: 0,
            padding: '34px 32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      </div>
    </Card>
  )
}
