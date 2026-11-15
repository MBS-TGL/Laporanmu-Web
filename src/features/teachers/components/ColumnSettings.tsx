import { Button, Checkbox, Popover, Space, Typography } from 'antd'
import { SettingOutlined } from '@ant-design/icons'

const { Text } = Typography

/** Kolom tabel yang bisa disembunyikan — Guru & Aksi selalu tampil */
const TOGGLE_COLUMNS = [
  { key: 'nbm', label: 'NBM' },
  { key: 'subject', label: 'Mapel' },
  { key: 'phone', label: 'Kontak' },
  { key: 'status', label: 'Status' },
  { key: 'join_date', label: 'Bergabung' },
] as const

export type ColumnVisibility = Record<string, boolean>

interface ColumnSettingsProps {
  value: ColumnVisibility
  onChange: (next: ColumnVisibility) => void
}

/** Popover "Atur Kolom" — toggle kolom tabel guru, persist di pemanggil */
export function ColumnSettings({ value, onChange }: ColumnSettingsProps) {
  const content = (
    <div style={{ minWidth: 170 }}>
      <Text strong style={{ fontSize: 13 }}>
        Kolom Tampilan
      </Text>
      <Space direction="vertical" size={2} style={{ marginTop: 8, display: 'flex' }}>
        {TOGGLE_COLUMNS.map((c) => (
          <Checkbox
            key={c.key}
            checked={value[c.key] ?? true}
            onChange={(e) => onChange({ ...value, [c.key]: e.target.checked })}
          >
            {c.label}
          </Checkbox>
        ))}
      </Space>
      <Button
        type="link"
        size="small"
        style={{ marginTop: 4, paddingInline: 0 }}
        onClick={() => onChange(Object.fromEntries(TOGGLE_COLUMNS.map((c) => [c.key, true])))}
      >
        Reset
      </Button>
    </div>
  )

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <Button icon={<SettingOutlined />}>Kolom</Button>
    </Popover>
  )
}
