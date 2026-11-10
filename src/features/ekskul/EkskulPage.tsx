import { useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  TeamOutlined,
  TrophyOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useCreateEkskul, useDeleteEkskul, useEkskul, useUpdateEkskul } from './hooks'
import { EkskulForm } from './components/EkskulForm'
import { MemberDrawer } from './components/MemberDrawer'
import type { Ekskul, EkskulFormValues } from './types'

function memberCount(ekskul: Ekskul): number {
  return ekskul.members?.[0]?.count ?? 0
}

export function EkskulPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Ekskul | null>(null)
  const [memberEkskul, setMemberEkskul] = useState<Ekskul | null>(null)
  const searchRef = useRef<InputRef>(null)

  const ekskulQuery = useEkskul()
  const createMutation = useCreateEkskul()
  const updateMutation = useUpdateEkskul()
  const deleteMutation = useDeleteEkskul()
  const allEkskul = ekskulQuery.data ?? []
  const isRefreshing = ekskulQuery.isFetching

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allEkskul.filter((e) => {
      if (
        q &&
        !`${e.name} ${e.teachers?.name ?? ''} ${e.place ?? ''} ${e.schedule ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      return true
    })
  }, [allEkskul, debouncedSearch])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch)

  const stats = useMemo(
    () => ({
      total: allEkskul.length,
      members: allEkskul.reduce((sum, e) => sum + memberCount(e), 0),
      coached: allEkskul.filter((e) => e.coach_id).length,
    }),
    [allEkskul],
  )

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (ekskul: Ekskul) => {
    setEditing(ekskul)
    setFormOpen(true)
  }

  const handleSubmit = (values: EkskulFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan kegiatan')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Ekstrakurikuler diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Ekstrakurikuler ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Ekstrakurikuler dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus ekstrakurikuler'),
    })
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah kegiatan',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: openCreate,
        when: canWrite,
      },
      {
        keys: ['Ctrl', 'K'],
        label: 'Fokus pencarian',
        group: 'Navigasi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
      {
        keys: ['Esc'],
        label: 'Reset filter',
        group: 'Navigasi',
        icon: <UndoOutlined />,
        run: resetFilters,
        when: hasActiveFilters,
      },
    ],
    [canWrite, hasActiveFilters],
  )

  const shortcuts = useShortcuts({
    items: [
      ...shortcutItems,
      {
        keys: ['?'],
        label: 'Palet shortcut',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => shortcuts.toggle(),
      },
    ],
    isBlocked: formOpen || memberEkskul !== null,
  })

  const columns: TableColumnsType<Ekskul> = [
    {
      title: 'Kegiatan',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600 }}
            onClick={() => setMemberEkskul(row)}
          >
            {row.name}
          </Button>
          {row.description && (
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{row.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Pembina',
      key: 'coach',
      width: 180,
      render: (_, row) => row.teachers?.name ?? '-',
    },
    {
      title: 'Jadwal',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 150,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: 'Tempat',
      dataIndex: 'place',
      key: 'place',
      width: 150,
      render: (v: string | null) => v ?? '-',
      responsive: ['md'],
    },
    {
      title: 'Anggota',
      key: 'members',
      width: 100,
      align: 'center',
      render: (_, row) => <span style={{ fontWeight: 600 }}>{memberCount(row)}</span>,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            <Tooltip title="Kelola anggota">
              <Button type="text" icon={<TeamOutlined />} onClick={() => setMemberEkskul(row)} />
            </Tooltip>
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus kegiatan ini?"
                onConfirm={() => handleDelete(row.id)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Tooltip title="Hapus">
                  <Button type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
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
        title="Ekstrakurikuler"
        subtitle="Kegiatan ekstrakurikuler, pembina, dan anggota santri"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void ekskulQuery.refetch()} />
            </Tooltip>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Kegiatan
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<TrophyOutlined />}
          label="Total Kegiatan"
          value={stats.total}
          color="indigo"
          loading={ekskulQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Total Anggota"
          value={stats.members}
          color="emerald"
          loading={ekskulQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Sudah Ada Pembina"
          value={stats.coached}
          color="sky"
          loading={ekskulQuery.isPending}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            ref={searchRef}
            placeholder="Cari nama kegiatan, pembina, atau tempat"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<Ekskul>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={ekskulQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasActiveFilters ? 'Tidak ada kegiatan yang cocok dengan filter' : 'Belum ada ekstrakurikuler'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} kegiatan`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <EkskulForm
        open={formOpen}
        ekskul={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <MemberDrawer
        open={memberEkskul !== null}
        ekskul={memberEkskul}
        onClose={() => setMemberEkskul(null)}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
