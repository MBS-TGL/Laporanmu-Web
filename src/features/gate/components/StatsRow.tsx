import { FileProtectOutlined, LoginOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons'
import { Space } from 'antd'
import { StatChip } from '../../../shared/components/StatChip'
import type { GateTodayStats } from '../types'

interface StatsRowProps {
  stats: GateTodayStats | undefined
  loading: boolean
  activePermitCount: number
  onOpenOutside: () => void
  onOpenPermits: () => void
}

/** Chip statistik gerbang hari ini — klik chip untuk membuka daftarnya */
export function StatsRow({
  stats,
  loading,
  activePermitCount,
  onOpenOutside,
  onOpenPermits,
}: StatsRowProps) {
  return (
    <Space wrap size="small" style={{ marginBottom: 16 }}>
      <StatChip
        icon={<LoginOutlined />}
        label="Masuk hari ini"
        value={stats?.entryCount ?? 0}
        color="emerald"
        loading={loading}
      />
      <StatChip
        icon={<LogoutOutlined />}
        label="Keluar hari ini"
        value={stats?.exitCount ?? 0}
        color="amber"
        loading={loading}
      />
      <StatChip
        icon={<TeamOutlined />}
        label="Di luar gerbang"
        value={stats?.outside.length ?? 0}
        color="rose"
        loading={loading}
        onClick={onOpenOutside}
      />
      <StatChip
        icon={<FileProtectOutlined />}
        label="Izin aktif"
        value={activePermitCount}
        color="sky"
        loading={loading}
        onClick={activePermitCount > 0 ? onOpenPermits : undefined}
      />
    </Space>
  )
}
