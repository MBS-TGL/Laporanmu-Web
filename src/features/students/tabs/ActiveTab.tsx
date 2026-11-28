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
  type MenuProps,
  type TableColumnsType,
  type TableProps,
} from 'antd'
import {
  CameraOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExportOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  IdcardOutlined,
  InboxOutlined,
  ManOutlined,
  MoreOutlined,
  PlusOutlined,
  QrcodeOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SlidersOutlined,
  SwapOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WhatsAppOutlined,
  WomanOutlined,
} from '@ant-design/icons'
import { ActionBar } from '../../../shared/components/ActionBar'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { RISK_THRESHOLD } from '../api'
import { StatsRow } from '../components/StatsRow'
import type { useShortcuts, ShortcutItem } from '../../../shared/hooks/useShortcuts'
import type {
  useClassesBrief,
  useBulkDeleteStudents,
  useGenerateStudentPins,
  useStudents,
} from '../hooks'
import type {
  Gender,
  MissingField,
  PointMode,
  SortOption,
  Student,
  StudentStats,
  StudentStatus,
} from '../types'

// Alumni (graduated) tidak termasuk — dikelola di AlumniPage; tab Arsip punya pintunya sendiri
const STATUS_OPTIONS = [
  { label: 'Aktif', value: 'active' },
  { label: 'Pindah', value: 'transferred' },
  { label: 'Keluar', value: 'left' },
]

const GENDER_TABS = [
  { label: 'Semua', value: '' },
  { label: 'Putra', value: 'L', icon: <ManOutlined /> },
  { label: 'Putri', value: 'P', icon: <WomanOutlined /> },
]

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: 'Nama A–Z' },
  { value: 'name_desc', label: 'Nama Z–A' },
  { value: 'class_asc', label: 'Kelas A–Z' },
  { value: 'class_desc', label: 'Kelas Z–A' },
  { value: 'status_asc', label: 'Status A–Z' },
  { value: 'status_desc', label: 'Status Z–A' },
  { value: 'points_desc', label: 'Poin tertinggi' },
  { value: 'points_asc', label: 'Poin terendah' },
  { value: 'updated_desc', label: 'Terbaru diperbarui' },
]

export const MISSING_OPTIONS: { value: MissingField; label: string }[] = [
  { value: 'any', label: 'Data belum lengkap' },
  { value: 'photo', label: 'Tanpa foto' },
  { value: 'pin', label: 'Tanpa PIN' },
  { value: 'phone', label: 'Tanpa nomor telepon' },
  { value: 'nisn', label: 'Tanpa NISN' },
]

export const POINT_OPTIONS: { value: PointMode; label: string }[] = [
  { value: 'negative', label: 'Poin negatif' },
  { value: 'positive', label: 'Poin positif' },
]

interface StudentShortcutsDeps {
  searchInputRef: RefObject<InputRef | null>
  setShowAdvanced: Dispatch<SetStateAction<boolean>>
  clearAllFilters: () => void
  toggleSelectAll: () => void
  openExport: (scope: 'filtered' | 'selected') => void
  openCreate: () => void
  setImportOpen: Dispatch<SetStateAction<boolean>>
  setBulkPhotoOpen: Dispatch<SetStateAction<boolean>>
  setScanOpen: Dispatch<SetStateAction<boolean>>
  setBulkCardOpen: Dispatch<SetStateAction<boolean>>
  setWaSettingsOpen: Dispatch<SetStateAction<boolean>>
  onNavigateTab: (tab: string) => void
  togglePrivacy: () => void
  handleRefresh: () => void
  toggleShortcuts: () => void
  canWrite: boolean
}

/** Shortcut keyboard tab Santri Aktif (juga menjadi isi palet "?") */
export function studentShortcuts({
  searchInputRef,
  setShowAdvanced,
  clearAllFilters,
  toggleSelectAll,
  openExport,
  openCreate,
  setImportOpen,
  setBulkPhotoOpen,
  setScanOpen,
  setBulkCardOpen,
  setWaSettingsOpen,
  onNavigateTab,
  togglePrivacy,
  handleRefresh,
  toggleShortcuts,
  canWrite,
}: StudentShortcutsDeps): ShortcutItem[] {
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
      label: 'Tambah siswa baru',
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
      label: 'Buka ekspor',
      group: 'Aksi',
      icon: <ExportOutlined />,
      run: () => openExport('filtered'),
    },
    {
      keys: ['I'],
      label: 'Impor data',
      group: 'Aksi',
      icon: <FileExcelOutlined />,
      when: canWrite,
      run: () => setImportOpen(true),
    },
    {
      keys: ['B'],
      label: 'Bulk foto via NISN',
      group: 'Aksi',
      icon: <CameraOutlined />,
      when: canWrite,
      run: () => setBulkPhotoOpen(true),
    },
    {
      keys: ['S'],
      label: 'Scan kartu santri',
      group: 'Aksi',
      icon: <QrcodeOutlined />,
      run: () => setScanOpen(true),
    },
    {
      keys: ['C'],
      label: 'Cetak kartu massal',
      group: 'Aksi',
      icon: <IdcardOutlined />,
      run: () => setBulkCardOpen(true),
    },
    {
      keys: ['W'],
      label: 'Pengaturan WA',
      group: 'Aksi',
      icon: <WhatsAppOutlined />,
      when: canWrite,
      run: () => setWaSettingsOpen(true),
    },
    {
      keys: ['A'],
      label: 'Buka arsip siswa',
      group: 'Aksi',
      icon: <HistoryOutlined />,
      run: () => onNavigateTab('archive'),
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
      icon: <SyncOutlined />,
      run: handleRefresh,
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

interface ActiveTabProps {
  /** true saat tab ini aktif — wajib untuk gate portal aksi tab bar */
  active: boolean
  studentsQuery: ReturnType<typeof useStudents>
  stats: StudentStats | undefined
  statsPending: boolean
  isRefreshing: boolean
  shortcuts: ReturnType<typeof useShortcuts>
  headerMenu: MenuProps
  columns: TableColumnsType<Student>
  classesQuery: ReturnType<typeof useClassesBrief>
  pagination: TableProps<Student>['pagination']
  // Filter state
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  status: StudentStatus | ''
  setStatus: Dispatch<SetStateAction<StudentStatus | ''>>
  gender: Gender | undefined
  setGender: Dispatch<SetStateAction<Gender | undefined>>
  classId: string | undefined
  setClassId: Dispatch<SetStateAction<string | undefined>>
  tag: string | undefined
  setTag: Dispatch<SetStateAction<string | undefined>>
  sortBy: SortOption | undefined
  setSortBy: Dispatch<SetStateAction<SortOption | undefined>>
  missing: MissingField | undefined
  setMissing: Dispatch<SetStateAction<MissingField | undefined>>
  pointMode: PointMode | undefined
  setPointMode: Dispatch<SetStateAction<PointMode | undefined>>
  showAdvanced: boolean
  setShowAdvanced: Dispatch<SetStateAction<boolean>>
  selectedIds: string[]
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  privacy: boolean
  togglePrivacy: () => void
  searchInputRef: RefObject<InputRef | null>
  resetPage: () => void
  clearAllFilters: () => void
  advFilterCount: number
  filterChips: FilterChip[]
  tagOptions: { value: string; label: string }[]
  // Data turunan
  allStudents: Student[]
  rows: Student[]
  paginatedRows: Student[]
  totalActive: number
  isTruncated: boolean
  canWrite: boolean
  noPinCount: number
  toggleGender: (g: Gender) => void
  togglePointMode: (m: PointMode) => void
  toggleMissing: (m: MissingField) => void
  handleWorstClass: (id: string) => void
  handleWorstCompleteness: (id: string) => void
  handleRefresh: () => void
  handleTableChange: TableProps<Student>['onChange']
  // Seleksi massal
  selectedStudents: Student[]
  selectedIdSet: Set<string>
  alreadyPinned: number
  setCardStudents: Dispatch<SetStateAction<Student[] | null>>
  setMoveOpen: Dispatch<SetStateAction<boolean>>
  setGraduateOpen: Dispatch<SetStateAction<boolean>>
  setWaOpen: Dispatch<SetStateAction<boolean>>
  setScanOpen: Dispatch<SetStateAction<boolean>>
  openCreate: () => void
  openImport: () => void
  openExport: (scope: 'filtered' | 'selected') => void
  bulkArchive: (ids: string[]) => void
  bulkGeneratePins: (ids: string[]) => void
  bulkDeleteMutation: ReturnType<typeof useBulkDeleteStudents>
  generatePinsMutation: ReturnType<typeof useGenerateStudentPins>
}

/** Toolbar, chip statistik, tabel, dan bar aksi massal tab Santri Aktif — state & query tetap di StudentsPage */
export function ActiveTab({
  active,
  studentsQuery,
  stats,
  statsPending,
  isRefreshing,
  shortcuts,
  headerMenu,
  columns,
  classesQuery,
  pagination,
  search,
  setSearch,
  status,
  setStatus,
  gender,
  setGender,
  classId,
  setClassId,
  tag,
  setTag,
  sortBy,
  setSortBy,
  missing,
  setMissing,
  pointMode,
  setPointMode,
  showAdvanced,
  setShowAdvanced,
  selectedIds,
  setSelectedIds,
  privacy,
  togglePrivacy,
  searchInputRef,
  resetPage,
  clearAllFilters,
  advFilterCount,
  filterChips,
  tagOptions,
  allStudents,
  rows,
  paginatedRows,
  totalActive,
  isTruncated,
  canWrite,
  noPinCount,
  toggleGender,
  togglePointMode,
  toggleMissing,
  handleWorstClass,
  handleWorstCompleteness,
  handleRefresh,
  handleTableChange,
  selectedStudents,
  selectedIdSet,
  alreadyPinned,
  setCardStudents,
  setMoveOpen,
  setGraduateOpen,
  setWaOpen,
  setScanOpen,
  openCreate,
  openImport,
  openExport,
  bulkArchive,
  bulkGeneratePins,
  bulkDeleteMutation,
  generatePinsMutation,
}: ActiveTabProps) {
  const { token } = theme.useToken()

  // Aksi halaman di ujung kanan tab bar (judul & subtitle ada di shell, di atas tab bar)
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button
          aria-label="Muat ulang data"
          icon={<SyncOutlined spin={isRefreshing} />}
          onClick={handleRefresh}
        />
      </Tooltip>
      <Tooltip title="Ekspor data (Ctrl+E)">
        <Button
          aria-label="Ekspor data"
          icon={<ExportOutlined />}
          onClick={() => openExport('filtered')}
        />
      </Tooltip>
      <Dropdown
        menu={headerMenu}
        trigger={['click']}
        placement="bottomRight"
        overlayStyle={{ minWidth: 300 }}
      >
        <Tooltip title="Menu lainnya">
          <Button aria-label="Menu lainnya" icon={<MoreOutlined />} />
        </Tooltip>
      </Dropdown>
      <Tooltip title="Scan QR kartu (S)">
        <Button
          aria-label="Scan QR kartu santri"
          icon={<QrcodeOutlined />}
          onClick={() => setScanOpen(true)}
        />
      </Tooltip>
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
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah Santri
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {tabActions}
      <StatsRow
        stats={stats}
        loading={statsPending}
        gender={gender}
        pointMode={pointMode}
        missing={missing}
        noPinCount={noPinCount}
        onGenderToggle={toggleGender}
        onPointMode={togglePointMode}
        onMissing={toggleMissing}
        onWorstClass={handleWorstClass}
        onWorstCompleteness={handleWorstCompleteness}
      />

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
          <Segmented
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => {
              setStatus(v as StudentStatus | '')
              resetPage()
            }}
          />
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
            placeholder="Cari nama / kode / NISN / wali / telepon…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            style={{ flex: '1 1 160px', minWidth: 150 }}
          />
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
                placeholder="Kelas"
                allowClear
                style={{ minWidth: 170 }}
                value={classId}
                onChange={(v) => {
                  setClassId(v)
                  resetPage()
                }}
                loading={classesQuery.isPending}
                options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
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
              <Select
                placeholder="Kelengkapan data"
                allowClear
                style={{ minWidth: 190 }}
                value={missing}
                onChange={(v) => {
                  setMissing(v)
                  resetPage()
                }}
                options={MISSING_OPTIONS}
              />
              <Select
                placeholder="Label / Tag"
                allowClear
                showSearch
                style={{ minWidth: 160 }}
                value={tag}
                onChange={(v) => {
                  setTag(v)
                  resetPage()
                }}
                options={tagOptions}
              />
              <Select
                placeholder="Filter poin"
                allowClear
                style={{ minWidth: 150 }}
                value={pointMode}
                onChange={(v) => {
                  setPointMode(v)
                  resetPage()
                }}
                options={POINT_OPTIONS}
              />
              <Button icon={<CloseOutlined />} onClick={clearAllFilters}>
                Reset semua
              </Button>
            </Space>
          </div>
        )}

        <FilterChips chips={filterChips} marginTop={showAdvanced ? 0 : 12} />

        {studentsQuery.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12, borderRadius: 10 }}
            message="Gagal memuat data siswa"
            description={studentsQuery.error?.message}
            action={
              <Button size="small" danger onClick={() => void studentsQuery.refetch()}>
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
            message={`Menampilkan ${allStudents.length.toLocaleString('id')} dari ${totalActive.toLocaleString('id')} siswa`}
            description="Daftar dibatasi 1.000 siswa — gunakan filter atau pencarian untuk melihat siswa lainnya. Ekspor tetap mencakup seluruh data yang cocok."
          />
        )}

        <Table<Student>
          rowKey="id"
          className="students-table"
          columns={columns}
          dataSource={paginatedRows}
          loading={studentsQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          rowClassName={(row) => (row.total_points <= RISK_THRESHOLD ? 'student-row-risk' : '')}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={allStudents.length > 0 ? 'Tidak ada siswa yang cocok dengan filter' : 'Belum ada siswa'}
              >
                {allStudents.length === 0 && !studentsQuery.isPending && (
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                      Tambah Santri
                    </Button>
                    <Button icon={<FileExcelOutlined />} onClick={openImport}>
                      Import Data
                    </Button>
                  </Space>
                )}
              </Empty>
            ),
          }}
          rowSelection={
            canWrite
              ? {
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as string[]),
                  selections: [
                    {
                      key: 'all-filtered',
                      text: `Pilih semua hasil filter (${rows.length} siswa)`,
                      onSelect: () => setSelectedIds(rows.map((r) => r.id)),
                    },
                    Table.SELECTION_INVERT,
                    {
                      key: 'none',
                      text: 'Kosongkan pilihan',
                      onSelect: () => setSelectedIds([]),
                    },
                  ],
                }
              : undefined
          }
          pagination={pagination}
          scroll={{ x: true }}
        />
      </Card>

      {/* Bar aksi massal — muncul saat ada siswa yang dipilih */}
      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          { key: 'export', label: 'Ekspor', icon: <ExportOutlined />, onClick: () => openExport('selected') },
          { key: 'card', label: 'Kartu', icon: <IdcardOutlined />, onClick: () => setCardStudents(selectedStudents) },
          {
            key: 'pin',
            label: 'Buat PIN',
            icon: <QuestionCircleOutlined />,
            hidden: !canWrite,
            loading: generatePinsMutation.isPending,
            confirm: {
              title: `Buat PIN untuk ${selectedIds.length} siswa terpilih?`,
              description:
                alreadyPinned > 0
                  ? `PIN 6 digit akan dibuat otomatis. ${alreadyPinned} siswa yang sudah punya PIN akan diganti, kartu yang sudah tercetak harus dicetak ulang.`
                  : 'PIN 6 digit akan dibuat otomatis untuk masuk portal wali.',
              okText: 'Ya, Buat PIN',
            },
            onClick: () => bulkGeneratePins([...selectedIdSet]),
          },
          { key: 'move', label: 'Kelas', icon: <SwapOutlined />, hidden: !canWrite, onClick: () => setMoveOpen(true) },
          { key: 'graduate', label: 'Luluskan', icon: <SafetyCertificateOutlined />, hidden: !canWrite, onClick: () => setGraduateOpen(true) },
          { key: 'wa', label: 'WA', icon: <WhatsAppOutlined />, hidden: !canWrite, onClick: () => setWaOpen(true) },
          {
            key: 'archive',
            label: 'Arsipkan',
            icon: <InboxOutlined />,
            hidden: !canWrite,
            loading: bulkDeleteMutation.isPending,
            confirm: {
              title: `Arsipkan ${selectedIds.length} santri terpilih?`,
              description: 'Data akan dipindah ke tab Arsip dan bisa dipulihkan kapan saja.',
              okText: 'Ya, Arsipkan',
            },
            onClick: () => bulkArchive(selectedIds),
          },
        ]}
      />
    </div>
  )
}
