import { useMemo } from 'react'
import { Alert, Card, Col, Empty, List, Row, Statistic } from 'antd'
import {
  ApartmentOutlined,
  AuditOutlined,
  DatabaseOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { useAuditActivity, useAuditLogs, useTableStats } from './hooks'

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#7c3aed', '#14b8a6', '#eab308']

const QUICK_LINKS = [
  { to: '/admin/database', label: 'Kesehatan Database', desc: 'Hitungan tabel & cek integritas', icon: <DatabaseOutlined /> },
  { to: '/admin/storage', label: 'Penyimpanan', desc: 'Bucket & pembersihan file', icon: <ApartmentOutlined /> },
  { to: '/admin/tasks', label: 'Otomasi', desc: 'Tugas pemeliharaan manual', icon: <ThunderboltOutlined /> },
  { to: '/admin/settings', label: 'Pengaturan Developer', desc: 'Feature flags & maintenance', icon: <AuditOutlined /> },
  { to: '/admin/users', label: 'Pengguna', desc: 'Kelola akun & role', icon: <UserOutlined /> },
  { to: '/admin/audit-log', label: 'Audit Log', desc: 'Jejak perubahan data', icon: <AuditOutlined /> },
]

function formatTableDate(value: string | null): string {
  if (!value) return '—'
  return dayjs(value).format('DD MMM YYYY HH:mm')
}

export function AdminDashboardPage() {
  const statsQuery = useTableStats()
  const activityQuery = useAuditActivity(7)
  const recentQuery = useAuditLogs({ page: 1, pageSize: 5 })

  const tableStats = statsQuery.data ?? []
  const totalRows = useMemo(() => tableStats.reduce((sum, t) => sum + t.total, 0), [tableStats])
  const pieData = useMemo(
    () => [...tableStats].sort((a, b) => b.total - a.total).map((t) => ({ name: t.label, value: t.total })),
    [tableStats],
  )
  const activityData = useMemo(
    () =>
      (activityQuery.data ?? []).map((d) => ({
        ...d,
        label: dayjs(d.date).format('DD/MM'),
      })),
    [activityQuery.data],
  )

  const studentsStat = tableStats.find((t) => t.key === 'students')
  const auditStat = tableStats.find((t) => t.key === 'audit_logs')

  return (
    <div>
      <PageHeader
        title="Dashboard Admin"
        subtitle="Pusat pantauan teknis: volume data, aktivitas sistem, dan akses cepat alat developer"
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Total Baris Data"
              value={totalRows}
              loading={statsQuery.isLoading}
              prefix={<DatabaseOutlined style={{ fontSize: 18, color: '#4f46e5' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Santri Aktif"
              value={studentsStat?.active ?? 0}
              loading={statsQuery.isLoading}
              prefix={<TeamOutlined style={{ fontSize: 18, color: '#0ea5e9' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Audit Log Tersimpan"
              value={auditStat?.total ?? 0}
              loading={statsQuery.isLoading}
              prefix={<AuditOutlined style={{ fontSize: 18, color: '#10b981' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} xl={6}>
          <Card>
            <Statistic
              title="Tabel Terpantau"
              value={tableStats.length}
              loading={statsQuery.isLoading}
              prefix={<DatabaseOutlined style={{ fontSize: 18, color: '#f59e0b' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card title="Aktivitas Audit 7 Hari" size="small">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={activityData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auditGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value) => [`${value} aktivitas`, 'Audit']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #eef2f7', fontSize: 12.5 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} fill="url(#auditGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Distribusi Baris per Tabel" size="small">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value).toLocaleString('id-ID'), String(name)]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #eef2f7', fontSize: 12.5 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Audit Terbaru" size="small">
            <List
              loading={recentQuery.isLoading}
              dataSource={recentQuery.data?.data ?? []}
              locale={{ emptyText: <Empty description="Belum ada aktivitas audit" /> }}
              renderItem={(log) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <code style={{ fontSize: 12.5 }}>{log.action}</code>{' '}
                        <span style={{ fontSize: 12.5, color: '#64748b' }}>{log.table_name ?? '—'}</span>
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 12.5 }}>
                        {log.actor_name ?? 'Sistem'} · {formatTableDate(log.created_at)}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Akses Cepat" size="small">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {QUICK_LINKS.map((link) => (
                <Link key={link.to} to={link.to} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #eef2f7',
                      background: '#fff',
                      transition: 'border-color .2s, box-shadow .2s',
                    }}
                  >
                    <div style={{ fontSize: 18, color: '#4f46e5', marginBottom: 6 }}>{link.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{link.label}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {!recentQuery.isLoading && (recentQuery.data?.total ?? 0) === 0 && (
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message="Audit log masih kosong — setiap aksi tulis di aplikasi akan tercatat di sini."
        />
      )}
    </div>
  )
}
