import {
  BookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
} from '@ant-design/icons'
import { Space } from 'antd'
import { StatChip } from '../../../shared/components/StatChip'
import type { CounselingStats } from '../types'

interface StatsRowProps {
  stats: CounselingStats | undefined
  loading: boolean
  onOpenInProgress: () => void
  onOpenHighUrgency: () => void
}

/** Chip statistik BK — klik chip untuk membuka daftarnya */
export function StatsRow({
  stats,
  loading,
  onOpenInProgress,
  onOpenHighUrgency,
}: StatsRowProps) {
  return (
    <Space wrap size="small" style={{ marginBottom: 16 }}>
      <StatChip
        icon={<BookOutlined />}
        label="Total sesi"
        value={stats?.total ?? 0}
        color="indigo"
        loading={loading}
      />
      <StatChip
        icon={<ClockCircleOutlined />}
        label="Dalam proses"
        value={stats?.inProgress ?? 0}
        color="amber"
        loading={loading}
        onClick={stats?.inProgress ? onOpenInProgress : undefined}
      />
      <StatChip
        icon={<FireOutlined />}
        label="Urgensi tinggi aktif"
        value={stats?.highUrgencyActive ?? 0}
        color="rose"
        loading={loading}
        onClick={stats?.highUrgencyActive ? onOpenHighUrgency : undefined}
      />
      <StatChip
        icon={<CheckCircleOutlined />}
        label="Selesai bulan ini"
        value={stats?.completedThisMonth ?? 0}
        color="emerald"
        loading={loading}
      />
    </Space>
  )
}
