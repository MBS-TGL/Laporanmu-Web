import { useMemo, useRef, useState } from 'react'
import {
  Alert,
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
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  IdcardOutlined,
  KeyOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { BulkActionBar } from '../../shared/components/BulkActionBar'
import { TableSortIcon } from '../../shared/components/TableSortIcon'
import { columnSortOrder, sortByFromTableChange } from '../../shared/utils/tableSort'
import { Kbd, ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useAcademicYearsBrief,
  useBulkDeleteClasses,
  useClassGenderCounts,
  useClasses,
  useCreateClass,
  useDeleteClass,
  useSetClassesHomeroomBulk,
  useUpdateClass,
} from './hooks'
import { ClassForm } from './components/ClassForm'
import { ClassDrawer } from './components/ClassDrawer'
import { ExportModal } from './components/ExportModal'
import { BulkHomeroomModal } from './components/BulkHomeroomModal'
import type { ClassFormValues, ClassRow } from './types'

type ClassSort = 'name_asc' | 'name_desc' | 'grade_asc' | 'grade_desc' | 'count_desc' | 'count_asc'

const SORT_OPTIONS: { value: ClassSort; label: string }[] = [
  { value: 'name_asc', label: 'Nama A–Z' },
  { value: 'name_desc', label: 'Nama Z–A' },
  { value: 'grade_asc', label: 'Tingkat rendah–tinggi' },
  { value: 'grade_desc', label: 'Tingkat tinggi–rendah' },
  { value: 'count_desc', label: 'Siswa terbanyak' },
  { value: 'count_asc', label: 'Siswa tersedikit' },
]

const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  grade: ['grade_asc', 'grade_desc'],
  count: ['count_asc', 'count_desc'],
} as const

export function ClassesPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [academicYearId, setAcademicYearId] = useState<string | undefined>()
  const [grade, setGrade] = useState<string | undefined>()
  const [noHomeroom, setNoHomeroom] = useState(false)
  const [emptyClass, setEmptyClass] = useState(false)
  const [sortBy, setSortBy] = useState<ClassSort | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [detail, setDetail] = useState<ClassRow | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [homeroomOpen, setHomeroomOpen] = useState(false)

  const searchInputRef = useRef<InputRef>(null)

  const yearsQuery = useAcademicYearsBrief()
  const genderCountsQuery = useClassGenderCounts()

  const countsMap = useMemo(
    () => genderCountsQuery.data ?? new Map<string, { total: number; male: number; female: number }>(),
    [genderCountsQuery.data],
  )

  // Pola StudentsPage: fetch sekali (kelas belasan), filter+sort di memori
  const classesQuery = useClasses({ page: 1, pageSize: 1000 })
  const createMutation = useCreateClass()
  const updateMutation = useUpdateClass()
  const deleteMutation = useDeleteClass()
  const bulkDeleteMutation = useBulkDeleteClasses()
  const homeroomBulkMutation = useSetClassesHomeroomBulk()

  const allClasses = useMemo(() => classesQuery.data?.data ?? [], [classesQuery.data])
  const totalAll = classesQuery.data?.total ?? 0
  const isTruncated = totalAll > allClasses.length

  const gradeOptions = useMemo(
    () =>
      [...new Set(allClasses.map((c) => c.grade).filter((g): g is string => !!g))]
        .sort((a, b) => a.localeCompare(b, 'id', { numeric: true }))
        .map((g) => ({ value: g, label: g })),
    [allClasses],
  )

  const countOf = (row: ClassRow) => countsMap.get(row.id)?.total ?? 0

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = allClasses.filter((c) => {
      if (q && !`${c.name} ${c.homeroom_teacher?.name ?? ''} ${c.major ?? ''}`.toLowerCase().includes(q))
        return false
      if (academicYearId && c.academic_year_id !== academicYearId) return false
      if (grade && c.grade !== grade) return false
      if (noHomeroom && c.homeroom_teacher_id) return false
      if (emptyClass && countOf(c) > 0) return false
      return true
    })

    const cmpName = (a: ClassRow, b: ClassRow) => a.name.localeCompare(b.name, 'id')
    const cmpGrade = (a: ClassRow, b: ClassRow) =>
      (a.grade ?? '').localeCompare(b.grade ?? '', 'id', { numeric: true }) || cmpName(a, b)

    const comparators: Record<ClassSort, (a: ClassRow, b: ClassRow) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      grade_asc: cmpGrade,
      grade_desc: (a, b) => cmpGrade(b, a),
      count_desc: (a, b) => countOf(b) - countOf(a) || cmpName(a, b),
      count_asc: (a, b) => countOf(a) - countOf(b) || cmpName(a, b),
    }
    return [...data].sort(comparators[sortBy ?? 'name_asc'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClasses, debouncedSearch, academicYearId, grade, noHomeroom, emptyClass, sortBy, countsMap])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetPage = () => setPage(1)

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))

  // Select-all lintas halaman: operasi atas semua hasil filter (pola StudentsPage)
  const toggleSelectAll = () => {
    const filteredIds = rows.map((r) => r.id)
    const everySelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id))
    setSelectedIds(
      everySelected
        ? selectedIds.filter((id) => !filteredIds.includes(id))
        : Array.from(new Set([...selectedIds, ...filteredIds])),
    )
  }

  const clearAllFilters = () => {
    setSearch('')
    setAcademicYearId(undefined)
    setGrade(undefined)
    setNoHomeroom(false)
    setEmptyClass(false)
    setSortBy(undefined)
    setSelectedIds([])
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
    if (academicYearId) {
      const name = yearsQuery.data?.find((y) => y.id === academicYearId)?.name
      chips.push({
        key: 'year',
        label: `TA: ${name ?? academicYearId}`,
        onClear: () => {
          setAcademicYearId(undefined)
          resetPage()
        },
      })
    }
    if (grade)
      chips.push({
        key: 'grade',
        label: `Tingkat: ${grade}`,
        onClear: () => {
          setGrade(undefined)
          resetPage()
        },
      })
    if (noHomeroom)
      chips.push({
        key: 'noHomeroom',
        label: 'Tanpa wali kelas',
        onClear: () => {
          setNoHomeroom(false)
          resetPage()
        },
      })
    if (emptyClass)
      chips.push({
        key: 'emptyClass',
        label: 'Kelas kosong',
        onClear: () => {
          setEmptyClass(false)
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
  }, [debouncedSearch, academicYearId, grade, noHomeroom, emptyClass, sortBy, yearsQuery.data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (cls: ClassRow) => {
    setEditing(cls)
    setFormOpen(true)
  }

  const handleSubmit = (values: ClassFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan kelas')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Kelas diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Kelas ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        message.success('Kelas dihapus')
        setSelectedIds((prev) => prev.filter((sid) => sid !== id))
        setDetail((current) => (current?.id === id ? null : current))
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus kelas'),
    })
  }

  const confirmBulkArchive = () => {
    const ids = selectedIds
    const blocked = allClasses.filter((c) => ids.includes(c.id) && countOf(c) > 0)
    if (blocked.length > 0) {
      modal.warning({
        title: 'Ada kelas yang masih berisi santri',
        content: `Tidak bisa diarsipkan: ${blocked.map((c) => c.name).join(', ')}. Pindahkan santrinya dulu atau hapus dari kelas.`,
        okText: 'Mengerti',
      })
      return
    }
    modal.confirm({
      title: `Arsipkan ${ids.length} kelas terpilih?`,
      content: 'Data akan ditandai terhapus (soft delete).',
      okText: 'Arsipkan',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () =>
        bulkDeleteMutation
          .mutateAsync(ids)
          .then(() => {
            setSelectedIds([])
            message.success(`${ids.length} kelas diarsipkan`)
          })
          .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan kelas')),
    })
  }

  const handleBulkHomeroom = (teacherId: string | null) => {
    const ids = selectedIds
    homeroomBulkMutation.mutate(
      { ids, teacherId },
      {
        onSuccess: () => {
          message.success(
            teacherId
              ? `Wali kelas diterapkan ke ${ids.length} kelas`
              : `Wali kelas dihapus dari ${ids.length} kelas`,
          )
          setHomeroomOpen(false)
          setSelectedIds([])
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan wali kelas'),
      },
    )
  }

  const openExport = (scope: 'filtered' | 'selected') => {
    setExportScope(scope)
    setExportOpen(true)
  }

  const isRefreshing = classesQuery.isFetching || genderCountsQuery.isFetching
  const isBlocked = formOpen || detail !== null || exportOpen || homeroomOpen

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
      label: 'Tutup / clear / deselect',
      group: 'Navigasi',
      icon: <CloseOutlined />,
      run: clearAllFilters,
    },
    {
      keys: ['N'],
      label: 'Tambah kelas baru',
      group: 'Aksi',
      icon: <PlusOutlined />,
      when: canWrite,
      run: openCreate,
    },
    {
      keys: ['Ctrl', 'A'],
      label: 'Pilih semua / deselect',
      group: 'Aksi',
      icon: <CheckSquareOutlined />,
      run: toggleSelectAll,
    },
    {
      keys: ['Ctrl', 'E'],
      label: 'Export data',
      group: 'Aksi',
      icon: <ExportOutlined />,
      run: () => openExport(selectedIds.length > 0 ? 'selected' : 'filtered'),
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <ReloadOutlined />,
      run: () => {
        void classesQuery.refetch()
        void genderCountsQuery.refetch()
      },
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
        key: 'export',
        icon: <ExportOutlined />,
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              <div style={{ fontWeight: 600 }}>Export Data</div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>Excel / CSV — hasil filter atau terpilih</div>
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
              <Kbd>Ctrl</Kbd>
              <Kbd>E</Kbd>
            </span>
          </div>
        ),
        onClick: () => openExport(selectedIds.length > 0 ? 'selected' : 'filtered'),
      },
    ],
  }

  const handleTableChange: TableProps<ClassRow>['onChange'] = (_pagination, _filters, sorter, extra) => {
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

  const columns: TableColumnsType<ClassRow> = [
    {
      title: 'Kelas',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'name', SORT_PAIRS),
      render: (_, row) => (
        <div>
          <Space size={4}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
              onClick={() => setDetail(row)}
            >
              {row.name}
            </Button>
            {!row.homeroom_teacher_id && (
              <Tooltip title="Tanpa wali kelas">
                <WarningOutlined style={{ color: token.colorWarning }} />
              </Tooltip>
            )}
          </Space>
          {row.major && (
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{row.major}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Tingkat',
      dataIndex: 'grade',
      key: 'grade',
      width: 110,
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'grade', SORT_PAIRS),
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : '-'),
    },
    {
      title: 'Tahun Akademik',
      key: 'year',
      responsive: ['md'],
      render: (_, row) => row.academic_year?.name || '-',
    },
    {
      title: 'Wali Kelas',
      key: 'homeroom',
      render: (_, row) => row.homeroom_teacher?.name || <Tag color="warning">Belum ada</Tag>,
    },
    {
      title: 'Jumlah Siswa',
      key: 'count',
      width: 130,
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'count', SORT_PAIRS),
      responsive: ['md'],
      render: (_, row) => {
        const g = countsMap.get(row.id)
        return (
          <div>
            <strong>{g?.total ?? 0}</strong>
            {g && g.total > 0 && (
              <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
                L {g.male} · P {g.female}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title="Lihat detail">
            <Button type="text" icon={<IdcardOutlined />} onClick={() => setDetail(row)} />
          </Tooltip>
          {canWrite && (
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus kelas ini?"
              description="Data akan ditandai terhapus (soft delete)."
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
      ),
    },
  ]

  const stats = useMemo(() => {
    const noHomeroomCount = allClasses.filter((c) => !c.homeroom_teacher_id).length
    const emptyCount = allClasses.filter((c) => countOf(c) === 0).length
    const totalStudents = [...countsMap.values()].reduce((a, b) => a + b.total, 0)
    const avg =
      allClasses.length > 0 ? Math.round((totalStudents / allClasses.length) * 10) / 10 : 0
    return { noHomeroomCount, emptyCount, totalStudents, avg }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClasses, countsMap])

  return (
    <div>
      <PageHeader
        title="Data Kelas"
        subtitle={`Struktur ${allClasses.length} kelas · ${stats.totalStudents} santri aktif.`}
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button
                icon={<ReloadOutlined spin={isRefreshing} />}
                onClick={() => {
                  void classesQuery.refetch()
                  void genderCountsQuery.refetch()
                }}
              />
            </Tooltip>
            <Dropdown menu={headerMenu} trigger={['click']} placement="bottomRight" overlayStyle={{ minWidth: 240 }}>
              <Tooltip title="Menu lainnya">
                <Button icon={<MoreOutlined />} />
              </Tooltip>
            </Dropdown>
            <Tooltip title="Shortcut keyboard (?)">
              <Button icon={<KeyOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Kelas
              </Button>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Total Kelas"
          value={allClasses.length}
          color="indigo"
          loading={classesQuery.isPending}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Total Santri"
          value={stats.totalStudents}
          color="emerald"
          loading={genderCountsQuery.isPending}
        />
        <StatChip
          icon={<UserOutlined />}
          label="Tanpa Wali"
          value={stats.noHomeroomCount}
          color="amber"
          loading={classesQuery.isPending}
          active={noHomeroom}
          onClick={() => {
            setNoHomeroom((v) => !v)
            resetPage()
          }}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Kelas Kosong"
          value={stats.emptyCount}
          color="rose"
          loading={genderCountsQuery.isPending}
          active={emptyClass}
          onClick={() => {
            setEmptyClass((v) => !v)
            resetPage()
          }}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Rata-rata Isi"
          value={stats.avg}
          color="purple"
          loading={genderCountsQuery.isPending}
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
            placeholder="Cari nama kelas / wali…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          <Select
            placeholder="Tahun Akademik"
            allowClear
            style={{ minWidth: 190 }}
            value={academicYearId}
            onChange={(v) => {
              setAcademicYearId(v)
              resetPage()
            }}
            loading={yearsQuery.isPending}
            options={(yearsQuery.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
          />
          <Tooltip title="Pilih semua hasil filter (Ctrl+A)">
            <Button
              icon={<CheckSquareOutlined />}
              type={allFilteredSelected ? 'primary' : 'default'}
              onClick={toggleSelectAll}
            >
              {selectedIds.length > 0 ? `${selectedIds.length} Terpilih` : 'Pilih'}
            </Button>
          </Tooltip>
          <Badge count={[grade, sortBy, noHomeroom, emptyClass].filter(Boolean).length} size="small" offset={[-6, 6]}>
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
                placeholder="Tingkat"
                allowClear
                style={{ minWidth: 140 }}
                value={grade}
                onChange={(v) => {
                  setGrade(v)
                  resetPage()
                }}
                options={gradeOptions}
              />
              <Select
                placeholder="Urutkan"
                allowClear
                style={{ minWidth: 190 }}
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

        {isTruncated && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message={`Menampilkan ${allClasses.length.toLocaleString('id')} dari ${totalAll.toLocaleString('id')} kelas`}
            description="Data melebihi batas muat sekali. Persempit filter agar kelas lain ikut tampil."
          />
        )}

        <Table<ClassRow>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={classesQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  allClasses.length > 0
                    ? 'Tidak ada kelas yang cocok dengan filter'
                    : 'Belum ada kelas — tambahkan kelas pertama'
                }
              />
            ),
          }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
            selections: [
              {
                key: 'all-filtered',
                text: `Pilih semua hasil filter (${rows.length} kelas)`,
                onSelect: () => setSelectedIds(rows.map((r) => r.id)),
              },
              Table.SELECTION_INVERT,
              {
                key: 'none',
                text: 'Kosongkan pilihan',
                onSelect: () => setSelectedIds([]),
              },
            ],
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} kelas`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="small" icon={<ExportOutlined />} onClick={() => openExport('selected')}>
          Ekspor
        </Button>
        {canWrite && (
          <Button size="small" icon={<UserOutlined />} onClick={() => setHomeroomOpen(true)}>
            Wali Kelas
          </Button>
        )}
        {canDelete && (
          <Button size="small" danger icon={<DeleteOutlined />} onClick={confirmBulkArchive}>
            Arsipkan
          </Button>
        )}
      </BulkActionBar>

      <ClassForm
        open={formOpen}
        cls={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ClassDrawer
        open={!!detail}
        cls={detail}
        onClose={() => setDetail(null)}
        onEdit={canWrite ? openEdit : undefined}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={{ search: debouncedSearch || undefined, academicYearId }}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={rows.length}
      />

      <BulkHomeroomModal
        open={homeroomOpen}
        count={selectedIds.length}
        submitting={homeroomBulkMutation.isPending}
        onCancel={() => setHomeroomOpen(false)}
        onSubmit={handleBulkHomeroom}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
