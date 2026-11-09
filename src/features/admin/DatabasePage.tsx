import { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Progress,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SearchOutlined,
  TableOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { logAudit } from '../../shared/utils/auditLogger'
import { runDetachRefs, TABLE_CONFIG } from './api'
import { useIntegrityIssues, useTableStats } from './hooks'
import type { IntegrityIssue, TableStat } from './types'

export function DatabasePage() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const qc = useQueryClient()
  const searchRef = useRef<InputRef>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const statsQuery = useTableStats()
  const integrityQuery = useIntegrityIssues()

  const repairMutation = useMutation({
    mutationFn: runDetachRefs,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void logAudit({
        action: 'EXECUTE',
        source: 'SYSTEM',
        tableName: 'students',
        newData: { aksi: 'perbaikan_integritas', ...result },
      })
      message.success(
        `Perbaikan selesai — ${result.classRefs} relasi kelas dan ${result.dormRefs} relasi asrama dilepas`,
      )
    },
    onError: (err: Error) => message.error(err.message || 'Gagal menjalankan perbaikan'),
  })

  const handleRefresh = () => {
    void statsQuery.refetch()
    void integrityQuery.refetch()
  }

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(handleRefresh, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])

  const tableStats = useMemo(() => statsQuery.data ?? [], [statsQuery.data])
  const filteredTables = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return tableStats
    return tableStats.filter((t) => t.label.toLowerCase().includes(term) || t.key.includes(term))
  }, [tableStats, debouncedSearch])

  const issues = useMemo(() => integrityQuery.data ?? [], [integrityQuery.data])
  const passed = issues.filter((i) => i.count === 0).length
  const score = issues.length > 0 ? Math.round((passed / issues.length) * 100) : 100
  const findingCount = useMemo(() => issues.reduce((sum, i) => sum + i.count, 0), [issues])
  const totalRows = useMemo(() => tableStats.reduce((sum, t) => sum + t.total, 0), [tableStats])

  const columns = useMemo<TableColumnsType<TableStat>>(
    () => [
      {
        title: 'Tabel',
        dataIndex: 'label',
        key: 'label',
        render: (_, t) => (
          <div>
            <div style={{ fontWeight: 600 }}>{t.label}</div>
            <code style={{ fontSize: 11.5, color: token.colorTextTertiary }}>{t.key}</code>
          </div>
        ),
      },
      {
        title: 'Total Baris',
        dataIndex: 'total',
        key: 'total',
        width: 140,
        render: (v: number) => <b style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString('id-ID')}</b>,
      },
      {
        title: 'Aktif',
        key: 'active',
        width: 150,
        render: (_, t) =>
          t.active === null ? (
            <Tag style={{ borderRadius: 6 }}>tanpa soft delete</Tag>
          ) : (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.active.toLocaleString('id-ID')}</span>
          ),
      },
      {
        title: 'Baris Terbaru',
        dataIndex: 'latestCreatedAt',
        key: 'latestCreatedAt',
        width: 180,
        responsive: ['lg'],
        render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—'),
      },
    ],
    [token],
  )

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['R'],
        label: 'Segarkan hitungan & cek',
        group: 'Aksi',
        icon: <ReloadOutlined />,
        run: handleRefresh,
      },
      {
        keys: ['Ctrl', 'K'],
        label: 'Fokus ke pencarian tabel',
        group: 'Navigasi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const shortcuts = useShortcuts({ items: shortcutItems })

  const renderIssue = (issue: IntegrityIssue) => {
    const ok = issue.count === 0
    return (
      <div
        key={issue.id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          padding: '11px 12px',
          borderRadius: 10,
          marginBottom: 8,
          border: `1px solid ${ok ? token.colorBorderSecondary : issue.fixable ? '#fcd34d' : '#fecaca'}`,
          background: ok ? 'transparent' : issue.fixable ? '#fffbeb' : '#fef2f2',
        }}
      >
        <div style={{ flex: 1 }}>
          <Space size={8} align="center">
            {ok ? (
              <CheckCircleOutlined style={{ color: '#10b981' }} />
            ) : (
              <WarningOutlined style={{ color: issue.fixable ? '#d97706' : '#dc2626' }} />
            )}
            <b style={{ fontSize: 13.5 }}>{issue.label}</b>
            {ok ? (
              <Tag color="success" style={{ borderRadius: 999 }}>
                Aman
              </Tag>
            ) : (
              <Tag color={issue.fixable ? 'warning' : 'error'} style={{ borderRadius: 999 }}>
                {issue.count} temuan
              </Tag>
            )}
          </Space>
          <div style={{ fontSize: 12.5, color: token.colorTextSecondary, marginTop: 4, paddingLeft: ok ? 22 : 22 }}>
            {issue.detail}
          </div>
        </div>
        {issue.fixable && !ok && (
          <Popconfirm
            title="Jalankan perbaikan?"
            description="Relasi santri ke kelas/asrama terarsip akan dilepas. Tindakan ini tercatat di audit log."
            okText="Perbaiki"
            cancelText="Batal"
            onConfirm={() => repairMutation.mutate()}
          >
            <Button size="small" icon={<ToolOutlined />} loading={repairMutation.isPending}>
              Perbaiki
            </Button>
          </Popconfirm>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Kesehatan Database"
        subtitle={`${TABLE_CONFIG.length} tabel terpantau · ${totalRows.toLocaleString('id-ID')} total baris`}
        extra={
          <Space wrap>
            <Tooltip title="Shortcut keyboard (?)">
              <Button icon={<span style={{ fontWeight: 700, fontSize: 12 }}>?</span>} onClick={shortcuts.open} />
            </Tooltip>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<ReloadOutlined spin={statsQuery.isFetching || integrityQuery.isFetching} />} onClick={handleRefresh} />
            </Tooltip>
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<DatabaseOutlined />}
          label="Total Baris"
          value={totalRows.toLocaleString('id-ID')}
          color="indigo"
          loading={statsQuery.isPending}
        />
        <StatChip
          icon={<TableOutlined />}
          label="Tabel Terpantau"
          value={tableStats.length}
          color="sky"
          loading={statsQuery.isPending}
        />
        <StatChip
          icon={<SafetyOutlined />}
          label="Cek Lolos"
          value={`${passed}/${issues.length}`}
          color={score === 100 ? 'emerald' : 'amber'}
          loading={integrityQuery.isPending}
        />
        {findingCount > 0 && (
          <StatChip
            icon={<WarningOutlined />}
            label="Temuan"
            value={findingCount}
            color="rose"
          />
        )}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card title="Hitungan Tabel" size="small">
            <Space wrap style={{ marginBottom: 12 }}>
              <Input
                ref={searchRef}
                placeholder="Cari tabel…"
                prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }}
              />
              <Space size={6}>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  Auto-refresh
                </Typography.Text>
                <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
              </Space>
            </Space>
            <Table<TableStat>
              rowKey="key"
              size="small"
              columns={columns}
              dataSource={filteredTables}
              loading={statsQuery.isPending}
              pagination={false}
              locale={{
                emptyText: (
                  <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                    Tidak ada tabel yang cocok dengan pencarian
                  </Typography.Text>
                ),
              }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={11}>
          <Card
            title={
              <Space>
                <SafetyOutlined style={{ color: score === 100 ? '#10b981' : '#f59e0b' }} />
                Cek Integritas Data
              </Space>
            }
            size="small"
            extra={
              <Progress
                type="circle"
                size={44}
                percent={score}
                strokeColor={score === 100 ? '#10b981' : '#f59e0b'}
                format={(p) => `${p}%`}
              />
            }
          >
            <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 10 }}>
              Pemeriksaan dijalankan di sisi aplikasi terhadap data hidup. Tidak ada data yang berubah tanpa konfirmasi.
            </Typography.Paragraph>
            {integrityQuery.isPending ? (
              <Typography.Text type="secondary">Memeriksa…</Typography.Text>
            ) : (
              <div>{issues.map(renderIssue)}</div>
            )}
          </Card>
        </Col>
      </Row>

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
