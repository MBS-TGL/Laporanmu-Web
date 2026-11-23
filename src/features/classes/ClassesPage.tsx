import { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tooltip,
  theme,
  type InputRef,
  type MenuProps,
  type TableProps,
} from 'antd'
import {
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExportOutlined,
  FileAddOutlined,
  MoreOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SlidersOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { ActionBar } from '../../shared/components/ActionBar'
import { Kbd, ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { sortByFromTableChange } from '../../shared/utils/tableSort'
import {
  useAcademicYearsBrief,
  useAllClasses,
  useBulkDeleteClasses,
  useClassGenderCounts,
  useCreateClass,
  useDeleteClass,
  useSetClassesHomeroomBulk,
  useUpdateClass,
} from './hooks'
import { ClassForm } from './components/ClassForm'
import { ClassDrawer } from './components/ClassDrawer'
import { useClassColumns, SORT_PAIRS } from './components/ClassColumns'
import { ExportModal } from './components/ExportModal'
import { HomeroomModal } from './components/HomeroomModal'
import { ImportModal } from './components/ImportModal'
import { ArchiveTab } from './tabs/ArchiveTab'
import type { ClassFormValues, ClassRow, ClassSort } from './types'

const SORT_OPTIONS: { value: ClassSort; label: string }[] = [
  { value: 'name_asc', label: 'Nama A–Z' },
  { value: 'name_desc', label: 'Nama Z–A' },
  { value: 'grade_asc', label: 'Tingkat rendah–tinggi' },
  { value: 'grade_desc', label: 'Tingkat tinggi–rendah' },
  { value: 'count_desc', label: 'Santri terbanyak' },
  { value: 'count_asc', label: 'Santri tersedikit' },
]

// Persistensi filter aktif — kelas dibiarkan tersaring saat kembali ke halaman ini
// (ukuran halaman dipersist useTablePagination via storageKey)
const LS_FILTERS = 'classes_filters'

type StoredFilters = {
  academicYearId?: string
  grade?: string
  noHomeroom?: boolean
  emptyClass?: boolean
  sortBy?: ClassSort
}

function loadStoredFilters(): StoredFilters {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_FILTERS) ?? '{}') as StoredFilters
    // sortBy lama/rusak diabaikan agar comparator tidak crash
    return { ...raw, sortBy: SORT_OPTIONS.some((o) => o.value === raw.sortBy) ? raw.sortBy : undefined }
  } catch {
    return {}
  }
}

// ─── Shell: satu halaman Kelas bertab (pola ?tab= — SKILLS.md §Skill 2) ─────
const CLASS_TAB_ITEMS = [
  { key: 'active', label: 'Kelas Aktif' },
  { key: 'archive', label: 'Arsip' },
]

/** Judul & subtitle per tab — dirender shell di ATAS tab bar (pola StudentsPage). */
const CLASS_TAB_META: Record<string, { title: string; subtitle: string }> = {
  active: { title: 'Kelas', subtitle: '' },
  archive: { title: 'Arsip Kelas', subtitle: 'Pulihkan kelas yang sudah diarsipkan' },
}

export function ClassesPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [stored] = useState(loadStoredFilters)
  const [academicYearId, setAcademicYearId] = useState<string | undefined>(stored.academicYearId)
  const [grade, setGrade] = useState<string | undefined>(stored.grade)
  const [noHomeroom, setNoHomeroom] = useState(stored.noHomeroom ?? false)
  const [emptyClass, setEmptyClass] = useState(stored.emptyClass ?? false)
  const [sortBy, setSortBy] = useState<ClassSort | undefined>(stored.sortBy)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  // Detail disimpan sebagai id lalu di-derive dari cache — setelah edit, drawer
  // otomatis menampilkan data terbaru (bukan snapshot basi)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [homeroomOpen, setHomeroomOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { tab, setTab } = useUrlTab('active', { keys: CLASS_TAB_ITEMS.map((t) => t.key) })

  const searchInputRef = useRef<InputRef>(null)

  const yearsQuery = useAcademicYearsBrief()
  const genderCountsQuery = useClassGenderCounts()

  const countsMap = useMemo(
    () => genderCountsQuery.data ?? new Map<string, { total: number; male: number; female: number }>(),
    [genderCountsQuery.data],
  )

  // Pola StudentsPage: muat-semua tanpa pagination (kelas belasan), filter+sort di memori
  const classesQuery = useAllClasses()
  const createMutation = useCreateClass()
  const updateMutation = useUpdateClass()
  const deleteMutation = useDeleteClass()
  const bulkDeleteMutation = useBulkDeleteClasses()
  const homeroomBulkMutation = useSetClassesHomeroomBulk()

  const allClasses = useMemo(() => classesQuery.data ?? [], [classesQuery.data])

  const detail = useMemo(
    () => allClasses.find((c) => c.id === detailId) ?? null,
    [allClasses, detailId],
  )

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

  const pg = useTablePagination(rows.length, { label: 'kelas', storageKey: 'classes_page_size' })

  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  const resetPage = pg.reset

  // Persistensi filter aktif + ukuran halaman (write error tidak fatal)
  useEffect(() => {
    try {
      localStorage.setItem(
        LS_FILTERS,
        JSON.stringify({ academicYearId, grade, noHomeroom, emptyClass, sortBy }),
      )
    } catch {
      /* kuota penuh — abaikan */
    }
  }, [academicYearId, grade, noHomeroom, emptyClass, sortBy])

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
  }, [debouncedSearch, academicYearId, grade, noHomeroom, emptyClass, sortBy, yearsQuery.data, resetPage])

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

  // Guard sama dengan arsip massal: kelas berisi santri tidak boleh diarsipkan
  const handleDelete = (row: ClassRow) => {
    if (countOf(row) > 0) {
      modal.warning({
        title: 'Kelas masih berisi santri',
        content: `${row.name} masih memiliki ${countOf(row)} santri aktif. Pindahkan santrinya dulu, lalu arsipkan.`,
        okText: 'Mengerti',
      })
      return
    }
    deleteMutation.mutate(row.id, {
      onSuccess: () => {
        message.success('Kelas diarsipkan — bisa dipulihkan lewat tab Arsip')
        setSelectedIds((prev) => prev.filter((sid) => sid !== row.id))
        setDetailId((current) => (current === row.id ? null : current))
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengarsipkan kelas'),
    })
  }

  const bulkArchive = (ids: string[]) => {
    const blocked = allClasses.filter((c) => ids.includes(c.id) && countOf(c) > 0)
    if (blocked.length > 0) {
      modal.warning({
        title: 'Ada kelas yang masih berisi santri',
        content: `Tidak bisa diarsipkan: ${blocked.map((c) => c.name).join(', ')}. Pindahkan santrinya dulu atau hapus dari kelas.`,
        okText: 'Mengerti',
      })
      return
    }
    bulkDeleteMutation
      .mutateAsync(ids)
      .then(() => {
        setSelectedIds([])
        message.success(`${ids.length} kelas diarsipkan`)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan kelas'))
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
  const isBlocked = formOpen || detail !== null || exportOpen || homeroomOpen || importOpen

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
      run: () => {
        // Progresif: seleksi → pencarian → semua filter (sekali tekan tidak menghapus semuanya)
        if (selectedIds.length > 0) {
          setSelectedIds([])
          return
        }
        if (search) {
          setSearch('')
          resetPage()
          return
        }
        clearAllFilters()
      },
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

  const headerMenu: MenuProps = {
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
    ...(canWrite
      ? [
          {
            key: 'import',
            icon: <FileAddOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  <div style={{ fontWeight: 600 }}>Impor Excel</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Unggah daftar kelas dari Excel/CSV</div>
                </span>
              </div>
            ),
            onClick: () => setImportOpen(true),
          },
        ]
      : []),
    ],
  }

  const handleTableChange: TableProps<ClassRow>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS))
    resetPage()
  }

  const columns = useClassColumns({
    sortBy,
    canWrite,
    canDelete,
    countsMap,
    onDetail: (row) => setDetailId(row.id),
    onEdit: openEdit,
    onDelete: handleDelete,
  })

  const stats = useMemo(() => {
    const noHomeroomCount = allClasses.filter((c) => !c.homeroom_teacher_id).length
    const emptyCount = allClasses.filter((c) => countOf(c) === 0).length
    const totalStudents = [...countsMap.values()].reduce((a, b) => a + b.total, 0)
    const avg =
      allClasses.length > 0 ? Math.round((totalStudents / allClasses.length) * 10) / 10 : 0
    return { noHomeroomCount, emptyCount, totalStudents, avg }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClasses, countsMap])

  const meta = CLASS_TAB_META[tab] ?? CLASS_TAB_META.active

  return (
    <div>
      <PageHeader
        title={meta.title}
        subtitle={
          tab === 'active'
            ? `Struktur ${allClasses.length} kelas · ${stats.totalStudents} santri aktif`
            : meta.subtitle
        }
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button
                aria-label="Muat ulang data"
                icon={<ReloadOutlined spin={isRefreshing} />}
                onClick={() => {
                  void classesQuery.refetch()
                  void genderCountsQuery.refetch()
                }}
              />
            </Tooltip>
            <Dropdown menu={headerMenu} trigger={['click']} placement="bottomRight" overlayStyle={{ minWidth: 240 }}>
              <Tooltip title="Menu lainnya">
                <Button aria-label="Menu lainnya" icon={<MoreOutlined />} />
              </Tooltip>
            </Dropdown>
            <Tooltip title="Shortcut keyboard (?)">
              <Button aria-label="Palet shortcut" icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Kelas
              </Button>
            )}
          </Space>
        }
      />

      <Tabs activeKey={tab} onChange={setTab} items={CLASS_TAB_ITEMS} />

      {tab === 'active' && (
      <>
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
          hideIfZero
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
          hideIfZero
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

        <Table<ClassRow>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={classesQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          locale={{
            emptyText:
              allClasses.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Belum ada kelas — mulai dari kelas pertama"
                >
                  {canWrite && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                      Tambah Kelas Pertama
                    </Button>
                  )}
                </Empty>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Tidak ada kelas yang cocok dengan filter"
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
          pagination={pg.pagination}
          scroll={{ x: true }}
        />
      </Card>

      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          { key: 'export', label: 'Ekspor', icon: <ExportOutlined />, onClick: () => openExport('selected') },
          { key: 'homeroom', label: 'Wali Kelas', icon: <UserOutlined />, hidden: !canWrite, onClick: () => setHomeroomOpen(true) },
          {
            key: 'archive',
            label: 'Arsipkan',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canDelete,
            loading: bulkDeleteMutation.isPending,
            confirm: {
              title: `Arsipkan ${selectedIds.length} kelas terpilih?`,
              description: 'Data ditandai terhapus dan bisa dipulihkan lewat tab Arsip.',
              okText: 'Ya, Arsipkan',
            },
            onClick: () => bulkArchive(selectedIds),
          },
        ]}
      />
      </>
      )}

      {tab === 'archive' && <ArchiveTab active />}

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
        onClose={() => setDetailId(null)}
        onEdit={canWrite ? openEdit : undefined}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filteredRows={rows}
        selectedIds={selectedIds}
        defaultScope={exportScope}
      />

      <HomeroomModal
        open={homeroomOpen}
        count={selectedIds.length}
        submitting={homeroomBulkMutation.isPending}
        onCancel={() => setHomeroomOpen(false)}
        onSubmit={handleBulkHomeroom}
      />

      {canWrite && (
        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          existingClasses={allClasses}
        />
      )}

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
