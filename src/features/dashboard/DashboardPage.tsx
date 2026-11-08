import { useMemo, type ReactNode } from 'react'
import { Avatar, Card, Col, List, Row, Statistic, Tag, Typography } from 'antd'
import {
  ApartmentOutlined,
  BankOutlined,
  FileDoneOutlined,
  ReadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../../shared/components/PageHeader'
import { supabase } from '../../lib/supabase'

const STATUS_ORDER = ['aktif', 'lulus', 'pindah', 'keluar'] as const
const STATUS_LABEL: Record<string, string> = {
  aktif: 'Aktif',
  lulus: 'Lulus',
  pindah: 'Pindah',
  keluar: 'Keluar',
}

async function fetchActiveCount(table: 'students' | 'teachers' | 'classes' | 'dorms'): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
  if (error) throw error
  return count ?? 0
}

async function fetchStatusCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('student_status_counts').select('*')
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as { status: string; count: number }[]) {
    counts[row.status] = row.count
  }
  return counts
}

interface ReportPoint {
  points: number
  reported_at: string
}

async function fetchMonthlyReports(): Promise<ReportPoint[]> {
  const since = dayjs().subtract(29, 'day').startOf('day').toISOString()
  const { data, error } = await supabase
    .from('reports')
    .select('points, reported_at')
    .gte('reported_at', since)
    .order('reported_at')
  if (error) throw error
  return (data ?? []) as ReportPoint[]
}

interface LowPointStudent {
  id: string
  name: string
  total_points: number
  classes?: { name: string } | null
}

async function fetchLowestPoints(): Promise<LowPointStudent[]> {
  const { data, error } = await supabase
    .from('students')
    // hint FK wajib sejak 0018 — students punya 2 FK ke classes
    .select('id, name, total_points, classes!students_class_id_fkey(name)')
    .is('deleted_at', null)
    .order('total_points', { ascending: true })
    .limit(5)
  if (error) throw error
  return (data ?? []) as unknown as LowPointStudent[]
}

interface RecentGateLog {
  id: string
  direction: 'keluar' | 'masuk'
  occurred_at: string
  student?: { name: string } | null
}

async function fetchRecentGateLogs(): Promise<RecentGateLog[]> {
  const { data, error } = await supabase
    .from('gate_logs')
    .select('id, direction, occurred_at, student:students!inner(name)')
    .order('occurred_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as unknown as RecentGateLog[]
}

function StatCard({
  title,
  value,
  loading,
  icon,
  bg,
  color,
}: {
  title: string
  value?: number
  loading?: boolean
  icon: ReactNode
  bg: string
  color: string
}) {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Statistic title={title} value={value} loading={loading} />
        <Avatar shape="square" size={42} icon={icon} style={{ background: bg, color, borderRadius: 12 }} />
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const studentsQuery = useQuery({
    queryKey: ['dashboard', 'students-count'],
    queryFn: () => fetchActiveCount('students'),
  })
  const teachersQuery = useQuery({
    queryKey: ['dashboard', 'teachers-count'],
    queryFn: () => fetchActiveCount('teachers'),
  })
  const classesQuery = useQuery({
    queryKey: ['dashboard', 'classes-count'],
    queryFn: () => fetchActiveCount('classes'),
  })
  const dormsQuery = useQuery({
    queryKey: ['dashboard', 'dorms-count'],
    queryFn: () => fetchActiveCount('dorms'),
  })
  const statusQuery = useQuery({
    queryKey: ['dashboard', 'status-counts'],
    queryFn: fetchStatusCounts,
  })
  const monthlyQuery = useQuery({
    queryKey: ['dashboard', 'monthly-reports'],
    queryFn: fetchMonthlyReports,
  })
  const lowPointsQuery = useQuery({
    queryKey: ['dashboard', 'lowest-points'],
    queryFn: fetchLowestPoints,
  })
  const gateQuery = useQuery({
    queryKey: ['dashboard', 'recent-gate'],
    queryFn: fetchRecentGateLogs,
  })

  const statusData = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        label: STATUS_LABEL[status],
        count: statusQuery.data?.[status] ?? 0,
      })),
    [statusQuery.data],
  )

  const trendData = useMemo(() => {
    const map = new Map<string, { pelanggaran: number; prestasi: number }>()
    for (const report of monthlyQuery.data ?? []) {
      const key = dayjs(report.reported_at).format('YYYY-MM-DD')
      const entry = map.get(key) ?? { pelanggaran: 0, prestasi: 0 }
      if (report.points < 0) entry.pelanggaran += 1
      else entry.prestasi += 1
      map.set(key, entry)
    }
    const days: { date: string; pelanggaran: number; prestasi: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      days.push({ date, ...(map.get(date) ?? { pelanggaran: 0, prestasi: 0 }) })
    }
    return days
  }, [monthlyQuery.data])

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Ringkasan utama sistem" />

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} xl={4}>
          <StatCard
            title="Siswa"
            value={studentsQuery.data ?? 0}
            loading={studentsQuery.isPending}
            icon={<TeamOutlined />}
            bg="#e0e7ff"
            color="#4f46e5"
          />
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <StatCard
            title="Guru"
            value={teachersQuery.data ?? 0}
            loading={teachersQuery.isPending}
            icon={<ReadOutlined />}
            bg="#d1fae5"
            color="#059669"
          />
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <StatCard
            title="Kelas"
            value={classesQuery.data ?? 0}
            loading={classesQuery.isPending}
            icon={<BankOutlined />}
            bg="#fef3c7"
            color="#d97706"
          />
        </Col>
        <Col xs={12} sm={8} xl={4}>
          <StatCard
            title="Asrama"
            value={dormsQuery.data ?? 0}
            loading={dormsQuery.isPending}
            icon={<ApartmentOutlined />}
            bg="#e0f2fe"
            color="#0284c7"
          />
        </Col>
        <Col xs={24} sm={16} xl={8}>
          <StatCard
            title="Catatan Poin 30 Hari Terakhir"
            value={monthlyQuery.data?.length ?? 0}
            loading={monthlyQuery.isPending}
            icon={<FileDoneOutlined />}
            bg="#ffe4e6"
            color="#e11d48"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Tren Catatan Poin (30 hari)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => dayjs(v).format('DD/MM')}
                  fontSize={11}
                  interval={4}
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
          <Card title="Distribusi Status Siswa">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" name="Jumlah siswa" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Siswa dengan Poin Terendah">
            <List<LowPointStudent>
              loading={lowPointsQuery.isPending}
              dataSource={lowPointsQuery.data ?? []}
              locale={{ emptyText: 'Belum ada data poin' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Tag key="poin" color={item.total_points < 0 ? 'red' : 'default'}>
                      {item.total_points} poin
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={item.classes?.name ?? 'Tanpa kelas'}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Aktivitas Gerbang Terbaru">
            <List<RecentGateLog>
              loading={gateQuery.isPending}
              dataSource={gateQuery.data ?? []}
              locale={{ emptyText: 'Belum ada aktivitas gerbang' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    item.direction === 'keluar' ? (
                      <Tag key="dir" color="orange">Keluar</Tag>
                    ) : (
                      <Tag key="dir" color="green">Masuk</Tag>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={item.student?.name ?? '-'}
                    description={
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.occurred_at).format('DD MMM YYYY HH:mm')}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
