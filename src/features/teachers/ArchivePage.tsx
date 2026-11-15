import { useState } from 'react'
import { App, Button, Card, Input, Popconfirm, Space, Table } from 'antd'
import { DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { hardDeleteErrorMessage } from '../../shared/api/crud'
import { ActionBar } from '../../shared/components/ActionBar'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useArchivedTeachers,
  useBulkRestoreTeachers,
  useHardDeleteTeacher,
  useHardDeleteTeachersBulk,
  useRestoreTeacher,
} from './hooks'
import type { Teacher } from './types'

/** Daftar guru yang sudah di-soft delete + aksi pulihkan & hapus permanen */
export function ArchivePage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const archivedQuery = useArchivedTeachers(search)
  const restoreMutation = useRestoreTeacher()
  const bulkRestoreMutation = useBulkRestoreTeachers()
  const hardDeleteMutation = useHardDeleteTeacher()
  const bulkHardDeleteMutation = useHardDeleteTeachersBulk()

  const handleRestore = (teacher: Teacher) => {
    restoreMutation.mutate(teacher.id, {
      onSuccess: () => message.success(`${teacher.name} dipulihkan`),
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan guru'),
    })
  }

  const handleHardDelete = (teacher: Teacher) => {
    hardDeleteMutation.mutate(teacher.id, {
      onSuccess: () => message.success(`${teacher.name} dihapus permanen`),
      onError: (err: unknown) => message.error(hardDeleteErrorMessage(err)),
    })
  }

  const bulkRestore = () =>
    bulkRestoreMutation.mutate(selectedIds, {
      onSuccess: () => {
        message.success(`${selectedIds.length} guru dipulihkan`)
        setSelectedIds([])
      },
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan guru'),
    })

  const bulkHardDelete = () =>
    bulkHardDeleteMutation.mutate(selectedIds, {
      onSuccess: () => {
        message.success(`${selectedIds.length} guru dihapus permanen`)
        setSelectedIds([])
      },
      onError: (err: unknown) => message.error(hardDeleteErrorMessage(err)),
    })

  return (
    <div>
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
          rowSelection={
            canWrite
              ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as string[]),
                }
              : undefined
          }
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
              // Semua baris di arsip adalah soft-deleted — status aslinya tak relevan
              render: () => (
                <StatusTag color="default">
                  Terarsip
                </StatusTag>
              ),
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
              width: 150,
              align: 'right',
              render: (_, row) => (
                <Space size={4}>
                  <Popconfirm
                    title="Pulihkan guru ini?"
                    description="Data akan aktif kembali."
                    onConfirm={() => handleRestore(row)}
                    okText="Ya, Pulihkan"
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
                  {canDelete && (
                    <Popconfirm
                      title="Hapus permanen guru ini?"
                      description={`${row.name} akan dihapus permanen dari database dan tidak bisa dipulihkan lagi.`}
                      okText="Ya, Hapus Permanen"
                      okButtonProps={{ danger: true }}
                      cancelText="Batal"
                      onConfirm={() => handleHardDelete(row)}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        loading={
                          hardDeleteMutation.isPending && hardDeleteMutation.variables === row.id
                        }
                      />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            key: 'restore',
            label: 'Pulihkan',
            icon: <ReloadOutlined />,
            hidden: !canWrite,
            loading: bulkRestoreMutation.isPending,
            confirm: {
              title: `Pulihkan ${selectedIds.length} guru terpilih?`,
              description: 'Semua data guru terpilih akan aktif kembali.',
              okText: 'Ya, Pulihkan',
            },
            onClick: bulkRestore,
          },
          {
            key: 'hard-delete',
            label: 'Hapus Permanen',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canDelete,
            loading: bulkHardDeleteMutation.isPending,
            confirm: {
              title: `Hapus permanen ${selectedIds.length} guru terpilih?`,
              description: 'Semua data guru terpilih akan dihapus permanen dari database dan tidak bisa dipulihkan lagi.',
              okText: 'Ya, Hapus Permanen',
            },
            onClick: bulkHardDelete,
          },
        ]}
      />
    </div>
  )
}
