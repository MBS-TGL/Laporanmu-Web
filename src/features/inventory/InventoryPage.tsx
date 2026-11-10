import { useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from './hooks'
import { CONDITION_OPTIONS, ItemForm } from './components/ItemForm'
import type { InventoryItem, ItemCondition, ItemFormValues } from './types'

const CONDITION_COLORS: Record<ItemCondition, string> = {
  good: 'green',
  light_damaged: 'gold',
  heavy_damaged: 'orange',
  lost: 'red',
}

export function InventoryPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [condition, setCondition] = useState<ItemCondition | ''>('')
  const [lowOnly, setLowOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<InputRef>(null)

  const itemsQuery = useItems()
  const createMutation = useCreateItem()
  const updateMutation = useUpdateItem()
  const deleteMutation = useDeleteItem()
  const allItems = itemsQuery.data ?? []
  const isRefreshing = itemsQuery.isFetching

  const isLow = (item: InventoryItem) =>
    item.min_quantity > 0 && item.quantity <= item.min_quantity

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return allItems.filter((it) => {
      if (
        q &&
        !`${it.name} ${it.code ?? ''} ${it.category ?? ''} ${it.location ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (category && it.category !== category) return false
      if (condition && it.condition !== condition) return false
      if (lowOnly && !isLow(it)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, debouncedSearch, category, condition, lowOnly])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetFilters = () => {
    setSearch('')
    setCategory(undefined)
    setCondition('')
    setLowOnly(false)
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || category || condition || lowOnly)

  const stats = useMemo(() => {
    const units = allItems.reduce((s, it) => s + (it.quantity || 0), 0)
    const damaged = allItems.filter((it) => it.condition === 'light_damaged' || it.condition === 'heavy_damaged').length
    const low = allItems.filter(isLow).length
    const value = allItems.reduce((s, it) => s + (it.price ?? 0) * (it.quantity || 0), 0)
    return { total: allItems.length, units, damaged, low, value }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems])

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const it of allItems) if (it.category) set.add(it.category)
    return [...set].sort().map((c) => ({ value: c, label: c }))
  }, [allItems])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setFormOpen(true)
  }

  const handleSubmit = (values: ItemFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan barang')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Barang diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Barang ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Barang dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus barang'),
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const csv = Papa.unparse({
        fields: ['Kode', 'Nama', 'Kategori', 'Jumlah', 'Satuan', 'Kondisi', 'Lokasi', 'Stok Min', 'Perolehan', 'Nilai', 'Sumber'],
        data: rows.map((it) => [
          it.code ?? '',
          it.name,
          it.category ?? '',
          it.quantity,
          it.unit ?? '',
          CONDITION_OPTIONS.find((c) => c.value === it.condition)?.label ?? it.condition,
          it.location ?? '',
          it.min_quantity,
          it.acquired_at ? dayjs(it.acquired_at).format('DD/MM/YYYY') : '',
          it.price ?? '',
          it.source ?? '',
        ]),
      })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `inventaris-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${rows.length} barang diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor CSV')
    } finally {
      setExporting(false)
    }
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah barang',
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
    isBlocked: formOpen,
  })

  const columns: TableColumnsType<InventoryItem> = [
    {
      title: 'Barang',
      dataIndex: 'name',
      key: 'name',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.name}</span>
          {row.code && <Tag style={{ marginLeft: 8, borderRadius: 6, fontSize: 11 }}>{row.code}</Tag>}
          {isLow(row) && (
            <Tooltip title={`Stok minimum ${row.min_quantity}`}>
              <Tag color="red" style={{ marginLeft: 4, borderRadius: 6, fontSize: 11 }}>
                <WarningOutlined /> Stok Rendah
              </Tag>
            </Tooltip>
          )}
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            {[row.category, row.location].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      title: 'Jumlah',
      key: 'quantity',
      width: 110,
      align: 'center',
      render: (_, row) => (
        <span style={{ fontWeight: 600 }}>
          {row.quantity}
          {row.unit ? <span style={{ color: 'rgba(0,0,0,0.45)', fontWeight: 400 }}> {row.unit}</span> : null}
        </span>
      ),
    },
    {
      title: 'Kondisi',
      dataIndex: 'condition',
      key: 'condition',
      width: 130,
      render: (v: ItemCondition) => (
        <StatusTag color={CONDITION_COLORS[v]}>
          {CONDITION_OPTIONS.find((c) => c.value === v)?.label ?? v}
        </StatusTag>
      ),
      responsive: ['md'],
    },
    {
      title: 'Perolehan',
      dataIndex: 'acquired_at',
      key: 'acquired_at',
      width: 120,
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
      responsive: ['lg'],
    },
    {
      title: 'Nilai',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (v: number | null) =>
        v ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v) : '-',
      responsive: ['lg'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus barang ini?"
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
        title="Inventaris"
        subtitle="Aset dan barang milik pondok / sekolah beserta kondisinya"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={() => void itemsQuery.refetch()} />
            </Tooltip>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              CSV
            </Button>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Barang
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<InboxOutlined />}
          label="Jenis Barang"
          value={stats.total}
          color="indigo"
          loading={itemsQuery.isPending}
          active={!lowOnly}
          onClick={() => {
            setLowOnly(false)
            setPage(1)
          }}
        />
        <StatChip
          icon={<InboxOutlined />}
          label="Total Unit"
          value={stats.units}
          color="sky"
          loading={itemsQuery.isPending}
        />
        <StatChip
          icon={<WarningOutlined />}
          label="Stok Rendah"
          value={stats.low}
          color="amber"
          loading={itemsQuery.isPending}
          active={lowOnly}
          onClick={() => {
            setLowOnly(!lowOnly)
            setPage(1)
          }}
        />
        <StatChip
          icon={<WarningOutlined />}
          label="Rusak"
          value={stats.damaged}
          color="rose"
          loading={itemsQuery.isPending}
          active={condition === 'light_damaged' || condition === 'heavy_damaged'}
          onClick={() => {
            setCondition(condition ? '' : 'light_damaged')
            setPage(1)
          }}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            ref={searchRef}
            placeholder="Cari nama, kode, kategori, atau lokasi"
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
            options={categoryOptions}
            value={category}
            onChange={(v) => {
              setCategory(v)
              setPage(1)
            }}
            style={{ minWidth: 140 }}
          />
          <Select
            placeholder="Kondisi"
            allowClear
            options={CONDITION_OPTIONS}
            value={condition || undefined}
            onChange={(v) => {
              setCondition(v ?? '')
              setPage(1)
            }}
            style={{ minWidth: 140 }}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<InventoryItem>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={itemsQuery.isPending}
          rowClassName={(row) => (isLow(row) ? 'student-row-risk' : '')}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasActiveFilters ? 'Tidak ada barang yang cocok dengan filter' : 'Belum ada barang inventaris'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} barang`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <ItemForm
        open={formOpen}
        item={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
