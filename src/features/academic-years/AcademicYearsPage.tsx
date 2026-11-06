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
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useAcademicYears,
  useCreateAcademicYear,
  useDeleteAcademicYear,
  useSetActiveAcademicYear,
  useUpdateAcademicYear,
} from './hooks'
import { AcademicYearForm } from './components/AcademicYearForm'
import type { AcademicYear, AcademicYearFilters, AcademicYearFormValues } from './types'

export function AcademicYearsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)

  const filters: AcademicYearFilters = useMemo(
    () => ({ search: search || undefined, page, pageSize }),
    [search, page, pageSize],
  )

  const yearsQuery = useAcademicYears(filters)
  const createMutation = useCreateAcademicYear()
  const updateMutation = useUpdateAcademicYear()
  const deleteMutation = useDeleteAcademicYear()
  const setActiveMutation = useSetActiveAcademicYear()

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (year: AcademicYear) => {
    setEditing(year)
    setFormOpen(true)
  }

  const handleSubmit = (values: AcademicYearFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan tahun akademik')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Tahun akademik diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Tahun akademik ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Tahun akademik dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
    })
  }

  const handleSetActive = (id: string) => {
    setActiveMutation.mutate(id, {
      onSuccess: () => message.success('Tahun akademik diaktifkan'),
      onError: (err: Error) => message.error(err.message || 'Gagal mengaktifkan'),
    })
  }

  const columns: TableColumnsType<AcademicYear> = [
    {
      title: 'Nama',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.is_active && (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6 }}>
              Aktif
            </Tag>
          )}
          {row.is_locked && (
            <Tag color="default" icon={<LockOutlined />} style={{ borderRadius: 6 }}>
              Terkunci
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Periode',
      key: 'period',
      responsive: ['md'],
      render: (_, row) => {
        const fmt = (d: string | null) =>
          d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
        return `${fmt(row.start_date)} — ${fmt(row.end_date)}`
      },
    },
    {
      title: 'Kurikulum',
      dataIndex: 'curriculum',
      key: 'curriculum',
      render: (v: string | null) => v || '-',
      responsive: ['lg'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && !row.is_active && !row.is_locked && (
              <Popconfirm
                title={`Jadikan "${row.name}" sebagai periode aktif?`}
                onConfirm={() => handleSetActive(row.id)}
                okText="Aktifkan"
                cancelText="Batal"
              >
                <Button type="text" icon={<CheckCircleOutlined />} loading={setActiveMutation.isPending}>
                  Set Aktif
                </Button>
              </Popconfirm>
            )}
            {canWrite && <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
            {canDelete && (
              <Popconfirm
                title="Hapus tahun akademik ini?"
                description="Data akan ditandai terhapus."
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
        title="Tahun Akademik"
        subtitle="Periode semester dan kalender akademik"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah
            </Button>
          ) : undefined
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder="Cari nama periode"
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
        <Table<AcademicYear>
          rowKey="id"
          columns={columns}
          dataSource={yearsQuery.data?.data ?? []}
          loading={yearsQuery.isPending}
          pagination={{
            current: page,
            pageSize,
            total: yearsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} periode`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <AcademicYearForm
        open={formOpen}
        year={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
