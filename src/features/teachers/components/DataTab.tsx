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
import {
  CheckCircleOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  IdcardOutlined,
  ManOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SearchOutlined,
  SlidersOutlined,
  StopOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WhatsAppOutlined,
  WomanOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { StatChip } from '../../../shared/components/StatChip'
import { FilterChips, type FilterChip } from '../../../shared/components/FilterChips'
import { ActionBar } from '../../../shared/components/ActionBar'
import { SortIcon } from '../../../shared/components/SortIcon'
import { columnSortOrder, sortByFromTableChange } from '../../../shared/utils/tableSort'
import { ShortcutsModal } from '../../../shared/components/ShortcutsModal'
import { actionMenuLabel } from '../../../shared/components/ActionMenu'
import { useTabActions } from '../../../shared/components/ActionsSlot'
import { useShortcuts, type ShortcutItem } from '../../../shared/hooks/useShortcuts'
import { useDebounce } from '../../../shared/hooks/useDebounce'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTablePagination } from '../../../shared/hooks/useTablePagination'
import {
  useBulkDeleteTeachers,
  useBulkRestoreTeachers,
  useCreateTeacher,
  useDeleteTeacher,
  useSetTeacherPinned,
  useSetTeacherStatusBulk,
  useTeachers,
  useUpdateTeacher,
} from '../hooks'
import { TeacherForm } from './TeacherForm'
import { TeacherDrawer } from './TeacherDrawer'
import { ExportModal } from './ExportModal'
import { ImportModal } from './ImportModal'
import { WaModal } from './WaModal'
import { ColumnSettings, type ColumnVisibility } from './ColumnSettings'
import { waLink } from '../../students/wa'
import { TEACHER_STATUS_META, GENDER_LABEL } from '../status'
import type {
  Gender,
  Teacher,
  TeacherFormValues,
  TeacherSort,
  TeacherStatus,
  TeacherType,
} from '../types'
import { TEACHER_TYPE_LABEL } from '../types'

const MASK = '••••••'

const COLUMNS_STORAGE_KEY = 'teachers_columns'

// Default semua kolom opsional tampil — reset dari popover kolom juga pakai ini
const DEFAULT_COLUMNS: ColumnVisibility = { nbm: true, subject: true, phone: true, status: true, join_date: true }

const STATUS_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Aktif', value: 'active' },
  { label: 'Nonaktif', value: 'inactive' },
  { label: 'Cuti', value: 'on_leave' },
]

const GENDER_TABS = [
  { label: 'Semua', value: '' },
  { label: 'Laki-laki', value: 'L', icon: <ManOutlined /> },
  { label: 'Perempuan', value: 'P', icon: <WomanOutlined /> },
]

const TYPE_OPTIONS = (Object.keys(TEACHER_TYPE_LABEL) as TeacherType[]).map((t) => ({
  value: t,
  label: TEACHER_TYPE_LABEL[t],
}))

const SORT_OPTIONS: { value: TeacherSort; label: string }[] = [
  { value: 'name_asc', label: 'Nama A–Z' },
  { value: 'name_desc', label: 'Nama Z–A' },
  { value: 'nbm_asc', label: 'NBM A–Z' },
  { value: 'nbm_desc', label: 'NBM Z–A' },
  { value: 'status_asc', label: 'Status A–Z' },
  { value: 'status_desc', label: 'Status Z–A' },
  { value: 'join_desc', label: 'Terbaru bergabung' },
  { value: 'join_asc', label: 'Terlama bergabung' },
]

// Pasangan [asc, desc] per kolom — dipakai header tabel, dropdown "Urutkan", dan onChange sorter
const SORT_PAIRS = {
  name: ['name_asc', 'name_desc'],
  nbm: ['nbm_asc', 'nbm_desc'],
  status: ['status_asc', 'status_desc'],
  join_date: ['join_asc', 'join_desc'],
} as const

interface DataTabProps {
  /** true saat tab ini aktif — wajib untuk gate portal aksi tab bar */
  active: boolean
  onNavigateTab: (tab: string) => void
}

/** Tab "Data Guru" — daftar guru lengkap: filter, pin, WA massal, status cepat */
export function DataTab({ active, onNavigateTab }: DataTabProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [status, setStatus] = useState<TeacherStatus | ''>('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [subject, setSubject] = useState<string | undefined>()
  const [type, setType] = useState<TeacherType | undefined>()
  const [missingWa, setMissingWa] = useState(false)
  const [sortBy, setSortBy] = useState<TeacherSort | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [detail, setDetail] = useState<Teacher | null>(null)
  const [columnVis, setColumnVis] = useState<ColumnVisibility>(() => {
    try {
      return { ...DEFAULT_COLUMNS, ...JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? '{}') }
    } catch {
      return { ...DEFAULT_COLUMNS }
    }
  })

  const searchInputRef = useRef<InputRef>(null)

  const handleColumns = (next: ColumnVisibility) => {
    setColumnVis(next)
    try {
      localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // penyimpanan penuh/tidak tersedia — pilihan tetap berlaku untuk sesi ini
    }
  }

  // Pola StudentsPage: fetch semua guru sekali (puluhan baris), filter+sort di memori
  const teachersQuery = useTeachers({ page: 1, pageSize: 1000 })
  const createMutation = useCreateTeacher()
  const updateMutation = useUpdateTeacher()
  const deleteMutation = useDeleteTeacher()
  const bulkDeleteMutation = useBulkDeleteTeachers()
  const bulkRestoreMutation = useBulkRestoreTeachers()
  const bulkStatusMutation = useSetTeacherStatusBulk()
  const pinMutation = useSetTeacherPinned()

  const allTeachers = useMemo(() => teachersQuery.data?.data ?? [], [teachersQuery.data])

  // Total dari server — untuk mendeteksi daftar terpotong batas 1000
  const totalActive = teachersQuery.data?.total ?? 0
  const isTruncated = totalActive > allTeachers.length

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const subjectOptions = useMemo(
    () =>
      [
        ...new Set(
          allTeachers.map((t) => t.subject).filter((s): s is string => !!s),
        ),
      ]
        .sort((a, b) => a.localeCompare(b, 'id'))
        .map((s) => ({ value: s, label: s })),
    [allTeachers],
  )

  const noWaCount = useMemo(
    () => allTeachers.filter((t) => !t.phone).length,
    [allTeachers],
  )

  const rows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    const data = allTeachers.filter((t) => {
      if (
        q &&
        !`${t.name} ${t.nbm ?? ''} ${t.subject ?? ''} ${t.email ?? ''} ${t.phone ?? ''} ${t.nip ?? ''} ${t.nuptk ?? ''}`
          .toLowerCase()
          .includes(q)
      )
        return false
      if (status && t.status !== status) return false
      if (gender && t.gender !== gender) return false
      if (subject && t.subject !== subject) return false
      if (type && t.type !== type) return false
      if (missingWa && t.phone) return false
      return true
    })

    const cmpName = (a: Teacher, b: Teacher) => a.name.localeCompare(b.name, 'id')
    const cmpNbm = (a: Teacher, b: Teacher) =>
      (a.nbm ?? '').localeCompare(b.nbm ?? '', 'id', { numeric: true }) || cmpName(a, b)
    const cmpStatus = (a: Teacher, b: Teacher) =>
      TEACHER_STATUS_META[a.status].label.localeCompare(
        TEACHER_STATUS_META[b.status].label,
        'id',
      ) || cmpName(a, b)
    const cmpJoin = (a: Teacher, b: Teacher) =>
      (b.join_date ?? '').localeCompare(a.join_date ?? '') || cmpName(a, b)

    const comparators: Record<TeacherSort, (a: Teacher, b: Teacher) => number> = {
      name_asc: cmpName,
      name_desc: (a, b) => cmpName(b, a),
      nbm_asc: cmpNbm,
      nbm_desc: (a, b) => cmpNbm(b, a),
      status_asc: cmpStatus,
      status_desc: (a, b) => cmpStatus(b, a),
      join_desc: cmpJoin,
      join_asc: (a, b) => cmpJoin(b, a),
    }
    // sort() modern stabil — sort kedua memindahkan pin ke atas tanpa merusak urutan
    const sorted = [...data].sort(comparators[sortBy ?? 'name_asc'])
    return sorted.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned))
  }, [allTeachers, debouncedSearch, status, gender, subject, type, missingWa, sortBy])

  // Pagination client-side — slice dari hasil filter+sort di memori
  const pg = useTablePagination(rows.length, { label: 'guru' })
  const paginatedRows = useMemo(
    () => rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize),
    [rows, pg.page, pg.pageSize],
  )

  const resetPage = pg.reset

  const clearAllFilters = () => {
    setSearch('')
    setStatus('')
    setGender(undefined)
    setSubject(undefined)
    setType(undefined)
    setMissingWa(false)
    setSortBy(undefined)
    setSelectedIds([])
    resetPage()
  }

  // Jumlah filter lanjutan aktif — badge di tombol "Lainnya"
  const advFilterCount = [subject, sortBy, type].filter(Boolean).length + (missingWa ? 1 : 0)

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
    if (status)
      chips.push({
        key: 'status',
        label: `Status: ${TEACHER_STATUS_META[status].label}`,
        onClear: () => {
          setStatus('')
          resetPage()
        },
      })
    if (gender)
      chips.push({
        key: 'gender',
        label: GENDER_LABEL[gender],
        onClear: () => {
          setGender(undefined)
          resetPage()
        },
      })
    if (subject)
      chips.push({
        key: 'subject',
        label: `Mapel: ${subject}`,
        onClear: () => {
          setSubject(undefined)
          resetPage()
        },
      })
    if (type)
      chips.push({
        key: 'type',
        label: `Jenis: ${TEACHER_TYPE_LABEL[type]}`,
        onClear: () => {
          setType(undefined)
          resetPage()
        },
      })
    if (missingWa)
      chips.push({
        key: 'missing-wa',
        label: 'Tanpa WA',
        onClear: () => {
          setMissingWa(false)
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
  }, [debouncedSearch, status, gender, subject, type, missingWa, sortBy])

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

  const togglePrivacy = () => {
    const next = !privacy
    setPrivacy(next)
    message.info(
      next ? 'Mode privasi diaktifkan — Data sensitif disembunyikan' : 'Mode privasi dinonaktifkan',
    )
  }

  const handleRefresh = () => {
    void teachersQuery.refetch()
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (teacher: Teacher) => {
    setEditing(teacher)
    setFormOpen(true)
  }

  const openExport = (scope: 'filtered' | 'selected') => {
    setExportScope(scope)
    setExportOpen(true)
  }

  const handleSubmit = (values: TeacherFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan guru')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: (updated) => {
            message.success('Guru diperbarui')
            setFormOpen(false)
            // perbarui drawer bila sedang terbuka untuk guru yang sama
            setDetail((current) => (current?.id === updated.id ? updated : current))
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Guru ditambahkan')
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
          <span>{count === 1 ? '1 guru diarsipkan' : `${count} guru diarsipkan`}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              bulkRestoreMutation.mutate(ids, {
                onSuccess: () =>
                  message.success(count === 1 ? 'Guru dipulihkan' : `${count} guru dipulihkan`),
                onError: (err: Error) => message.error(err.message || 'Gagal memulihkan guru'),
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
        // bersihkan dari seleksi massal bila guru ini sedang dipilih
        setSelectedIds((prev) => prev.filter((sid) => sid !== id))
        setDetail((current) => (current?.id === id ? null : current))
        showUndoToast([id], 1)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengarsipkan guru'),
    })
  }

  const bulkArchive = (ids: string[]) => {
    const count = ids.length
    bulkDeleteMutation
      .mutateAsync(ids)
      .then(() => {
        setSelectedIds([])
        showUndoToast(ids, count)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan guru'))
  }

  const bulkStatus = (next: TeacherStatus) => {
    const label = TEACHER_STATUS_META[next].label.toLowerCase()
    bulkStatusMutation
      .mutateAsync({ ids: selectedIds, status: next })
      .then(() => {
        setSelectedIds([])
        message.success(`Status ${selectedIds.length} guru diubah menjadi ${label}`)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal mengubah status guru'))
  }

  /** Ganti status satu guru langsung dari sel Status di tabel */
  const quickStatus = (row: Teacher, next: TeacherStatus) => {
    bulkStatusMutation
      .mutateAsync({ ids: [row.id], status: next })
      .then(() => message.success(`Status ${row.name} → ${TEACHER_STATUS_META[next].label}`))
      .catch((err: Error) => message.error(err.message || 'Gagal mengubah status guru'))
  }

  const togglePin = (row: Teacher) => {
    pinMutation.mutate(
      { id: row.id, isPinned: !row.is_pinned },
      {
        onSuccess: () =>
          message.success(
            row.is_pinned ? `Sematkan "${row.name}" dilepas` : `"${row.name}" disematkan ke atas`,
          ),
        onError: (err: Error) => message.error(err.message || 'Gagal menyematkan guru'),
      },
    )
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
            key: 'import',
            icon: <FileExcelOutlined />,
            label: actionMenuLabel('Import Data', 'Unggah dari Excel atau Google Sheets', ['I']),
            disabled: !canWrite,
            onClick: () => setImportOpen(true),
          },
          {
            key: 'export',
            icon: <ExportOutlined />,
            label: actionMenuLabel('Export Data', 'Excel atau CSV sesuai filter aktif', ['Ctrl', 'E']),
            onClick: () => openExport('filtered'),
          },
        ],
      },
    ],
  }

  // -------------------------------------------------------------------------
  // Shortcut keyboard (juga menjadi isi palet "?")
  // -------------------------------------------------------------------------

  const isBlocked = formOpen || importOpen || exportOpen || waOpen || detail !== null

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
      label: 'Tambah guru baru',
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
      keys: ['I'],
      label: 'Import data',
      group: 'Aksi',
      icon: <FileExcelOutlined />,
      when: canWrite,
      run: () => setImportOpen(true),
    },
    {
      keys: ['A'],
      label: 'Buka arsip guru',
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

  const handleTableChange: TableProps<Teacher>['onChange'] = (_pagination, _filters, sorter, extra) => {
    if (extra.action !== 'sort') return
    const s = Array.isArray(sorter) ? sorter[0] : sorter
    setSortBy(sortByFromTableChange(s, SORT_PAIRS))
    resetPage()
  }

  // Ikon sorter gaya Esceha.id — template di shared/components/SortIcon.
  // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
  // harus dirender sebagai elemen agar hooks-nya legal.
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <SortIcon sortOrder={sortOrder} />
  )

  // Urutan kolom sinkron dengan state sortBy (dipakai juga dropdown "Urutkan")
  const sortOrderOf = (key: keyof typeof SORT_PAIRS) =>
    columnSortOrder(sortBy, key, SORT_PAIRS)

  const statusCell = (row: Teacher) => {
    const meta = TEACHER_STATUS_META[row.status]
    const tag = (
      <StatusTag color={meta.color} icon={meta.icon}>
        {meta.label}
      </StatusTag>
    )
    if (!canWrite) return tag
    return (
      <Dropdown
        trigger={['click']}
        menu={{
          items: (['active', 'inactive', 'on_leave'] as TeacherStatus[])
            .filter((s) => s !== row.status)
            .map((s) => ({ key: s, label: `Jadi ${TEACHER_STATUS_META[s].label}` })),
          onClick: ({ key }) => quickStatus(row, key as TeacherStatus),
        }}
      >
        <span style={{ cursor: 'pointer' }} title="Klik untuk ganti status">
          {tag}
        </span>
      </Dropdown>
    )
  }

  const columns: TableColumnsType<Teacher> = [
    {
      title: 'Guru',
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
            {privacy ? '*' : row.name.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, fontSize: 14 }}
              onClick={() => setDetail(row)}
            >
              {row.name}
            </Button>
            <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
              {privacy ? MASK : row.email || '—'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'NBM',
      dataIndex: 'nbm',
      key: 'nbm',
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('nbm'),
      responsive: ['md'],
      hidden: !(columnVis.nbm ?? true),
      render: (v: string | null) => (privacy && v ? MASK : v || '-'),
    },
    {
      title: 'Mapel',
      dataIndex: 'subject',
      key: 'subject',
      responsive: ['lg'],
      hidden: !(columnVis.subject ?? true),
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Kontak',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['md'],
      hidden: !(columnVis.phone ?? true),
      render: (v: string | null) => (
        <Space size={4}>
          <span>{privacy ? MASK : v || '-'}</span>
          <Tooltip title={privacy ? 'Mode privasi aktif' : v ? 'Chat WhatsApp' : 'Nomor HP belum tersedia'}>
            <span>
              <Button
                type="text"
                size="small"
                disabled={!v || !!privacy}
                icon={<WhatsAppOutlined style={{ color: v && !privacy ? token.colorSuccess : undefined }} />}
                onClick={() => v && window.open(waLink(v), '_blank', 'noopener')}
              />
            </span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('status'),
      hidden: !(columnVis.status ?? true),
      render: (_: TeacherStatus, row) => statusCell(row),
    },
    {
      title: 'Bergabung',
      dataIndex: 'join_date',
      key: 'join_date',
      width: 120,
      sorter: true,
      sortIcon,
      sortOrder: sortOrderOf('join_date'),
      responsive: ['lg'],
      hidden: !(columnVis.join_date ?? true),
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('id-ID') : '-'),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      render: (_, row) => (
        <Space size={0}>
          <Tooltip title={row.is_pinned ? 'Lepas sematan' : 'Sematkan ke atas'}>
            <Button
              type="text"
              icon={
                row.is_pinned ? (
                  <PushpinFilled style={{ color: token.colorWarning }} />
                ) : (
                  <PushpinOutlined />
                )
              }
              onClick={() => togglePin(row)}
            />
          </Tooltip>
          <Tooltip title="Lihat detail">
            <Button type="text" icon={<IdcardOutlined />} onClick={() => setDetail(row)} />
          </Tooltip>
          <Tooltip title={row.phone ? 'Chat WhatsApp' : 'Nomor HP belum tersedia'}>
            <span>
              <Button
                type="text"
                disabled={!row.phone}
                icon={<WhatsAppOutlined style={{ color: row.phone ? token.colorSuccess : undefined }} />}
                onClick={() => row.phone && window.open(waLink(row.phone), '_blank', 'noopener')}
              />
            </span>
          </Tooltip>
          {canWrite && (
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus guru ini?"
              description="Data akan ditandai terhapus (soft delete)."
              onConfirm={() => handleDelete(row.id)}
              okText="Ya, Hapus"
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

  const counts = useMemo(() => {
    const c = { total: allTeachers.length, active: 0, inactive: 0, on_leave: 0 }
    for (const t of allTeachers) c[t.status] += 1
    return c
  }, [allTeachers])

  // Sinkron dengan toggleSelectAll & dropdown pilihan tabel: semua baris hasil filter
  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))

  const selectedTeachers = useMemo(
    () => allTeachers.filter((t) => selectedIdSet.has(t.id)),
    [allTeachers, selectedIdSet],
  )

  // Aksi halaman di ujung kanan tab bar (judul & subtitle ada di shell, di atas tab bar)
  const tabActions = useTabActions(
    active,
    <Space wrap>
      <Tooltip title="Muat ulang (R)">
        <Button icon={<SyncOutlined spin={teachersQuery.isFetching} />} onClick={handleRefresh} />
      </Tooltip>
      <Dropdown menu={headerMenu} trigger={['click']} placement="bottomRight" overlayStyle={{ minWidth: 300 }}>
        <Tooltip title="Menu lainnya">
          <Button icon={<MoreOutlined />} />
        </Tooltip>
      </Dropdown>
      <Tooltip title="Shortcut keyboard (?)">
        <Button icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
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
        />
      </Tooltip>
      {canWrite && (
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Tambah Guru
        </Button>
      )}
    </Space>,
  )

  return (
    <div>
      {/* Judul & subtitle dirender shell (di atas tab bar); aksi halaman di ujung kanan tab bar */}
      {tabActions}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Total Guru"
          value={counts.total}
          color="indigo"
          loading={teachersQuery.isPending}
          onClick={() => {
            setStatus('')
            resetPage()
          }}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Aktif"
          value={counts.active}
          color="emerald"
          loading={teachersQuery.isPending}
          active={status === 'active'}
          onClick={() => {
            setStatus('active')
            resetPage()
          }}
        />
        <StatChip
          icon={<StopOutlined />}
          label="Nonaktif"
          value={counts.inactive}
          color="rose"
          loading={teachersQuery.isPending}
          active={status === 'inactive'}
          hideIfZero
          onClick={() => {
            setStatus('inactive')
            resetPage()
          }}
        />
        <StatChip
          icon={<PauseCircleOutlined />}
          label="Cuti"
          value={counts.on_leave}
          color="amber"
          loading={teachersQuery.isPending}
          active={status === 'on_leave'}
          hideIfZero
          onClick={() => {
            setStatus('on_leave')
            resetPage()
          }}
        />
        {/* Insight: guru tanpa WA — angka nyata dari data ter-fetch, klik = filter */}
        {noWaCount > 0 && !missingWa && (
          <Tooltip title="Klik untuk melihat guru tanpa nomor WhatsApp">
            <Button
              icon={<WhatsAppOutlined />}
              onClick={() => {
                setMissingWa(true)
                resetPage()
              }}
              style={{
                height: 'auto',
                paddingInline: 12,
                borderColor: token.colorWarningBorder,
                background: token.colorWarningBg,
              }}
            >
              <span style={{ fontWeight: 600 }}>{noWaCount}</span> Guru Tanpa WA
            </Button>
          </Tooltip>
        )}
      </div>

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
              setStatus(v as TeacherStatus | '')
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
            placeholder="Cari nama / NBM / mapel / email…"
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
                placeholder="Jenis tugas"
                allowClear
                style={{ minWidth: 150 }}
                value={type}
                onChange={(v) => {
                  setType(v)
                  resetPage()
                }}
                options={TYPE_OPTIONS}
              />
              <Select
                placeholder="Mata pelajaran"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 190 }}
                value={subject}
                onChange={(v) => {
                  setSubject(v)
                  resetPage()
                }}
                options={subjectOptions}
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
              <ColumnSettings value={columnVis} onChange={handleColumns} />
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
            message={`Menampilkan ${allTeachers.length.toLocaleString('id')} dari ${totalActive.toLocaleString('id')} guru`}
            description="Daftar dibatasi 1.000 guru — gunakan filter atau pencarian untuk melihat guru lainnya. Ekspor tetap mencakup seluruh data yang cocok."
          />
        )}

        <Table<Teacher>
          rowKey="id"
          columns={columns}
          dataSource={paginatedRows}
          loading={teachersQuery.isPending}
          onChange={handleTableChange}
          showSorterTooltip={false}
          onRow={(row) => ({
            style: row.is_pinned ? { background: token.colorWarningBg } : undefined,
          })}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  allTeachers.length > 0
                    ? 'Tidak ada guru yang cocok dengan filter'
                    : 'Belum ada guru — tambahkan pengajar pertama'
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
                text: `Pilih semua hasil filter (${rows.length} guru)`,
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

      {/* Bar aksi massal — muncul saat ada guru yang dipilih */}
      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          { key: 'wa', label: 'WA Massal', icon: <WhatsAppOutlined />, onClick: () => setWaOpen(true) },
          { key: 'export', label: 'Ekspor', icon: <ExportOutlined />, onClick: () => openExport('selected') },
          {
            key: 'activate',
            label: 'Aktifkan',
            icon: <CheckCircleOutlined />,
            hidden: !canWrite,
            loading: bulkStatusMutation.isPending,
            confirm: { title: `Set ${selectedIds.length} guru menjadi "aktif"?`, okText: 'Ya, Terapkan' },
            onClick: () => bulkStatus('active'),
          },
          {
            key: 'deactivate',
            label: 'Nonaktifkan',
            icon: <StopOutlined />,
            hidden: !canWrite,
            loading: bulkStatusMutation.isPending,
            confirm: { title: `Set ${selectedIds.length} guru menjadi "nonaktif"?`, okText: 'Ya, Terapkan' },
            onClick: () => bulkStatus('inactive'),
          },
          {
            key: 'archive',
            label: 'Arsipkan',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canDelete,
            loading: bulkDeleteMutation.isPending,
            confirm: {
              title: `Arsipkan ${selectedIds.length} guru terpilih?`,
              description: 'Data akan ditandai terhapus (soft delete) dan bisa dipulihkan lewat tab Arsip.',
              okText: 'Ya, Arsipkan',
            },
            onClick: () => bulkArchive(selectedIds),
          },
        ]}
      />

      <TeacherForm
        open={formOpen}
        teacher={editing}
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
          status: status || undefined,
          gender,
          subject,
          type,
          missingWa: missingWa || undefined,
          sortBy,
        }}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={rows.length}
      />

      <WaModal
        open={waOpen}
        teachers={selectedTeachers}
        onClose={() => setWaOpen(false)}
      />

      <TeacherDrawer
        open={!!detail}
        teacher={detail}
        isPrivacyMode={privacy}
        onClose={() => setDetail(null)}
        onEdit={canWrite ? openEdit : undefined}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
