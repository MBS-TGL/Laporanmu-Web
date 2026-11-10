import { useState } from 'react'
import { App, Button, Card, Input, Popconfirm, Table } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { useArchivedTeachers, useRestoreTeacher } from './hooks'
import { TEACHER_STATUS_META } from './status'
import type { Teacher } from './types'

/** Daftar guru yang sudah di-soft delete + aksi pulihkan */
export function ArchivePage() {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const restoreMutation = useRestoreTeacher()
  const archivedQuery = useArchivedTeachers(search)

  const handleRestore = (teacher: Teacher) => {
    restoreMutation.mutate(teacher.id, {
      onSuccess: () => message.success(`${teacher.name} dipulihkan`),
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan guru'),
    })
  }

  return (
    <div>
      <PageHeader
        title="Arsip Guru"
        subtitle="Lihat & pulihkan data guru yang sudah dihapus"
        extra={
          <Link to="/master/teachers">
            <Button icon={<ArrowLeftOutlined />}>Kembali</Button>
          </Link>
        }
      />

      <Card>
        <Input
          placeholder="Cari nama / NBM / mapel"
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16, maxWidth: 360 }}
        />

        <Table<Teacher>
          rowKey="id"
          loading={archivedQuery.isPending}
          dataSource={archivedQuery.data ?? []}
          locale={{ emptyText: 'Tidak ada guru di arsip' }}
          pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
          columns={[
            {
              title: 'Guru',
              key: 'name',
              render: (_, row) => (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{row.nbm || '-'}</div>
                </div>
              ),
            },
            {
              title: 'Mapel',
              key: 'subject',
              render: (_, row) => row.subject || '-',
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (v: Teacher['status']) => {
                const meta = TEACHER_STATUS_META[v]
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
                  title="Pulihkan guru ini?"
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
