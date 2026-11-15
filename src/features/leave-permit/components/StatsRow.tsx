import { Space } from 'antd'
import {
  CalendarOutlined,
  FileAddOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'

export interface PermitStats {
  issuedToday: number
  out: number
  overdue: number
  thisMonth: number
}

interface Props {
  stats: PermitStats
  loading: boolean
  /** Filter status aktif — chip terkait menyala */
  statusFilter: string
  /** Toggle filter status (berangkat / terlambat) */
  onToggleStatus: (status: 'departed' | 'overdue') => void
  /** Toggle rentang bulan berjalan */
  onToggleMonth: () => void
}

/** Baris statistik klikabel — chip aktif berfungsi sebagai filter cepat */
export function StatsRow({ stats, loading, statusFilter, onToggleStatus, onToggleMonth }: Props) {
  return (
    <Space wrap size={10} style={{ marginBottom: 16 }}>
      <StatChip
        icon={<FileAddOutlined />}
        label="Diterbitkan Hari Ini"
        value={stats.issuedToday}
        color="indigo"
        loading={loading}
      />
      <StatChip
        icon={<SendOutlined />}
        label="Sedang Keluar"
        value={stats.out}
        color="amber"
        loading={loading}
        active={statusFilter === 'departed'}
        onClick={() => onToggleStatus('departed')}
      />
      <StatChip
        icon={<StopOutlined />}
        label="Terlambat"
        value={stats.overdue}
        color="rose"
        loading={loading}
        active={statusFilter === 'overdue'}
        onClick={() => onToggleStatus('overdue')}
      />
      <StatChip
        icon={<CalendarOutlined />}
        label="Bulan Ini"
        value={stats.thisMonth}
        color="sky"
        loading={loading}
        onClick={onToggleMonth}
      />
    </Space>
  )
}
