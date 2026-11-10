import type { ReactNode } from 'react'
import { Button, Tag, theme } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  children: ReactNode
}

/**
 * Bar aksi massal melayang di bawah layar — template dari StudentsPage,
 * dipakai halaman list lain yang punya row selection.
 */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  const { token } = theme.useToken()
  if (count <= 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 14,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
      }}
    >
      <Tag color="processing" style={{ borderRadius: 999, fontWeight: 700, marginInlineEnd: 2 }}>
        {count}
      </Tag>
      <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>Dipilih</span>
      {children}
      <Button
        size="small"
        type="text"
        style={{ color: token.colorTextQuaternary }}
        icon={<CloseOutlined />}
        onClick={onClear}
      />
    </div>
  )
}
