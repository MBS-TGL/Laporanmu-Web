import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
  type InputRef,
  type TableColumnsType,
  type   TableProps,
  Grid,
} from 'antd'
import { useSearchParams } from 'react-router-dom'
import {
  CameraOutlined,
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
  ManOutlined,
  MoreOutlined,
  PlusOutlined,
  QrcodeOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SlidersOutlined,
  SwapOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  WhatsAppOutlined,
  WomanOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { ActionBar } from '../../shared/components/ActionBar'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { SortIcon } from '../../shared/components/SortIcon'
import { columnSortOrder, sortByFromTableChange } from '../../shared/utils/tableSort'
import { photoThumb } from '../../shared/utils/photoThumb'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { actionMenuLabel } from '../../shared/components/ActionMenu'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { usePermissions, useProfile } from '../../shared/hooks/useProfile'
import { WaliTab } from './tabs/WaliTab'
import { formatDisplayName } from '../../shared/utils/displayName'
import { matchesStudentList } from './filterStudents'
import {
  useBulkDeleteStudents,
  useBulkRestoreStudents,
  useClassesBrief,
  useCreateStudent,
  useDeleteStudent,
  useGenerateStudentPins,
  useSaveStudentGuardians,
  useStudentStats,
  useStudents,
  useStudentPhotos,
  useUpdateStudent,
  useDormsBrief as useDorms,
} from './hooks'
import { StudentForm } from './components/StudentForm'
import { ImportModal } from './components/ImportModal'
const DetailDrawer = lazy(() =>
  import('./components/DetailDrawer').then((m) => ({ default: m.DetailDrawer })),
)
import { StatsRow } from './components/StatsRow'
import { ResetModal } from './components/ResetModal'
import { PhotoModal } from './components/PhotoModal'
import { ExportModal } from './components/ExportModal'
import { MoveModal } from './components/MoveModal'
import { GraduateModal } from './components/GraduateModal'
import { BroadcastModal } from './components/BroadcastModal'
import { GatewayModal } from './components/GatewayModal'
import { CardModal } from './components/CardModal'
import { CardsModal } from './components/CardsModal'
import { ScanModal } from './components/ScanModal'
import { RISK_THRESHOLD } from './api'
import { waLink } from './wa'
import { STUDENT_STATUS_META, GENDER_LABEL } from './status'
import { ArchivePage } from './ArchivePage'
import { AlumniPage } from './AlumniPage'
import { PromoteModal } from './PromotePage'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { TabActionsContext, useTabActions } from '../../shared/components/ActionsSlot'
import type {
  Gender,
  MissingField,
  PointMode,
  SortOption,
  Student,
  StudentFormValues,
  StudentStatus,
} from './types'

// Alumni (graduated) tidak termasuk — dikelola di AlumniPage; "Semua" = aktif + pindah + keluar
const STATUS_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Aktif', value: 'active' },
  { label: 'Pindah', value: 'transferred' },
  { label: 'Keluar', value: 'left' },
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
  { value: 'pin', label: 'Tanpa PIN' },
  { value: 'phone', label: 'Tanpa nomor telepon' },
  { value: 'nisn', label: 'Tanpa NISN' },
]

const POINT_OPTIONS: { value: PointMode; label: string }[] = [
  { value: 'negative', label: 'Poin negatif' },
  { value: 'positive', label: 'Poin positif' },
]

const MASK = '••••••'

// Pasangan [asc, desc] per kolom — dipakai header tabel, dropdown "Urutkan", dan onChange sorter
const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  class: ['class_asc', 'class_desc'],
  status: ['status_asc', 'status_desc'],
  total_points: ['points_asc', 'points_desc'],
} as const

function initials(name: string): string {
  return name.charAt(0).toUpperCase()
}

/** Aksi baris tabel: tombol ikon di desktop, menu dropdown di mobile (C4) */
function StudentActions({
  row,
  canWrite,
  canDelete,
  onDetail,
  onCard,
  onEdit,
  onDelete,
  token,
}: {
  row: Student
  canWrite: boolean
  canDelete: boolean
  onDetail: (s: Student) => void
  onCard: (s: Student) => void
  onEdit: (s: Student) => void
  onDelete: (id: string) => void
  token: any
}) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const actions = (
    <>
      <Tooltip title="Lihat detail">
        <Button
          type="text"
          aria-label="Lihat detail"
          icon={<EyeOutlined />}
          onClick={() => onDetail(row)}
        />
      </Tooltip>
      <Tooltip title="Kartu portal (kode & PIN)">
        <Button
          type="text"
          aria-label="Kartu portal"
          icon={<IdcardOutlined />}
          onClick={() => onCard(row)}
        />
      </Tooltip>
      <Tooltip title={row.phone ? 'Chat WhatsApp' : 'Nomor HP belum tersedia'}>
        <span>
          <Button
            type="text"
            aria-label="Chat WhatsApp"
            disabled={!row.phone}
            icon={<WhatsAppOutlined style={{ color: row.phone ? token.colorSuccess : undefined }} />}
            onClick={() => row.phone && window.open(waLink(row.phone), '_blank', 'noopener')}
          />
        </span>
      </Tooltip>
      {canWrite && (
        <Tooltip title="Edit">
          <Button
            type="text"
            aria-label="Edit data"
            icon={<EditOutlined />}
            onClick={() => onEdit(row)}
          />
        </Tooltip>
      )}
      {canDelete && (
        <Popconfirm
          title="Hapus siswa ini?"
          description="Data akan ditandai terhapus (soft delete)."
          onConfirm={() => onDelete(row.id)}
          okText="Ya, Hapus"
          cancelText="Batal"
        >
          <Tooltip title="Hapus">
            <Button type="text" danger aria-label="Hapus siswa" icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      )}
    </>
  )

  if (!isMobile) return <Space size={0}>{actions}</Space>

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'detail', icon: <EyeOutlined />, label: 'Lihat Detail', onClick: () => onDetail(row) },
          { key: 'card', icon: <IdcardOutlined />, label: 'Kartu Portal', onClick: () => onCard(row) },
          {
            key: 'wa',
            icon: <WhatsAppOutlined />,
            label: 'WhatsApp',
            disabled: !row.phone,
            onClick: () => row.phone && window.open(waLink(row.phone), '_blank', 'noopener'),
          },
          ...(canWrite
            ? [{ key: 'edit', icon: <EditOutlined />, label: 'Edit Data', onClick: () => onEdit(row) }]
            : []),
          ...(canDelete
            ? [
                { type: 'divider' as const },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: 'Hapus',
                  danger: true,
                  onClick: () => {
                    // Popconfirm dalam dropdown sering bermasalah — pakai konfirmasi modal bila mobile?
                    // Untuk simpelnya, panggil onDelete langsung (handleDelete sudah punya konfirmasi?)
                    // Tidak, handleDelete di parent dipicu Popconfirm.
                    // Gunakan onDelete saja, atau biarkan Popconfirm di luar.
                    // Cara termudah: panggil onDelete yang membungkus konfirmasi.
                    onDelete(row.id)
                  },
                },
              ]
            : []),
        ],
      }}
    >
      <Button type="text" icon={<MoreOutlined />} />
    </Dropdown>
  )
}

function StudentsActiveTab({
  active,
  promoteOpen,
  onNavigateTab,
  onOpenPromote,
}: {
  /** true saat tab ini aktif — wajib untuk gate portal aksi tab bar */
  active: boolean
  promoteOpen: boolean
  onNavigateTab: (tab: string) => void
  onOpenPromote: () => void
}) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  // Deep-link dari halaman lain (mis. ClassDrawer "Kelola santri", DetailDrawer asrama), dibaca sekali saat mount
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [classId, setClassId] = useState<string | undefined>(() => searchParams.get('classId') ?? undefined)
  const [dormId, setDormId] = useState<string | undefined>(() => searchParams.get('dormId') ?? undefined)
  const [tag, setTag] = useState<string | undefined>()
  const [gender, setGender] = useState<Gender | undefined>()
  // Default hanya aktif — lulus/pindah/keluar tetap bisa dilihat lewat tab "Semua"
  const [status, setStatus] = useState<StudentStatus | ''>('active')
  const [sortBy, setSortBy] = useState<SortOption | undefined>()
  const [missing, setMissing] = useState<MissingField | undefined>()
  const [pointMode, setPointMode] = useState<PointMode | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [bulkPhotoOpen, setBulkPhotoOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [moveOpen, setMoveOpen] = useState(false)
  const [graduateOpen, setGraduateOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [waSettingsOpen, setWaSettingsOpen] = useState(false)
  /** 'selection' = kartu untuk semua siswa terpilih; Student = kartu satu siswa dari aksi baris */
  const [cardStudents, setCardStudents] = useState<Student[] | null>(null)
  const [bulkCardOpen, setBulkCardOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [detail, setDetail] = useState<Student | null>(null)

  // D3: Deep-link ?student= untuk membuka drawer langsung via URL yang bisa dibagikan
  const openDetail = useCallback((student: Student) => {
    setDetail(student)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('student', student.id)
      return next
    }, { replace: true })
  }, [setSearchParams])

  const closeDetail = useCallback(() => {
    setDetail(null)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('student')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const searchInputRef = useRef<InputRef>(null)

  const classesQuery = useClassesBrief()
  const dormsQuery = useDorms()
  const statsQuery = useStudentStats()
  const stats = statsQuery.data

  // Pola Esceha.id: fetch semua santri aktif SEKALI (volume ratusan), lalu
  // filter + sort + paginate di memori — klik sort/filter terasa instan
  // karena tidak ada round-trip jaringan per klik.
  const studentsQuery = useStudents({ page: 1, pageSize: 1000 })
  const createMutation = useCreateStudent()
  const updateMutation = useUpdateStudent()
  const saveGuardiansMutation = useSaveStudentGuardians()
  const generatePinsMutation = useGenerateStudentPins()
  const deleteMutation = useDeleteStudent()
  const bulkDeleteMutation = useBulkDeleteStudents()
  const bulkRestoreMutation = useBulkRestoreStudents()
  const allStudents = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data])
  const isRefreshing = studentsQuery.isFetching || statsQuery.isFetching

  // Sinkronisasi deep-link ?student= saat pertama kali data termuat
  const urlStudentId = searchParams.get('student')
  useEffect(() => {
    if (urlStudentId && allStudents.length > 0 && detail?.id !== urlStudentId) {
      const found = allStudents.find((s) => s.id === urlStudentId)
      if (found) setDetail(found)
    }
  }, [urlStudentId, allStudents, detail?.id])

  // Total dari server — untuk mendeteksi daftar terpotong batas 1000
  const totalActive = studentsQuery.data?.total ?? 0
  const isTruncated = totalActive > allStudents.length

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedStudents = useMemo(
    () => allStudents.filter((s) => selectedIdSet.has(s.id)),
    [allStudents, selectedIdSet],
  )
  const alreadyPinned = selectedStudents.filter((s) => s.pin).length

  // D2: Kumpulan seluruh tag siswa untuk filter lanjutan
  const tagOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of allStudents) {
      for (const t of s.tags ?? []) set.add(t)
    }
    return Array.from(set).sort().map((t) => ({ value: t, label: t }))
  }, [allStudents])

  // D1: Jumlah siswa aktif yang belum punya PIN portal wali
  const noPinCount = useMemo(
    () => allStudents.filter((s) => s.status === 'active' && !s.pin).length,
    [allStudents],
  )

  const rows = useMemo(() => {
    const data = allStudents.filter((s) =>
      matchesStudentList(s, {
        search: debouncedSearch,
        classId,
        dormId,
        tag,
        gender,
        status: status || undefined,
        missing,
        pointMode,
      }),
    )

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
      graduated_desc: (a, b) =>
        (b.graduated_at ?? '').localeCompare(a.graduated_at ?? '') || cmpName(a, b),
      graduated_asc: (a, b) =>
        (a.graduated_at ?? '').localeCompare(b.graduated_at ?? '') || cmpName(a, b),
      year_desc: (a, b) => (b.graduation_year ?? 0) - (a.graduation_year ?? 0) || cmpName(a, b),
      year_asc: (a, b) => (a.graduation_year ?? 0) - (b.graduation_year ?? 0) || cmpName(a, b),
    }
    return [...data].sort(comparators[sortBy ?? 'name_asc'])
  }, [allStudents, debouncedSearch, classId, dormId, tag, gender, status, missing, pointMode, sortBy])

  const pg = useTablePagination(rows.length, { label: 'siswa' })

  // Pagination client-side — slice dari hasil filter+sort di memori
  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  // A1: Ambil foto on-demand hanya untuk baris yang tampil (hindari payload base64 massal).
  const visibleIds = useMemo(() => paginatedRows.map((r) => r.id), [paginatedRows])
  const photosQuery = useStudentPhotos(visibleIds)
  const photos = photosQuery.data ?? {}

  const resetPage = pg.reset

  const clearAllFilters = () => {
    setSearch('')
    setClassId(undefined)
    setDormId(undefined)
    setTag(undefined)
    setGender(undefined)
    setStatus('active')
    setSortBy(undefined)
    setMissing(undefined)
    setPointMode(undefined)
    setSelectedIds([])
    resetPage()
  }

  // Jumlah filter lanjutan aktif — badge di tombol "Lainnya"
  const advFilterCount = useMemo(
    () => [classId, dormId, tag, sortBy, missing, pointMode].filter(Boolean).length,
    [classId, dormId, tag, sortBy, missing, pointMode],
  )

  // Chip filter aktif — bisa dihapus satu per satu
  const filterChips = useMemo<FilterChip[]>(() => {
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
    if (dormId) {
      const name = dormsQuery.data?.find((d) => d.id === dormId)?.name
      chips.push({
        key: 'dorm',
        label: `Asrama: ${name ?? dormId}`,
        onClear: () => {
          setDormId(undefined)
          resetPage()
        },
      })
    }
    if (tag) {
      chips.push({
        key: 'tag',
        label: `Label: ${tag}`,
        onClear: () => {
          setTag(undefined)
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
  }, [debouncedSearch, classId, dormId, tag, sortBy, missing, pointMode, classesQuery.data, dormsQuery.data])

  const toggleSelectAll = useCallback(() => {
    const filteredIdSet = new Set(rows.map((r) => r.id))
    const allSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !filteredIdSet.has(id))
        : Array.from(new Set([...selectedIds, ...filteredIdSet])),
    )
  }, [rows, selectedIdSet, selectedIds])

  const toggleGender = useCallback((g: Gender) => {
    setGender((prev) => (prev === g ? undefined : g))
    resetPage()
  }, [resetPage])

  const togglePointMode = useCallback((m: PointMode) => {
    setPointMode((prev) => (prev === m ? undefined : m))
    resetPage()
  }, [resetPage])

  const toggleMissing = useCallback((m: MissingField) => {
    setMissing((prev) => (prev === m ? undefined : m))
    resetPage()
  }, [resetPage])

  const handleWorstClass = useCallback((id: string) => {
    setClassId(id)
    resetPage()
  }, [resetPage])

  const handleWorstCompleteness = useCallback((id: string) => {
    setClassId(id)
    setMissing('any')
    resetPage()
  }, [resetPage])

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
    // Data ayah/ibu/wali disimpan via RPC terpisah (student_guardians, 0020) —
    // saat edit selalu dipanggil agar baris yang dikosongkan ikut di-soft-delete.
    const persistGuardians = (studentId: string) => {
      if (!editing && !values.guardians?.length) return Promise.resolve()
      return saveGuardiansMutation.mutateAsync({ studentId, rows: values.guardians ?? [] })
    }
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: (updated) => {
            persistGuardians(updated.id)
              .then(() => {
                message.success('Siswa diperbarui')
                setFormOpen(false)
                // perbarui drawer bila sedang terbuka untuk siswa yang sama
                setDetail((current) => (current?.id === updated.id ? updated : current))
              })
              .catch((err: Error) =>
                message.error(err.message || 'Gagal menyimpan data orang tua'),
              )
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: (created) => {
          persistGuardians(created.id)
            .then(() => {
              message.success('Siswa ditambahkan')
              setFormOpen(false)
            })
            .catch((err: Error) =>
              message.error(err.message || 'Siswa tersimpan, tetapi data orang tua gagal disimpan'),
            )
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

  const bulkArchive = (ids: string[]) => {
    const count = ids.length
    bulkDeleteMutation
      .mutateAsync(ids)
      .then(() => {
        setSelectedIds([])
        showUndoToast(ids, count)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan siswa'))
  }

  /** Generate PIN portal wali massal untuk siswa terpilih (RPC 0021) */
  const bulkGeneratePins = (ids: string[]) => {
    generatePinsMutation
      .mutateAsync(ids)
      .then((results) => {
        message.success(
          results.length === 1 ? '1 PIN berhasil dibuat' : `${results.length} PIN berhasil dibuat`,
        )
      })
      .catch((err: Error) => message.error(err.message || 'Gagal membuat PIN'))
  }

  // -------------------------------------------------------------------------
  // Menu "Lainnya" di header
  // -------------------------------------------------------------------------

  // Item menu aksi halaman — gaya seragam dua baris (judul + deskripsi) via helper shared.
  const menuItem = (
    key: string,
    icon: ReactNode,
    title: string,
    desc: string,
    shortcut?: string[],
    extra?: { danger?: boolean; disabled?: boolean; onClick?: () => void },
  ) => ({
    key,
    icon,
    danger: extra?.danger,
    disabled: extra?.disabled,
    onClick: extra?.onClick,
    label: actionMenuLabel(title, desc, shortcut),
  })

  const headerMenu = useMemo(
    () => ({
      items: [
        {
          key: 'data',
          type: 'group' as const,
          label: 'Data',
          children: [
            menuItem('import', <FileExcelOutlined />, 'Impor Data', 'Unggah dari Excel atau Google Sheets', ['I'], { disabled: !canWrite, onClick: () => setImportOpen(true) }),
            menuItem('export', <ExportOutlined />, 'Ekspor Data', 'Cadangkan seluruh database', ['Ctrl', 'E'], { onClick: () => openExport('filtered') }),
            menuItem('bulk-photo', <CameraOutlined />, 'Bulk Foto', 'Update foto siswa secara masal via NISN', ['B'], { disabled: !canWrite, onClick: () => setBulkPhotoOpen(true) }),
            menuItem('wa-settings', <WhatsAppOutlined />, 'Pengaturan WA', 'Token Fonnte untuk broadcast wali santri', ['W'], { disabled: !canWrite, onClick: () => setWaSettingsOpen(true) }),
          ],
        },
        {
          key: 'manajemen',
          type: 'group' as const,
          label: 'Manajemen',
          children: [
            menuItem('bulk-card', <IdcardOutlined />, 'Cetak Kartu Massal', 'Per kelas, semua aktif, atau sesuai filter', ['C'], { onClick: () => setBulkCardOpen(true) }),
            menuItem('promote', <RiseOutlined />, 'Kenaikan Kelas', 'Wizard promosi massal & kelulusan tahun ajaran', undefined, { disabled: !canWrite, onClick: onOpenPromote }),
            menuItem('reset-points', <SyncOutlined />, 'Reset Poin', 'Bersihkan semua poin untuk semester baru', undefined, { danger: true, disabled: !canWrite, onClick: () => setResetOpen(true) }),
          ],
        },
      ],
    }),
    [canWrite, onOpenPromote],
  )

  // -------------------------------------------------------------------------
  // Shortcut keyboard (juga menjadi isi palet "?")
  // -------------------------------------------------------------------------

  const isBlocked =
    !active ||
    formOpen ||
    importOpen ||
    resetOpen ||
    bulkPhotoOpen ||
    exportOpen ||
    promoteOpen ||
    moveOpen ||
    graduateOpen ||
    waOpen ||
    waSettingsOpen ||
    scanOpen ||
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
      run: () => onNavigateTab('arsip'),
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

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  // -------------------------------------------------------------------------
  // Kolom tabel
  // -------------------------------------------------------------------------

  // Ikon sorter gaya Esceha.id — template di shared/components/SortIcon.
  // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
  // harus dirender sebagai elemen agar hooks-nya legal.
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <SortIcon sortOrder={sortOrder} />
  )

  // Urutan kolom sinkron dengan state sortBy (dipakai juga dropdown "Urutkan")
  const sortOrderOf = (key: keyof typeof SORT_PAIRS) =>
    columnSortOrder(sortBy, key, SORT_PAIRS)

  const handleTableChange: TableProps<Student>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS))
    resetPage()
  }

  const columns: TableColumnsType<Student> = useMemo(
    () => [
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
            src={privacy ? undefined : photoThumb(row.photo_url ?? photos[row.id])}
            style={{ background: token.colorPrimaryBg, color: token.colorPrimaryTextActive, fontWeight: 700, flexShrink: 0 }}
          >
            {privacy ? '*' : initials(row.name)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
              onClick={() => openDetail(row)}
            >
              {privacy ? MASK : formatDisplayName(row.name)}
            </Button>
            <div style={{ fontSize: 12, color: token.colorTextTertiary, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>
                {row.gender ? `${GENDER_LABEL[row.gender]} · ` : ''}
                {privacy ? MASK : row.registration_code}
              </span>
              {row.tags && row.tags.length > 0 && (
                <span>
                  {row.tags.slice(0, 2).map((t) => (
                    <Tag
                      key={t}
                      onClick={(e) => {
                        e.stopPropagation()
                        setTag(t)
                        resetPage()
                      }}
                      style={{ borderRadius: 6, fontSize: 11, lineHeight: '16px', paddingInline: 5, cursor: 'pointer' }}
                    >
                      {t}
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
            <Tag
              style={{
                marginInlineStart: 4,
                borderRadius: 6,
                fontWeight: 500,
                background: token.colorFillTertiary,
                color: token.colorTextSecondary,
                border: 'none',
              }}
            >
              {row.dorms.name}
            </Tag>
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
        <StudentActions
          row={row}
          canWrite={canWrite}
          canDelete={canDelete}
          onDetail={openDetail}
          onCard={(s) => setCardStudents([s])}
          onEdit={openEdit}
          onDelete={handleDelete}
          token={token}
        />
      ),
    },
  ], [sortBy, privacy, photos, canWrite, canDelete, token])

  // Sinkron dengan toggleSelectAll & dropdown pilihan tabel: semua baris hasil filter
  const allFilteredSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id)),
    [rows, selectedIdSet],
  )

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
          Tambah Siswa
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {tabActions}
      <StatsRow
        stats={stats}
        loading={statsQuery.isPending}
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
                      Tambah Siswa
                    </Button>
                    <Button icon={<FileExcelOutlined />} onClick={() => setImportOpen(true)}>
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
          pagination={pg.pagination}
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
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canWrite,
            loading: bulkDeleteMutation.isPending,
            confirm: {
              title: `Arsipkan ${selectedIds.length} siswa terpilih?`,
              description: 'Data akan ditandai terhapus (soft delete) dan bisa dipulihkan lewat tab Arsip.',
              okText: 'Ya, Arsipkan',
            },
            onClick: () => bulkArchive(selectedIds),
          },
        ]}
      />

      <StudentForm
        open={formOpen}
        student={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <ExportModal
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

      <MoveModal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        students={selectedStudents}
        classes={classesQuery.data ?? []}
        onMoved={() => setSelectedIds([])}
      />

      <GraduateModal
        open={graduateOpen}
        onClose={() => setGraduateOpen(false)}
        students={selectedStudents}
        onGraduated={() => setSelectedIds([])}
      />

      <BroadcastModal open={waOpen} onClose={() => setWaOpen(false)} students={selectedStudents} />

      <GatewayModal open={waSettingsOpen} onClose={() => setWaSettingsOpen(false)} />

      <CardModal
        open={cardStudents !== null}
        onClose={() => setCardStudents(null)}
        students={cardStudents ?? []}
      />

      <CardsModal
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

      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} defaultClassId={classId} />

      <PhotoModal open={bulkPhotoOpen} onClose={() => setBulkPhotoOpen(false)} />

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        allStudents={allStudents}
        onSelectStudent={openDetail}
      />

      {detail !== null && (
        <Suspense fallback={null}>
          <DetailDrawer
            open={!!detail}
            student={detail}
            isPrivacyMode={privacy}
            onClose={closeDetail}
            onEdit={(s) => {
              closeDetail()
              openEdit(s)
            }}
          />
        </Suspense>
      )}

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}

// ─── Shell: satu halaman Siswa bertab (pola ?tab= — SKILLS.md §Skill 2) ─────
const STUDENT_TAB_ITEMS = [
  { key: 'aktif', label: 'Santri Aktif' },
  { key: 'arsip', label: 'Arsip' },
  { key: 'alumni', label: 'Alumni' },
  { key: 'wali', label: 'Hub Wali' },
]

/** Judul & subtitle per tab — dirender shell di ATAS tab bar (pola AttendancePage). */
const STUDENT_TAB_META: Record<string, { title: string; subtitle: (total?: number) => string }> = {
  aktif: {
    title: 'Data Siswa',
    subtitle: (total) => `Kelola ${total ?? '…'} data siswa aktif dalam sistem laporan.`,
  },
  arsip: {
    title: 'Arsip Siswa',
    subtitle: () => 'Lihat & pulihkan data siswa yang sudah dihapus',
  },
  alumni: {
    title: 'Alumni',
    subtitle: () => 'Jejak siswa yang telah lulus, riwayat poin, raport, dan log tetap tersimpan',
  },
  wali: {
    title: 'Hub Wali',
    subtitle: () => 'Rekap ayah/ibu/wali per keluarga, dikelompokkan per nomor HP',
  },
}

/** Halaman Siswa: aktif / arsip / alumni dalam satu route (?tab=), aksi kenaikan kelas = modal. */
export function StudentsPage() {
  const { tab, setTab } = useUrlTab('aktif', { keys: STUDENT_TAB_ITEMS.map((t) => t.key) })
  const { role } = useProfile()
  // RLS student_guardians: hanya developer/admin/manager yang bisa baca
  const canViewWali = Boolean(role && ['developer', 'admin', 'manager'].includes(role))
  const [promoteOpen, setPromoteOpen] = useState(false)
  // Cache dibagi dengan useStudentStats di tab aktif — tanpa fetch ganda
  const statsQuery = useStudentStats()
  const meta = STUDENT_TAB_META[tab] ?? STUDENT_TAB_META.aktif
  // Host aksi di ujung kanan tab bar — diisi tiap tab via useTabActions (ActionsSlot)
  const [actionsHost, setActionsHost] = useState<HTMLDivElement | null>(null)

  return (
    <TabActionsContext.Provider value={actionsHost}>
      <ShellStagger>
        <ShellItem>
          <PageHeader
            title={meta.title}
            subtitle={meta.subtitle(statsQuery.data?.total)}
            extra={<div ref={setActionsHost} style={{ display: 'flex', alignItems: 'center' }} />}
          />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={tab}
            onChange={setTab}
        items={STUDENT_TAB_ITEMS.filter((t) => t.key !== 'wali' || canViewWali).map((t) => ({
          ...t,
          children:
            t.key === 'aktif' ? (
              <StudentsActiveTab
                active={tab === 'aktif'}
                promoteOpen={promoteOpen}
                onNavigateTab={setTab}
                onOpenPromote={() => setPromoteOpen(true)}
              />
            ) : t.key === 'arsip' ? (
              <ArchivePage active={tab === 'arsip'} />
            ) : t.key === 'wali' ? (
              <WaliTab active={tab === 'wali'} />
            ) : (
              <AlumniPage active={tab === 'alumni'} />
            ),
        }))}
        />
        </ShellItem>
      </ShellStagger>
      <PromoteModal open={promoteOpen} onClose={() => setPromoteOpen(false)} />
    </TabActionsContext.Provider>
  )
}
