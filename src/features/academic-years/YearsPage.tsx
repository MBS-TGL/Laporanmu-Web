import { useMemo, useRef, useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type InputRef,
  type TableColumnsType,
  type TableProps,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { TableSortIcon } from '../../shared/components/TableSortIcon'
import { columnSortOrder, sortByFromTableChange } from '../../shared/utils/tableSort'
import { Kbd, ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePermissions } from '../../shared/hooks/useProfile'
import { supabase } from '../../lib/supabase'
import {
  useAcademicYears,
  useCreateAcademicYear,
  useDeleteAcademicYear,
  useSetActiveAcademicYear,
  useUpdateAcademicYear,
} from './hooks'
import { YearForm } from './components/YearForm'
import type { AcademicYear, YearFormValues } from './types'

type YearSort = 'name_asc' | 'name_desc' | 'start_desc' | 'start_asc' | 'end_desc' | 'end_asc'

const SORT_OPTIONS: { value: YearSort; label: string }[] = [
  { value: 'name_desc', label: 'Nama Z–A' },
  { value: 'name_asc', label: 'Nama A–Z' },
  { value: 'start_desc', label: 'Mulai terbaru' },
  { value: 'start_asc', label: 'Mulai terlama' },
  { value: 'end_desc', label: 'Selesai terbaru' },
  { value: 'end_asc', label: 'Selesai terlama' },
]

const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  start_date: ['start_asc', 'start_desc'],
  end_date: ['end_asc', 'end_desc'],
} as const

const CURRICULUM_OPTIONS = [
  { value: 'Merdeka', label: 'Merdeka' },
  { value: 'K-13', label: 'K-13' },
]

export function YearsPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [curriculum, setCurriculum] = useState<string | undefined>()
  const [onlyActive, setOnlyActive] = useState(false)
  const [onlyLocked, setOnlyLocked] = useState(false)
  const [sortBy, setSortBy] = useState<YearSort | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicYear | null>(null)

  const searchInputRef = useRef<InputRef>(null)

  // Pola StudentsPage: fetch sekali (belasan periode), filter+sort di memori
  const yearsQuery = useAcademicYears({ page: 1, pageSize: 1000 })
  const createMutation = useCreateAcademicYear()
  const updateMutation = useUpdateAcademicYear()
  const deleteMutation = useDeleteAcademicYear()
  const setActiveMutation = useSetActiveAcademicYear()

  // Jumlah kelas per tahun akademik — untuk kolom "Dipakai" + proteksi hapus
  const classCountsQuery = useQuery({
    queryKey: ['classes', 'count-by-year'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('academic_year_id')
        .is('deleted_at', null)
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of (data ?? []) as { academic_year_id: string | null }[]) {
        if (row.academic_year_id) counts.set(row.academic_year_id, (counts.get(row.academic_year_id) ?? 0) + 1)
      }
      return counts
    },
  })
  const classCounts = classCountsQuery.data ?? new Map<string, number>()

  const allYears = useMemo(() => yearsQuery.data?.data ?? [], [yearsQuery.data])

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = allYears.filter((y) => {
      if (q && !`${y.name} ${y.curriculum ?? ''} ${y.semester ?? ''}`.toLowerCase().includes(q))
        return false
      if (curriculum && (y.curriculum ?? '') !== curriculum) return false
      if (onlyActive && !y.is_active) return false
      if (onlyLocked && !y.is_locked) return false
      return true
    })

    const cmpName = (a: AcademicYear, b: AcademicYear) => b.name.localeCompare(a.name, 'id')
    const cmpStart = (a: AcademicYear, b: AcademicYear) =>
      (b.start_date ?? '').localeCompare(a.start_date ?? '') || cmpName(a, b)
    const cmpEnd = (a: AcademicYear, b: AcademicYear) =>
      (b.end_date ?? '').localeCompare(a.end_date ?? '') || cmpName(a, b)

    const comparators: Record<YearSort, (a: AcademicYear, b: AcademicYear) => number> = {
      name_asc: (a, b) => cmpName(b, a),
      name_desc: cmpName,
      start_asc: (a, b) => cmpStart(b, a),
      start_desc: cmpStart,
      end_asc: (a, b) => cmpEnd(b, a),
      end_desc: cmpEnd,
    }
    return [...data].sort(comparators[sortBy ?? 'name_desc'])
  }, [allYears, debouncedSearch, curriculum, onlyActive, onlyLocked, sortBy])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetPage = () => setPage(1)

  const clearAllFilters = () => {
    setSearch('')
    setCurriculum(undefined)
    setOnlyActive(false)
    setOnlyLocked(false)
    setSortBy(undefined)
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
    if (curriculum)
      chips.push({
        key: 'curriculum',
        label: `Kurikulum: ${curriculum}`,
        onClear: () => {
          setCurriculum(undefined)
          resetPage()
        },
      })
    if (onlyActive)
      chips.push({
        key: 'onlyActive',
        label: 'Hanya aktif',
        onClear: () => {
          setOnlyActive(false)
          resetPage()
        },
      })
    if (onlyLocked)
      chips.push({
        key: 'onlyLocked',
        label: 'Hanya terkunci',
        onClear: () => {
          setOnlyLocked(false)
          resetPage()
        },
      })
    if (sortBy)
      chips.push({
        key: 'sort',
        label: `Urut: ${SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? sortBy}`,
        onClear: () => {
          setSortBy(undefined)
          resetPage()
        },
      })
    return chips
  }, [debouncedSearch, curriculum, onlyActive, onlyLocked, sortBy])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (year: AcademicYear) => {
    setEditing(year)
    setFormOpen(true)
  }

  const handleSubmit = (values: YearFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan tahun akademik')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Tahun akademik diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Tahun akademik ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (year: AcademicYear) => {
    const used = classCounts.get(year.id) ?? 0
    if (used > 0) {
      modal.warning({
        title: 'Tahun akademik masih dipakai',
        content: `"${year.name}" masih terikat ${used} kelas. Arsipkan atau pindahkan kelasnya dulu sebelum menghapus.`,
        okText: 'Mengerti',
      })
      return
    }
    modal.confirm({
      title: `Hapus "${year.name}"?`,
      content: 'Data akan ditandai terhapus (soft delete).',
      okText: 'Hapus',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () =>
        deleteMutation
          .mutateAsync(year.id)
          .then(() => message.success('Tahun akademik dihapus'))
          .catch((err: Error) => message.error(err.message || 'Gagal menghapus')),
    })
  }

  const handleSetActive = (id: string) => {
    setActiveMutation.mutate(id, {
      onSuccess: () => message.success('Tahun akademik diaktifkan'),
      onError: (err: Error) => message.error(err.message || 'Gagal mengaktifkan'),
    })
  }

  const isBlocked = formOpen

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['Ctrl', 'K'],
      label: 'Fokus ke search',
      group: 'Navigasi',
      icon: <SearchOutlined />,
      run: () => searchInputRef.current?.focus(),
    },
    {
      keys: ['Ctrl', 'F'],
      label: 'Toggle filter lanjutan',
      group: 'Navigasi',
      icon: <SlidersOutlined />,
      run: () => setShowAdvanced((v) => !v),
    },
    {
      keys: ['Esc'],
      label: 'Tutup / clear',
      group: 'Navigasi',
      icon: <CloseOutlined />,
      run: clearAllFilters,
    },
    {
      keys: ['N'],
      label: 'Tambah periode baru',
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
      run: () => void yearsQuery.refetch(),
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

  const headerMenu = {
    items: [
      {
        key: 'refresh',
        icon: <ReloadOutlined />,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              <div style={{ fontWeight: 600 }}>Muat Ulang</div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>Segarkan daftar periode</div>
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
              <Kbd>R</Kbd>
            </span>
          </div>
        ),
        onClick: () => void yearsQuery.refetch(),
      },
    ],
  }

  const handleTableChange: TableProps<AcademicYear>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS))
    resetPage()
  }

  // Ikon sorter gaya Esceha.id — template di shared/components/TableSortIcon.
  // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
  // harus dirender sebagai elemen agar hooks-nya legal.
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <TableSortIcon sortOrder={sortOrder} />
  )

  const fmtDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : '-'

  const columns: TableColumnsType<AcademicYear> = [
    {
      title: 'Nama',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'name', SORT_PAIRS),
      render: (_, row) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{row.name}</span>
          {row.is_active && (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ borderRadius: 6 }}>
              Aktif
            </Tag>
          )}
          {row.is_locked && (
            <Tag color="default" icon={<LockOutlined />} style={{ borderRadius: 6 }}>
              Terkunci
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      width: 110,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Periode',
      key: 'period',
      width: 230,
      responsive: ['md'],
      render: (_, row) => `${fmtDate(row.start_date)} — ${fmtDate(row.end_date)}`,
    },
    {
      title: 'Mulai',
      dataIndex: 'start_date',
      key: 'start_date',
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'start_date', SORT_PAIRS),
      responsive: ['lg'],
      render: fmtDate,
    },
    {
      title: 'Selesai',
      dataIndex: 'end_date',
      key: 'end_date',
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'end_date', SORT_PAIRS),
      responsive: ['lg'],
      render: fmtDate,
    },
    {
      title: 'Kurikulum',
      dataIndex: 'curriculum',
      key: 'curriculum',
      responsive: ['lg'],
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Dipakai',
      key: 'used',
      width: 100,
      responsive: ['md'],
      render: (_, row) => {
        const used = classCounts.get(row.id) ?? 0
        return used > 0 ? (
          <Tooltip title={`${used} kelas terikat ke periode ini`}>
            <Tag color="processing">{used} kelas</Tag>
          </Tooltip>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size={0}>
            {canWrite && !row.is_active && !row.is_locked && (
              <Popconfirm
                title={`Jadikan "${row.name}" sebagai periode aktif?`}
                onConfirm={() => handleSetActive(row.id)}
                okText="Aktifkan"
                cancelText="Batal"
              >
                <Tooltip title="Set sebagai periode aktif">
                  <Button type="text" icon={<CheckCircleOutlined />} loading={setActiveMutation.isPending && setActiveMutation.variables === row.id} />
                </Tooltip>
              </Popconfirm>
            )}
            {canWrite && (
              <Tooltip title="Edit">
                <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Hapus">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(row)}
                />
              </Tooltip>
            )}
          </Space>
        ) : (
          <span style={{ color: token.colorTextQuaternary }}>—</span>
        ),
    },
  ]

  const activeCount = allYears.filter((y) => y.is_active).length
  const lockedCount = allYears.filter((y) => y.is_locked).length

  return (
    <div>
      <PageHeader
        title="Tahun Akademik"
        subtitle="Periode semester dan kalender akademik"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<ReloadOutlined spin={yearsQuery.isFetching} />} onClick={() => void yearsQuery.refetch()} />
            </Tooltip>
            <Dropdown menu={headerMenu} trigger={['click']} placement="bottomRight" overlayStyle={{ minWidth: 220 }}>
              <Tooltip title="Menu lainnya">
                <Button icon={<MoreOutlined />} />
              </Tooltip>
            </Dropdown>
            <Tooltip title="Shortcut keyboard (?)">
              <Button icon={<KeyOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<SlidersOutlined />}
          label="Total Periode"
          value={allYears.length}
          color="indigo"
          loading={yearsQuery.isPending}
          onClick={() => {
            setOnlyActive(false)
            setOnlyLocked(false)
            resetPage()
          }}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Aktif"
          value={activeCount}
          color="emerald"
          loading={yearsQuery.isPending}
          active={onlyActive}
          onClick={() => {
            setOnlyActive((v) => !v)
            setOnlyLocked(false)
            resetPage()
          }}
        />
        <StatChip
          icon={<LockOutlined />}
          label="Terkunci"
          value={lockedCount}
          color="rose"
          loading={yearsQuery.isPending}
          active={onlyLocked}
          onClick={() => {
            setOnlyLocked((v) => !v)
            setOnlyActive(false)
            resetPage()
          }}
        />
      </div>

      <Card>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 14,
            paddingBottom: 14,
            borderBottom: `1px dashed ${token.colorBorderSecondary}`,
          }}
        >
          <Input
            ref={searchInputRef}
            placeholder="Cari nama periode / kurikulum…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          <Badge count={onlyActive || onlyLocked ? 1 : 0} size="small" offset={[-6, 6]}>
            <Button
              icon={<SlidersOutlined />}
              type={showAdvanced ? 'primary' : 'default'}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              Lainnya
            </Button>
          </Badge>
        </div>

        {showAdvanced && (
          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <Space wrap size="middle">
              <Select
                placeholder="Kurikulum"
                allowClear
                style={{ minWidth: 150 }}
                value={curriculum}
                onChange={(v) => {
                  setCurriculum(v)
                  resetPage()
                }}
                options={CURRICULUM_OPTIONS}
              />
              <Select
                placeholder="Urutkan"
                allowClear
                style={{ minWidth: 180 }}
                value={sortBy}
                onChange={(v) => {
                  setSortBy(v)
                  resetPage()
                }}
                options={SORT_OPTIONS}
              />
              <Button icon={<CloseOutlined />} onClick={clearAllFilters}>
                Reset semua
              </Button>
            </Space>
          </div>
        )}

        <FilterChips chips={filterChips} marginTop={showAdvanced ? 0 : 12} />

        <Table<AcademicYear>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={yearsQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  allYears.length > 0
                    ? 'Tidak ada periode yang cocok dengan filter'
                    : 'Belum ada tahun akademik — tambahkan periode pertama'
                }
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} periode`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <YearForm
        open={formOpen}
        year={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
