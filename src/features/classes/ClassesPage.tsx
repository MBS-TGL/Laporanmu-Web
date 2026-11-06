import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  type TableColumnsType,
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useAcademicYearsBrief,
  useClassSizes,
  useClasses,
  useCreateClass,
  useDeleteClass,
  useUpdateClass,
} from './hooks'
import { ClassForm } from './components/ClassForm'
import { extractCount } from './api'
import type { ClassFilters, ClassFormValues, ClassRow } from './types'

export function ClassesPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [academicYearId, setAcademicYearId] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)

  const yearsQuery = useAcademicYearsBrief()
  const sizesQuery = useClassSizes()

  const sizesMap = useMemo(
    () => new Map((sizesQuery.data ?? []).map((s) => [s.class_id, s.total])),
    [sizesQuery.data],
  )

  const filters: ClassFilters = useMemo(
    () => ({ search: search || undefined, academicYearId, page, pageSize }),
    [search, academicYearId, page, pageSize],
  )

  const classesQuery = useClasses(filters)
  const createMutation = useCreateClass()
  const updateMutation = useUpdateClass()
  const deleteMutation = useDeleteClass()

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (cls: ClassRow) => {
    setEditing(cls)
    setFormOpen(true)
  }

  const handleSubmit = (values: ClassFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan kelas')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Kelas diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Kelas ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Kelas dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus kelas'),
    })
  }

  const columns: TableColumnsType<ClassRow> = [
    {
      title: 'Kelas',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <Space size={4}>
          <span style={{ fontWeight: 500 }}>{row.name}</span>
          {!row.homeroom_teacher_id && (
            <WarningOutlined style={{ color: '#faad14' }} title="Tanpa wali kelas" />
          )}
        </Space>
      ),
    },
    {
      title: 'Tingkat',
      dataIndex: 'grade',
      key: 'grade',
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: 'Tahun Akademik',
      key: 'year',
      render: (_, row) => row.academic_year?.name || '-',
    },
    {
      title: 'Wali Kelas',
      key: 'homeroom',
      render: (_, row) => row.homeroom_teacher?.name || <Tag color="warning">Belum ada</Tag>,
    },
    {
      title: 'Jumlah Siswa',
      key: 'count',
      responsive: ['md'],
      render: (_, row) => sizesMap.get(row.id) ?? extractCount(row.students),
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
                title="Hapus kelas ini?"
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
        title="Data Kelas"
        subtitle="Struktur kelas dan wali kelas"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah Kelas
            </Button>
          ) : undefined
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama kelas"
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
            placeholder="Tahun Akademik"
            allowClear
            style={{ minWidth: 200 }}
            value={academicYearId}
            onChange={(v) => {
              setAcademicYearId(v)
              setPage(1)
            }}
            loading={yearsQuery.isPending}
            options={(yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
          />
        </Space>
      </Card>

      <Card>
        <Table<ClassRow>
          rowKey="id"
          columns={columns}
          dataSource={classesQuery.data?.data ?? []}
          loading={classesQuery.isPending}
          pagination={{
            current: page,
            pageSize,
            total: classesQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} kelas`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <ClassForm
        open={formOpen}
        cls={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
