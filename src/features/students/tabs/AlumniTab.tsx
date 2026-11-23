import { useMemo } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Segmented,
  Select,
  Space,
  Table,
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
  SlidersOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExportOutlined,
  ImportOutlined,
  ManOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UndoOutlined,
  WomanOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { StatChip } from '../../../shared/components/StatChip'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import { ActionBar } from '../../../shared/components/ActionBar'
import { actionMenuLabel } from '../../../shared/components/ActionMenu'
import { sortByFromTableChange } from '../../../shared/utils/tableSort'
import type { ShortcutItem, useShortcuts } from '../../../shared/hooks/useShortcuts'
import type { useAlumni, useBulkDeleteStudents, useBulkRevertGraduation } from '../hooks'
import { SORT_PAIRS, type AlumniSort } from '../components/AlumniColumns'
import type { Gender, Student } from '../types'

const GENDER_TABS = [
  { label: 'Semua', value: '' },
  { label: 'Putra', value: 'L', icon: <ManOutlined /> },
  { label: 'Putri', value: 'P', icon: <WomanOutlined /> },
]

const SORT_OPTIONS: { value: AlumniSort; label: string }[] = [
  { value: 'graduated_desc', label: 'Terbaru lulus' },
  { value: 'graduated_asc', label: 'Terlama lulus' },
  { value: 'year_desc', label: 'Tahun lulus tinggi–rendah' },
  { value: 'year_asc', label: 'Tahun lulus rendah–tinggi' },
  { value: 'name_asc', label: 'Nama A–Z' },
  { value: 'name_desc', label: 'Nama Z–A' },
  { value: 'points_desc', label: 'Poin tertinggi' },
  { value: 'points_asc', label: 'Poin terendah' },
]

interface AlumniShortcutDeps {
  searchInputRef: RefObject<InputRef | null>
  setShowAdvanced: Dispatch<SetStateAction<boolean>>
  clearAllFilters: () => void
  toggleSelectAll: () => void
  openExport: (scope: 'filtered' | 'selected') => void
  togglePrivacy: () => void
  refetchAlumni: () => void | Promise<unknown>
  toggleShortcuts: () => void
}

/** Item shortcut tab Alumni — dipakai AlumniPage via useShortcuts */
export function alumniShortcuts({
  searchInputRef,
  setShowAdvanced,
  clearAllFilters,
  toggleSelectAll,
  openExport,
  togglePrivacy,
  refetchAlumni,
  toggleShortcuts,
}: AlumniShortcutDeps): ShortcutItem[] {
  return [
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
      icon: <SearchOutlined />,
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
      keys: ['Ctrl', 'A'],
      label: 'Pilih semua / deselect',
      group: 'Aksi',
      icon: <CheckSquareOutlined />,
      run: toggleSelectAll,
    },
    {
      keys: ['Ctrl', 'E'],
      label: 'Buka export',
      group: 'Aksi',
      icon: <ExportOutlined />,
      run: () => openExport('filtered'),
    },
    {
      keys: ['P'],
      label: 'Mode privasi',
      group: 'Tampilan',
      icon: <EyeInvisibleOutlined />,
      run: togglePrivacy,
    },
    {
      keys: ['R'],
      label: 'Muat ulang data',
      group: 'Tampilan',
      icon: <ReloadOutlined />,
      run: () => void refetchAlumni(),
    },
    {
      keys: ['?'],
      label: 'Toggle palet shortcut',
      group: 'Tampilan',
      icon: <ThunderboltOutlined />,
      run: () => toggleShortcuts(),
    },
  ]
}

interface AlumniTabProps {
  active: boolean
  alumniQuery: ReturnType<typeof useAlumni>
  allAlumni: Student[]
  rows: Student[]
  paginatedRows: Student[]
  columns: TableColumnsType<Student>
  pagination: TableProps<Student>['pagination']
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  debouncedSearch: string
  gender: Gender | undefined
  setGender: Dispatch<SetStateAction<Gender | undefined>>
  year: number | undefined
  setYear: Dispatch<SetStateAction<number | undefined>>
  lastClassId: string | undefined
  setLastClassId: Dispatch<SetStateAction<string | undefined>>
  sortBy: AlumniSort
  setSortBy: Dispatch<SetStateAction<AlumniSort>>
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  privacy: boolean
  togglePrivacy: () => void
  showAdvanced: boolean
  setShowAdvanced: Dispatch<SetStateAction<boolean>>
  searchInputRef: RefObject<InputRef | null>
  resetPage: () => void
  clearAllFilters: () => void
  toggleSelectAll: () => void
  allFilteredSelected: boolean
  pointsHistoryIds: Set<string>
  isTruncated: boolean
  totalAlumni: number
  canWrite: boolean
  canDelete: boolean
  openAddAlumni: () => void
  openImport: () => void
  openExport: (scope: 'filtered' | 'selected') => void
  bulkRevert: () => void
  bulkDelete: () => void
  bulkRevertMutation: ReturnType<typeof useBulkRevertGraduation>
  bulkDeleteMutation: ReturnType<typeof useBulkDeleteStudents>
  shortcuts: ReturnType<typeof useShortcuts>
}

/** Toolbar, chip statistik, tabel, dan bar aksi massal tab Alumni — state & query tetap di AlumniPage */
export function AlumniTab({
  active,
  alumniQuery,
  allAlumni,
  rows,
  paginatedRows,
  columns,
  pagination,
  search,
  setSearch,
  debouncedSearch,
  gender,
  setGender,
  year,
  setYear,
  lastClassId,
  setLastClassId,
  sortBy,
  setSortBy,
  selectedIds,
  setSelectedIds,
  privacy,
  togglePrivacy,
  showAdvanced,
  setShowAdvanced,
  searchInputRef,
  resetPage,
  clearAllFilters,
  toggleSelectAll,
  allFilteredSelected,
  pointsHistoryIds,
  isTruncated,
  totalAlumni,
  canWrite,
  canDelete,
  openAddAlumni,
  openImport,
  openExport,
  bulkRevert,
  bulkDelete,
  bulkRevertMutation,
  bulkDeleteMutation,
  shortcuts,
}: AlumniTabProps) {
  const { token } = theme.useToken()

  // Tahun & kelas terakhir yang ada di data — untuk dropdown filter
  const yearOptions = useMemo(
    () =>
      [...new Set(allAlumni.map((s) => s.graduation_year).filter((y): y is number => y != null))]
        .sort((a, b) => b - a)
        .map((y) => ({ value: y, label: String(y) })),
    [allAlumni],
  )
  // Nilai = last_class_id (snapshot) agar filter bisa dipakai export server-side
  const lastClassOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of allAlumni) {
      const name = s.last_class?.name ?? s.classes?.name
      if (s.last_class_id && name) map.set(s.last_class_id, name)
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'id'))
      .map(([id, name]) => ({ value: id, label: name }))
  }, [allAlumni])

  const handleTableChange: TableProps<Student>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS) ?? 'graduated_desc')
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
    if (year)
      chips.push({
        key: 'year',
        label: `Tahun lulus: ${year}`,
        onClear: () => {
          setYear(undefined)
          resetPage()
        },
      })
    if (lastClassId)
      chips.push({
        key: 'lastClass',
        label: `Kelas terakhir: ${lastClassOptions.find((o) => o.value === lastClassId)?.label ?? lastClassId}`,
        onClear: () => {
          setLastClassId(undefined)
          resetPage()
        },
      })
    if (sortBy !== 'graduated_desc')
      chips.push({
        key: 'sort',
        label: `Urut: ${SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? sortBy}`,
        onClear: () => {
          setSortBy('graduated_desc')
          resetPage()
        },
      })
    return chips
  }, [debouncedSearch, year, lastClassId, sortBy, lastClassOptions, setSearch, setYear, setLastClassId, setSortBy, resetPage])

  const yearCount = yearOptions.length
  const advFilterCount = [year, lastClassId, sortBy !== 'graduated_desc' ? sortBy : undefined].filter(
    Boolean,
  ).length

  // Hanya hitung rata-rata dari alumni yang memiliki riwayat poin
  const alumniWithPoints = useMemo(
    () => allAlumni.filter((s) => pointsHistoryIds.has(s.id)),
    [allAlumni, pointsHistoryIds],
  )
  const avgPoints =
    alumniWithPoints.length > 0
      ? Math.round(alumniWithPoints.reduce((acc, s) => acc + (s.total_points ?? 0), 0) / alumniWithPoints.length)
      : null

  const headerMenuItems = [
    ...(canWrite
      ? [
          {
            key: 'import',
            icon: <ImportOutlined />,
            label: actionMenuLabel('Import Alumni', 'Unggah template Excel / CSV'),
            onClick: openImport,
          },
          { type: 'divider' as const },
        ]
      : []),
    {
      key: 'export',
      icon: <ExportOutlined />,
      label: actionMenuLabel('Export Data', 'Cadangkan data alumni', ['Ctrl', 'E']),
      onClick: () => openExport('filtered'),
    },
  ]

  const headerMenu = { items: headerMenuItems }

  // Aksi halaman di ujung kanan tab bar (judul & subtitle dirender shell StudentsPage)
  // Urutan konsisten dengan tab Aktif: ikon utilitas dulu, tombol primary terakhir
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button
          aria-label="Muat ulang data"
          icon={<ReloadOutlined spin={alumniQuery.isFetching} />}
          onClick={() => void alumniQuery.refetch()}
        />
      </Tooltip>
      <Dropdown
        menu={headerMenu}
        trigger={['click']}
        placement="bottomRight"
        overlayStyle={{ minWidth: 240 }}
      >
        <Tooltip title="Menu lainnya">
          <Button aria-label="Menu lainnya" icon={<MoreOutlined />} />
        </Tooltip>
      </Dropdown>
      <Tooltip title="Shortcut keyboard (?)">
        <Button aria-label="Shortcut keyboard" icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      <Tooltip title="Mode privasi (P)">
        <Button
          aria-label="Toggle mode privasi"
          icon={privacy ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={togglePrivacy}
          style={
            privacy
              ? {
                  background: token.colorWarningBg,
                  borderColor: token.colorWarningBorder,
                  color: token.colorWarningTextActive,
                }
              : undefined
          }
        />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddAlumni}>
          Tambah Alumni
        </Button>
      )}
    </Space>,
  )

  return (
    <>
      {/* Judul & subtitle dirender shell StudentsPage (di atas tab bar); aksi halaman di ujung kanan tab bar */}
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Total Alumni"
          value={allAlumni.length}
          color="indigo"
          loading={alumniQuery.isPending}
        />
        <StatChip
          icon={<TrophyOutlined />}
          label="Angkatan"
          value={yearCount}
          color="sky"
          loading={alumniQuery.isPending}
          active={showAdvanced}
          onClick={() => setShowAdvanced((v) => !v)}
        />
        {avgPoints != null && avgPoints !== 0 && (
          <StatChip
            icon={<TrophyOutlined />}
            label="Rata-rata Poin"
            value={avgPoints > 0 ? `+${avgPoints}` : avgPoints}
            color="emerald"
            loading={alumniQuery.isPending}
          />
        )}
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
          <Segmented
            options={GENDER_TABS}
            value={gender ?? ''}
            onChange={(v) => {
              setGender(v === '' ? undefined : (v as Gender))
              resetPage()
            }}
          />
          <Input
            ref={searchInputRef}
            placeholder="Cari nama / kode / NISN…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            style={{ flex: '1 1 240px', minWidth: 220 }}
          />
          <Tooltip title="Pilih semua hasil filter / batal (Ctrl+A)">
            <Button
              icon={<CheckSquareOutlined />}
              type={allFilteredSelected ? 'primary' : 'default'}
              onClick={toggleSelectAll}
            >
              {selectedIds.length > 0 ? `${selectedIds.length} Terpilih` : 'Pilih'}
            </Button>
          </Tooltip>
          <Badge count={advFilterCount} size="small" offset={[-6, 6]}>
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
                placeholder="Tahun lulus"
                allowClear
                style={{ minWidth: 160 }}
                value={year}
                onChange={(v) => {
                  setYear(v)
                  resetPage()
                }}
                options={yearOptions}
              />
              <Select
                placeholder="Kelas terakhir"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 180 }}
                value={lastClassId}
                onChange={(v) => {
                  setLastClassId(v)
                  resetPage()
                }}
                options={lastClassOptions}
              />
              <Select
                placeholder="Urutkan"
                style={{ minWidth: 200 }}
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

        {alumniQuery.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12, borderRadius: 10 }}
            message="Gagal memuat data alumni"
            description={alumniQuery.error?.message}
            action={
              <Button size="small" danger onClick={() => void alumniQuery.refetch()}>
                Coba lagi
              </Button>
            }
          />
        )}

        {isTruncated && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12, borderRadius: 10 }}
            message={`Menampilkan ${allAlumni.length.toLocaleString('id')} dari ${totalAlumni.toLocaleString('id')} alumni`}
            description="Daftar dibatasi 1.000 alumni — gunakan filter atau pencarian untuk melihat alumni lainnya. Ekspor tetap mencakup seluruh data yang cocok."
          />
        )}

        <Table<Student>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={alumniQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  allAlumni.length > 0 ? (
                    'Tidak ada alumni yang cocok dengan filter'
                  ) : (
                    <div>
                      <div>Belum ada alumni terdaftar</div>
                      <div style={{ fontSize: 13, color: token.colorTextTertiary, marginTop: 4 }}>
                        Santri yang diluluskan akan otomatis muncul di sini, atau Anda dapat menambah dan mengimpor alumni manual.
                      </div>
                      {canWrite && (
                        <Space style={{ marginTop: 12 }}>
                          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAddAlumni}>
                            Tambah Alumni
                          </Button>
                          <Button size="small" icon={<ImportOutlined />} onClick={openImport}>
                            Import Alumni
                          </Button>
                        </Space>
                      )}
                    </div>
                  )
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
                text: `Pilih semua hasil filter (${rows.length} alumni)`,
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
          pagination={pagination}
          scroll={{ x: true }}
        />
      </Card>

      {/* Bar aksi massal — muncul saat ada alumni yang dipilih */}
      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          { key: 'export', label: 'Ekspor', icon: <ExportOutlined />, onClick: () => openExport('selected') },
          {
            key: 'revert',
            label: 'Kembalikan Aktif',
            icon: <UndoOutlined />,
            hidden: !canWrite,
            loading: bulkRevertMutation.isPending,
            confirm: {
              title: `Kembalikan ${selectedIds.length} alumni menjadi siswa aktif?`,
              description: 'Jejak kelulusan (tanggal & tahun lulus) akan dihapus dan siswa kembali aktif. Bisa dibatalkan sesaat setelah selesai.',
              okText: 'Ya, Kembalikan',
            },
            onClick: bulkRevert,
          },
          {
            key: 'delete',
            label: 'Hapus',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canDelete,
            loading: bulkDeleteMutation.isPending,
            confirm: {
              title: `Hapus ${selectedIds.length} alumni terpilih?`,
              description: 'Data akan ditandai terhapus (arsip) dan dapat dipulihkan lewat tab Arsip.',
              okText: 'Ya, Hapus',
            },
            onClick: bulkDelete,
          },
        ]}
      />
    </>
  )
}
