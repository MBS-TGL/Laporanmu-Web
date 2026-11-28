import { Tag, theme } from 'antd'

interface ClassChipProps {
  name?: string | null
}

/** Chip kelas seragam: indigo lembut, tanpa border, dipakai semua tabel santri */
export function ClassChip({ name }: ClassChipProps) {
  const { token } = theme.useToken()
  if (!name) return null

  return (
    <Tag
      style={{
        marginInlineEnd: 0,
        borderRadius: 6,
        fontWeight: 500,
        background: token.colorPrimaryBg,
        color: token.colorPrimary,
        border: 'none',
      }}
    >
      {name}
    </Tag>
  )
}
