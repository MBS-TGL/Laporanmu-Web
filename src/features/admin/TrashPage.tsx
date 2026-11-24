import { useMemo, useState, type Key } from 'react'
import { App, Alert, Button, Card, Input, Popconfirm, Select, Space, Spin, Table, Tag, theme } from 'antd'
import { DeleteOutlined, InboxOutlined, RestOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { StatChip } from '../../shared/components/StatChip'
import { ActionBar } from '../../shared/components/ActionBar'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useTrashItems, useRestoreTrash, usePurgeTrash, TRASH_TABLES, type TrashEntry } from './trash'
import { chunk } from '../../shared/utils/array'

const MODULE_COLORS: Record<string, string> = {
  students: 'geekblue',
  teachers: 'green',
  classes: 'cyan',
  dorms: 'purple',
  academic_years: 'gold',
  subjects: 'blue',
  schedules: 'processing',
  tahfidz_records: 'volcano',
  halaqah_groups: 'orange',
  extracurriculars: 'magenta',
  books: 'red',
  savings_accounts: 'lime',
  inventory_items: 'default',
  worship_items: 'gold',
  entities: 'geekblue',
  instruments: 'purple',
  curriculum_cps: 'blue',
  curriculum_tps: 'cyan',
  cocurricular_dims: 'green',
}

/** Sisa retensi ≤ 7 hari = merah, ≤ 14 hari = amber. */
function retentionColor(daysLeft: number): string | undefined {
  if (daysLeft <= 7) return 'red'
  if (daysLeft <= 14) return 'orange'
  return undefined
}

/**
 * Tab Sampah — agregasi seluruh baris soft-deleted lintas modul.
 * Pulihkan = kembalikan deleted_at ke null; Hapus Permanen = hard delete
 * (irreversibel, selalu lewat konfirmasi). File storage tidak masuk sini.
 */
export function TrashPage({ active }: { active: boolean }) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()

  const trashQuery = useTrashItems()
  const restoreMutation = useRestoreTrash()
  const purgeMutation = usePurgeTrash()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [moduleFilter, setModuleFilter] = useState<string | undefined>()
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([])

  const entries = useMemo(() => trashQuery.data ?? [], [trashQuery.data])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return entries.filter((e) => {
      if (moduleFilter && e.table !== moduleFilter) return false
      if (q && !e.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, debouncedSearch, moduleFilter])

  const pg = useTablePagination(filtered.length, { label: 'item', showSizeChanger: false, defaultPageSize: 15 })

  // Batch dijalankan paralel per chunk 8 (bukan satu per satu) — puluhan
  // item selesai jauh lebih cepat tanpa menabrak rate limit.
  const restore = async (targets: TrashEntry[]) => {
    const failures: string[] = []
    for (const group of chunk(targets, 8)) {
      await Promise.all(
        group.map(async (t) => {
          try {
            await restoreMutation.mutateAsync({ table: t.table, id: t.id })
          } catch {
            failures.push(t.title)
          }
        }),
      )
    }
    if (failures.length === 0) {
      message.success(
        targets.length === 1 ? `"${targets[0].title}" dipulihkan` : `${targets.length} item dipulihkan`,
      )
    } else {
      message.warning(`${targets.length - failures.length} dipulihkan, ${failures.length} gagal`)
    }
    setSelectedKeys([])
  }

  const purge = async (targets: TrashEntry[]) => {
    const failures: string[] = []
    for (const group of chunk(targets, 8)) {
      await Promise.all(
        group.map(async (t) => {
          try {
            await purgeMutation.mutateAsync({ table: t.table, id: t.id })
          } catch {
            failures.push(t.title)
          }
        }),
      )
    }
    if (failures.length === 0) {
      message.success(`${targets.length} item dihapus permanen`)
    } else {
      message.warning(
        `${targets.length - failures.length} dihapus, ${failures.length} gagal (masih dipakai data lain atau ditolak RLS)`,
      )
    }
    setSelectedKeys([])
  }

  const confirmPurge = (targets: TrashEntry[]) => {
    modal.confirm({
      title: targets.length === 1 ? `Hapus permanen "${targets[0].title}"?` : `Hapus permanen ${targets.length} item?`,
      content: 'Data dihapus dari database dan tidak bisa dikembalikan. Pastikan tidak lagi dirujuk data lain.',
      okText: 'Hapus Permanen',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () => purge(targets),
    })
  }

  const refreshButton = (
    <Button icon={<RestOutlined />} loading={trashQuery.isFetching} onClick={() => trashQuery.refetch()}>
      Muat Ulang
    </Button>
  )
  const actions = useTabActions(active, refreshButton)

  const columns: ColumnsType<TrashEntry> = [
    {
      title: 'Item',
      dataIndex: 'title',
      key: 'title',
      render: (_, e) => (
        <span style={{ fontWeight: 600 }}>{e.title}</span>
      ),
    },
    {
      title: 'Modul',
      dataIndex: 'label',
      key: 'label',
      width: 150,
      filters: TRASH_TABLES.map((t) => ({ text: t.label, value: t.table })),
      onFilter: (value, e) => e.table === value,
      render: (_, e) => <Tag color={MODULE_COLORS[e.table]} style={{ borderRadius: 6, marginInlineEnd: 0 }}>{e.label}</Tag>,
    },
    {
      title: 'Dihapus',
      dataIndex: 'deletedAt',
      key: 'deletedAt',
      width: 150,
      sorter: (a, b) => a.deletedAt.localeCompare(b.deletedAt),
      defaultSortOrder: 'descend',
      render: (deletedAt: string) =>
        new Date(deletedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: 'Retensi',
      dataIndex: 'daysLeft',
      key: 'daysLeft',
      width: 130,
      sorter: (a, b) => a.daysLeft - b.daysLeft,
      render: (daysLeft: number) => {
        const color = retentionColor(daysLeft)
        const text = daysLeft > 0 ? `sisa ${daysLeft} hari` : `lewat ${Math.abs(daysLeft)} hari`
        return (
          <span style={{ color: color ? token.colorError : token.colorTextSecondary, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
            {text}
          </span>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      align: 'right',
      render: (_, e) => (
        <Space size="small">
          <Button size="small" icon={<UndoOutlined />} loading={restoreMutation.isPending} onClick={() => restore([e])}>
            Pulihkan
          </Button>
          <Popconfirm
            title="Hapus permanen?"
            description="Tidak bisa dikembalikan."
            okText="Hapus Permanen"
            okButtonProps={{ danger: true }}
            cancelText="Batal"
            onConfirm={() => purge([e])}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Hapus permanen ${e.title}`} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries) counts.set(e.table, (counts.get(e.table) ?? 0) + 1)
    return counts
  }, [entries])

  const oldest = entries.length > 0 ? entries[entries.length - 1] : null

  return (
    <div>
      {actions}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <StatChip icon={<InboxOutlined />} label="Item di sampah" value={entries.length} color="rose" loading={trashQuery.isPending} />
        <StatChip icon={<RestOutlined />} label="Modul terdampak" value={moduleCounts.size} color="slate" loading={trashQuery.isPending} />
        {oldest && (
          <StatChip
            icon={<DeleteOutlined />}
            label="Terlama di sampah"
            value={`${Math.max(0, -oldest.daysLeft)}+ hari`}
            color="amber"
            loading={trashQuery.isPending}
          />
        )}
      </div>

      <Card>
        <Space wrap size="middle" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 14 }}>
          <Space wrap>
            <Input
              placeholder="Cari judul item"
              allowClear
              prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 240, maxWidth: '100%' }}
            />
            <Select
              placeholder="Semua Modul"
              allowClear
              style={{ minWidth: 160 }}
              value={moduleFilter}
              onChange={(v) => setModuleFilter(v)}
              options={TRASH_TABLES.map((t) => ({ value: t.table, label: `${t.label} (${moduleCounts.get(t.table) ?? 0})` }))}
            />
          </Space>
        </Space>

        {trashQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat data sampah"
            description={trashQuery.error instanceof Error ? trashQuery.error.message : 'RPC admin_trash_items tidak bisa diakses. Pastikan migrasi 0062 sudah diterapkan.'}
            action={
              <Button size="small" icon={<RestOutlined />} onClick={() => void trashQuery.refetch()}>
                Coba lagi
              </Button>
            }
          />
        ) : entries.length === 0 && !trashQuery.isPending ? (
          <Alert
            type="success"
            showIcon
            message="Sampah kosong"
            description="Tidak ada data terhapus di seluruh modul. Item yang di-soft-delete dari halaman mana pun akan berkumpul di sini."
          />
        ) : trashQuery.isPending ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <Table
            rowKey={(e) => `${e.table}:${e.id}`}
            columns={columns}
            dataSource={filtered}
            rowSelection={{ selectedRowKeys: selectedKeys, onChange: setSelectedKeys }}
            pagination={pg.pagination}
            size="middle"
            scroll={{ x: 700 }}
          />
        )}
      </Card>

      <ActionBar
        count={selectedKeys.length}
        onClear={() => setSelectedKeys([])}
        actions={[
          {
            key: 'restore',
            label: 'Pulihkan',
            icon: <UndoOutlined />,
            confirm: { title: `Pulihkan ${selectedKeys.length} item?`, okText: 'Pulihkan' },
            onClick: () => restore(filtered.filter((e) => selectedKeys.includes(`${e.table}:${e.id}`))),
          },
          {
            key: 'purge',
            label: 'Hapus Permanen',
            icon: <DeleteOutlined />,
            variant: 'danger',
            onClick: () => confirmPurge(filtered.filter((e) => selectedKeys.includes(`${e.table}:${e.id}`))),
          },
        ]}
      />
    </div>
  )
}
