import { ArrowDownOutlined, ArrowUpOutlined, CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons'
import { theme } from 'antd'

type SortOrder = 'ascend' | 'descend' | null

/**
 * Ikon sorter gaya Esceha.id: nonaktif = dua arah kecil sangat redup
 * (lebih pudar dari teks header), aktif = satu panah solid primary.
 * Template dari StudentsPage.
 */
export function TableSortIcon({ sortOrder }: { sortOrder?: SortOrder }) {
  const { token } = theme.useToken()
  if (sortOrder === 'ascend')
    return <ArrowUpOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
  if (sortOrder === 'descend')
    return <ArrowDownOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        lineHeight: 1,
        color: token.colorTextQuaternary,
      }}
    >
      <CaretUpOutlined style={{ fontSize: 10, marginBottom: -3 }} />
      <CaretDownOutlined style={{ fontSize: 10 }} />
    </span>
  )
}
