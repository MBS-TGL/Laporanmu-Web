import { useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  DeploymentUnitOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  TeamOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useCreateHalaqah,
  useDeleteHalaqah,
  useHalaqah,
  useUpdateHalaqah,
} from './hooks'
import { HalaqahForm } from './components/HalaqahForm'
import { MemberDrawer } from './components/MemberDrawer'
import type { HalaqahGroup, HalaqahFormValues } from './types'

function memberCount(group: HalaqahGroup): number {
  return group.members?.[0]?.count ?? 0
}

export function HalaqahPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [gender, setGender] = useState<'L' | 'P' | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<HalaqahGroup | null>(null)
  const [memberGroup, setMemberGroup] = useState<HalaqahGroup | null>(null)
  const searchRef = useRef<InputRef>(null)

  const halaqahQuery = useHalaqah()
  const createMutation = useCreateHalaqah()
  const updateMutation = useUpdateHalaqah()
  const deleteMutation = useDeleteHalaqah()
  const allGroups = halaqahQuery.data ?? []
  const isRefreshing = halaqahQuery.isFetching

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allGroups.filter((g) => {
      if (
        q &&
        !`${g.name} ${g.teachers?.name ?? ''} ${g.place ?? ''} ${g.schedule ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (gender && g.gender !== gender) return false
      return true
    })
  }, [allGroups, debouncedSearch, gender])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setGender(undefined)
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || gender)

  const stats = useMemo(() => {
    const totalMembers = allGroups.reduce((sum, g) => sum + memberCount(g), 0)
    const capacity = allGroups.reduce((sum, g) => sum + (g.capacity || 0), 0)
    const full = allGroups.filter((g) => g.capacity > 0 && memberCount(g) >= g.capacity).length
    return { total: allGroups.length, totalMembers, capacity, full }
  }, [allGroups])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (group: HalaqahGroup) => {
    setEditing(group)
    setFormOpen(true)
  }

  const handleSubmit = (values: HalaqahFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan halaqah')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Halaqah diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Halaqah ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Halaqah dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus halaqah'),
    })
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah halaqah',
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
        label: 'Reset semua filter',
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
    isBlocked: formOpen || memberGroup !== null,
  })

  const columns: TableColumnsType<HalaqahGroup> = [
    {
      title: 'Halaqah',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600 }}
            onClick={() => setMemberGroup(row)}
          >
            {row.name}
          </Button>
          {row.schedule && (
            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{row.schedule}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Musyrif',
      key: 'musyrif',
      width: 180,
      render: (_, row) => row.teachers?.name ?? '-',
    },
    {
      title: 'Kategori',
      dataIndex: 'gender',
      key: 'gender',
      width: 100,
      render: (v: 'L' | 'P' | null) =>
        v ? <Tag color={v === 'L' ? 'blue' : 'magenta'}>{v === 'L' ? 'Putra' : 'Putri'}</Tag> : '-',
      responsive: ['md'],
    },
    {
      title: 'Tempat',
      dataIndex: 'place',
      key: 'place',
      width: 140,
      render: (v: string | null) => v ?? '-',
      responsive: ['md'],
    },
    {
      title: 'Anggota',
      key: 'members',
      width: 170,
      render: (_, row) => {
        const count = memberCount(row)
        const pct = row.capacity > 0 ? Math.min(100, Math.round((count / row.capacity) * 100)) : 0
        return (
          <div style={{ minWidth: 120 }}>
            <span style={{ fontWeight: 600 }}>
              {count}
              {row.capacity > 0 ? ` / ${row.capacity}` : ''}
            </span>
            {row.capacity > 0 && (
              <Progress
                percent={pct}
                size="small"
                showInfo={false}
                strokeColor={pct >= 100 ? '#f43f5e' : undefined}
                style={{ marginBottom: 0 }}
              />
            )}
          </div>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 150,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            <Tooltip title="Kelola anggota">
              <Button type="text" icon={<TeamOutlined />} onClick={() => setMemberGroup(row)} />
            </Tooltip>
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus halaqah ini?"
                description="Riwayat setoran tahfidz santri tidak ikut terhapus."
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
        title="Halaqah"
        subtitle="Kelompok halaqah, musyrif, dan anggota santri"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void halaqahQuery.refetch()} />
            </Tooltip>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Halaqah
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<DeploymentUnitOutlined />}
          label="Total Halaqah"
          value={stats.total}
          color="indigo"
          loading={halaqahQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Total Anggota"
          value={stats.totalMembers}
          color="emerald"
          loading={halaqahQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Kapasitas Total"
          value={stats.capacity}
          color="sky"
          loading={halaqahQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Halaqah Penuh"
          value={stats.full}
          color="rose"
          loading={halaqahQuery.isPending}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            ref={searchRef}
            placeholder="Cari nama halaqah, musyrif, atau tempat"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          <Select
            placeholder="Kategori"
            allowClear
            style={{ minWidth: 130 }}
            value={gender}
            onChange={(v) => {
              setGender(v)
              setPage(1)
            }}
            options={[
              { value: 'L', label: 'Putra' },
              { value: 'P', label: 'Putri' },
            ]}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<HalaqahGroup>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={halaqahQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasActiveFilters ? 'Tidak ada halaqah yang cocok dengan filter' : 'Belum ada halaqah'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} halaqah`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <HalaqahForm
        open={formOpen}
        group={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <MemberDrawer
        open={memberGroup !== null}
        group={memberGroup}
        onClose={() => setMemberGroup(null)}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
