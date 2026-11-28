import { memo } from 'react'
import { Popover, theme } from 'antd'
import {
  CrownFilled,
  ExclamationCircleOutlined,
  FallOutlined,
  FileDoneOutlined,
  KeyOutlined,
  ManOutlined,
  RiseOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
  WarningOutlined,
  WomanOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { StudentName } from '../../../shared/components/StudentName'
import type { Gender, MissingField, PointMode, StudentStats } from '../types'

interface StatsRowProps {
  stats: StudentStats | undefined
  loading: boolean
  gender?: Gender
  pointMode?: PointMode
  missing?: MissingField
  noPinCount?: number
  onGenderToggle: (g: Gender) => void
  onPointMode: (m: PointMode) => void
  onMissing: (m: MissingField) => void
  /** klik kelas terendah → filter kelas tersebut */
  onWorstClass: (classId: string) => void
  /** klik kelas dengan kelengkapan terendah → filter kelas + "belum lengkap" */
  onWorstCompleteness: (classId: string) => void
}

/** Baris chip statistik + strip insight Terbaik/Terendah */
export const StatsRow = memo(function StatsRow({
  stats,
  loading,
  gender,
  pointMode,
  missing,
  noPinCount,
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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Total Santri"
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
          icon={<UserOutlined />}
          label="Tanpa gender"
          value={stats?.unknownGender ?? '–'}
          color="slate"
          loading={loading}
          hideIfZero
        />
        <StatChip
          icon={<TrophyOutlined />}
          label="Rata-rata Poin"
          value={stats ? (stats.avgPoints > 0 ? `+${stats.avgPoints}` : stats.avgPoints) : '–'}
          color="emerald"
          loading={loading}
          hideIfZero
          active={pointMode === 'positive'}
          onClick={() => onPointMode('positive')}
        />
        <StatChip
          icon={<WarningOutlined />}
          label="Berisiko"
          value={stats?.riskCount ?? '–'}
          color="rose"
          loading={loading}
          hideIfZero
          active={pointMode === 'negative'}
          onClick={() => onPointMode('negative')}
        />
        <StatChip
          icon={<ExclamationCircleOutlined />}
          label="Tidak Lengkap"
          value={stats?.incompleteCount ?? '–'}
          color="amber"
          loading={loading}
          active={missing === 'any'}
          onClick={() => onMissing('any')}
        />
        {noPinCount !== undefined && (
          <StatChip
            icon={<KeyOutlined />}
            label="Tanpa PIN"
            value={noPinCount}
            color="amber"
            loading={loading}
            hideIfZero
            active={missing === 'pin'}
            onClick={() => onMissing('pin')}
          />
        )}
        {trend !== null && trend !== undefined && trend !== 0 && (
          <StatChip
            icon={trend < 0 ? <FallOutlined /> : <RiseOutlined />}
            label="Tren 7 hari"
            value={trend > 0 ? `+${trend}` : trend}
            color="purple"
            loading={loading}
          />
        )}

        {/* Insight Terbaik / Terendah / Kelengkapan — sejajar di baris chip, bukan band terpisah */}
        {stats?.topPerformer && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              fontSize: 12.5,
              minHeight: 44,
            }}
          >
            <CrownFilled style={{ color: '#f59e0b' }} />
            <span style={{ color: token.colorTextSecondary }}>Terbaik:</span>
            <StudentName name={stats.topPerformer.name} size={12.5} />
            <span style={{ fontWeight: 700, color: token.colorSuccess }}>+{stats.topPerformer.points}</span>
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
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              font: 'inherit',
              fontSize: 12.5,
              minHeight: 44,
              cursor: 'pointer',
            }}
            title={`Filter siswa kelas ${worst.name}`}
          >
            <WarningOutlined style={{ color: token.colorError }} />
            <span style={{ color: token.colorTextSecondary }}>Terendah:</span>
            <span style={{ fontWeight: 600, color: token.colorError }}>{worst.name}</span>
            <span style={{ fontWeight: 700, color: token.colorError }}>({worst.avg})</span>
          </button>
        )}
        {worstCompl && (
          // Popover, bukan Tooltip — isi berupa daftar per kelas butuh judul proper,
          // padding lega, dan lebar terkontrol (Tooltip menyebabkan wrap per kata).
          <Popover
            trigger={['hover', 'click']}
            placement="bottomLeft"
            title="Kelengkapan data per kelas"
            content={
              <div
                style={{
                  width: 'min(330px, calc(100vw - 48px))',
                  maxHeight: 280,
                  overflowY: 'auto',
                  marginInline: -4,
                }}
              >
                {[...(stats?.classCompleteness ?? [])]
                  .sort((a, b) => a.percent - b.percent || a.name.localeCompare(b.name, 'id'))
                  .map((c) => {
                    const color = c.percent < 50 ? token.colorError : c.percent < 80 ? token.colorWarning : token.colorSuccess
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className="completeness-row"
                        onClick={() => onWorstCompleteness(c.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          padding: '5px 6px',
                          font: 'inherit',
                          fontSize: 12.5,
                          color: token.colorText,
                          cursor: 'pointer',
                          borderRadius: 6,
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 500,
                          }}
                        >
                          {c.name}
                        </span>
                        {/* Bar mini kelengkapan — warna sesuai tingkat */}
                        <span
                          style={{
                            width: 72,
                            height: 6,
                            borderRadius: 4,
                            background: token.colorFillSecondary,
                            overflow: 'hidden',
                            flexShrink: 0,
                            display: 'inline-block',
                          }}
                        >
                          <span
                            style={{
                              display: 'block',
                              width: `${c.percent}%`,
                              height: '100%',
                              background: color,
                            }}
                          />
                        </span>
                        <span
                          style={{
                            width: 104,
                            flexShrink: 0,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color,
                            fontWeight: 600,
                          }}
                        >
                          {c.percent}% · {c.total - c.incomplete}/{c.total} lengkap
                        </span>
                      </button>
                    )
                  })}
                <div style={{ marginTop: 6, paddingInline: 6, fontSize: 11, color: token.colorTextTertiary }}>
                  Urut dari kelengkapan terendah, klik kelas untuk memfilter siswa yang belum lengkap
                </div>
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
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                font: 'inherit',
                fontSize: 12.5,
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              <FileDoneOutlined style={{ color: token.colorWarning }} />
              <span style={{ color: token.colorTextSecondary }}>Kelengkapan:</span>
              <span style={{ fontWeight: 600, color: token.colorWarning }}>{worstCompl.name}</span>
              <span style={{ fontWeight: 700, color: token.colorWarning }}>
                {worstCompl.percent}% ({worstCompl.total - worstCompl.incomplete}/{worstCompl.total} lengkap)
              </span>
            </button>
          </Popover>
        )}
      </div>
    </div>
  )
})
