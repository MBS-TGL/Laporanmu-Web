import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card, Empty, Typography, theme } from 'antd'
import { transformToRadarData, type RadarDataPoint } from '../raporUtil'

interface RaporRadarChartProps {
  data: Array<{
    subject: string
    score: number | null
    kkm: number
  }>
  height?: number
  isPrint?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color: string
    payload: RadarDataPoint
  }>
}

function CustomRadarTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '8px 12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{data.fullName}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4f46e5' }}>
        <span>Nilai Santri:</span>
        <b>{data.score}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
        <span>KKM:</span>
        <b>{data.kkm}</b>
      </div>
    </div>
  )
}

export function RaporRadarChart({ data, height = 300, isPrint = false }: RaporRadarChartProps) {
  const { token } = theme.useToken()
  const chartData = transformToRadarData(data)

  // Radar chart membutuhkan minimal 3 sudut (titik) agar membentuk polygon yang valid
  if (chartData.length < 3) {
    return (
      <Card size="small" style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Minimal 3 mata pelajaran terdaftar untuk menampilkan diagram capaian"
        />
      </Card>
    )
  }

  // Hitung ringkasan capaian
  const evaluated = chartData.filter((d) => d.score > 0)
  const aboveKkmCount = evaluated.filter((d) => d.score >= d.kkm).length

  return (
    <div
      style={{
        width: '100%',
        background: isPrint ? '#fff' : token.colorBgContainer,
        borderRadius: isPrint ? 0 : 12,
        padding: isPrint ? 0 : '12px 14px',
        border: isPrint ? 'none' : `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {!isPrint && (
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Typography.Text strong style={{ fontSize: 13, color: token.colorText }}>
            Diagram Capaian Pembelajaran
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {aboveKkmCount}/{chartData.length} tuntas KKM
          </Typography.Text>
        </div>
      )}

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius={isPrint ? '70%' : '75%'} data={chartData}>
            <PolarGrid stroke={isPrint ? '#cbd5e1' : '#e2e8f0'} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{
                fontSize: isPrint ? 10 : 11,
                fill: isPrint ? '#0f172a' : '#64748b',
                fontWeight: isPrint ? 600 : 500,
              }}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" tick={{ fontSize: 9 }} />
            <Radar
              name="Batas KKM"
              dataKey="kkm"
              stroke="#94a3b8"
              fill="#94a3b8"
              fillOpacity={0.12}
              strokeDasharray="4 4"
            />
            <Radar
              name="Nilai Santri"
              dataKey="score"
              stroke={isPrint ? '#3730a3' : '#4f46e5'}
              fill={isPrint ? '#4338ca' : '#4f46e5'}
              fillOpacity={0.35}
              strokeWidth={2}
            />
            {!isPrint && <Tooltip content={<CustomRadarTooltip />} />}
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
              iconType="circle"
              iconSize={8}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
