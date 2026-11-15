import { useMemo, useRef, useState } from 'react'
import { App, Button, Popconfirm, Card, Empty, Input, Space, Table, Tag, Tooltip, theme, type InputRef, type TableColumnsType } from 'antd'
import {
  ApartmentOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useCreateRoom, useDeleteRoom, useRooms, useUpdateRoom } from '../hooks'
import { RoomForm } from '../components/RoomForm'
import type { Room, RoomFormValues } from '../types'

/** Tab "Ruang KBM" — master ruangan untuk jadwal (tabel rooms). */
export function RoomsTab({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const searchInputRef = useRef<InputRef>(null)

  const roomsQuery = useRooms()
  const createMutation = useCreateRoom()
  const updateMutation = useUpdateRoom()
  const deleteMutation = useDeleteRoom()

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return roomsQuery.data ?? []
    return (roomsQuery.data ?? []).filter((r) =>
      `${r.name} ${r.code ?? ''} ${r.notes ?? ''}`.toLowerCase().includes(q),
    )
  }, [roomsQuery.data, debouncedSearch])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditing(room)
    setFormOpen(true)
  }

  const handleSubmit = (values: RoomFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan ruang')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Ruang diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Ruang ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (room: Room) => {
    deleteMutation
      .mutateAsync(room.id)
      .then(() => message.success('Ruang dihapus'))
      .catch((err: Error) => message.error(err.message || 'Gagal menghapus'))
  }

  const isBlocked = formOpen || !active

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['Ctrl', 'K'],
      label: 'Fokus ke search',
      group: 'Navigasi',
      icon: <SearchOutlined />,
      run: () => searchInputRef.current?.focus(),
    },
    {
      keys: ['N'],
      label: 'Tambah ruang',
      group: 'Aksi',
      icon: <PlusOutlined />,
      when: canWrite,
      run: openCreate,
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <ReloadOutlined />,
      run: () => void roomsQuery.refetch(),
    },
    {
      keys: ['?'],
      label: 'Toggle palet shortcut',
      group: 'Tampilan',
      icon: <ThunderboltOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  const all = roomsQuery.data ?? []
  const activeCount = all.filter((r) => r.is_active).length

  const columns: TableColumnsType<Room> = [
    {
      title: 'Nama Ruang',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.code && <Tag style={{ borderRadius: 6 }}>{row.code}</Tag>}
          {!row.is_active && (
            <Tag color="default" icon={<MinusCircleOutlined />} style={{ borderRadius: 6 }}>
              Nonaktif
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Kapasitas',
      dataIndex: 'capacity',
      key: 'capacity',
      width: 120,
      responsive: ['md'],
      render: (v: number | null) => (v ? `${v} orang` : '—'),
    },
    {
      title: 'Keterangan',
      dataIndex: 'notes',
      key: 'notes',
      responsive: ['lg'],
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      render: (v: boolean) =>
        v ? (
          <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6 }}>
            Aktif
          </Tag>
        ) : (
          <Tag color="default" style={{ borderRadius: 6 }}>
            Nonaktif
          </Tag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size={0}>
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title={`Hapus "${row.name}"?`}
                description="Ruang akan ditandai terhapus (soft delete). Jadwal lama yang memakai namanya tidak berubah."
                okText="Ya, Hapus"
                okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                cancelText="Batal"
                onConfirm={() => handleDelete(row)}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        ),
    },
  ]

  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button icon={<ReloadOutlined spin={roomsQuery.isFetching} />} onClick={() => void roomsQuery.refetch()} />
      </Tooltip>
      <Tooltip title="Shortcut keyboard (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah Ruang
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {/* Aksi tab di ujung kanan tab bar — portal via ActionsSlot */}
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<ApartmentOutlined />}
          label="Total Ruang"
          value={all.length}
          color="indigo"
          loading={roomsQuery.isPending}
          onClick={() => setSearch('')}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Aktif"
          value={activeCount}
          color="emerald"
          loading={roomsQuery.isPending}
        />
        <StatChip
          icon={<MinusCircleOutlined />}
          label="Nonaktif"
          value={all.length - activeCount}
          color="rose"
          loading={roomsQuery.isPending}
          hideIfZero
        />
      </div>

      <Card>
        <div style={{ marginBottom: 14 }}>
          <Input
            ref={searchInputRef}
            placeholder="Cari nama / kode ruang…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </div>

        <Table<Room>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={roomsQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  all.length > 0
                    ? 'Tidak ada ruang yang cocok dengan pencarian'
                    : 'Belum ada ruang — tambahkan kelas, lab, aula, dan lainnya'
                }
              />
            ),
          }}
          pagination={rows.length > 10 ? { showTotal: (t) => `Total ${t} ruang` } : false}
          scroll={{ x: true }}
        />
      </Card>

      <RoomForm
        open={formOpen}
        room={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
