import { useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
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
  AudioOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SyncOutlined,
  UndoOutlined,
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
import {
  useCreateTahfidz,
  useDeleteTahfidz,
  useTahfidz,
  useTahfidzStats,
  useUpdateTahfidz,
} from './hooks'
import { TahfidzForm } from './components/TahfidzForm'
import { fetchTahfidz } from './api'
import type { TahfidzKindFilter, TahfidzQuality, TahfidzRecord, TahfidzFilters } from './types'

const KIND_META: Record<string, { label: string; color: string }> = {
  ziyadah: { label: 'Ziyadah', color: 'green' },
  murojaah: { label: 'Murojaah', color: 'blue' },
}

const QUALITY_META: Record<TahfidzQuality, { label: string; color: string }> = {
  excellent: { label: 'Sangat Baik', color: 'green' },
  good: { label: 'Baik', color: 'blue' },
  needs_work: { label: 'Perlu Perbaikan', color: 'orange' },
}

export function TahfidzPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [kind, setKind] = useState<TahfidzKindFilter>('')
  const [quality, setQuality] = useState<TahfidzQuality | ''>('')
  const [range, setRange] = useState<[string | undefined, string | undefined]>([undefined, undefined])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TahfidzRecord | null>(null)
  const [exporting, setExporting] = useState(false)
  const searchRef = useRef<InputRef>(null)

  const filters = useMemo<TahfidzFilters>(
    () => ({
      search: debouncedSearch || undefined,
      kind,
      quality: quality || undefined,
      from: range[0],
      to: range[1],
      page,
      pageSize,
    }),
    [debouncedSearch, kind, quality, range, page, pageSize],
  )

  const recordsQuery = useTahfidz(filters)
  const statsQuery = useTahfidzStats()
  const createMutation = useCreateTahfidz()
  const updateMutation = useUpdateTahfidz()
  const deleteMutation = useDeleteTahfidz()
  const stats = statsQuery.data

  const resetFilters = () => {
    setSearch('')
    setKind('')
    setQuality('')
    setRange([undefined, undefined])
    setPage(1)
  }

  const hasActiveFilters = Boolean(debouncedSearch || kind || quality || range[0] || range[1])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (record: TahfidzRecord) => {
    setEditing(record)
    setFormOpen(true)
  }

  const handleSubmit = (values: Parameters<typeof createMutation.mutate>[0]) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan setoran')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Setoran hafalan diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Setoran hafalan dicatat')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => message.success('Setoran hafalan dihapus'),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus setoran'),
    })
  }

  // Ekspor memakai filter yang sama, tanpa pagination
  const handleExport = async () => {
    setExporting(true)
    try {
      const all = await fetchTahfidz({ ...filters, page: 1, pageSize: 1000 })
      const csv = Papa.unparse({
        fields: ['Tanggal', 'Santri', 'Kode', 'Jenis', 'Surah', 'Ayat', 'Mutu', 'Musyrif', 'Catatan'],
        data: all.data.map((r) => [
          dayjs(r.recorded_at).format('DD/MM/YYYY'),
          r.student?.name ?? '',
          r.student?.registration_code ?? '',
          KIND_META[r.kind]?.label ?? r.kind,
          r.surah,
          r.from_ayat ? `${r.from_ayat}-${r.to_ayat ?? r.from_ayat}` : '',
          r.quality ? QUALITY_META[r.quality]?.label ?? '' : '',
          r.teacher?.name ?? '',
          r.note ?? '',
        ]),
      })
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tahfidz-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${all.data.length} setoran diekspor`)
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
        label: 'Catat setoran',
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

  const handleTableChange: TableProps<TahfidzRecord>['onChange'] = (pagination) => {
    setPage(pagination.current ?? 1)
    setPageSize(pagination.pageSize ?? 10)
  }

  const columns: TableColumnsType<TahfidzRecord> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.student?.name ?? '-'}</span>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
            {row.student?.registration_code}
          </div>
        </div>
      ),
    },
    {
      title: 'Setoran',
      key: 'surah',
      render: (_, row) => (
        <div>
          <span style={{ fontWeight: 500 }}>{row.surah}</span>
          {row.from_ayat && (
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>
              {' '}
              : {row.from_ayat}
              {row.to_ayat && row.to_ayat !== row.from_ayat ? `–${row.to_ayat}` : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'Jenis',
      dataIndex: 'kind',
      key: 'kind',
      width: 110,
      render: (v: string) => <Tag color={KIND_META[v]?.color}>{KIND_META[v]?.label ?? v}</Tag>,
    },
    {
      title: 'Mutu',
      dataIndex: 'quality',
      key: 'quality',
      width: 140,
      render: (v: TahfidzQuality | null) =>
        v ? (
          <StatusTag color={QUALITY_META[v]?.color ?? 'default'}>{QUALITY_META[v]?.label ?? v}</StatusTag>
        ) : (
          '-'
        ),
      responsive: ['md'],
    },
    {
      title: 'Musyrif',
      key: 'teacher',
      width: 160,
      render: (_, row) => row.teacher?.name ?? '-',
      responsive: ['md'],
    },
    {
      title: 'Tanggal',
      dataIndex: 'recorded_at',
      key: 'recorded_at',
      width: 120,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
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
                title="Hapus setoran ini?"
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
        title="Tahfidz"
        subtitle="Catatan setoran hafalan santri — ziyadah dan murojaah"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button
                icon={<SyncOutlined spin={recordsQuery.isFetching} />}
                onClick={() => {
                  void recordsQuery.refetch()
                  void statsQuery.refetch()
                }}
              />
            </Tooltip>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport}>
              CSV
            </Button>
            <Tooltip title="Palet shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Catat Setoran
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<AudioOutlined />}
          label="Total Setoran"
          value={stats?.total ?? '…'}
          color="indigo"
          loading={statsQuery.isPending}
          active={!kind}
          onClick={() => {
            setKind('')
            setPage(1)
          }}
        />
        <StatChip
          icon={<AudioOutlined />}
          label="Ziyadah"
          value={stats?.ziyadah ?? '…'}
          color="emerald"
          loading={statsQuery.isPending}
          active={kind === 'ziyadah'}
          onClick={() => {
            setKind(kind === 'ziyadah' ? '' : 'ziyadah')
            setPage(1)
          }}
        />
        <StatChip
          icon={<AudioOutlined />}
          label="Murojaah"
          value={stats?.murojaah ?? '…'}
          color="sky"
          loading={statsQuery.isPending}
          active={kind === 'murojaah'}
          onClick={() => {
            setKind(kind === 'murojaah' ? '' : 'murojaah')
            setPage(1)
          }}
        />
        <StatChip
          icon={<AudioOutlined />}
          label="Setoran 7 Hari"
          value={stats?.week ?? '…'}
          color="purple"
          loading={statsQuery.isPending}
        />
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v as TahfidzKindFilter)
              setPage(1)
            }}
            options={[
              { label: 'Semua', value: '' },
              { label: 'Ziyadah', value: 'ziyadah' },
              { label: 'Murojaah', value: 'murojaah' },
            ]}
          />
          <Input
            ref={searchRef}
            placeholder="Cari nama santri"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ flex: '1 1 220px', minWidth: 200 }}
          />
          <Select
            placeholder="Mutu"
            allowClear
            style={{ minWidth: 150 }}
            value={quality || undefined}
            onChange={(v) => {
              setQuality(v ?? '')
              setPage(1)
            }}
            options={Object.entries(QUALITY_META).map(([value, meta]) => ({
              value,
              label: meta.label,
            }))}
          />
          <DatePicker.RangePicker
            value={[range[0] ? dayjs(range[0]) : null, range[1] ? dayjs(range[1]) : null] as never}
            onChange={(dates) => {
              setRange([
                dates?.[0]?.format('YYYY-MM-DD'),
                dates?.[1]?.format('YYYY-MM-DD'),
              ])
              setPage(1)
            }}
            style={{ minWidth: 230 }}
          />
          {hasActiveFilters && (
            <Button icon={<UndoOutlined />} onClick={resetFilters}>
              Reset
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table<TahfidzRecord>
          rowKey="id"
          columns={columns}
          dataSource={recordsQuery.data?.data ?? []}
          loading={recordsQuery.isPending}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasActiveFilters ? 'Tidak ada setoran yang cocok dengan filter' : 'Belum ada setoran hafalan'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: recordsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} setoran`,
          }}
          scroll={{ x: true }}
        />
      </Card>

      <TahfidzForm
        open={formOpen}
        record={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
