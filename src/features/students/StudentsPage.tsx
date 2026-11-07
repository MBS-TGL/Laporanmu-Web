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
  Tag,
  Tooltip,
  Typography,
  theme,
  type InputRef,
  type TableColumnsType,
  type TableProps,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CameraOutlined,
  CaretDownOutlined,
  CaretUpOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  ExportOutlined,
  FallOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  IdcardOutlined,
  KeyOutlined,
  LinkOutlined,
  ManOutlined,
  MoreOutlined,
  PlusOutlined,
  RiseOutlined,
  SearchOutlined,
  SlidersOutlined,
  SwapOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WhatsAppOutlined,
  WomanOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { Kbd, ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { usePageShortcuts, type ShortcutItem } from '../../shared/hooks/usePageShortcuts'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { usePermissions } from '../../shared/hooks/useProfile'
import {
  useBulkDeleteStudents,
  useBulkRestoreStudents,
  useClassesBrief,
  useCreateStudent,
  useDeleteStudent,
  useStudentStats,
  useStudents,
  useUpdateStudent,
} from './hooks'
import { StudentForm } from './components/StudentForm'
import { StudentImportModal } from './components/StudentImportModal'
import { StudentDetailDrawer } from './components/StudentDetailDrawer'
import { StudentStatsRow } from './components/StudentStatsRow'
import { ResetPointsModal } from './components/ResetPointsModal'
import { BulkPhotoModal } from './components/BulkPhotoModal'
import { ExportStudentsModal } from './components/ExportStudentsModal'
import { BulkMoveClassModal } from './components/BulkMoveClassModal'
import { WaBroadcastModal } from './components/WaBroadcastModal'
import { WaSettingsModal } from './components/WaSettingsModal'
import { StudentCardModal } from './components/StudentCardModal'
import { StudentBulkCardModal } from './components/StudentBulkCardModal'
import { RISK_THRESHOLD } from './api'
import { waLink } from './wa'
import { STUDENT_STATUS_META, GENDER_LABEL } from './status'
import type {
  Gender,
  MissingField,
  PointMode,
  SortOption,
  Student,
  StudentFormValues,
  StudentStatus,
} from './types'

const STATUS_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Aktif', value: 'aktif' },
  { label: 'Lulus', value: 'lulus' },
  { label: 'Pindah', value: 'pindah' },
  { label: 'Keluar', value: 'keluar' },
]

const GENDER_TABS = [
  { label: 'Semua', value: '' },
  { label: 'Putra', value: 'L', icon: <ManOutlined /> },
  { label: 'Putri', value: 'P', icon: <WomanOutlined /> },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
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

const MISSING_OPTIONS: { value: MissingField; label: string }[] = [
  { value: 'any', label: 'Data belum lengkap' },
  { value: 'photo', label: 'Tanpa foto' },
  { value: 'phone', label: 'Tanpa nomor telepon' },
  { value: 'nisn', label: 'Tanpa NISN' },
]

const POINT_OPTIONS: { value: PointMode; label: string }[] = [
  { value: 'negative', label: 'Poin negatif' },
  { value: 'positive', label: 'Poin positif' },
]

const MASK = '••••••'

function initials(name: string): string {
  return name.charAt(0).toUpperCase()
}

export function StudentsPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 350)
  const [classId, setClassId] = useState<string | undefined>()
  const [gender, setGender] = useState<Gender | undefined>()
  const [status, setStatus] = useState<StudentStatus | ''>('')
  const [sortBy, setSortBy] = useState<SortOption | undefined>()
  const [missing, setMissing] = useState<MissingField | undefined>()
  const [pointMode, setPointMode] = useState<PointMode | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importSource, setImportSource] = useState<'file' | 'gsheets'>('file')
  const [resetOpen, setResetOpen] = useState(false)
  const [bulkPhotoOpen, setBulkPhotoOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [moveOpen, setMoveOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waSettingsOpen, setWaSettingsOpen] = useState(false)
  /** 'selection' = kartu untuk semua siswa terpilih; Student = kartu satu siswa dari aksi baris */
  const [cardStudents, setCardStudents] = useState<Student[] | null>(null)
  const [bulkCardOpen, setBulkCardOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<Student | null>(null)

  const searchInputRef = useRef<InputRef>(null)

  const classesQuery = useClassesBrief()
  const statsQuery = useStudentStats()
  const stats = statsQuery.data

  // Pola Esceha.id: fetch semua santri aktif SEKALI (volume ratusan), lalu
  // filter + sort + paginate di memori — klik sort/filter terasa instan
  // karena tidak ada round-trip jaringan per klik.
  const studentsQuery = useStudents({ page: 1, pageSize: 1000 })
  const createMutation = useCreateStudent()
  const updateMutation = useUpdateStudent()
  const deleteMutation = useDeleteStudent()
  const bulkDeleteMutation = useBulkDeleteStudents()
  const bulkRestoreMutation = useBulkRestoreStudents()
  const allStudents = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data])
  const isRefreshing = studentsQuery.isFetching || statsQuery.isFetching

  // Total dari server — untuk mendeteksi daftar terpotong batas 1000
  const totalActive = studentsQuery.data?.total ?? 0
  const isTruncated = totalActive > allStudents.length

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedStudents = useMemo(
    () => allStudents.filter((s) => selectedIdSet.has(s.id)),
    [allStudents, selectedIdSet],
  )

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = allStudents.filter((s) => {
      if (
        q &&
        !`${s.name} ${s.registration_code} ${s.nisn ?? ''} ${s.nis ?? ''} ${s.classes?.name ?? ''} ${s.dorms?.name ?? ''} ${s.guardian_name ?? ''} ${s.phone ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (classId && s.class_id !== classId) return false
      if (gender && s.gender !== gender) return false
      if (status && s.status !== status) return false
      if (missing === 'photo' && s.photo_url) return false
      if (missing === 'phone' && s.phone) return false
      if (missing === 'nisn' && s.nisn) return false
      if (missing === 'any' && s.photo_url && s.phone && s.nisn) return false
      if (pointMode === 'negative' && s.total_points >= 0) return false
      if (pointMode === 'positive' && s.total_points <= 0) return false
      return true
    })

    const cmpName = (a: Student, b: Student) => a.name.localeCompare(b.name, 'id')
    // numeric: true agar kelas urut alami (8A < 9A < 10A, bukan 10A < 8A)
    const cmpClass = (a: Student, b: Student) =>
      (a.classes?.name ?? '').localeCompare(b.classes?.name ?? '', 'id', { numeric: true }) ||
      cmpName(a, b)
    const cmpStatus = (a: Student, b: Student) =>
      STUDENT_STATUS_META[a.status].label.localeCompare(
        STUDENT_STATUS_META[b.status].label,
        'id',
      ) || cmpName(a, b)
    const cmpPoints = (a: Student, b: Student) =>
      a.total_points - b.total_points || cmpName(a, b)
    const cmpUpdated = (a: Student, b: Student) =>
      (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || cmpName(a, b)

    const comparators: Record<SortOption, (a: Student, b: Student) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      class_asc: cmpClass,
      class_desc: (a, b) => cmpClass(b, a),
      status_asc: cmpStatus,
      status_desc: (a, b) => cmpStatus(b, a),
      points_asc: cmpPoints,
      points_desc: (a, b) => cmpPoints(b, a),
      updated_desc: cmpUpdated,
    }
    return [...data].sort(comparators[sortBy ?? 'name_asc'])
  }, [allStudents, debouncedSearch, classId, gender, status, missing, pointMode, sortBy])

  // Pagination client-side — slice dari hasil filter+sort di memori
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetPage = () => setPage(1)

  const clearAllFilters = () => {
    setSearch('')
    setClassId(undefined)
    setGender(undefined)
    setStatus('')
    setSortBy(undefined)
    setMissing(undefined)
    setPointMode(undefined)
    setSelectedIds([])
    resetPage()
  }

  // Jumlah filter lanjutan aktif — badge di tombol "Lainnya"
  const advFilterCount = [classId, sortBy, missing, pointMode].filter(Boolean).length

  // Chip filter aktif — bisa dihapus satu per satu
  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = []
    if (debouncedSearch.trim())
      chips.push({
        key: 'search',
        label: `Cari: "${debouncedSearch.trim()}"`,
        onClear: () => {
          setSearch('')
          resetPage()
        },
      })
    if (classId) {
      const name = classesQuery.data?.find((c) => c.id === classId)?.name
      chips.push({
        key: 'class',
        label: `Kelas: ${name ?? classId}`,
        onClear: () => {
          setClassId(undefined)
          resetPage()
        },
      })
    }
    if (sortBy) {
      const label = SORT_OPTIONS.find((o) => o.value === sortBy)?.label
      chips.push({
        key: 'sort',
        label: `Urut: ${label ?? sortBy}`,
        onClear: () => {
          setSortBy(undefined)
          resetPage()
        },
      })
    }
    if (missing)
      chips.push({
        key: 'missing',
        label: MISSING_OPTIONS.find((o) => o.value === missing)?.label ?? '',
        onClear: () => {
          setMissing(undefined)
          resetPage()
        },
      })
    if (pointMode)
      chips.push({
        key: 'points',
        label: POINT_OPTIONS.find((o) => o.value === pointMode)?.label ?? '',
        onClear: () => {
          setPointMode(undefined)
          resetPage()
        },
      })
    return chips
  }, [debouncedSearch, classId, sortBy, missing, pointMode, classesQuery.data])

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

  const toggleGender = (g: Gender) => {
    setGender((prev) => (prev === g ? undefined : g))
    resetPage()
  }

  const togglePointMode = (m: PointMode) => {
    setPointMode((prev) => (prev === m ? undefined : m))
    resetPage()
  }

  const toggleMissing = (m: MissingField) => {
    setMissing((prev) => (prev === m ? undefined : m))
    resetPage()
  }

  const handleRefresh = () => {
    void studentsQuery.refetch()
    void statsQuery.refetch()
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
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

  const handleSubmit = (values: StudentFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan siswa')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: (updated) => {
            message.success('Siswa diperbarui')
            setFormOpen(false)
            // perbarui drawer bila sedang terbuka untuk siswa yang sama
            setDetail((current) => (current?.id === updated.id ? updated : current))
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Siswa ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  /** Toast arsip dengan tombol Batalkan (pemulihan massal) */
  const showUndoToast = (ids: string[], count: number) => {
    const key = `undo-${Date.now()}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      // AntD v6: message.open tidak lagi punya properti `btn` — tombol ikut di content
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{count === 1 ? '1 siswa diarsipkan' : `${count} siswa diarsipkan`}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              bulkRestoreMutation.mutate(ids, {
                onSuccess: () =>
                  message.success(count === 1 ? 'Siswa dipulihkan' : `${count} siswa dipulihkan`),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan siswa'),
              })
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        message.success('Siswa diarsipkan')
        // bersihkan dari seleksi massal bila siswa ini sedang dipilih
        setSelectedIds((prev) => prev.filter((sid) => sid !== id))
        setDetail((current) => (current?.id === id ? null : current))
        showUndoToast([id], 1)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengarsipkan siswa'),
    })
  }

  const openExport = (scope: 'filtered' | 'selected') => {
    setExportScope(scope)
    setExportOpen(true)
  }

  const confirmBulkArchive = () => {
    const ids = selectedIds
    const count = ids.length
    modal.confirm({
      title: `Arsipkan ${count} siswa terpilih?`,
      content: 'Data akan ditandai terhapus (soft delete) dan bisa dipulihkan lewat menu Arsip Siswa.',
      okText: 'Arsipkan',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () =>
        bulkDeleteMutation
          .mutateAsync(ids)
          .then(() => {
            setSelectedIds([])
            showUndoToast(ids, count)
          })
          .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan siswa')),
    })
  }

  // -------------------------------------------------------------------------
  // Menu "Lainnya" di header
  // -------------------------------------------------------------------------

  const headerMenu = {
    items: [
      {
        key: 'data',
        type: 'group' as const,
        label: 'Data',
        children: [
          {
            key: 'import-excel',
            icon: <FileExcelOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Import Excel</div><div style={{ fontSize: 12, opacity: 0.65 }}>Unggah data siswa masal</div></div>,
            disabled: !canWrite,
            onClick: () => {
              setImportSource('file')
              setImportOpen(true)
            },
          },
          {
            key: 'import-gsheets',
            icon: <LinkOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Import GSheets</div><div style={{ fontSize: 12, opacity: 0.65 }}>Sinkronisasi data via Google Sheets</div></div>,
            disabled: !canWrite,
            onClick: () => {
              setImportSource('gsheets')
              setImportOpen(true)
            },
          },
          {
            key: 'export',
            icon: <ExportOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span><div style={{ fontWeight: 600 }}>Export Data</div><div style={{ fontSize: 12, opacity: 0.65 }}>Cadangkan seluruh database</div></span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>E</Kbd>
                </span>
              </div>
            ),
            onClick: () => openExport('filtered'),
          },
          {
            key: 'bulk-photo',
            icon: <CameraOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Bulk Foto</div><div style={{ fontSize: 12, opacity: 0.65 }}>Update foto siswa secara masal via NISN</div></div>,
            disabled: !canWrite,
            onClick: () => setBulkPhotoOpen(true),
          },
          {
            key: 'wa-settings',
            icon: <WhatsAppOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Pengaturan WA</div><div style={{ fontSize: 12, opacity: 0.65 }}>Token Fonnte untuk broadcast wali santri</div></div>,
            disabled: !canWrite,
            onClick: () => setWaSettingsOpen(true),
          },
        ],
      },
      {
        key: 'manajemen',
        type: 'group' as const,
        label: 'Manajemen',
        children: [
          {
            key: 'bulk-card',
            icon: <IdcardOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Cetak Kartu Massal</div><div style={{ fontSize: 12, opacity: 0.65 }}>Per kelas, semua aktif, atau sesuai filter</div></div>,
            onClick: () => setBulkCardOpen(true),
          },
          {
            key: 'archive',
            icon: <HistoryOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Arsip Siswa</div><div style={{ fontSize: 12, opacity: 0.65 }}>Lihat &amp; pulihkan data siswa tidak aktif</div></div>,
            onClick: () => navigate('/master/students/archive'),
          },
          {
            key: 'reset-points',
            icon: <SyncOutlined />,
            label: <div><div style={{ fontWeight: 600 }}>Reset Poin</div><div style={{ fontSize: 12, opacity: 0.65 }}>Bersihkan semua poin untuk semester baru</div></div>,
            danger: true,
            disabled: !canWrite,
            onClick: () => setResetOpen(true),
          },
        ],
      },
    ],
  }

  // -------------------------------------------------------------------------
  // Shortcut keyboard (juga menjadi isi palet "?")
  // -------------------------------------------------------------------------

  const isBlocked =
    formOpen ||
    importOpen ||
    resetOpen ||
    bulkPhotoOpen ||
    exportOpen ||
    moveOpen ||
    waOpen ||
    waSettingsOpen ||
    cardStudents !== null ||
    bulkCardOpen ||
    detail !== null

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
      icon: <SyncOutlined />,
      run: handleRefresh,
    },
    {
      keys: ['?'],
      label: 'Toggle palet shortcut',
      group: 'Tampilan',
      icon: <ThunderboltOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = usePageShortcuts({ items: shortcutItems, isBlocked })

  // -------------------------------------------------------------------------
  // Kolom tabel
  // -------------------------------------------------------------------------

  // Ikon sorter gaya Esceha.id: nonaktif = dua arah kecil sangat redup
  // (lebih pudar dari teks header), aktif = satu panah solid primary
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => {
    if (sortOrder === 'ascend')
      return <ArrowUpOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
    if (sortOrder === 'descend')
      return <ArrowDownOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
    return (
      <span
        style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, color: token.colorTextQuaternary }}
      >
        <CaretUpOutlined style={{ fontSize: 10, marginBottom: -3 }} />
        <CaretDownOutlined style={{ fontSize: 10 }} />
      </span>
    )
  }

  // Urutan kolom sinkron dengan state sortBy (dipakai juga dropdown "Urutkan")
  const sortOrderOf = (key: 'name' | 'class' | 'status' | 'total_points'): 'ascend' | 'descend' | null => {
    switch (key) {
      case 'name':
        return sortBy === 'name_asc' ? 'ascend' : sortBy === 'name_desc' ? 'descend' : null
      case 'class':
        return sortBy === 'class_asc' ? 'ascend' : sortBy === 'class_desc' ? 'descend' : null
      case 'status':
        return sortBy === 'status_asc' ? 'ascend' : sortBy === 'status_desc' ? 'descend' : null
      case 'total_points':
        return sortBy === 'points_asc' ? 'ascend' : sortBy === 'points_desc' ? 'descend' : null
    }
  }

  const handleTableChange: TableProps<Student>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    if (!s.order || !s.column) {
      setSortBy(undefined)
      resetPage()
      return
    }
    const key = s.column.key as 'name' | 'class' | 'status' | 'total_points'
    const pair: Record<typeof key, [SortOption, SortOption]> = {
      name: ['name_asc', 'name_desc'],
      class: ['class_asc', 'class_desc'],
      status: ['status_asc', 'status_desc'],
      total_points: ['points_asc', 'points_desc'],
    }
    const [asc, desc] = pair[key]
    setSortBy(s.order === 'ascend' ? asc : desc)
    resetPage()
  }

  const columns: TableColumnsType<Student> = [
    {
      title: 'Siswa',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('name'),
      render: (_, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            size={32}
            src={privacy ? undefined : row.photo_url || undefined}
            style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, flexShrink: 0 }}
          >
            {privacy ? '*' : initials(row.name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
              onClick={() => setDetail(row)}
            >
              {row.name}
            </Button>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>
                {row.gender ? `${GENDER_LABEL[row.gender]} · ` : ''}
                {privacy ? MASK : row.registration_code}
              </span>
              {row.tags && row.tags.length > 0 && (
                <span>
                  {row.tags.slice(0, 2).map((tag) => (
                    <Tag key={tag} style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5 }}>
                      {tag}
                    </Tag>
                  ))}
                  {row.tags.length > 2 && (
                    <Tooltip title={row.tags.slice(2).join(', ')}>
                      <Tag style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5 }}>
                        +{row.tags.length - 2}
                      </Tag>
                    </Tooltip>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Kelas',
      key: 'class',
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('class'),
      render: (_, row) => (
        <div>
          {row.classes?.name ? (
            <Tag
              style={{
                borderRadius: 6,
                fontWeight: 500,
                background: token.colorPrimaryBg,
                color: token.colorPrimary,
                border: 'none',
              }}
            >
              {row.classes.name}
            </Tag>
          ) : (
            '-'
          )}
          {row.dorms?.name && (
            <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
              {row.dorms.name}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('status'),
      render: (v: StudentStatus) => {
        const meta = STUDENT_STATUS_META[v]
        return (
          <StatusTag color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusTag>
        )
      },
    },
    {
      title: 'Poin',
      dataIndex: 'total_points',
      key: 'total_points',
      width: 100,
      sorter: true,
      sortIcon,
      // Klik pertama = tertinggi (desc) — arah angka yang paling sering dicari
      sortDirections: ['descend', 'ascend'],
      sortOrder: sortOrderOf('total_points'),
      render: (v: number) => (
        <Typography.Text
          strong
          style={{
            color: v < 0 ? token.colorError : v > 0 ? token.colorSuccess : undefined,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {v < 0 ? <FallOutlined /> : v > 0 ? <RiseOutlined /> : null}
          {v > 0 ? `+${v}` : v}
        </Typography.Text>
      ),
      responsive: ['md'],
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title="Lihat detail">
            <Button type="text" icon={<EyeOutlined />} onClick={() => setDetail(row)} />
          </Tooltip>
          <Tooltip title="Kartu portal (kode & PIN)">
            <Button type="text" icon={<IdcardOutlined />} onClick={() => setCardStudents([row])} />
          </Tooltip>
          {row.phone && (
            <Tooltip title="Chat WhatsApp">
              <Button
                type="text"
                icon={<WhatsAppOutlined style={{ color: token.colorSuccess }} />}
                onClick={() => window.open(waLink(row.phone!), '_blank', 'noopener')}
              />
            </Tooltip>
          )}
          {canWrite && (
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus siswa ini?"
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

  // Sinkron dengan toggleSelectAll & dropdown pilihan tabel: semua baris hasil filter
  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))

  return (
    <div>
      <PageHeader
        title="Data Siswa"
        subtitle={`Kelola ${stats ? stats.total : '…'} data siswa aktif dalam sistem laporan.`}
        extra={
          <Space wrap>
            <Tooltip title="Muat ulang (R)">
              <Button icon={<SyncOutlined spin={isRefreshing} />} onClick={handleRefresh} />
            </Tooltip>
            <Dropdown
              menu={headerMenu}
              trigger={['click']}
              placement="bottomRight"
              overlayStyle={{ minWidth: 300 }}
            >
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
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Siswa
              </Button>
            )}
          </Space>
        }
      />

      <StudentStatsRow
        stats={stats}
        loading={statsQuery.isPending}
        gender={gender}
        pointMode={pointMode}
        missing={missing}
        onGenderToggle={toggleGender}
        onPointMode={togglePointMode}
        onMissing={toggleMissing}
        onWorstClass={(id) => {
          setClassId(id)
          resetPage()
        }}
      />

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
            placeholder="Cari nama / kode / kelas / wali…"
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

        {filterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, marginTop: showAdvanced ? 0 : 12 }}>
            {filterChips.map((chip) => (
              <Tag
                key={chip.key}
                closable
                onClose={chip.onClear}
                style={{
                  borderRadius: 999,
                  background: token.colorFillQuaternary,
                  border: 'none',
                  paddingInline: 10,
                }}
              >
                {chip.label}
              </Tag>
            ))}
          </div>
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
              />
            ),
          }}
          rowSelection={{
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
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} siswa`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      {/* Bar aksi massal — muncul saat ada siswa yang dipilih */}
      {selectedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 14,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.14)',
          }}
        >
          <Tag color="processing" style={{ borderRadius: 999, fontWeight: 700, marginInlineEnd: 2 }}>
            {selectedIds.length}
          </Tag>
          <span style={{ color: token.colorTextSecondary, fontSize: 13 }}>dipilih</span>
          <Button size="small" icon={<ExportOutlined />} onClick={() => openExport('selected')}>
            Ekspor
          </Button>
          <Button size="small" icon={<IdcardOutlined />} onClick={() => setCardStudents(selectedStudents)}>
            Kartu
          </Button>
          {canWrite && (
            <Button size="small" icon={<SwapOutlined />} onClick={() => setMoveOpen(true)}>
              Kelas
            </Button>
          )}
          {canWrite && (
            <Button size="small" icon={<WhatsAppOutlined style={{ color: token.colorSuccess }} />} onClick={() => setWaOpen(true)}>
              WA
            </Button>
          )}
          {canWrite && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={confirmBulkArchive}>
              Arsipkan
            </Button>
          )}
          <Button size="small" type="text" style={{ color: token.colorTextQuaternary }} icon={<CloseOutlined />} onClick={() => setSelectedIds([])} />
        </div>
      )}

      <StudentForm
        open={formOpen}
        student={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <StudentImportModal open={importOpen} onClose={() => setImportOpen(false)} initialSource={importSource} />

      <ExportStudentsModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={{
          search: debouncedSearch || undefined,
          classId,
          gender,
          status: status || undefined,
          sortBy,
          missing,
          pointMode,
        }}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={rows.length}
      />

      <BulkMoveClassModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        students={selectedStudents}
        classes={classesQuery.data ?? []}
        onMoved={() => setSelectedIds([])}
      />

      <WaBroadcastModal open={waOpen} onClose={() => setWaOpen(false)} students={selectedStudents} />

      <WaSettingsModal open={waSettingsOpen} onClose={() => setWaSettingsOpen(false)} />

      <StudentCardModal
        open={cardStudents !== null}
        onClose={() => setCardStudents(null)}
        students={cardStudents ?? []}
      />

      <StudentBulkCardModal
        open={bulkCardOpen}
        onClose={() => setBulkCardOpen(false)}
        allStudents={allStudents}
        filteredRows={rows}
        classes={classesQuery.data ?? []}
        onSubmit={(list) => {
          setBulkCardOpen(false)
          setCardStudents(list)
        }}
      />

      <ResetPointsModal open={resetOpen} onClose={() => setResetOpen(false)} defaultClassId={classId} />

      <BulkPhotoModal open={bulkPhotoOpen} onClose={() => setBulkPhotoOpen(false)} />

      <StudentDetailDrawer
        open={!!detail}
        student={detail}
        isPrivacyMode={privacy}
        onClose={() => setDetail(null)}
        onEdit={(s) => {
          setDetail(null)
          openEdit(s)
        }}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
