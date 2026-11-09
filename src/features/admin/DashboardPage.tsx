import { useMemo, useState } from 'react'
import { Button, Card, Col, Empty, List, Row, Segmented, Space, Tag, Tooltip, Typography, theme } from 'antd'
import {
  AuditOutlined,
  CrownFilled,
  DatabaseOutlined,
  SafetyOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useAuditActivity, useAuditLogs, useIntegrityIssues, useTableStats } from './hooks'

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#7c3aed', '#14b8a6', '#eab308']

const RANGE_OPTIONS = [
  { label: '7 hari', value: 7 },
  { label: '14 hari', value: 14 },
  { label: '30 hari', value: 30 },
]

const QUICK_LINKS = [
  { to: '/admin/database', label: 'Kesehatan Database', desc: 'Hitungan tabel & integritas', icon: <DatabaseOutlined /> },
  { to: '/admin/storage', label: 'Penyimpanan', desc: 'Bucket & pembersihan file', icon: <DatabaseOutlined /> },
  { to: '/admin/tasks', label: 'Otomasi', desc: 'Tugas pemeliharaan manual', icon: <ThunderboltOutlined /> },
  { to: '/admin/settings', label: 'Pengaturan Developer', desc: 'Feature flags & maintenance', icon: <SafetyOutlined /> },
  { to: '/admin/users', label: 'Pengguna', desc: 'Kelola akun & role', icon: <UserOutlined /> },
  { to: '/admin/audit-log', label: 'Audit Log', desc: 'Jejak perubahan data', icon: <AuditOutlined /> },
]

export function DashboardPage() {
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const [range, setRange] = useState(7)

  const statsQuery = useTableStats()
  const activityQuery = useAuditActivity(range)
  const integrityQuery = useIntegrityIssues()
  const recentQuery = useAuditLogs({ page: 1, pageSize: 5 })

  const tableStats = useMemo(() => statsQuery.data ?? [], [statsQuery.data])
  const totalRows = useMemo(() => tableStats.reduce((sum, t) => sum + t.total, 0), [tableStats])
  const biggestTable = useMemo(
    () => [...tableStats].sort((a, b) => b.total - a.total)[0],
    [tableStats],
  )
  const pieData = useMemo(
    () => tableStats.map((t) => ({ name: t.label, value: t.total })),
    [tableStats],
  )
  const activityData = useMemo(
    () => (activityQuery.data ?? []).map((d) => ({ ...d, label: dayjs(d.date).format('DD/MM') })),
    [activityQuery.data],
  )
  const todayActivity = activityQuery.data?.at(-1)?.total ?? 0
  const integrityIssues = useMemo(() => integrityQuery.data ?? [], [integrityQuery.data])
  const openIssues = useMemo(() => integrityIssues.filter((i) => i.count > 0), [integrityIssues])
  const studentsStat = tableStats.find((t) => t.key === 'students')
  const profilesStat = tableStats.find((t) => t.key === 'profiles')
  const auditStat = tableStats.find((t) => t.key === 'audit_logs')

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['R'],
        label: 'Segarkan semua data',
        group: 'Aksi',
        icon: <ThunderboltOutlined />,
        run: () => {
          void statsQuery.refetch()
          void activityQuery.refetch()
          void integrityQuery.refetch()
          void recentQuery.refetch()
        },
      },
    ],
    [statsQuery, activityQuery, integrityQuery, recentQuery],
  )
  const shortcuts = useShortcuts({ items: shortcutItems })
  const isRefreshing =
    statsQuery.isFetching || activityQuery.isFetching || integrityQuery.isFetching || recentQuery.isFetching

  return (
    <div>
      <PageHeader
        title="Dashboard Admin"
        subtitle="Pusat pantauan teknis: volume data, aktivitas sistem, dan akses cepat alat developer"
        extra={
          <Space wrap>
            <Tooltip title="Segarkan semua data (R)">
              <Button icon={<ThunderboltOutlined spin={isRefreshing} />} onClick={() => shortcutItems[0].run()} />
            </Tooltip>
            <Tooltip title="Shortcut keyboard (?)">
              <Button icon={<span style={{ fontWeight: 700, fontSize: 12 }}>?</span>} onClick={shortcuts.open} />
            </Tooltip>
          </Space>
        }
      />

      {/* Statistik — klik untuk melompat ke halaman terkait */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: openIssues.length || biggestTable ? 10 : 0 }}>
        <StatChip
          icon={<DatabaseOutlined />}
          label="Total Baris Data"
          value={totalRows.toLocaleString('id-ID')}
          color="indigo"
          loading={statsQuery.isPending}
          onClick={() => navigate('/admin/database')}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Santri Aktif"
          value={studentsStat?.active ?? '–'}
          color="sky"
          loading={statsQuery.isPending}
          onClick={() => navigate('/master/students')}
        />
        <StatChip
          icon={<UserOutlined />}
          label="Akun Pengguna"
          value={profilesStat?.total ?? '–'}
          color="emerald"
          loading={statsQuery.isPending}
          onClick={() => navigate('/admin/users')}
        />
        <StatChip
          icon={<AuditOutlined />}
          label="Audit Log"
          value={auditStat?.total?.toLocaleString('id-ID') ?? '–'}
          color="purple"
          loading={statsQuery.isPending}
          onClick={() => navigate('/admin/audit-log')}
        />
        <StatChip
          icon={<ThunderboltOutlined />}
          label="Aktivitas Hari Ini"
          value={todayActivity}
          color="amber"
          loading={activityQuery.isPending}
        />
        {openIssues.length > 0 && (
          <StatChip
            icon={<WarningOutlined />}
            label="Temuan Integritas"
            value={openIssues.reduce((sum, i) => sum + i.count, 0)}
            color="rose"
            onClick={() => navigate('/admin/database')}
          />
        )}
      </div>

      {/* Strip insight — ringkasan satu baris yang bisa diklik */}
      {(biggestTable || openIssues.length > 0) && (
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
            marginBottom: 14,
          }}
        >
          {biggestTable && (
            <button
              type="button"
              onClick={() => navigate('/admin/database')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
              title="Lihat kesehatan database"
            >
              <CrownFilled style={{ color: '#f59e0b' }} />
              <span style={{ color: token.colorTextSecondary }}>Tabel terbesar:</span>
              <span style={{ fontWeight: 600 }}>{biggestTable.label}</span>
              <span style={{ fontWeight: 700, color: '#4f46e5' }}>{biggestTable.total.toLocaleString('id-ID')} baris</span>
            </button>
          )}
          {openIssues.length > 0 && (
            <button
              type="button"
              onClick={() => navigate('/admin/database')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
              title="Lihat cek integritas"
            >
              <WarningOutlined style={{ color: '#dc2626' }} />
              <span style={{ color: token.colorTextSecondary }}>Perlu perhatian:</span>
              <span style={{ fontWeight: 600, color: '#dc2626' }}>
                {openIssues
                  .slice(0, 2)
                  .map((i) => `${i.label} (${i.count})`)
                  .join(' · ')}
                {openIssues.length > 2 ? ` +${openIssues.length - 2}` : ''}
              </span>
            </button>
          )}
        </div>
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title="Aktivitas Audit"
            size="small"
            extra={
              <Segmented size="small" options={RANGE_OPTIONS} value={range} onChange={(v) => setRange(v as number)} />
            }
          >
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={activityData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auditGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={token.colorPrimary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={token.colorPrimary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={token.colorTextTertiary} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={token.colorTextTertiary} />
                  <RTooltip
                    formatter={(value) => [`${value} aktivitas`, 'Audit']}
                    contentStyle={{ borderRadius: 10, border: `1px solid ${token.colorBorderSecondary}`, fontSize: 12.5 }}
                  />
                  <Area type="monotone" dataKey="total" stroke={token.colorPrimary} strokeWidth={2} fill="url(#auditGradient)" />
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
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(value, name) => [Number(value).toLocaleString('id-ID'), String(name)]}
                    contentStyle={{ borderRadius: 10, border: `1px solid ${token.colorBorderSecondary}`, fontSize: 12.5 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title="Audit Terbaru"
            size="small"
            extra={
              <Link to="/admin/audit-log">
                <Typography.Link style={{ fontSize: 12.5 }}>Lihat semua</Typography.Link>
              </Link>
            }
          >
            <List
              loading={recentQuery.isPending}
              dataSource={recentQuery.data?.data ?? []}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada aktivitas audit" /> }}
              renderItem={(log) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <Tag
                          style={{ borderRadius: 6, fontSize: 11.5, fontFamily: 'monospace' }}
                          color={
                            log.action === 'DELETE'
                              ? 'red'
                              : log.action === 'UPDATE'
                                ? 'blue'
                                : log.action === 'INSERT'
                                  ? 'green'
                                  : 'default'
                          }
                        >
                          {log.action}
                        </Tag>
                        <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>{log.table_name ?? '—'}</span>
                      </span>
                    }
                    description={
                      <span style={{ fontSize: 12.5 }}>
                        {log.actor_name ?? 'Sistem'} · {dayjs(log.created_at).format('DD MMM YYYY HH:mm')}
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
                      border: `1px solid ${token.colorBorderSecondary}`,
                      background: token.colorBgContainer,
                      transition: 'border-color .2s, box-shadow .2s',
                    }}
                  >
                    <div style={{ fontSize: 18, color: token.colorPrimary, marginBottom: 6 }}>{link.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>{link.label}</div>
                    <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>{link.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
