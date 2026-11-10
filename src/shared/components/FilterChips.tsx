import { Tag, theme } from 'antd'

export interface FilterChip {
  key: string
  label: string
  onClear: () => void
}

/** Baris chip filter aktif yang bisa dihapus satu per satu — template dari StudentsPage */
export function FilterChips({ chips, marginTop }: { chips: FilterChip[]; marginTop?: number }) {
  const { token } = theme.useToken()
  if (chips.length === 0) return null
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
        marginTop: marginTop ?? 12,
      }}
    >
      {chips.map((chip) => (
        <Tag
          key={chip.key}
          closable
          onClose={chip.onClear}
          style={{
            borderRadius: 999,
            background: token.colorFillQuaternary,
            border: 'none',
            paddingInline: 10,
          }}
        >
          {chip.label}
        </Tag>
      ))}
    </div>
  )
}
