import type { ReactNode } from 'react'
import { Space, Typography } from 'antd'

interface PageHeaderProps {
  title: string
  subtitle?: string
  extra?: ReactNode
}

export function PageHeader({ title, subtitle, extra }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div>
        <Typography.Title
          level={3}
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
          }}
        >
          {title}
        </Typography.Title>
        {subtitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13.5, marginTop: 2, display: 'block' }}>
            {subtitle}
          </Typography.Text>
        ) : null}
      </div>
      {extra ? <Space wrap>{extra}</Space> : null}
    </div>
  )
}
