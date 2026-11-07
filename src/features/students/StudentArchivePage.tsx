import { useState } from 'react'
import { App, Button, Card, Input, Popconfirm, Table } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { useArchivedStudents, useRestoreStudent } from './hooks'
import { STUDENT_STATUS_META } from './status'
import type { Student } from './types'

/** Daftar siswa yang sudah di-soft delete + aksi pulihkan */
export function StudentArchivePage() {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const restoreMutation = useRestoreStudent()
  const archivedQuery = useArchivedStudents(search)

  const handleRestore = (student: Student) => {
    restoreMutation.mutate(student.id, {
      onSuccess: () => message.success(`${student.name} dipulihkan`),
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan siswa'),
    })
  }

  return (
    <div>
      <PageHeader
        title="Arsip Siswa"
        subtitle="Lihat & pulihkan data siswa yang sudah dihapus"
        extra={
          <Link to="/master/students">
            <Button icon={<ArrowLeftOutlined />}>Kembali</Button>
          </Link>
        }
      />

      <Card>
        <Input
          placeholder="Cari nama / kode / NISN"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 360 }}
        />

        <Table<Student>
          rowKey="id"
          loading={archivedQuery.isPending}
          dataSource={archivedQuery.data ?? []}
          locale={{ emptyText: 'Tidak ada siswa di arsip' }}
          pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
          columns={[
            {
              title: 'Siswa',
              key: 'name',
              render: (_, row) => (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{row.registration_code}</div>
                </div>
              ),
            },
            {
              title: 'Kelas',
              key: 'class',
              render: (_, row) => row.classes?.name || '-',
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (v: Student['status']) => {
                const meta = STUDENT_STATUS_META[v]
                return (
                  <StatusTag color={meta.color} icon={meta.icon}>
                    {meta.label}
                  </StatusTag>
                )
              },
            },
            {
              title: 'Dihapus',
              dataIndex: 'deleted_at',
              key: 'deleted_at',
              width: 170,
              render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : '-'),
            },
            {
              title: '',
              key: 'action',
              width: 120,
              align: 'right',
              render: (_, row) => (
                <Popconfirm
                  title="Pulihkan siswa ini?"
                  description="Data akan aktif kembali."
                  onConfirm={() => handleRestore(row)}
                  okText="Pulihkan"
                  cancelText="Batal"
                >
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    loading={restoreMutation.isPending && restoreMutation.variables === row.id}
                  >
                    Pulihkan
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
