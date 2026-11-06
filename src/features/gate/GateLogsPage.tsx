import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  Segmented,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd'
import { EnterOutlined, ExportOutlined, LoginOutlined, LogoutOutlined, SearchOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { supabase } from '../../lib/supabase'
import { useConfirmDeparture, useConfirmReturn, usePermits } from '../leave-permit/hooks'
import { useGateLogs } from './hooks'
import { GateEntryCard } from './components/GateEntryCard'
import type { GateDirection, GateLog, GateLogFilters } from './types'

const DIRECTION_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Keluar', value: 'keluar' },
  { label: 'Masuk', value: 'masuk' },
]

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function GateLogsPage() {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<GateDirection | ''>('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const filters: GateLogFilters = useMemo(
    () => ({
      search: search || undefined,
      direction: direction || undefined,
      from: dateRange?.[0]?.startOf('day').format(),
      to: dateRange?.[1]?.endOf('day').format(),
      page,
      pageSize,
    }),
    [search, direction, dateRange, page, pageSize],
  )

  const logsQuery = useGateLogs(filters)

  // Reconcile izin pulang: daftar izin aktif untuk diproses di gerbang
  const permitsQuery = usePermits()
  const departureMutation = useConfirmDeparture()
  const returnMutation = useConfirmReturn()
  const activePermits = useMemo(
    () =>
      (permitsQuery.data ?? [])
        .filter((p) => p.status === 'issued' || p.status === 'departed')
        .slice(0, 6),
    [permitsQuery.data],
  )

  const handleDepart = async (permitId: string) => {
    const permit = (permitsQuery.data ?? []).find((p) => p.id === permitId)
    if (!permit) return
    const { data: userData } = await supabase.auth.getUser()
    departureMutation.mutate(
      { permit, recordedBy: userData.user?.id ?? null },
      {
        onSuccess: () => message.success(`${permit.student?.name ?? 'Santri'} tercatat berangkat`),
        onError: (err: Error) => message.error(err.message || 'Gagal mencatat keberangkatan'),
      },
    )
  }

  const handleReturn = (permitId: string) => {
    const permit = (permitsQuery.data ?? []).find((p) => p.id === permitId)
    if (!permit) return
    returnMutation.mutate(permit, {
      onSuccess: () => {
        const late = new Date() > new Date(permit.return_deadline)
        message.success(
          late
            ? `${permit.student?.name ?? 'Santri'} kembali (terlambat)`
            : `${permit.student?.name ?? 'Santri'} kembali tepat waktu`,
        )
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mencatat kepulangan'),
    })
  }

  const columns: TableColumnsType<GateLog> = [
    {
      title: 'Waktu',
      dataIndex: 'occurred_at',
      key: 'occurred_at',
      width: 170,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: 'Siswa',
      key: 'student',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.student?.name ?? '-'}</div>
          <span style={{ fontSize: 12, color: '#888' }}>{row.student?.registration_code}</span>
        </div>
      ),
    },
    {
      title: 'Arah',
      dataIndex: 'direction',
      key: 'direction',
      width: 110,
      render: (v: GateDirection) =>
        v === 'keluar' ? (
          <StatusTag color="orange" icon={<ExportOutlined />}>
            Keluar
          </StatusTag>
        ) : (
          <StatusTag color="green" icon={<EnterOutlined />}>
            Masuk
          </StatusTag>
        ),
    },
    {
      title: 'Catatan',
      dataIndex: 'note',
      key: 'note',
      render: (v: string | null) => v || '-',
      responsive: ['md'],
    },
    {
      title: 'Dicatat Oleh',
      key: 'recorder',
      render: (_, row) => row.recorder?.name ?? '-',
      responsive: ['lg'],
    },
  ]

  return (
    <div>
      <PageHeader
        title="Gate Santri"
        subtitle="Log keluar-masuk santri di gerbang"
      />

      {/* Reconcile izin pulang: proses keberangkatan & kepulangan */}
      {activePermits.length > 0 && (
        <Card title="Izin Santri Aktif" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {activePermits.map((p) => {
              const overdue = p.status === 'departed' && new Date(p.return_deadline) < new Date()
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: `1px solid ${overdue ? '#fca5a5' : '#e2e8f0'}`,
                    background: overdue ? '#fff1f0' : undefined,
                  }}
                >
                  <div>
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      {p.student?.name ?? '—'}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      → {p.destination} · batas{' '}
                      {new Date(p.return_deadline).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography.Text>
                  </div>
                  <Space size="small">
                    {overdue && <StatusTag color="red">Terlambat</StatusTag>}
                    {p.status === 'issued' ? (
                      <Button
                        size="small"
                        icon={<LogoutOutlined />}
                        loading={departureMutation.isPending}
                        onClick={() => void handleDepart(p.id)}
                      >
                        Berangkat
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<LoginOutlined />}
                        loading={returnMutation.isPending}
                        onClick={() => handleReturn(p.id)}
                      >
                        Kembali
                      </Button>
                    )}
                  </Space>
                </div>
              )
            })}
          </Space>
        </Card>
      )}

      <GateEntryCard />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama siswa"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 220 }}
          />
          <Segmented
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={(v) => {
              setDirection(v as GateDirection | '')
              setPage(1)
            }}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(v) => {
              setDateRange(v as [Dayjs, Dayjs] | null)
              setPage(1)
            }}
          />
        </Space>
      </Card>

      <Card>
        <Table<GateLog>
          rowKey="id"
          columns={columns}
          dataSource={logsQuery.data?.data ?? []}
          loading={logsQuery.isPending}
          pagination={{
            current: page,
            pageSize,
            total: logsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} log`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>
    </div>
  )
}
