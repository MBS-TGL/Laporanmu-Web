import { useMemo, useState, type ReactNode } from 'react'
import {
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useCreateTeacher,
  useDeleteTeacher,
  useTeachers,
  useUpdateTeacher,
} from './hooks'
import { TeacherForm } from './components/TeacherForm'
import type { Gender, Teacher, TeacherFilters, TeacherFormValues, TeacherStatus } from './types'

const STATUS_META: Record<TeacherStatus, { label: string; color?: string; icon: ReactNode }> = {
  active: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  inactive: { label: 'Nonaktif', icon: <StopOutlined /> },
  on_leave: { label: 'Cuti', color: 'orange', icon: <PauseCircleOutlined /> },
}

const STATUS_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Aktif', value: 'active' },
  { label: 'Nonaktif', value: 'inactive' },
  { label: 'Cuti', value: 'on_leave' },
]

export function TeachersPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<TeacherStatus | ''>('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)

  const filters: TeacherFilters = useMemo(
    () => ({ search: search || undefined, status: status || undefined, gender, page, pageSize }),
    [search, status, gender, page, pageSize],
  )

  const teachersQuery = useTeachers(filters)
  const createMutation = useCreateTeacher()
  const updateMutation = useUpdateTeacher()
  const deleteMutation = useDeleteTeacher()

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    setFormOpen(true)
  }

  const handleSubmit = (values: TeacherFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan guru')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Guru diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Guru ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Guru dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus guru'),
    })
  }

  const columns: TableColumnsType<Teacher> = [
    {
      title: 'Guru',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.name}</div>
          {row.email ? (
            <span style={{ fontSize: 12, color: '#888' }}>{row.email}</span>
          ) : null}
        </div>
      ),
    },
    {
      title: 'NBM',
      dataIndex: 'nbm',
      key: 'nbm',
      render: (v: string | null) => v || '-',
      responsive: ['md'],
    },
    {
      title: 'Mapel',
      dataIndex: 'subject',
      key: 'subject',
      render: (v: string | null) => v || '-',
      responsive: ['lg'],
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (v: Gender | null) => v || '-',
      responsive: ['lg'],
    },
    {
      title: 'Kontak',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string | null) => v || '-',
      responsive: ['md'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: TeacherStatus) => {
        const meta = STATUS_META[v]
        return (
          <StatusTag color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusTag>
        )
      },
    },
    {
      title: 'Bergabung',
      dataIndex: 'join_date',
      key: 'join_date',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('id-ID') : '-'),
      responsive: ['lg'],
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
                title="Hapus guru ini?"
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
        title="Data Guru"
        subtitle="Kelola pengajar, musyrif, dan staf"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah Guru
            </Button>
          ) : undefined
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama / NBM / mapel"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Gender"
            allowClear
            style={{ minWidth: 130 }}
            value={gender}
            onChange={(v) => {
              setGender(v)
              setPage(1)
            }}
            options={[
              { value: 'L', label: 'Laki-laki' },
              { value: 'P', label: 'Perempuan' },
            ]}
          />
          <Segmented
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v as TeacherStatus | '')
              setPage(1)
            }}
          />
        </Space>
      </Card>

      <Card>
        <Table<Teacher>
          rowKey="id"
          columns={columns}
          dataSource={teachersQuery.data?.data ?? []}
          loading={teachersQuery.isPending}
          pagination={{
            current: page,
            pageSize,
            total: teachersQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} guru`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <TeacherForm
        open={formOpen}
        teacher={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
