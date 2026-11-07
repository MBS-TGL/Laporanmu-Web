import { useMemo, useRef, useState } from 'react'
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
  type InputRef,
  type TableColumnsType,
  type TableProps,
} from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FallOutlined,
  FileDoneOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RiseOutlined,
  SearchOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { usePageShortcuts, type ShortcutItem } from '../../shared/hooks/usePageShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { fetchPointRulesForExport } from './api'
import {
  useCreatePointRule,
  useDeletePointRule,
  usePointRules,
  usePointRulesBrief,
  useUpdatePointRule,
} from './hooks'
import { PointRuleForm } from './components/PointRuleForm'
import type {
  PointRule,
  PointRuleFilters,
  PointRuleFormValues,
  PointRuleSort,
  ReportKind,
} from './types'

function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`
}

// Warna poin bertingkat: positif hijau; negatif merah ≥20, orange ≥10, gold sisanya
function pointTagColor(points: number): string {
  if (points > 0) return 'green'
  const abs = Math.abs(points)
  if (abs >= 20) return 'red'
  if (abs >= 10) return 'orange'
  return 'gold'
}

export function PointRulesPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  // Filter state (search di-debounce agar tidak request per ketikan)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [category, setCategory] = useState<string | undefined>(undefined)
  const [kind, setKind] = useState<ReportKind>('')
  const [sort, setSort] = useState<{ key: PointRuleSort; dir: 'asc' | 'desc' } | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // UI state
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PointRule | null>(null)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<InputRef>(null)

  // Statistik & opsi kategori dihitung dari brief (rules sedikit, staleTime 60s)
  const briefQuery = usePointRulesBrief()

  const filters: PointRuleFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category: category || undefined,
      kind: kind || undefined,
      sort: sort?.key,
      dir: sort?.dir,
      page,
      pageSize,
    }),
    [debouncedSearch, category, kind, sort, page, pageSize],
  )

  const rulesQuery = usePointRules(filters)
  const createMutation = useCreatePointRule()
  const updateMutation = useUpdatePointRule()
  const deleteMutation = useDeletePointRule()

  const hasActiveFilters = Boolean(debouncedSearch || category || kind || sort)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (rule: PointRule) => {
    setEditing(rule)
    setFormOpen(true)
  }

  const resetFilters = () => {
    setSearch('')
    setCategory(undefined)
    setKind('')
    setSort(null)
    setPage(1)
  }

  const handleSubmit = (values: PointRuleFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan aturan poin')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Aturan poin diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Aturan poin ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Aturan poin dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus aturan poin'),
    })
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const rows = await fetchPointRulesForExport(filters)
      if (!rows.length) {
        message.warning('Tidak ada aturan untuk diekspor')
        return
      }
      const csv = Papa.unparse({
        fields: ['Aturan', 'Kategori', 'Poin', 'Tipe'],
        data: rows.map((r) => [
          r.name,
          r.category ?? '',
          r.points,
          r.is_negative ? 'Pelanggaran' : 'Prestasi',
        ]),
      })
      // BOM agar UTF-8 terbaca benar saat dibuka di Excel
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `aturan-poin-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${rows.length} aturan diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor CSV')
    } finally {
      setExporting(false)
    }
  }

  // Statistik global (tidak terpengaruh filter); chip diklik = pasang/bersihkan filter tipe
  const stats = useMemo(() => {
    const rules = briefQuery.data ?? []
    return {
      total: rules.length,
      negative: rules.filter((r) => r.points < 0).length,
      positive: rules.filter((r) => r.points > 0).length,
    }
  }, [briefQuery.data])

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of briefQuery.data ?? []) if (r.category) set.add(r.category)
    return [...set].sort((a, b) => a.localeCompare(b)).map((c) => ({ value: c, label: c }))
  }, [briefQuery.data])

  // ------------------------------------------------------------
  // Shortcut keyboard (palet via tombol ? atau ikon di header)
  // ------------------------------------------------------------
  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah Aturan',
        description: 'Buka form aturan poin baru',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: openCreate,
        when: canWrite,
      },
      {
        keys: ['Ctrl', 'K'],
        label: 'Fokus pencarian',
        group: 'Aksi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
      {
        keys: ['Esc'],
        label: 'Reset semua filter',
        group: 'Aksi',
        icon: <UndoOutlined />,
        run: resetFilters,
        when: hasActiveFilters,
      },
    ],
    [canWrite, hasActiveFilters],
  )

  const { isOpen, close, toggle, sections } = usePageShortcuts({
    items: [
      ...shortcutItems,
      {
        keys: ['?'],
        label: 'Palet shortcut',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => toggle(),
      },
    ],
    isBlocked: formOpen,
  })

  // ------------------------------------------------------------
  // Tabel
  // ------------------------------------------------------------
  const handleTableChange: TableProps<PointRule>['onChange'] = (pagination, _filters, sorter, extra) => {
    if (extra.action === 'paginate') {
      setPage(pagination.current ?? 1)
      setPageSize(pagination.pageSize ?? 10)
      return
    }
    if (extra.action === 'sort') {
      const s = Array.isArray(sorter) ? sorter[0] : sorter
      setSort(
        s.order && s.column
          ? { key: s.column.key as PointRuleSort, dir: s.order === 'ascend' ? 'asc' : 'desc' }
          : null,
      )
      setPage(1)
    }
  }

  const sortOrderOf = (key: PointRuleSort) =>
    sort?.key === key ? (sort.dir === 'asc' ? 'ascend' : 'descend') : null

  const columns: TableColumnsType<PointRule> = [
    {
      title: 'Aturan',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortOrder: sortOrderOf('name'),
      render: (_, row) => <span style={{ fontWeight: 500 }}>{row.name}</span>,
    },
    {
      title: 'Kategori',
      dataIndex: 'category',
      key: 'category',
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
      responsive: ['md'],
    },
    {
      title: 'Poin',
      dataIndex: 'points',
      key: 'points',
      width: 110,
      sorter: true,
      sortOrder: sortOrderOf('points'),
      render: (v: number) => (
        <StatusTag color={pointTagColor(v)} icon={v < 0 ? <FallOutlined /> : <RiseOutlined />}>
          {formatPoints(v)}
        </StatusTag>
      ),
    },
    {
      title: 'Tipe',
      dataIndex: 'is_negative',
      key: 'is_negative',
      width: 120,
      render: (v: boolean) => (v ? 'Pelanggaran' : 'Prestasi'),
      responsive: ['md'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
            {canDelete && (
              <Popconfirm
                title="Hapus aturan poin ini?"
                description="Aturan akan ditandai terhapus; catatan poin lama tetap tersimpan."
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
        title="Aturan Poin"
        subtitle="Daftar pelanggaran dan prestasi beserta bobot poinnya"
        extra={[
          <Tooltip key="shortcuts" title="Palet shortcut (?)">
            <Button type="text" icon={<QuestionCircleOutlined />} onClick={() => toggle()} />
          </Tooltip>,
          <Button key="export" icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
            CSV
          </Button>,
          ...(canWrite
            ? [
                <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Tambah Aturan
                </Button>,
              ]
            : []),
        ]}
      />

      {/* Chip statistik — klik untuk memfilter tipe */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<FileDoneOutlined />}
          label="Total Aturan"
          value={stats.total}
          color="indigo"
          loading={briefQuery.isPending}
          active={!kind}
          onClick={() => {
            setKind('')
            setPage(1)
          }}
        />
        <StatChip
          icon={<FallOutlined />}
          label="Pelanggaran"
          value={stats.negative}
          color="rose"
          loading={briefQuery.isPending}
          active={kind === 'negative'}
          onClick={() => {
            setKind(kind === 'negative' ? '' : 'negative')
            setPage(1)
          }}
        />
        <StatChip
          icon={<RiseOutlined />}
          label="Prestasi"
          value={stats.positive}
          color="emerald"
          loading={briefQuery.isPending}
          active={kind === 'positive'}
          onClick={() => {
            setKind(kind === 'positive' ? '' : 'positive')
            setPage(1)
          }}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Input
            ref={searchRef}
            placeholder="Cari nama atau kategori aturan"
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
            style={{ minWidth: 150 }}
          />
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v as ReportKind)
              setPage(1)
            }}
            options={[
              { label: 'Semua', value: '' },
              { label: 'Pelanggaran', value: 'negative' },
              { label: 'Prestasi', value: 'positive' },
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
        <Table<PointRule>
          rowKey="id"
          columns={columns}
          dataSource={rulesQuery.data?.data ?? []}
          loading={rulesQuery.isPending}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  hasActiveFilters
                    ? 'Tidak ada aturan yang cocok dengan filter'
                    : 'Belum ada aturan poin'
                }
              />
            ),
          }}
          onChange={handleTableChange}
          pagination={{
            current: page,
            pageSize,
            total: rulesQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} aturan`,
          }}
          scroll={{ x: true }}
        />
      </Card>

      <PointRuleForm
        open={formOpen}
        rule={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={isOpen} onClose={close} sections={sections} />
    </div>
  )
}
