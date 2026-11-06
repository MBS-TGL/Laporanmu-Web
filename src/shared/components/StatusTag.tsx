import type { ReactNode } from 'react'
import { Tag } from 'antd'

interface StatusTagProps {
  color?: string
  icon?: ReactNode
  children: ReactNode
}

// Tag status seragam: radius lembut + ikon, dipakai semua tabel
export function StatusTag({ color, icon, children }: StatusTagProps) {
  return (
    <Tag color={color} icon={icon} style={{ borderRadius: 6, fontWeight: 500 }}>
      {children}
    </Tag>
  )
}
