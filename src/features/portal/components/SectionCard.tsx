import { Card, Typography, theme } from 'antd'

/**
 * Kartu seksi portal: header ikon + judul + aksi opsional, body bebas.
 * Radius 14 (borderRadiusLG) agar selaras PortalCard, body register rapat.
 */
export function SectionCard({
  title,
  icon,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const { token } = theme.useToken()
  return (
    <Card styles={{ body: { padding: '14px 16px 16px' } }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <span style={{ color: token.colorPrimary, display: 'inline-flex', fontSize: 15 }}>{icon}</span>
          <Typography.Text strong style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}
