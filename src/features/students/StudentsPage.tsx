import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
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
  DownloadOutlined,
  EditOutlined,
  FallOutlined,
  PlusOutlined,
  RiseOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useClassesBrief,
  useCreateStudent,
  useDeleteStudent,
  useStudents,
  useUpdateStudent,
} from './hooks'
import { StudentForm } from './components/StudentForm'
import { StudentImportModal } from './components/StudentImportModal'
import { StudentDetailDrawer } from './components/StudentDetailDrawer'
import { downloadStudentsCsv, fetchAllStudents } from './api'
import { STUDENT_STATUS_META, GENDER_LABEL } from './status'
import type {
  Gender,
  Student,
  StudentFilters,
  StudentFormValues,
  StudentStatus,
} from './types'

const STATUS_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Aktif', value: 'aktif' },
  { label: 'Lulus', value: 'lulus' },
  { label: 'Pindah', value: 'pindah' },
  { label: 'Keluar', value: 'keluar' },
]

export function StudentsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState<string | undefined>()
  const [gender, setGender] = useState<Gender | undefined>()
  const [status, setStatus] = useState<StudentStatus | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<Student | null>(null)
  const [exporting, setExporting] = useState(false)

  const classesQuery = useClassesBrief()

  const filters: StudentFilters = useMemo(
    () => ({
      search: search || undefined,
      classId,
      gender,
      status: status || undefined,
      page,
      pageSize,
    }),
    [search, classId, gender, status, page, pageSize],
  )

  const studentsQuery = useStudents(filters)
  const createMutation = useCreateStudent()
  const updateMutation = useUpdateStudent()
  const deleteMutation = useDeleteStudent()

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setFormOpen(true)
  }

  const handleSubmit = (values: StudentFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan siswa')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: (updated) => {
            message.success('Siswa diperbarui')
            setFormOpen(false)
            // perbarui drawer bila sedang terbuka untuk siswa yang sama
            setDetail((current) => (current?.id === updated.id ? updated : current))
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Siswa ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        message.success('Siswa dihapus')
        setDetail((current) => (current?.id === id ? null : current))
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus siswa'),
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const all = await fetchAllStudents({ search: search || undefined, classId, gender, status: status || undefined })
      if (all.length === 0) {
        message.info('Tidak ada data untuk diekspor')
        return
      }
      downloadStudentsCsv(all)
      message.success(`${all.length} siswa diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor data')
    } finally {
      setExporting(false)
    }
  }

  const columns: TableColumnsType<Student> = [
    {
      title: 'Siswa',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
            onClick={() => setDetail(row)}
          >
            {row.name}
          </Button>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.registration_code}
            {row.tags && row.tags.length > 0 && (
              <span style={{ marginLeft: 8 }}>
                {row.tags.slice(0, 2).map((tag) => (
                  <Tag key={tag} style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5 }}>
                    {tag}
                  </Tag>
                ))}
                {row.tags.length > 2 && (
                  <Tooltip title={row.tags.slice(2).join(', ')}>
                    <Tag style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5 }}>
                      +{row.tags.length - 2}
                    </Tag>
                  </Tooltip>
                )}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'NISN',
      dataIndex: 'nisn',
      key: 'nisn',
      render: (v: string | null) => v || '-',
      responsive: ['md'],
    },
    {
      title: 'Kelas',
      key: 'class',
      render: (_, row) => (
        <div>
          <div>{row.classes?.name || '-'}</div>
          {row.dorms?.name && (
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              {row.dorms.name}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 110,
      render: (v: Gender | null) => (v ? GENDER_LABEL[v] : '-'),
      responsive: ['lg'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: StudentStatus) => {
        const meta = STUDENT_STATUS_META[v]
        return (
          <StatusTag color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusTag>
        )
      },
    },
    {
      title: 'Poin',
      dataIndex: 'total_points',
      key: 'total_points',
      width: 100,
      render: (v: number) => (
        <Typography.Text
          strong
          style={{
            color: v < 0 ? '#dc2626' : v > 0 ? '#16a34a' : undefined,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {v < 0 ? <FallOutlined /> : v > 0 ? <RiseOutlined /> : null}
          {v > 0 ? `+${v}` : v}
        </Typography.Text>
      ),
      responsive: ['md'],
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
                title="Hapus siswa ini?"
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
        title="Data Siswa"
        subtitle="Kelola database santri aktif"
        extra={
          <Space wrap>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
              Ekspor CSV
            </Button>
            {canWrite && (
              <>
                <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                  Impor CSV
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Tambah Siswa
                </Button>
              </>
            )}
          </Space>
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama / kode / NISN"
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
            placeholder="Kelas"
            allowClear
            style={{ minWidth: 160 }}
            value={classId}
            onChange={(v) => {
              setClassId(v)
              setPage(1)
            }}
            loading={classesQuery.isPending}
            options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
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
              setStatus(v as StudentStatus | '')
              setPage(1)
            }}
          />
        </Space>
      </Card>

      <Card>
        <Table<Student>
          rowKey="id"
          columns={columns}
          dataSource={studentsQuery.data?.data ?? []}
          loading={studentsQuery.isPending}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada siswa" />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: studentsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} siswa`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <StudentForm
        open={formOpen}
        student={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <StudentImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <StudentDetailDrawer
        open={!!detail}
        student={detail}
        onClose={() => setDetail(null)}
        onEdit={(s) => {
          setDetail(null)
          openEdit(s)
        }}
      />
    </div>
  )
}
