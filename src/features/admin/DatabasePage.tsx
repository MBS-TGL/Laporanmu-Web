import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Badge,
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
  Typography,
  type TableColumnsType,
} from 'antd'
import { CheckCircleOutlined, ReloadOutlined, SafetyOutlined, ToolOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { logAudit } from '../../shared/utils/auditLogger'
import { runDetachRefs, TABLE_CONFIG } from './api'
import { useIntegrityIssues, useTableStats } from './hooks'
import type { IntegrityIssue, TableStat } from './types'

export function DatabasePage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
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

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      void statsQuery.refetch()
      void integrityQuery.refetch()
    }, 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])

  const tableStats = statsQuery.data ?? []
  const filteredTables = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tableStats
    return tableStats.filter((t) => t.label.toLowerCase().includes(term) || t.key.includes(term))
  }, [tableStats, search])

  const issues = integrityQuery.data ?? []
  const passed = issues.filter((i) => i.count === 0).length
  const score = issues.length > 0 ? Math.round((passed / issues.length) * 100) : 100
  const totalRows = useMemo(() => tableStats.reduce((sum, t) => sum + t.total, 0), [tableStats])

  const columns: TableColumnsType<TableStat> = [
    {
      title: 'Tabel',
      dataIndex: 'label',
      key: 'label',
      render: (_, t) => (
        <div>
          <div style={{ fontWeight: 600 }}>{t.label}</div>
          <code style={{ fontSize: 11.5, color: '#64748b' }}>{t.key}</code>
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
      width: 140,
      render: (_, t) =>
        t.active === null ? <Tag>tanpa soft delete</Tag> : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.active.toLocaleString('id-ID')}</span>,
    },
    {
      title: 'Baris Terbaru',
      dataIndex: 'latestCreatedAt',
      key: 'latestCreatedAt',
      width: 180,
      responsive: ['lg'],
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—'),
    },
  ]

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
          padding: '12px 0',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ flex: 1 }}>
          <Space size={8} align="center">
            {ok ? (
              <CheckCircleOutlined style={{ color: '#10b981' }} />
            ) : (
              <Badge status="warning" />
            )}
            <b style={{ fontSize: 13.5 }}>{issue.label}</b>
            {ok ? (
              <Tag color="success">OK</Tag>
            ) : (
              <Tag color={issue.fixable ? 'warning' : 'error'}>{issue.count} temuan</Tag>
            )}
            {issue.fixable && !ok && <Tag color="geekblue">dapat diperbaiki</Tag>}
          </Space>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, paddingLeft: ok ? 22 : 14 }}>
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
          <Space>
            <span style={{ fontSize: 12.5, color: '#64748b' }}>Auto-refresh</span>
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
            <Button
              icon={<ReloadOutlined />}
              loading={statsQuery.isFetching || integrityQuery.isFetching}
              onClick={() => {
                void statsQuery.refetch()
                void integrityQuery.refetch()
              }}
            >
              Segarkan
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={13}>
          <Card title="Hitungan Tabel" size="small">
            <Input
              placeholder="Cari tabel…"
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 12, maxWidth: 260 }}
            />
            <Table<TableStat>
              rowKey="key"
              size="small"
              columns={columns}
              dataSource={filteredTables}
              loading={statsQuery.isLoading}
              pagination={false}
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
            <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 8 }}>
              Pemeriksaan dijalankan di sisi aplikasi terhadap data hidup. Tidak ada data yang berubah tanpa konfirmasi.
            </Typography.Paragraph>
            {integrityQuery.isLoading ? (
              <Typography.Text type="secondary">Memeriksa…</Typography.Text>
            ) : (
              <div>{issues.map(renderIssue)}</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
