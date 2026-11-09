import { theme, Tooltip } from 'antd'
import {
  CrownFilled,
  ExclamationCircleOutlined,
  FallOutlined,
  FileDoneOutlined,
  ManOutlined,
  RiseOutlined,
  TeamOutlined,
  TrophyOutlined,
  WarningOutlined,
  WomanOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import type { Gender, MissingField, PointMode, StudentStats } from '../types'

interface StatsRowProps {
  stats: StudentStats | undefined
  loading: boolean
  gender?: Gender
  pointMode?: PointMode
  missing?: MissingField
  onGenderToggle: (g: Gender) => void
  onPointMode: (m: PointMode) => void
  onMissing: (m: MissingField) => void
  /** klik kelas terendah → filter kelas tersebut */
  onWorstClass: (classId: string) => void
  /** klik kelas dengan kelengkapan terendah → filter kelas + "belum lengkap" */
  onWorstCompleteness: (classId: string) => void
}

/** Baris chip statistik + strip insight Terbaik/Terendah */
export function StatsRow({
  stats,
  loading,
  gender,
  pointMode,
  missing,
  onGenderToggle,
  onPointMode,
  onMissing,
  onWorstClass,
  onWorstCompleteness,
}: StatsRowProps) {
  const { token } = theme.useToken()
  const trend = stats?.trend7d
  const worst = stats?.worstClass
  const worstCompl = stats?.worstCompleteness

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: stats?.topPerformer || worst ? 10 : 0 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Total Siswa"
          value={stats?.total ?? '–'}
          color="indigo"
          loading={loading}
        />
        <StatChip
          icon={<ManOutlined />}
          label="Putra"
          value={stats?.male ?? '–'}
          color="sky"
          loading={loading}
          active={gender === 'L'}
          onClick={() => onGenderToggle('L')}
        />
        <StatChip
          icon={<WomanOutlined />}
          label="Putri"
          value={stats?.female ?? '–'}
          color="rose"
          loading={loading}
          active={gender === 'P'}
          onClick={() => onGenderToggle('P')}
        />
        <StatChip
          icon={<TrophyOutlined />}
          label="Rata-rata Poin"
          value={stats ? (stats.avgPoints > 0 ? `+${stats.avgPoints}` : stats.avgPoints) : '–'}
          color="emerald"
          loading={loading}
          active={pointMode === 'positive'}
          onClick={() => onPointMode('positive')}
        />
        {(stats?.riskCount ?? 0) > 0 && (
          <StatChip
            icon={<WarningOutlined />}
            label="Berisiko"
            value={stats!.riskCount}
            color="rose"
            active={pointMode === 'negative'}
            onClick={() => onPointMode('negative')}
          />
        )}
        <StatChip
          icon={<ExclamationCircleOutlined />}
          label="Tidak Lengkap"
          value={stats?.incompleteCount ?? '–'}
          color="amber"
          loading={loading}
          active={missing === 'any'}
          onClick={() => onMissing('any')}
        />
        {trend !== null && trend !== undefined && (
          <StatChip
            icon={trend < 0 ? <FallOutlined /> : <RiseOutlined />}
            label="Tren 7 hari"
            value={trend > 0 ? `+${trend}` : trend}
            color="purple"
            loading={loading}
          />
        )}
      </div>

      {(stats?.topPerformer || worst || worstCompl) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '4px 20px',
            padding: '7px 14px',
            borderRadius: 10,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
            fontSize: 12.5,
          }}
        >
          {stats?.topPerformer && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CrownFilled style={{ color: '#f59e0b' }} />
              <span style={{ color: token.colorTextSecondary }}>Terbaik:</span>
              <span style={{ fontWeight: 600 }}>{stats.topPerformer.name}</span>
              <span style={{ fontWeight: 700, color: '#16a34a' }}>+{stats.topPerformer.points}</span>
            </span>
          )}
          {worst && (
            <button
              type="button"
              onClick={() => onWorstClass(worst.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                cursor: 'pointer',
              }}
              title={`Filter siswa kelas ${worst.name}`}
            >
              <WarningOutlined style={{ color: '#dc2626' }} />
              <span style={{ color: token.colorTextSecondary }}>Terendah:</span>
              <span style={{ fontWeight: 600, color: '#dc2626' }}>{worst.name}</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>({worst.avg})</span>
            </button>
          )}
          {worstCompl && (
            <Tooltip
              title={
                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Kelengkapan data per kelas</div>
                  {(stats?.classCompleteness ?? []).map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <span>{c.name}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {c.percent}% · {c.incomplete}/{c.total} belum lengkap
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 4, opacity: 0.75 }}>Klik untuk filter kelas ini</div>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => onWorstCompleteness(worstCompl.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <FileDoneOutlined style={{ color: '#f59e0b' }} />
                <span style={{ color: token.colorTextSecondary }}>Kelengkapan:</span>
                <span style={{ fontWeight: 600, color: '#f59e0b' }}>{worstCompl.name}</span>
                <span style={{ fontWeight: 700, color: '#f59e0b' }}>
                  {worstCompl.percent}% ({worstCompl.incomplete}/{worstCompl.total})
                </span>
              </button>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}
