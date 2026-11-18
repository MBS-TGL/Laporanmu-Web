import { useMemo, useRef, useState } from 'react'
import { useStudentDetail } from '../../students/useStudentDetail'
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
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { StatChip } from '../../../shared/components/StatChip'
import { StatusTag } from '../../../shared/components/StatusTag'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import {
  useCreateTahfidz,
  useDeleteTahfidz,
  useHalaqahMembers,
  useTahfidz,
  useTahfidzStats,
  useUpdateTahfidz,
} from '../hooks'
import { useScopedHalaqah } from '../useHalaqahScope'
import { TahfidzForm } from '../components/TahfidzForm'
import { fetchTahfidz } from '../api'
import type { TahfidzKindFilter, TahfidzQuality, TahfidzRecord, TahfidzFilters } from '../types'

const KIND_META: Record<string, { label: string; color: string }> = {
  ziyadah: { label: 'Ziyadah', color: 'green' },
  murojaah: { label: 'Murojaah', color: 'blue' },
}

const QUALITY_META: Record<TahfidzQuality, { label: string; color: string }> = {
  excellent: { label: 'Sangat Baik', color: 'green' },
  good: { label: 'Baik', color: 'blue' },
  needs_work: { label: 'Perlu Perbaikan', color: 'orange' },
}

/** Tab Setoran: catatan setoran hafalan santri — ziyadah & murojaah. */
export function SetoranTab({ active }: { active: boolean }) {
  const { open: openStudentDetail } = useStudentDetail()
  const { message } = App.useApp()
  const { canWrite: canWriteRole, canDelete: canDeleteRole } = usePermissions()
  const scope = useScopedHalaqah()
  // Scope musyrif: catatan dibatasi santri anggota kelompok guru tsb
  const scoped = scope.scoped
  const scopedGroups = scope.groups ?? []
  const [scopeGroupId, setScopeGroupId] = useState<string | undefined>(undefined)
  const activeGroupId = scoped ? (scopeGroupId ?? scopedGroups[0]?.id) : undefined

  const membersQuery = useHalaqahMembers(scoped ? activeGroupId : undefined)
  const memberStudentIds = useMemo(
    () => (membersQuery.data ?? []).map((m) => m.student_id),
    [membersQuery.data],
  )

  // Musyrif boleh menulis & menghapus setoran di kelompoknya sendiri
  const canWrite = canWriteRole || scoped
  const canDelete = canDeleteRole || scoped

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [kind, setKind] = useState<TahfidzKindFilter>('')
  const [quality, setQuality] = useState<TahfidzQuality | ''>('')
  const [range, setRange] = useState<[string | undefined, string | undefined]>([undefined, undefined])
  // Tabel server-paginated: total asli dari recordsQuery, di-override di prop Table.
  const pg = useTablePagination(0, { label: 'setoran' })

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
      studentIds: scoped ? memberStudentIds : undefined,
      page: pg.page,
      pageSize: pg.pageSize,
    }),
    [debouncedSearch, kind, quality, range, scoped, memberStudentIds, pg.page, pg.pageSize],
  )

  const recordsQuery = useTahfidz(filters)
  const statsQuery = useTahfidzStats(scoped ? memberStudentIds : undefined)
  const createMutation = useCreateTahfidz()
  const updateMutation = useUpdateTahfidz()
  const deleteMutation = useDeleteTahfidz()
  const stats = statsQuery.data

  const resetFilters = () => {
    setSearch('')
    setKind('')
    setQuality('')
    setRange([undefined, undefined])
    pg.setPage(1)
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

  // Aksi halaman di ujung kanan tab bar — pola sama dengan tab lain (judul & subtitle dirender shell)
  const tabActions = useTabActions(
    active,
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
      <Tooltip title="Ekspor data setoran (CSV)">
        <Button icon={<DownloadOutlined />} loading={exporting} onClick={handleExport} />
      </Tooltip>
      <Tooltip title="Palet shortcut (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Catat Setoran
        </Button>
      )}
    </Space>,
  )

  const handleTableChange: TableProps<TahfidzRecord>['onChange'] = (pagination) => {
    pg.setPage(pagination.current ?? 1)
    pg.setPageSize(pagination.pageSize ?? 10)
  }

  const columns: TableColumnsType<TahfidzRecord> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, row) => (
        <div>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 500 }}
            onClick={() => row.student && openStudentDetail(row.student.id)}
          >
            {row.student?.name ?? '-'}
          </Button>
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
      {tabActions}

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
            pg.setPage(1)
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
            pg.setPage(1)
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
            pg.setPage(1)
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
              pg.setPage(1)
            }}
            options={[
              { label: 'Semua', value: '' },
              { label: 'Ziyadah', value: 'ziyadah' },
              { label: 'Murojaah', value: 'murojaah' },
            ]}
          />
          {scoped && scopedGroups.length > 1 && (
            <Select
              placeholder="Kelompokku"
              style={{ minWidth: 190 }}
              value={activeGroupId}
              onChange={(v) => {
                setScopeGroupId(v)
                pg.setPage(1)
              }}
              options={scopedGroups.map((g) => ({
                value: g.id,
                label: g.name,
              }))}
            />
          )}
          <Input
            ref={searchRef}
            placeholder="Cari nama santri"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pg.setPage(1)
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
              pg.setPage(1)
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
              pg.setPage(1)
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
                description={
                  scoped && memberStudentIds.length === 0
                    ? 'Kelompokmu belum punya anggota santri.'
                    : hasActiveFilters
                      ? 'Tidak ada setoran yang cocok dengan filter'
                      : 'Belum ada setoran hafalan'
                }
              />
            ),
          }}
          pagination={{ ...pg.pagination, total: recordsQuery.data?.total ?? 0 }}
          scroll={{ x: true }}
        />
      </Card>

      <TahfidzForm
        open={formOpen}
        record={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        studentOptions={
          scoped
            ? (membersQuery.data ?? []).map((m) => ({
                value: m.student_id,
                label: `${m.students?.name ?? '?'} (${m.students?.registration_code ?? '-'})`,
              }))
            : undefined
        }
        defaultTeacherId={scope.myTeacherId ?? undefined}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
