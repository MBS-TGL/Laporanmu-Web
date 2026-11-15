import { Card, Col, Empty, Row } from 'antd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'
import type { InsightsSnapshot } from '../types'

/** Grafik agregat halaman Insights — pola styling sama dengan DashboardPage. */
export function InsightCharts({ snapshot }: { snapshot: InsightsSnapshot }) {
  const hasClasses = snapshot.classSizes.length > 0
  const hasDorms = snapshot.dormNegative.length > 0
  const hasRisk = snapshot.riskBreakdown.some((b) => b.value > 0)

  const emptyText = (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data" style={{ margin: '40px 0' }} />
  )

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={14}>
        <Card title="Tren Pencatatan Poin (14 hari)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={snapshot.reportsDaily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => dayjs(v).format('DD/MM')}
                fontSize={11}
                interval={2}
              />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip labelFormatter={(v) => dayjs(v as string).format('DD MMM YYYY')} />
              <Legend />
              <Line
                type="monotone"
                dataKey="pelanggaran"
                name="Pelanggaran"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="prestasi"
                name="Prestasi"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </Col>
      <Col xs={24} lg={10}>
        <Card title="Distribusi Kondisi Poin">
          {hasRisk ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={snapshot.riskBreakdown}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {snapshot.riskBreakdown.map((b) => (
                    <Cell key={b.label} fill={b.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            emptyText
          )}
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Rata-rata Poin per Kelas">
          {hasClasses ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={snapshot.classSizes.map((c) => ({ ...c, rata: c.avgPoints }))}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} />
                <YAxis type="category" dataKey="name" width={48} fontSize={11} />
                <Tooltip formatter={(value, name) => (name === 'rata' ? [value, 'Rata-rata poin'] : [value, name])} />
                <Bar dataKey="rata" name="Rata-rata poin" radius={[0, 4, 4, 0]}>
                  {snapshot.classSizes.map((c) => (
                    <Cell key={c.name} fill={c.avgPoints < 0 ? '#ef4444' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            emptyText
          )}
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card title="Santri Poin Negatif per Asrama">
          {hasDorms ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={snapshot.dormNegative}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} fontSize={11} />
                <Tooltip />
                <Bar dataKey="negativeStudents" name="Santri poin negatif" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            emptyText
          )}
        </Card>
      </Col>
    </Row>
  )
}
