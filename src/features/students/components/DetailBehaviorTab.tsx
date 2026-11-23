import { Button, Card, Col, Empty, Row, Segmented, Spin, Statistic, Tag, Timeline } from 'antd'
import dayjs from 'dayjs'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { StudentAttendanceRecap } from './StudentAttendanceRecap'
import { StudentSubjectRecap } from './StudentSubjectRecap'
import { StudentWorshipRecap } from './StudentWorshipRecap'
import type { BehaviorReport } from '../../behavior/types'

export interface BehaviorChartPoint {
  key: string
  label: string
  positif: number
  negatif: number
}

export type PointFilter = 'all' | 'pos' | 'neg'

export function TabEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ paddingTop: 56, textAlign: 'center' }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <span>
            <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</span>
            <span style={{ display: 'block', fontSize: 13.5, color: '#94a3b8', marginTop: 3 }}>{description}</span>
          </span>
        }
      />
    </div>
  )
}

interface DetailBehaviorTabProps {
  studentId: string
  reports: BehaviorReport[]
  reportsPending: boolean
  points: number
  chartData: BehaviorChartPoint[]
  pointFilter: PointFilter
  onPointFilterChange: (v: PointFilter) => void
  visibleLogs: number
  onLoadMore: () => void
}

export function DetailBehaviorTab({ studentId, reports, reportsPending, points, chartData, pointFilter, onPointFilterChange, visibleLogs, onLoadMore }: DetailBehaviorTabProps) {
  const posCount = reports.filter((r) => r.points > 0).length
  const negCount = reports.filter((r) => r.points < 0).length
  const filteredCount = pointFilter === 'all' ? reports.length : reports.filter((r) => (pointFilter === 'pos' ? r.points > 0 : r.points < 0)).length
  const filteredReports = (pointFilter === 'all' ? reports : reports.filter((r) => (pointFilter === 'pos' ? r.points > 0 : r.points < 0))).slice(
    0,
    visibleLogs,
  )

  return reportsPending ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
      <Spin />
    </div>
  ) : reports.length === 0 ? (
    <TabEmpty title="Belum ada Kedisiplinan & Poin" description="Santri ini belum memiliki catatan histori perilaku di sistem." />
  ) : (
    <div>
      <Card size="small" style={{ marginTop: 20, borderRadius: 13 }} styles={{ body: { padding: '12px 16px' } }}>
        <Row gutter={12}>
          <Col span={6}>
            <Statistic title="Total Poin" value={points > 0 ? `+${points}` : points} valueStyle={{ color: points < 0 ? '#dc2626' : '#16a34a', fontSize: 22 }} />
          </Col>
          <Col span={6}>
            <Statistic title="Total Log" value={reports.length} valueStyle={{ fontSize: 22 }} />
          </Col>
          <Col span={6}>
            <Statistic title="Positif" value={posCount} valueStyle={{ color: '#16a34a', fontSize: 22 }} />
          </Col>
          <Col span={6}>
            <Statistic title="Negatif" value={negCount} valueStyle={{ color: '#dc2626', fontSize: 22 }} />
          </Col>
        </Row>
        <div style={{ height: 190, marginTop: 12, marginLeft: -8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%" margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#cbd5e1' }} allowDecimals={false} />
              <RTooltip
                cursor={{ fill: 'rgba(79,70,229,0.06)' }}
                formatter={(value, name) => [`${name === 'Positif' ? '+' : '-'}${value}`, name as string]}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 11.5, padding: '6px 10px' }}
              />
              <Bar dataKey="positif" name="Positif" stackId="p" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Bar dataKey="negatif" name="Negatif" stackId="p" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <StudentAttendanceRecap studentId={studentId} />
      <StudentSubjectRecap studentId={studentId} />
      <StudentWorshipRecap studentId={studentId} />

      <Segmented
        block
        size="small"
        style={{ marginTop: 16 }}
        value={pointFilter}
        onChange={(v) => onPointFilterChange(v as PointFilter)}
        options={[
          { label: `Semua (${reports.length})`, value: 'all' },
          { label: `Positif (${posCount})`, value: 'pos' },
          { label: `Negatif (${negCount})`, value: 'neg' },
        ]}
      />

      <Timeline
        style={{ marginTop: 16 }}
        items={filteredReports.map((r) => ({
          color: r.points > 0 ? 'green' : r.points < 0 ? 'red' : 'gray',
          children: (
            <div style={{ paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{r.rule?.name ?? '-'}</span>
                <Tag
                  color={r.points > 0 ? 'green' : r.points < 0 ? 'red' : 'default'}
                  style={{ marginInlineEnd: 0, borderRadius: 6, fontSize: 12, fontWeight: 700 }}
                >
                  {r.points > 0 ? `+${r.points}` : r.points}
                </Tag>
              </div>
              {r.notes && <div style={{ fontSize: 13, color: '#475569', marginTop: 2, overflowWrap: 'anywhere' }}>{r.notes}</div>}
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                {dayjs(r.reported_at).format('DD MMM YYYY')} · {r.reporter?.name ?? 'Admin'}
              </div>
            </div>
          ),
        }))}
      />
      {filteredCount > visibleLogs && (
        <Button type="dashed" block onClick={onLoadMore} style={{ marginTop: 4 }}>
          Muat Lagi ({filteredCount - visibleLogs} lagi)
        </Button>
      )}
    </div>
  )
}
