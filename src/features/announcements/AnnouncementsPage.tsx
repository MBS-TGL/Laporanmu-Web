import { useMemo, useState, type ReactNode } from 'react'
import { App, Button, Card, Input, List, Popconfirm, Select, Space, Tag, Tooltip } from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  NotificationOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from './hooks'
import { AnnouncementModal, type AnnouncementFormValues } from './components/AnnouncementModal'
import { CATEGORY_COLORS, type Announcement } from './types'

type StatusFilter = 'all' | 'published' | 'draft'

export function AnnouncementsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [status, setStatus] = useState<StatusFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)

  const filters = useMemo(() => ({ search, category, status }), [search, category, status])
  const query = useAnnouncements(filters)
  // Statistik global — tidak terpengaruh filter
  const briefQuery = useAnnouncements({})

  const createMutation = useCreateAnnouncement()
  const updateMutation = useUpdateAnnouncement()
  const deleteMutation = useDeleteAnnouncement()

  const items = query.data ?? []

  const stats = useMemo(() => {
    const all = briefQuery.data ?? []
    return {
      total: all.length,
      published: all.filter((a) => a.is_published).length,
      draft: all.filter((a) => !a.is_published).length,
    }
  }, [briefQuery.data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (item: Announcement) => {
    setEditing(item)
    setFormOpen(true)
  }

  // published_at = tanggal tayang terakhir: diset saat terbit, dibersihkan saat ditarik
  const handleSubmit = (values: AnnouncementFormValues) => {
    const patch = {
      ...values,
      published_at: values.is_published
        ? (editing?.published_at ?? dayjs().toISOString())
        : null,
    }
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan pengumuman')

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, patch },
        {
          onSuccess: () => {
            message.success('Pengumuman diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(patch, {
        onSuccess: () => {
          message.success('Pengumuman ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const togglePublish = (item: Announcement) => {
    const isPublished = !item.is_published
    updateMutation.mutate(
      {
        id: item.id,
        patch: {
          is_published: isPublished,
          published_at: isPublished ? (item.published_at ?? dayjs().toISOString()) : null,
        },
      },
      {
        onSuccess: () =>
          message.success(isPublished ? 'Pengumuman diterbitkan' : 'Pengumuman ditarik ke draft'),
        onError: (err: Error) => message.error(err.message || 'Gagal memperbarui status'),
      },
    )
  }

  const togglePin = (item: Announcement) => {
    updateMutation.mutate(
      { id: item.id, patch: { is_pinned: !item.is_pinned } },
      {
        onSuccess: () =>
          message.success(item.is_pinned ? 'Sematan dilepas' : 'Pengumuman disematkan'),
        onError: (err: Error) => message.error(err.message || 'Gagal memperbarui sematan'),
      },
    )
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Pengumuman dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus pengumuman'),
    })
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  const statusChip = (key: StatusFilter, label: string, value: number, icon: ReactNode) => (
    <StatChip
      icon={icon}
      label={label}
      value={value}
      loading={briefQuery.isLoading}
      active={status === key}
      onClick={() => setStatus((prev) => (prev === key ? 'all' : key))}
    />
  )

  return (
    <div>
      <PageHeader
        title="Informasi"
        subtitle="Pengumuman dan informasi untuk staf — opsional tampil di portal wali santri"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tambah
            </Button>
          ) : null
        }
      />

      <Space wrap style={{ marginBottom: 16 }}>
        {statusChip('all', 'Total', stats.total, <NotificationOutlined />)}
        {statusChip('published', 'Terbit', stats.published, <CheckCircleOutlined />)}
        {statusChip('draft', 'Draft', stats.draft, <FileTextOutlined />)}
      </Space>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Cari judul…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <Select
            allowClear
            placeholder="Kategori"
            style={{ minWidth: 150 }}
            value={category}
            onChange={setCategory}
            options={['Pengumuman', 'Informasi', 'Akademik', 'Kesantrian', 'Darurat'].map((c) => ({
              value: c,
              label: c,
            }))}
          />
        </Space>

        <List
          loading={query.isLoading}
          dataSource={items}
          locale={{ emptyText: 'Belum ada pengumuman' }}
          renderItem={(item) => {
            const dateLabel = dayjs(item.published_at ?? item.created_at).format('DD MMM YYYY HH:mm')
            return (
              <List.Item
                actions={
                  canWrite || canDelete
                    ? [
                        canWrite && (
                          <Button
                            key="publish"
                            type="text"
                            size="small"
                            onClick={() => togglePublish(item)}
                          >
                            {item.is_published ? 'Tarik' : 'Terbitkan'}
                          </Button>
                        ),
                        canWrite && (
                          <Tooltip key="pin" title={item.is_pinned ? 'Lepas sematan' : 'Sematkan'}>
                            <Button
                              type="text"
                              size="small"
                              icon={
                                item.is_pinned ? (
                                  <PushpinFilled style={{ color: '#4f46e5' }} />
                                ) : (
                                  <PushpinOutlined />
                                )
                              }
                              onClick={() => togglePin(item)}
                            />
                          </Tooltip>
                        ),
                        canWrite && (
                          <Button
                            key="edit"
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEdit(item)}
                          />
                        ),
                        canDelete && (
                          <Popconfirm
                            key="delete"
                            title="Hapus pengumuman ini?"
                            description="Pengumuman akan dihapus permanen."
                            onConfirm={() => handleDelete(item.id)}
                            okText="Hapus"
                            cancelText="Batal"
                          >
                            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      ].filter(Boolean)
                    : undefined
                }
              >
                <List.Item.Meta
                  title={
                    <Space size={6} wrap>
                      {item.is_pinned && (
                        <PushpinFilled style={{ color: '#4f46e5' }} aria-label="Tersemat" />
                      )}
                      <span style={{ fontWeight: 600 }}>{item.title}</span>
                      <Tag color={CATEGORY_COLORS[item.category] ?? 'default'}>{item.category}</Tag>
                      {item.is_published ? (
                        <Tag color="green">Terbit</Tag>
                      ) : (
                        <Tag>Draft</Tag>
                      )}
                      {item.is_public && <Tag color="orange">Portal Wali</Tag>}
                    </Space>
                  }
                  description={
                    <>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>
                        {dateLabel}
                        {!item.published_at && ' (draft)'}
                      </div>
                      <div
                        style={{
                          whiteSpace: 'pre-line',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.body}
                      </div>
                    </>
                  }
                />
              </List.Item>
            )
          }}
        />
      </Card>

      <AnnouncementModal
        open={formOpen}
        announcement={editing}
        submitting={submitting}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
