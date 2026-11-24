import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Grid, List, Row, Segmented, Tag, Tooltip, Typography, theme } from 'antd'
import {
  AuditOutlined,
  CrownFilled,
  DatabaseOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  ReadOutlined,
  SafetyOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
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
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useAuditActivity, useAuditLogs, useIntegrityIssues, useTableStats } from './hooks'
import { TABLE_LABELS } from './api'
import { SystemHealth } from './components/SystemHealth'
import { SetupChecklist } from './components/SetupChecklist'

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#7c3aed', '#14b8a6', '#eab308']

// Pie hanya menampilkan 7 tabel terbesar; sisanya digabung "Lainnya"
// agar tabel dominan (audit_logs) tidak menenggelamkan slice lain.
const PIE_TOP_N = 7

const RANGE_OPTIONS = [
  { label: '7 hari', value: 7 },
  { label: '14 hari', value: 14 },
  { label: '30 hari', value: 30 },
]

const TOOLTIP_CONTENT_STYLE = { borderRadius: 10, fontSize: 12.5 } as const

// Tab tujuan memakai key tab ?tab= AdminPage; `href` untuk modul di luar
// /admin. Key legacy (penyimpanan/otomatisasi/…) dihapus — langsung key aktif.
interface QuickLink {
  tab?: string
  href?: string
  label: string
  desc: string
  icon: React.ReactNode
}

const QUICK_LINKS: QuickLink[] = [
  { tab: 'database', label: 'Kesehatan Database', desc: 'Hitungan tabel & integritas', icon: <DatabaseOutlined /> },
  { tab: 'storage', label: 'Penyimpanan', desc: 'Bucket & pembersihan file', icon: <DatabaseOutlined /> },
  { tab: 'automation', label: 'Otomatisasi', desc: 'Tugas pemeliharaan manual', icon: <ThunderboltOutlined /> },
  { tab: 'settings', label: 'Pengaturan Developer', desc: 'Feature flags & maintenance', icon: <SafetyOutlined /> },
  { tab: 'users', label: 'Pengguna', desc: 'Kelola akun & role', icon: <UserOutlined /> },
  { tab: 'audit', label: 'Audit Log', desc: 'Jejak perubahan data', icon: <AuditOutlined /> },
  { href: '/instruments', label: 'Evaluasi', desc: 'Angket AKPD, EDOM, sosiometri', icon: <FileDoneOutlined /> },
  { href: '/documents', label: 'Dokumen Akademik', desc: 'Kurmer, KHS, transkrip', icon: <FileTextOutlined /> },
  { href: '/worship', label: 'Ibadah', desc: 'Penguasaan ibadah santri', icon: <ReadOutlined /> },
]

export function AdminDashboardTab({ onNavigateTab, active }: { onNavigateTab: (tab: string) => void; active: boolean }) {
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const navigate = useNavigate()
  const [range, setRange] = useState(7)
  const [excludeLogs, setExcludeLogs] = useState(true)

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
  const pieData = useMemo(() => {
    const filtered = excludeLogs
      ? tableStats.filter((t) => t.key !== 'audit_logs' && t.key !== 'api_request_log')
      : tableStats
    const sorted = [...filtered].sort((a, b) => b.total - a.total)
    const top = sorted.slice(0, PIE_TOP_N).map((t) => ({ name: t.label, value: t.total }))
    const restTotal = sorted.slice(PIE_TOP_N).reduce((sum, t) => sum + t.total, 0)
    return restTotal > 0 ? [...top, { name: 'Lainnya', value: restTotal }] : top
  }, [tableStats, excludeLogs])
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

  // shortcutItems dibuat stabil: refetch dibungkus ref agar memo tidak
  // ter-buang tiap transisi isFetching query
  const refreshRef = useRef<() => void>(() => {})
  useEffect(() => {
    refreshRef.current = () => {
      void statsQuery.refetch()
      void activityQuery.refetch()
      void integrityQuery.refetch()
      void recentQuery.refetch()
    }
  })
  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['R'],
        label: 'Segarkan semua data',
        group: 'Aksi',
        icon: <ThunderboltOutlined />,
        run: () => refreshRef.current(),
      },
    ],
    [],
  )
  const shortcuts = useShortcuts({ items: shortcutItems })
  const isRefreshing =
    statsQuery.isFetching || activityQuery.isFetching || integrityQuery.isFetching || recentQuery.isFetching

  // Aksi tab diportal ke kanan judul shell — hasil WAJIB dirender di JSX
  const actions = useTabActions(
    active,
    <>
      <Tooltip title="Segarkan semua data (R)">
        <Button
          icon={<ThunderboltOutlined spin={isRefreshing} />}
          aria-label="Segarkan semua data"
          onClick={() => shortcutItems[0].run()}
          style={isMobile ? { width: 44, height: 44 } : undefined}
        />
      </Tooltip>
      <Tooltip title="Shortcut keyboard (?)">
        <Button
          aria-label="Bantuan shortcut keyboard"
          icon={<QuestionCircleOutlined />}
          onClick={shortcuts.open}
          style={isMobile ? { width: 44, height: 44 } : undefined}
        />
      </Tooltip>
    </>,
  )

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Freshness: umur cache stats (menit) — indikator data diperbarui kapan
  const statsAgeMin = statsQuery.dataUpdatedAt
    ? Math.max(0, Math.floor((now - statsQuery.dataUpdatedAt) / 60_000))
    : null

  return (
    <div>
      {actions}

      {(statsQuery.isError || activityQuery.isError || integrityQuery.isError || recentQuery.isError) && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sebagian data gagal dimuat"
          description="Ada query yang tidak bisa diambil dari server. Coba segarkan, dan kalau berulang periksa koneksi Supabase."
          action={
            <Button
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => shortcutItems[0].run()}
            >
              Segarkan
            </Button>
          }
        />
      )}

      {/* Statistik — klik untuk melompat ke halaman terkait */}
      {statsAgeMin !== null && !statsQuery.isFetching && (
        <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginBottom: 6 }}>
          Data diperbarui {statsAgeMin === 0 ? 'baru saja' : `${statsAgeMin} mnt lalu`}
        </Typography.Text>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: openIssues.length || biggestTable ? 10 : 0 }}>        <StatChip
          icon={<DatabaseOutlined />}
          label="Total Baris Data"
          value={totalRows.toLocaleString('id-ID')}
          color="indigo"
          loading={statsQuery.isPending}
          onClick={() => onNavigateTab('database')}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Santri Aktif"
          value={studentsStat?.active ?? '–'}
          color="sky"
          loading={statsQuery.isPending}
          onClick={() => navigate('/students')}
        />
        <StatChip
          icon={<UserOutlined />}
          label="Akun Pengguna"
          value={profilesStat?.total ?? '–'}
          color="emerald"
          loading={statsQuery.isPending}
          onClick={() => onNavigateTab('users')}
        />
        <StatChip
          icon={<AuditOutlined />}
          label="Audit Log"
          value={auditStat?.total?.toLocaleString('id-ID') ?? '–'}
          color="purple"
          loading={statsQuery.isPending}
          onClick={() => onNavigateTab('audit')}
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
            onClick={() => onNavigateTab('database')}
          />
        )}
      </div>

      {/* Strip insight — ringkasan satu baris yang bisa diklik */}
      {(biggestTable || openIssues.length > 0) && (
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            flexWrap: 'wrap',
            gap: isMobile ? 8 : '4px 20px',
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
              onClick={() => onNavigateTab('database')}
              style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', textAlign: 'left', maxWidth: '100%', gap: 6, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
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
              onClick={() => onNavigateTab('database')}
              style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', textAlign: 'left', maxWidth: '100%', gap: 6, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}
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

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title="Aktivitas Audit"
            size="small"
            style={{ height: '100%' }}
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
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                  />
                  <Area type="monotone" dataKey="total" stroke={token.colorPrimary} strokeWidth={2} fill="url(#auditGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="Distribusi Baris per Tabel"
            size="small"
            style={{ height: '100%' }}
            extra={
              <Button
                size="small"
                type={excludeLogs ? 'primary' : 'default'}
                ghost={excludeLogs}
                onClick={() => setExcludeLogs((prev) => !prev)}
                style={{ fontSize: 11, height: 24, paddingInline: 8 }}
              >
                {excludeLogs ? 'Tanpa Log' : 'Semua'}
              </Button>
            }
          >
            {/* Chart + legend lega di kotak 240px — pembaca tahu milik siapa
                tiap slice tanpa harus hover, jumlahnya terbaca langsung */}
            <div style={{ width: '100%', height: 176 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={84}
                    paddingAngle={2}
                    onClick={() => onNavigateTab('database')}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RTooltip
                    formatter={(value, name) => [Number(value).toLocaleString('id-ID'), String(name)]}
                    contentStyle={TOOLTIP_CONTENT_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 4 }}>
              {pieData.map((entry, index) => (
                <span key={entry.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                  <span
                    aria-hidden="true"
                    style={{ width: 8, height: 8, borderRadius: 3, background: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <Typography.Text type="secondary">{entry.name}</Typography.Text>
                  <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {entry.value.toLocaleString('id-ID')}
                  </Typography.Text>
                </span>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <SystemHealth active={active} onOpenDatabase={() => onNavigateTab('database')} />
        </Col>
        <Col xs={24} lg={12}>
          <SetupChecklist />
        </Col>
      </Row>

      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} lg={14}>
          <Card
            title="Audit Terbaru"
            size="small"
            style={{ height: '100%' }}
            extra={
              <Typography.Link style={{ fontSize: 12.5 }} onClick={() => onNavigateTab('audit')}>
                Lihat semua
              </Typography.Link>
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Tag
                          style={{ borderRadius: 6, fontSize: 11.5, fontFamily: 'monospace', marginInlineEnd: 0 }}
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
                        <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
                          {log.table_name ? (TABLE_LABELS[log.table_name] ?? log.table_name) : '—'}
                        </span>
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
          <Card title="Akses Cepat" size="small" style={{ height: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.tab ?? link.href}
                  type="button"
                  onClick={() => (link.tab ? onNavigateTab(link.tab) : navigate(link.href as string))}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    background: token.colorBgContainer,
                    transition: 'border-color .2s, box-shadow .2s',
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  <div style={{ fontSize: 18, color: token.colorPrimary, marginBottom: 6 }}>{link.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>{link.label}</div>
                  <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>{link.desc}</div>
                </button>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
