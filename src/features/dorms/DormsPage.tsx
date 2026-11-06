import { useMemo, useState, type ReactNode } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useCreateDorm, useDeleteDorm, useDormOccupancy, useDorms, useUpdateDorm } from './hooks'
import { DormForm } from './components/DormForm'
import type { Dorm, DormFilters, DormFormValues, DormGender, DormStatus } from './types'

const STATUS_META: Record<string, { label: string; color?: string; icon: ReactNode }> = {
  aktif: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  penuh: { label: 'Penuh', color: 'orange', icon: <TeamOutlined /> },
  nonaktif: { label: 'Nonaktif', icon: <StopOutlined /> },
}

const GENDER_LABEL: Record<string, string> = {
  putra: 'Putra',
  putri: 'Putri',
  campur: 'Campur',
}

const GENDER_COLOR: Record<string, string> = {
  putra: 'geekblue',
  putri: 'magenta',
  campur: 'purple',
}

export function DormsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState<DormGender | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dorm | null>(null)

  const filters: DormFilters = useMemo(
    () => ({ search: search || undefined, gender, page, pageSize }),
    [search, gender, page, pageSize],
  )

  const dormsQuery = useDorms(filters)
  const occupancyQuery = useDormOccupancy()
  const createMutation = useCreateDorm()
  const updateMutation = useUpdateDorm()
  const deleteMutation = useDeleteDorm()

  const occupancyMap = useMemo(
    () => new Map((occupancyQuery.data ?? []).map((o) => [o.dorm_id, o.occupied])),
    [occupancyQuery.data],
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (dorm: Dorm) => {
    setEditing(dorm)
    setFormOpen(true)
  }

  const handleSubmit = (values: DormFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan kamar')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Kamar diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Kamar ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Kamar dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus kamar'),
    })
  }

  const columns: TableColumnsType<Dorm> = [
    {
      title: 'Kamar',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => <span style={{ fontWeight: 600 }}>{row.name}</span>,
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 110,
      render: (v: DormGender | null) =>
        v ? (
          <StatusTag color={GENDER_COLOR[v]}>{GENDER_LABEL[v] ?? v}</StatusTag>
        ) : (
          '-'
        ),
    },
    {
      title: 'Okupansi',
      key: 'occupancy',
      width: 160,
      responsive: ['md'],
      render: (_, row) => {
        const occupied = occupancyMap.get(row.id) ?? 0
        const pct = row.capacity > 0 ? Math.min(100, Math.round((occupied / row.capacity) * 100)) : 0
        const stroke = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
        return (
          <Space size={10}>
            <Progress
              percent={pct}
              showInfo={false}
              size="small"
              style={{ width: 72, marginBottom: 0 }}
              strokeColor={stroke}
            />
            <Typography.Text style={{ fontSize: 12.5 }}>
              {occupied}/{row.capacity}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Musyrif',
      key: 'musyrif',
      render: (_, row) => row.musyrif?.name || '-',
      responsive: ['lg'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: DormStatus | null) => {
        if (!v) return '-'
        const meta = STATUS_META[v]
        return (
          <StatusTag color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusTag>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 90,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
            {canDelete && (
              <Popconfirm
                title="Hapus kamar ini?"
                description="Data akan ditandai terhapus (soft delete)."
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
        title="Asrama"
        subtitle="Kelola kamar, kapasitas, dan okupansi asrama"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah Kamar
            </Button>
          ) : undefined
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama kamar"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 240 }}
          />
          <Select
            placeholder="Gender"
            allowClear
            style={{ minWidth: 140 }}
            value={gender}
            onChange={(v) => {
              setGender(v)
              setPage(1)
            }}
            options={[
              { value: 'putra', label: 'Putra' },
              { value: 'putri', label: 'Putri' },
              { value: 'campur', label: 'Campur' },
            ]}
          />
        </Space>
      </Card>

      <Card>
        <Table<Dorm>
          rowKey="id"
          columns={columns}
          dataSource={dormsQuery.data?.data ?? []}
          loading={dormsQuery.isPending}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada kamar" />,
          }}
          pagination={{
            current: page,
            pageSize,
            total: dormsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} kamar`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <DormForm
        open={formOpen}
        dorm={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
