import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FallOutlined,
  PlusOutlined,
  RiseOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useCreatePointRule,
  useDeletePointRule,
  usePointRules,
  useUpdatePointRule,
} from './hooks'
import { PointRuleForm } from './components/PointRuleForm'
import type { PointRule, PointRuleFilters, PointRuleFormValues } from './types'

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`
}

export function PointRulesPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PointRule | null>(null)

  const filters: PointRuleFilters = useMemo(
    () => ({ search: search || undefined, page, pageSize }),
    [search, page, pageSize],
  )

  const rulesQuery = usePointRules(filters)
  const createMutation = useCreatePointRule()
  const updateMutation = useUpdatePointRule()
  const deleteMutation = useDeletePointRule()

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (rule: PointRule) => {
    setEditing(rule)
    setFormOpen(true)
  }

  const handleSubmit = (values: PointRuleFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan aturan poin')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Aturan poin diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Aturan poin ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Aturan poin dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus aturan poin'),
    })
  }

  const columns: TableColumnsType<PointRule> = [
    {
      title: 'Aturan',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => <span style={{ fontWeight: 500 }}>{row.name}</span>,
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      key: 'category',
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: 'Poin',
      dataIndex: 'points',
      key: 'points',
      width: 110,
      render: (v: number) => (
        <StatusTag color={v < 0 ? 'red' : 'green'} icon={v < 0 ? <FallOutlined /> : <RiseOutlined />}>
          {formatPoints(v)}
        </StatusTag>
      ),
    },
    {
      title: 'Tipe',
      dataIndex: 'is_negative',
      key: 'is_negative',
      width: 120,
      render: (v: boolean) => (v ? 'Pelanggaran' : 'Prestasi'),
      responsive: ['md'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
            {canDelete && (
              <Popconfirm
                title="Hapus aturan poin ini?"
                description="Aturan akan ditandai terhapus; catatan poin lama tetap tersimpan."
                onConfirm={() => handleDelete(row.id)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Aturan Poin"
        subtitle="Daftar pelanggaran dan prestasi beserta bobot poinnya"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah Aturan
            </Button>
          ) : undefined
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder="Cari nama aturan"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          style={{ width: 280 }}
        />
      </Card>

      <Card>
        <Table<PointRule>
          rowKey="id"
          columns={columns}
          dataSource={rulesQuery.data?.data ?? []}
          loading={rulesQuery.isPending}
          pagination={{
            current: page,
            pageSize,
            total: rulesQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} aturan`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <PointRuleForm
        open={formOpen}
        rule={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
