import { useMemo, type ReactNode } from 'react'
import { Avatar, Button, Card, Col, List, Row, Statistic, Tag, Typography } from 'antd'
import {
  ApartmentOutlined,
  BankOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  FileDoneOutlined,
  InboxOutlined,
  ReadOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
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
import { useStudentDetail } from '../students/useStudentDetail'
import { CATEGORY_COLORS, type AnnouncementCategory } from '../announcements/types'
import { supabase } from '../../lib/supabase'

const STATUS_ORDER = ['active', 'graduated', 'transferred', 'left'] as const
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktif',
  graduated: 'Lulus',
  transferred: 'Pindah',
  left: 'Keluar',
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
    .limit(2000)
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
  direction: 'left' | 'masuk'
  occurred_at: string
  student?: { id: string; name: string } | null
}

async function fetchRecentGateLogs(): Promise<RecentGateLog[]> {
  const { data, error } = await supabase
    .from('gate_logs')
    .select('id, direction, occurred_at, student:students!inner(id, name)')
    .order('occurred_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as unknown as RecentGateLog[]
}

interface RecentAnnouncement {
  id: string
  title: string
  category: AnnouncementCategory
  published_at: string | null
}

async function fetchRecentAnnouncements(): Promise<RecentAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, category, published_at, created_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return (data ?? []) as RecentAnnouncement[]
}

interface TodaySchedule {
  id: string
  start_time: string
  end_time: string
  room: string | null
  classes?: { name: string } | null
  subjects?: { name: string } | null
  teachers?: { name: string } | null
}

async function fetchTodaySchedules(): Promise<TodaySchedule[]> {
  // day_of_week: 1=Senin … 7=Minggu (dayjs .day(): 0=Minggu)
  const dow = dayjs().day() === 0 ? 7 : dayjs().day()
  const { data, error } = await supabase
    .from('schedules')
    .select('id, start_time, end_time, room, classes(name), subjects(name), teachers(name)')
    .eq('day_of_week', dow)
    .is('deleted_at', null)
    .order('start_time')
    .limit(8)
  if (error) throw error
  return (data ?? []) as unknown as TodaySchedule[]
}

async function fetchLoanCounts(): Promise<{ active: number; overdue: number }> {
  const today = dayjs().format('YYYY-MM-DD')
  const [activeRes, overdueRes] = await Promise.all([
    supabase.from('book_loans').select('id', { count: 'exact', head: true }).filter('returned_at', 'is', null),
    supabase
      .from('book_loans')
      .select('id', { count: 'exact', head: true })
      .filter('returned_at', 'is', null)
      .lt('due_date', today),
  ])
  if (activeRes.error) throw activeRes.error
  if (overdueRes.error) throw overdueRes.error
  return { active: activeRes.count ?? 0, overdue: overdueRes.count ?? 0 }
}

interface InventoryStats {
  total: number
  lowStock: number
  damaged: number
  totalValue: number
}

async function fetchInventoryStats(): Promise<InventoryStats> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('quantity, min_quantity, condition, price')
    .is('deleted_at', null)
  if (error) throw error
  const items = (data ?? []) as {
    quantity: number
    min_quantity: number
    condition: string
    price: number | null
  }[]
  return {
    total: items.length,
    lowStock: items.filter((i) => i.quantity <= i.min_quantity).length,
    damaged: items.filter((i) => i.condition === 'light_damaged' || i.condition === 'heavy_damaged').length,
    totalValue: items.reduce((sum, i) => sum + (i.price ?? 0) * (i.quantity ?? 0), 0),
  }
}

const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

function StatCard({
  title,
  value,
  loading,
  icon,
  bg,
  color,
  onClick,
}: {
  title: string
  value?: number
  loading?: boolean
  icon: ReactNode
  bg: string
  color: string
  /** Kalau diisi, kartu jadi shortcut ke page terkait (dashboard = hub navigasi). */
  onClick?: () => void
}) {
  const card = (
    <Card
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      hoverable={!!onClick}
      style={onClick ? { cursor: 'pointer', height: '100%' } : undefined}
    >
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

  // Kartu shortcut diberi lift halus agar affordance kliknya terasa (MOTION 2)
  if (!onClick) return card
  return <div className="stat-card-lift">{card}</div>
}

/** Link kecil ke page induk di pojok kanan atas Card widget. */
function CardLink({ label, to, navigate }: { label: string; to: string; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <Button type="link" size="small" onClick={() => navigate(to)} style={{ padding: 0 }}>
      {label}
    </Button>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { open: openStudentDetail } = useStudentDetail()

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
  const announcementsQuery = useQuery({
    queryKey: ['dashboard', 'recent-announcements'],
    queryFn: fetchRecentAnnouncements,
  })
  const todaySchedulesQuery = useQuery({
    queryKey: ['dashboard', 'today-schedules'],
    queryFn: fetchTodaySchedules,
  })
  const loansQuery = useQuery({
    queryKey: ['dashboard', 'loan-counts'],
    queryFn: fetchLoanCounts,
  })
  const inventoryQuery = useQuery({
    queryKey: ['dashboard', 'inventory-stats'],
    queryFn: fetchInventoryStats,
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
    const map = new Map<string, { violations: number; achievements: number }>()
    for (const report of monthlyQuery.data ?? []) {
      const key = dayjs(report.reported_at).format('YYYY-MM-DD')
      const entry = map.get(key) ?? { violations: 0, achievements: 0 }
      if (report.points < 0) entry.violations += 1
      else entry.achievements += 1
      map.set(key, entry)
    }
    const days: { date: string; violations: number; achievements: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      days.push({ date, ...(map.get(date) ?? { violations: 0, achievements: 0 }) })
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
            onClick={() => navigate('/students')}
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
            onClick={() => navigate('/teachers')}
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
            onClick={() => navigate('/classes')}
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
            onClick={() => navigate('/dorms')}
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
            onClick={() => navigate('/disiplin?tab=catatan')}
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
          <Card
            title="Siswa dengan Poin Terendah"
            extra={<CardLink label="Semua catatan" to="/disiplin?tab=catatan" navigate={navigate} />}
          >
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
                    title={
                      <Typography.Link onClick={() => openStudentDetail(item.id)}>{item.name}</Typography.Link>
                    }
                    description={item.classes?.name ?? 'Tanpa kelas'}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Aktivitas Gerbang Terbaru" extra={<CardLink label="Semua log" to="/gate" navigate={navigate} />}>
            <List<RecentGateLog>
              loading={gateQuery.isPending}
              dataSource={gateQuery.data ?? []}
              locale={{ emptyText: 'Belum ada aktivitas gerbang' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    item.direction === 'left' ? (
                      <Tag key="dir" color="orange">Keluar</Tag>
                    ) : (
                      <Tag key="dir" color="green">Masuk</Tag>
                    ),
                  ]}
                >
                  <List.Item.Meta
                    title={
                      item.student ? (
                        <Typography.Link onClick={() => openStudentDetail(item.student!.id)}>
                          {item.student.name}
                        </Typography.Link>
                      ) : (
                        '-'
                      )
                    }
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

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <>
                <CalendarOutlined /> Jadwal Hari Ini ({dayjs().format('dddd, DD MMM YYYY')})
              </>
            }
            extra={<CardLink label="Kelola jadwal" to="/schedules" navigate={navigate} />}
          >
            <List<TodaySchedule>
              loading={todaySchedulesQuery.isPending}
              dataSource={todaySchedulesQuery.data ?? []}
              locale={{ emptyText: 'Tidak ada jadwal hari ini' }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Tag key="jam" color="blue">
                      {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.subjects?.name ?? 'Tanpa mapel'}
                    description={
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.classes?.name ?? 'Tanpa kelas'}
                        {item.teachers?.name ? ` · ${item.teachers.name}` : ''}
                        {item.room ? ` · Ruang ${item.room}` : ''}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <>
                <BellOutlined /> Pengumuman Terbaru
              </>
            }
            extra={<CardLink label="Semua pengumuman" to="/announcements" navigate={navigate} />}
          >
            <List<RecentAnnouncement>
              loading={announcementsQuery.isPending}
              dataSource={announcementsQuery.data ?? []}
              locale={{ emptyText: 'Belum ada pengumuman terpublikasi' }}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/announcements')}
                >
                  <List.Item.Meta
                    title={item.title}
                    description={
                      <span>
                        <Tag color={CATEGORY_COLORS[item.category] ?? 'default'}>{item.category}</Tag>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(item.published_at ?? '').format('DD MMM YYYY')}
                        </Typography.Text>
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <BookOutlined /> Perpustakaan
              </>
            }
            extra={<CardLink label="Kelola perpustakaan" to="/library" navigate={navigate} />}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="Peminjaman Aktif"
                  value={loansQuery.data?.active}
                  loading={loansQuery.isPending}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Terlambat"
                  value={loansQuery.data?.overdue}
                  loading={loansQuery.isPending}
                  valueStyle={loansQuery.data?.overdue ? { color: '#e11d48' } : undefined}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <>
                <InboxOutlined /> Inventaris
              </>
            }
            extra={<CardLink label="Kelola inventaris" to="/inventory" navigate={navigate} />}
          >
            <Row gutter={16}>
              <Col xs={8}>
                <Statistic
                  title="Jenis Barang"
                  value={inventoryQuery.data?.total}
                  loading={inventoryQuery.isPending}
                />
              </Col>
              <Col xs={8}>
                <Statistic
                  title="Stok Menipis"
                  value={inventoryQuery.data?.lowStock}
                  loading={inventoryQuery.isPending}
                  valueStyle={inventoryQuery.data?.lowStock ? { color: '#d97706' } : undefined}
                />
              </Col>
              <Col xs={8}>
                <Statistic
                  title="Nilai Aset"
                  value={idr.format(inventoryQuery.data?.totalValue ?? 0)}
                  loading={inventoryQuery.isPending}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
