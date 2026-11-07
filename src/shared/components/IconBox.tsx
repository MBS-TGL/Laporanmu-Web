import type { ReactNode } from 'react'
import { theme } from 'antd'

interface IconBoxProps {
  icon: ReactNode
  size?: number
}

export function IconBox({ icon, size = 40 }: IconBoxProps) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: token.colorPrimaryBg,
        color: token.colorPrimary,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  )
}
