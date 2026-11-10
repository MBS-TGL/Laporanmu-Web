import { useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
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
import { CheckSquareOutlined, CloseOutlined, EyeInvisibleOutlined, EyeOutlined, ExportOutlined, IdcardOutlined, KeyOutlined, ManOutlined, MoreOutlined, ReloadOutlined, SearchOutlined, TeamOutlined, ThunderboltOutlined, TrophyOutlined, UndoOutlined, WomanOutlined } from '@ant-design/icons'
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
  useAlumni,
  useBulkRevertGraduation,
  useRestoreGraduationSnapshots,
  useRevertGraduation,
  useSaveStudentGuardians,
  useUpdateStudent,
} from './hooks'
import { DetailDrawer } from './components/DetailDrawer'
import { ExportModal } from './components/ExportModal'
import { StudentForm } from './components/StudentForm'
import type { Gender, GraduationSnapshot, SortOption, Student, StudentFormValues } from './types'

const MASK = '••••••'

const GENDER_TABS = [
  { label: 'Semua', value: '' },
  { label: 'Putra', value: 'L', icon: <ManOutlined /> },
  { label: 'Putri', value: 'P', icon: <WomanOutlined /> },
]

/** Subset SortOption yang relevan untuk alumni — dipakai juga filter export server-side */
type AlumniSort = Extract<
  SortOption,
  | 'name_asc'
  | 'name_desc'
  | 'graduated_desc'
  | 'graduated_asc'
  | 'year_desc'
  | 'year_asc'
  | 'points_desc'
  | 'points_asc'
>

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

// Pasangan [asc, desc] per kolom — dipakai header tabel, dropdown "Urutkan", dan onChange sorter
const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  graduated_at: ['graduated_asc', 'graduated_desc'],
  graduation_year: ['year_asc', 'year_desc'],
  total_points: ['points_asc', 'points_desc'],
} as const

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

/** Jejak siswa yang telah graduated: daftar alumni + profil + edit + pembatalan kelulusan */
export function AlumniPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [gender, setGender] = useState<Gender | undefined>()
  const [year, setYear] = useState<number | undefined>()
  const [lastClassId, setLastClassId] = useState<string | undefined>()
  const [sortBy, setSortBy] = useState<AlumniSort>('graduated_desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<Student | null>(null)

  const searchInputRef = useRef<InputRef>(null)

  const alumniQuery = useAlumni()
  const revertMutation = useRevertGraduation()
  const bulkRevertMutation = useBulkRevertGraduation()
  const restoreSnapshotsMutation = useRestoreGraduationSnapshots()
  const updateMutation = useUpdateStudent()
  const saveGuardiansMutation = useSaveStudentGuardians()

  const allAlumni = useMemo(() => alumniQuery.data?.data ?? [], [alumniQuery.data])
  // Total dari server — untuk mendeteksi daftar terpotong batas 1000
  const totalAlumni = alumniQuery.data?.total ?? 0
  const isTruncated = totalAlumni > allAlumni.length

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedStudents = useMemo(
    () => allAlumni.filter((s) => selectedIdSet.has(s.id)),
    [allAlumni, selectedIdSet],
  )

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

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = allAlumni.filter((s) => {
      if (
        q &&
        !`${s.name} ${s.registration_code} ${s.nisn ?? ''} ${s.last_class?.name ?? s.classes?.name ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (gender && s.gender !== gender) return false
      if (year && s.graduation_year !== year) return false
      if (lastClassId && s.last_class_id !== lastClassId) return false
      return true
    })

    const cmpName = (a: Student, b: Student) => a.name.localeCompare(b.name, 'id')
    const cmpGraduated = (a: Student, b: Student) =>
      (b.graduated_at ?? '').localeCompare(a.graduated_at ?? '') || cmpName(a, b)
    const cmpYear = (a: Student, b: Student) =>
      (b.graduation_year ?? 0) - (a.graduation_year ?? 0) || cmpGraduated(a, b)
    const cmpPoints = (a: Student, b: Student) => b.total_points - a.total_points || cmpName(a, b)

    const comparators: Record<AlumniSort, (a: Student, b: Student) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      graduated_desc: cmpGraduated,
      graduated_asc: (a, b) => cmpGraduated(b, a),
      year_desc: cmpYear,
      year_asc: (a, b) => cmpYear(b, a),
      points_desc: cmpPoints,
      points_asc: (a, b) => cmpPoints(b, a),
    }
    return [...data].sort(comparators[sortBy])
  }, [allAlumni, debouncedSearch, gender, year, lastClassId, sortBy])

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetPage = () => setPage(1)

  const clearAllFilters = () => {
    setSearch('')
    setGender(undefined)
    setYear(undefined)
    setLastClassId(undefined)
    setSortBy('graduated_desc')
    setSelectedIds([])
    resetPage()
  }

  const advFilterCount = [year, lastClassId, sortBy !== 'graduated_desc' ? sortBy : undefined].filter(
    Boolean,
  ).length

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
  }, [debouncedSearch, year, lastClassId, sortBy, lastClassOptions])

  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))

  const toggleSelectAll = () => {
    // Memilih semua baris HASIL FILTER (lintas halaman) — bukan hanya halaman aktif
    const filteredIds = rows.map((r) => r.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIdSet.has(id))
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !filteredIds.includes(id))
        : Array.from(new Set([...selectedIds, ...filteredIds])),
    )
  }

  const openExport = (scope: 'filtered' | 'selected') => {
    setExportScope(scope)
    setExportOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setFormOpen(true)
  }

  const togglePrivacy = () => {
    const next = !privacy
    setPrivacy(next)
    message.info(
      next ? 'Mode privasi diaktifkan — Data sensitif disembunyikan' : 'Mode privasi dinonaktifkan',
    )
  }

  const handleRevert = (student: Student) => {
    revertMutation.mutate(student.id, {
      onSuccess: () => {
        message.success(`${student.name} dikembalikan menjadi siswa aktif`)
        setSelectedIds((prev) => prev.filter((id) => id !== student.id))
        setDetail((current) => (current?.id === student.id ? null : current))
      },
      onError: (err: Error) => message.error(err.message || 'Gagal membatalkan kelulusan'),
    })
  }

  const handleSubmit = (values: StudentFormValues) => {
    if (!editing) return
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan alumni')
    updateMutation.mutate(
      { id: editing.id, values },
      {
        onSuccess: (updated) => {
          // Data ayah/ibu/wali disimpan via RPC terpisah (student_guardians) — saat edit
          // selalu dipanggil agar baris yang dikosongkan ikut di-soft-delete.
          saveGuardiansMutation.mutate(
            { studentId: updated.id, rows: values.guardians ?? [] },
            {
              onError: (err: Error) =>
                message.error(err.message || 'Alumni tersimpan, tetapi data orang tua gagal disimpan'),
            },
          )
          message.success('Data alumni diperbarui')
          setFormOpen(false)
          setEditing(null)
          // perbarui drawer bila sedang terbuka untuk alumni yang sama
          setDetail((current) => (current?.id === updated.id ? updated : current))
        },
        onError,
      },
    )
  }

  /** Toast undo pembatalan massal — pulihkan jejak kelulusan dari snapshot sebelum revert */
  const showRevertUndoToast = (snapshots: GraduationSnapshot[]) => {
    const count = snapshots.length
    const key = `undo-revert-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      // AntD v6: message.open tidak lagi punya properti `btn` — tombol ikut di content
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            {count === 1 ? '1 alumni dikembalikan' : `${count} alumni dikembalikan menjadi siswa aktif`}
          </span>
          <Button
            size="small"
            type="primary"
            loading={restoreSnapshotsMutation.isPending}
            onClick={() => {
              message.destroy(key)
              restoreSnapshotsMutation.mutate(snapshots, {
                onSuccess: () =>
                  message.success(
                    count === 1 ? 'Kelulusan dipulihkan' : `${count} kelulusan dipulihkan`,
                  ),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan kelulusan'),
              })
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const confirmBulkRevert = () => {
    const count = selectedStudents.length
    if (count === 0) return
    // Snapshot jejak kelulusan sebelum revert — dipakai tombol "Batalkan" di toast
    const snapshots: GraduationSnapshot[] = selectedStudents.map((s) => ({
      id: s.id,
      graduated_at: s.graduated_at,
      graduation_year: s.graduation_year,
      last_class_id: s.last_class_id,
    }))
    modal.confirm({
      title: `Kembalikan ${count} alumni menjadi siswa aktif?`,
      content:
        'Jejak kelulusan (tanggal & tahun lulus) akan dihapus dan siswa kembali aktif. Bisa dibatalkan sesaat setelah selesai.',
      okText: 'Ya, Kembalikan',
      cancelText: 'Batal',
      onOk: () =>
        bulkRevertMutation
          .mutateAsync(snapshots.map((s) => s.id))
          .then(() => {
            setSelectedIds([])
            showRevertUndoToast(snapshots)
          })
          .catch((err: Error) => message.error(err.message || 'Gagal membatalkan kelulusan')),
    })
  }

  const isBlocked = exportOpen || detail !== null || formOpen

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
      run: () => void alumniQuery.refetch(),
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
              <div style={{ fontSize: 12, opacity: 0.65 }}>Cadangkan data alumni</div>
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
              <Kbd>Ctrl</Kbd>
              <Kbd>E</Kbd>
            </span>
          </div>
        ),
        onClick: () => openExport('filtered'),
      },
    ],
  }

  // Ikon sorter gaya Esceha.id — template di shared/components/TableSortIcon.
  // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
  // harus dirender sebagai elemen agar hooks-nya legal.
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <TableSortIcon sortOrder={sortOrder} />
  )

  const columns: TableColumnsType<Student> = [
    {
      title: 'Siswa',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'name', SORT_PAIRS),
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={34}
            src={privacy ? undefined : row.photo_url || undefined}
            style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, fontSize: 13, flexShrink: 0 }}
          >
            {privacy ? '*' : initials(row.name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 13.5 }}
              onClick={() => setDetail(row)}
            >
              {row.name}
            </Button>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
              {row.gender === 'P' ? 'Perempuan' : 'Laki-laki'} ·{' '}
              {privacy ? MASK : row.registration_code}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Kelas Terakhir',
      key: 'last_class',
      responsive: ['md'],
      render: (_, row) => row.last_class?.name ?? row.classes?.name ?? '—',
    },
    {
      title: 'Tahun Lulus',
      dataIndex: 'graduation_year',
      key: 'graduation_year',
      width: 120,
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'graduation_year', SORT_PAIRS),
      render: (v: number | null) => (v != null ? <strong>{v}</strong> : '—'),
    },
    {
      title: 'Tanggal Lulus',
      dataIndex: 'graduated_at',
      key: 'graduated_at',
      width: 140,
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'graduated_at', SORT_PAIRS),
      responsive: ['lg'],
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
    },
    {
      title: 'Poin',
      dataIndex: 'total_points',
      key: 'total_points',
      width: 90,
      sorter: true,
      sortIcon,
      sortOrder: columnSortOrder(sortBy, 'total_points', SORT_PAIRS),
      sortDirections: ['descend', 'ascend'],
      responsive: ['md'],
      render: (v: number) => <strong>{v > 0 ? `+${v}` : v}</strong>,
    },
    {
      title: 'Aksi',
      key: 'aksi',
      width: 140,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title="Lihat detail">
            <Button type="text" icon={<IdcardOutlined />} onClick={() => setDetail(row)} />
          </Tooltip>
          {canWrite && (
            <Tooltip title="Kembalikan menjadi siswa aktif">
              <Popconfirm
                title="Batalkan kelulusan?"
                description={`${row.name} akan kembali menjadi siswa aktif tanpa jejak kelulusan.`}
                okText="Ya, Batalkan"
                cancelText="Batal"
                onConfirm={() => handleRevert(row)}
              >
                <Button
                  type="text"
                  icon={<UndoOutlined />}
                  loading={revertMutation.isPending && revertMutation.variables === row.id}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const yearCount = yearOptions.length
  const avgPoints =
    allAlumni.length > 0
      ? Math.round(allAlumni.reduce((acc, s) => acc + (s.total_points ?? 0), 0) / allAlumni.length)
      : 0

  return (
    <div>
      <PageHeader
        title="Alumni"
        subtitle="Jejak siswa yang telah lulus — riwayat poin, raport, dan log tetap tersimpan"
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<ReloadOutlined spin={alumniQuery.isFetching} />} onClick={() => void alumniQuery.refetch()} />
            </Tooltip>
            <Dropdown menu={headerMenu} trigger={['click']} placement="bottomRight" overlayStyle={{ minWidth: 240 }}>
              <Tooltip title="Menu lainnya">
                <Button icon={<MoreOutlined />} />
              </Tooltip>
            </Dropdown>
            <Tooltip title="Shortcut keyboard (?)">
              <Button icon={<KeyOutlined />} onClick={shortcuts.open} />
            </Tooltip>
            <Tooltip title="Mode privasi (P)">
              <Button
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
              >
                Privasi
              </Button>
            </Tooltip>
          </Space>
        }
      />

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
        <StatChip
          icon={<TrophyOutlined />}
          label="Rata-rata Poin"
          value={avgPoints > 0 ? `+${avgPoints}` : avgPoints}
          color="emerald"
          loading={alumniQuery.isPending}
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
              icon={<CloseOutlined />}
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
                  allAlumni.length > 0
                    ? 'Tidak ada alumni yang cocok dengan filter'
                    : 'Belum ada alumni — siswa yang diluluskan akan muncul di sini'
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
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} alumni`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      {/* Bar aksi massal — muncul saat ada alumni yang dipilih */}
      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="small" icon={<ExportOutlined />} onClick={() => openExport('selected')}>
          Ekspor
        </Button>
        {canWrite && (
          <Button
            size="small"
            icon={<UndoOutlined />}
            loading={bulkRevertMutation.isPending}
            onClick={confirmBulkRevert}
          >
            Kembalikan Aktif
          </Button>
        )}
      </BulkActionBar>

      <StudentForm
        open={formOpen}
        student={editing}
        submitting={updateMutation.isPending || saveGuardiansMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={{
          status: 'graduated',
          search: debouncedSearch || undefined,
          gender,
          graduationYear: year,
          lastClassId,
          sortBy,
        }}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={rows.length}
      />

      <DetailDrawer
        open={!!detail}
        student={detail}
        isPrivacyMode={privacy}
        onClose={() => setDetail(null)}
        onEdit={(student) => {
          setDetail(null)
          openEdit(student)
        }}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
