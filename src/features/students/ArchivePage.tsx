import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tooltip,
  theme,
  type TableProps,
} from 'antd'
import {
  CheckSquareOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hardDeleteErrorMessage } from '../../shared/api/crud'
import { ActionBar } from '../../shared/components/ActionBar'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { SortIcon } from '../../shared/components/SortIcon'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { columnSortOrder, sortByFromTableChange } from '../../shared/utils/tableSort'
import { ArchiveExport } from './components/ArchiveExport'
import { DetailDrawer } from './components/DetailDrawer'
import {
  useArchivedStudents,
  useBulkRestoreStudents,
  useClassesBrief,
  useHardDeleteStudent,
  useHardDeleteStudentsBulk,
  useRestoreStudent,
} from './hooks'
import type { Student } from './types'

type ArchiveSort = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc'

/** Preset rentang tanggal penghapusan */
type RangeKey = 'all' | '7d' | '30d' | 'old30'

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: 'all', label: 'Semua periode' },
  { value: '7d', label: '7 hari terakhir' },
  { value: '30d', label: '30 hari terakhir' },
  { value: 'old30', label: 'Lebih dari 30 hari' },
]

const RANGE_LABEL: Record<RangeKey, string> = {
  all: 'Semua periode',
  '7d': '7 hari terakhir',
  '30d': '30 hari terakhir',
  old30: 'Lebih dari 30 hari',
}

// Pasangan [asc, desc] per kolom — dipakai header tabel dan onChange sorter
const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  deleted_at: ['date_asc', 'date_desc'],
} as const

function matchesRange(deletedAt: string | null, range: RangeKey): boolean {
  if (range === 'all' || !deletedAt) return true
  const d = dayjs(deletedAt)
  if (range === '7d') return d.isAfter(dayjs().subtract(7, 'day'))
  if (range === '30d') return d.isAfter(dayjs().subtract(30, 'day'))
  return d.isBefore(dayjs().subtract(30, 'day'))
}

/** Lama hari sejak dihapus (dibulatkan ke bawah, min 0 untuk data bertanggal masa depan) */
function archiveDays(deletedAt: string | null): number | null {
  if (!deletedAt) return null
  return Math.max(0, Math.floor(dayjs().diff(dayjs(deletedAt), 'day', true)))
}

/** Daftar siswa yang sudah di-soft delete + aksi pulihkan & hapus permanen */
export function ArchivePage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState<string | undefined>(undefined)
  const [range, setRange] = useState<RangeKey>('all')
  const [sortBy, setSortBy] = useState<ArchiveSort>('date_desc')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [detail, setDetail] = useState<Student | null>(null)
  const [exportOpen, setExportOpen] = useState(false)

  const debouncedSearch = useDebounce(search)
  const archivedQuery = useArchivedStudents()
  const classesQuery = useClassesBrief()
  const archived = archivedQuery.data ?? []

  const restoreMutation = useRestoreStudent()
  const bulkRestoreMutation = useBulkRestoreStudents()
  const hardDeleteMutation = useHardDeleteStudent()
  const bulkHardDeleteMutation = useHardDeleteStudentsBulk()

  const classOptions = useMemo(
    () => (classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [classesQuery.data],
  )
  const classNameOf = (id: string | undefined) =>
    (classesQuery.data ?? []).find((c) => c.id === id)?.name

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = archived.filter((s) => {
      if (
        q &&
        !`${s.name} ${s.registration_code} ${s.nisn ?? ''} ${s.classes?.name ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (classId && s.class_id !== classId) return false
      return matchesRange(s.deleted_at, range)
    })

    const cmpName = (a: Student, b: Student) => a.name.localeCompare(b.name, 'id')
    const cmpDeleted = (a: Student, b: Student) =>
      (b.deleted_at ?? '').localeCompare(a.deleted_at ?? '') || cmpName(a, b)

    const comparators: Record<ArchiveSort, (a: Student, b: Student) => number> = {
      date_desc: cmpDeleted,
      date_asc: (a, b) => cmpDeleted(b, a),
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
    }
    return [...data].sort(comparators[sortBy])
  }, [archived, debouncedSearch, classId, range, sortBy])

  // Statistik retensi dihitung dari seluruh arsip, bukan hanya baris yang tampil
  const recent7Count = useMemo(
    () => archived.filter((s) => s.deleted_at && matchesRange(s.deleted_at, '7d')).length,
    [archived],
  )
  const old30 = useMemo(
    () => archived.filter((s) => s.deleted_at && matchesRange(s.deleted_at, 'old30')),
    [archived],
  )

  const pg = useTablePagination(rows.length, { defaultPageSize: 10, showSizeChanger: false, hideOnSinglePage: true })

  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )
  const resetPage = pg.reset

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))
  const toggleSelectAll = () => {
    setSelectedIds(allFilteredSelected ? [] : rows.map((r) => r.id))
  }
  const selectedRows = useMemo(
    () => archived.filter((s) => selectedIdSet.has(s.id)),
    [archived, selectedIdSet],
  )

  const clearAllFilters = () => {
    setSearch('')
    setClassId(undefined)
    setRange('all')
    setSortBy('date_desc')
    setSelectedIds([])
    resetPage()
  }

  const handleTableChange: TableProps<Student>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS) ?? 'date_desc')
    resetPage()
  }

  // Chip filter aktif — bisa dihapus satu per satu
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    if (debouncedSearch.trim())
      chips.push({
        key: 'search',
        label: `Cari: "${debouncedSearch.trim()}"`,
        onClear: () => {
          setSearch('')
          resetPage()
        },
      })
    if (classId)
      chips.push({
        key: 'class',
        label: `Kelas: ${classNameOf(classId) ?? classId}`,
        onClear: () => {
          setClassId(undefined)
          resetPage()
        },
      })
    if (range !== 'all')
      chips.push({
        key: 'range',
        label: `Dihapus: ${RANGE_LABEL[range]}`,
        onClear: () => {
          setRange('all')
          resetPage()
        },
      })
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, classId, range, classesQuery.data])

  const handleRestore = (student: Student) => {
    restoreMutation.mutate(student.id, {
      onSuccess: () => message.success(`${student.name} dipulihkan`),
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan siswa'),
    })
  }

  const handleHardDelete = (student: Student) => {
    hardDeleteMutation.mutate(student.id, {
      onSuccess: () => message.success(`${student.name} dihapus permanen`),
      onError: (err: unknown) => message.error(hardDeleteErrorMessage(err)),
    })
  }

  const bulkRestore = () =>
    bulkRestoreMutation.mutate(selectedIds, {
      onSuccess: () => {
        message.success(`${selectedIds.length} siswa dipulihkan`)
        setSelectedIds([])
      },
      onError: (err: Error) => message.error(err.message || 'Gagal memulihkan siswa'),
    })

  const bulkHardDelete = (ids: string[]) =>
    bulkHardDeleteMutation.mutate(ids, {
      onSuccess: () => {
        message.success(`${ids.length} siswa dihapus permanen`)
        setSelectedIds([])
      },
      onError: (err: unknown) => message.error(hardDeleteErrorMessage(err)),
    })

  // Aksi halaman di ujung kanan tab bar — pola AlumniPage: ikon utilitas dulu
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang">
        <Button icon={<ReloadOutlined spin={archivedQuery.isFetching} />} onClick={() => void archivedQuery.refetch()} />
      </Tooltip>
      <Tooltip title="Ekspor arsip">
        <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)} />
      </Tooltip>
    </Space>,
  )

  // antd memanggil sortIcon sebagai fungsi biasa, jadi komponennya dibungkus
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <SortIcon sortOrder={sortOrder} />
  )

  const columns: TableProps<Student>['columns'] = [
    {
      title: 'Santri',
      key: 'name',
      sorter: true,
      sortOrder: columnSortOrder(sortBy, 'name', SORT_PAIRS),
      sortIcon,
      render: (_, row) => (
        <div>
          <Button
            type="link"
            onClick={() => setDetail(row)}
            style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 13.5 }}
          >
            {row.name}
          </Button>
          <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.registration_code}</div>
        </div>
      ),
    },
    {
      title: 'Kelas',
      key: 'class',
      render: (_, row) => row.classes?.name || '-',
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      // Semua baris di arsip adalah soft-deleted — status aslinya tak relevan
      render: () => <StatusTag color="default">Terarsip</StatusTag>,
    },
    {
      title: 'Dihapus',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      width: 170,
      sorter: true,
      sortOrder: columnSortOrder(sortBy, 'deleted_at', SORT_PAIRS),
      sortIcon,
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : '-'),
    },
    {
      title: 'Lama Arsip',
      key: 'age',
      width: 110,
      render: (_, row) => {
        const days = archiveDays(row.deleted_at)
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: token.colorTextSecondary }}>
            {days == null ? '-' : `${days} hari`}
          </span>
        )
      },
    },
    {
      title: '',
      key: 'action',
      width: 150,
      align: 'right',
      render: (_, row) => (
        <Space size={4}>
          <Popconfirm
            title="Pulihkan siswa ini?"
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
              title="Hapus permanen siswa ini?"
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
                aria-label={`Hapus permanen ${row.name}`}
                loading={hardDeleteMutation.isPending && hardDeleteMutation.variables === row.id}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* Judul & subtitle dirender shell StudentsPage; aksi halaman di ujung kanan tab bar */}
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<InboxOutlined />}
          label="Total Terarsip"
          value={archived.length}
          color="indigo"
          loading={archivedQuery.isPending}
        />
        <StatChip
          icon={<ClockCircleOutlined />}
          label="Dihapus 7 Hari Terakhir"
          value={recent7Count}
          color="sky"
          loading={archivedQuery.isPending}
          hideIfZero
          active={range === '7d'}
          onClick={() => {
            setRange(range === '7d' ? 'all' : '7d')
            resetPage()
          }}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Lebih dari 30 Hari"
          value={old30.length}
          color="amber"
          loading={archivedQuery.isPending}
          hideIfZero
          active={range === 'old30'}
          onClick={() => {
            setRange(range === 'old30' ? 'all' : 'old30')
            resetPage()
          }}
        />
      </div>

      {archivedQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12, borderRadius: 10 }}
          message="Gagal memuat arsip siswa"
          description={
            <Space direction="vertical" size={4}>
              <span>{archivedQuery.error.message}</span>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void archivedQuery.refetch()}>
                Coba lagi
              </Button>
            </Space>
          }
        />
      )}

      {!archivedQuery.isError && old30.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12, borderRadius: 10 }}
          message={`${old30.length} siswa terarsip lebih dari 30 hari`}
          description="Semakin lama di arsip, data semakin mudah terlewat. Pulihkan siswa yang masih dibutuhkan, atau hapus permanen bila datanya sudah tidak dipakai lagi."
          action={
            <Space>
              <Button
                size="small"
                onClick={() => {
                  setRange('old30')
                  resetPage()
                }}
              >
                Tampilkan
              </Button>
              {canDelete && (
                <Popconfirm
                  title={`Hapus permanen ${old30.length} siswa?`}
                  description="Semua siswa yang terarsip lebih dari 30 hari akan dihapus permanen dari database dan tidak bisa dipulihkan lagi."
                  okText="Ya, Hapus Permanen"
                  okButtonProps={{ danger: true, loading: bulkHardDeleteMutation.isPending }}
                  cancelText="Batal"
                  onConfirm={() => bulkHardDelete(old30.map((s) => s.id))}
                >
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    Hapus Permanen
                  </Button>
                </Popconfirm>
              )}
            </Space>
          }
        />
      )}

      <Card>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: `1px dashed ${token.colorBorderSecondary}`,
          }}
        >
          <Input
            placeholder="Cari nama / kode / NISN"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            style={{ flex: '1 1 200px', minWidth: 180, maxWidth: 360 }}
          />
          <Select
            placeholder="Kelas"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 160 }}
            value={classId}
            options={classOptions}
            onChange={(v) => {
              setClassId(v)
              resetPage()
            }}
          />
          <Select
            placeholder="Periode dihapus"
            style={{ minWidth: 180 }}
            value={range}
            options={RANGE_OPTIONS}
            onChange={(v) => {
              setRange(v as RangeKey)
              resetPage()
            }}
          />
          {canWrite && (
            <Tooltip title="Pilih semua hasil filter / batal">
              <Button
                icon={<CheckSquareOutlined />}
                type={allFilteredSelected ? 'primary' : 'default'}
                onClick={toggleSelectAll}
              >
                {selectedIds.length > 0 ? `${selectedIds.length} Terpilih` : 'Pilih'}
              </Button>
            </Tooltip>
          )}
          {(search || classId || range !== 'all' || sortBy !== 'date_desc') && (
            <Button icon={<CloseOutlined />} onClick={clearAllFilters}>
              Reset
            </Button>
          )}
        </div>

        <FilterChips chips={filterChips} />

        <Table<Student>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={archivedQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          scroll={{ x: 'max-content' }}
          pagination={pg.pagination}
          rowSelection={
            canWrite
              ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as string[]),
                }
              : undefined
          }
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  archived.length > 0 ? (
                    'Tidak ada siswa yang cocok dengan filter'
                  ) : (
                    <div>
                      <div>Belum ada siswa di arsip</div>
                      <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
                        Santri yang dihapus dari tab Santri Aktif akan muncul di sini
                      </div>
                    </div>
                  )
                }
              />
            ),
          }}
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
              title: `Pulihkan ${selectedIds.length} siswa terpilih?`,
              description: 'Semua data siswa terpilih akan aktif kembali.',
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
              title: `Hapus permanen ${selectedIds.length} siswa terpilih?`,
              description:
                'Semua data siswa terpilih akan dihapus permanen dari database dan tidak bisa dipulihkan lagi.',
              okText: 'Ya, Hapus Permanen',
            },
            onClick: () => bulkHardDelete(selectedIds),
          },
        ]}
      />

      <DetailDrawer
        open={!!detail}
        student={detail}
        onClose={() => setDetail(null)}
        notice={
          detail?.deleted_at ? (
            <Alert
              type="warning"
              showIcon
              style={{ borderRadius: 0, paddingInline: 24 }}
              message={`Terarsip sejak ${dayjs(detail.deleted_at).format('DD MMM YYYY HH:mm')} (${archiveDays(detail.deleted_at)} hari)`}
              description="Data siswa ini sedang diarsipkan. Pulihkan dulu bila ingin mengubah datanya."
            />
          ) : undefined
        }
      />

      <ArchiveExport
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filteredRows={rows}
        selectedRows={selectedRows}
      />
    </div>
  )
}
