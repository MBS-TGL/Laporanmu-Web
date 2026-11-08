import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  FallOutlined,
  PlusOutlined,
  RiseOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useCreateReport, useDeleteReport, usePointRulesBrief, useReports } from './hooks'
import { ReportForm } from './components/ReportForm'
import type { BehaviorReport, ReportFilters, ReportFormValues, ReportKind } from './types'

const KIND_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Pelanggaran', value: 'negative' },
  { label: 'Prestasi', value: 'positive' },
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

export function ReportsPage() {
  const { message } = App.useApp()
  const { canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [ruleId, setRuleId] = useState<string | undefined>()
  const [kind, setKind] = useState<ReportKind>('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)

  const filters: ReportFilters = useMemo(
    () => ({
      search: search || undefined,
      ruleId,
      kind,
      from: dateRange?.[0]?.startOf('day').format(),
      to: dateRange?.[1]?.endOf('day').format(),
      page,
      pageSize,
    }),
    [search, ruleId, kind, dateRange, page, pageSize],
  )

  const reportsQuery = useReports(filters)
  const rulesQuery = usePointRulesBrief()
  const createMutation = useCreateReport()
  const deleteMutation = useDeleteReport()

  const handleCreate = (values: ReportFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        message.success('Catatan poin tersimpan')
        setFormOpen(false)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan catatan poin'),
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Catatan poin dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus catatan'),
    })
  }

  const columns: TableColumnsType<BehaviorReport> = [
    {
      title: 'Waktu',
      dataIndex: 'reported_at',
      key: 'reported_at',
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
      title: 'Aturan',
      key: 'rule',
      render: (_, row) => row.rule?.name ?? '-',
      responsive: ['md'],
    },
    {
      title: 'Kategori',
      key: 'category',
      render: (_, row) => (row.rule?.category ? <Tag>{row.rule.category}</Tag> : '-'),
      responsive: ['lg'],
    },
    {
      title: 'Poin',
      dataIndex: 'points',
      key: 'points',
      width: 110,
      render: (v: number) => (
        <StatusTag color={v < 0 ? 'red' : 'green'} icon={v < 0 ? <FallOutlined /> : <RiseOutlined />}>
          {v > 0 ? `+${v}` : v}
        </StatusTag>
      ),
    },
    {
      title: 'Catatan',
      dataIndex: 'notes',
      key: 'notes',
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <Typography.Text ellipsis style={{ maxWidth: 180 }}>
              {v}
            </Typography.Text>
          </Tooltip>
        ) : (
          '-'
        ),
      responsive: ['lg'],
    },
    {
      title: 'Pelapor',
      key: 'reporter',
      render: (_, row) => row.reporter?.name ?? '-',
      responsive: ['xl'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_, row) =>
        canDelete ? (
          <Popconfirm
            title="Hapus catatan ini?"
            description="Poin siswa akan disesuaikan otomatis."
            onConfirm={() => handleDelete(row.id)}
            okText="Hapus"
            cancelText="Batal"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Catatan Poin"
        subtitle="Riwayat pelanggaran dan prestasi santri"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
            Catat Poin
          </Button>
        }
      />

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
          <Select
            placeholder="Aturan poin"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 220 }}
            value={ruleId}
            loading={rulesQuery.isPending}
            onChange={(v) => {
              setRuleId(v)
              setPage(1)
            }}
            options={(rulesQuery.data ?? []).map((r) => ({
              value: r.id,
              label: r.name,
            }))}
          />
          <Segmented
            options={KIND_OPTIONS}
            value={kind}
            onChange={(v) => {
              setKind(v as ReportKind)
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
        <Table<BehaviorReport>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data?.data ?? []}
          loading={reportsQuery.isPending}
          pagination={{
            current: page,
            pageSize,
            total: reportsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} catatan`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <ReportForm
        open={formOpen}
        submitting={createMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}
