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
  KeyOutlined,
  ManOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  SlidersOutlined,
  StopOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WhatsAppOutlined,
  WomanOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
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
  useBulkDeleteTeachers,
  useBulkRestoreTeachers,
  useCreateTeacher,
  useDeleteTeacher,
  useSetTeacherStatusBulk,
  useTeachers,
  useUpdateTeacher,
} from './hooks'
import { TeacherForm } from './components/TeacherForm'
import { TeacherDrawer } from './components/TeacherDrawer'
import { TeacherExportModal } from './components/TeacherExportModal'
import { TeacherImportModal } from './components/TeacherImportModal'
import { waLink } from '../students/wa'
import { TEACHER_STATUS_META, GENDER_LABEL } from './status'
import type { Gender, Teacher, TeacherFormValues, TeacherSort, TeacherStatus } from './types'

const MASK = '••••••'

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

export function TeachersPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [status, setStatus] = useState<TeacherStatus | ''>('')
  const [gender, setGender] = useState<Gender | undefined>()
  const [subject, setSubject] = useState<string | undefined>()
  const [sortBy, setSortBy] = useState<TeacherSort | undefined>()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [privacy, setPrivacy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [detail, setDetail] = useState<Teacher | null>(null)

  const searchInputRef = useRef<InputRef>(null)

  // Pola StudentsPage: fetch semua guru sekali (puluhan baris), filter+sort di memori
  const teachersQuery = useTeachers({ page: 1, pageSize: 1000 })
  const createMutation = useCreateTeacher()
  const updateMutation = useUpdateTeacher()
  const deleteMutation = useDeleteTeacher()
  const bulkDeleteMutation = useBulkDeleteTeachers()
  const bulkRestoreMutation = useBulkRestoreTeachers()
  const bulkStatusMutation = useSetTeacherStatusBulk()

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
    return [...data].sort(comparators[sortBy ?? 'name_asc'])
  }, [allTeachers, debouncedSearch, status, gender, subject, sortBy])

  // Pagination client-side — slice dari hasil filter+sort di memori
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  )

  const resetPage = () => setPage(1)

  const clearAllFilters = () => {
    setSearch('')
    setStatus('')
    setGender(undefined)
    setSubject(undefined)
    setSortBy(undefined)
    setSelectedIds([])
    resetPage()
  }

  // Jumlah filter lanjutan aktif — badge di tombol "Lainnya"
  const advFilterCount = [subject, sortBy].filter(Boolean).length

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
  }, [debouncedSearch, status, gender, subject, sortBy])

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

  const confirmBulkArchive = () => {
    const ids = selectedIds
    const count = ids.length
    modal.confirm({
      title: `Arsipkan ${count} guru terpilih?`,
      content: 'Data akan ditandai terhapus (soft delete) dan bisa dipulihkan lewat menu Arsip Guru.',
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
          .catch((err: Error) => message.error(err.message || 'Gagal mengarsipkan guru')),
    })
  }

  const confirmBulkStatus = (next: TeacherStatus) => {
    const label = TEACHER_STATUS_META[next].label.toLowerCase()
    modal.confirm({
      title: `Set ${selectedIds.length} guru menjadi "${label}"?`,
      okText: 'Ya',
      cancelText: 'Batal',
      onOk: () =>
        bulkStatusMutation
          .mutateAsync({ ids: selectedIds, status: next })
          .then(() => {
            setSelectedIds([])
            message.success(`Status ${selectedIds.length} guru diubah menjadi ${label}`)
          })
          .catch((err: Error) => message.error(err.message || 'Gagal mengubah status guru')),
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
            key: 'import',
            icon: <FileExcelOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  <div style={{ fontWeight: 600 }}>Import Data</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Unggah dari Excel atau Google Sheets</div>
                </span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                  <Kbd>I</Kbd>
                </span>
              </div>
            ),
            disabled: !canWrite,
            onClick: () => setImportOpen(true),
          },
          {
            key: 'export',
            icon: <ExportOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  <div style={{ fontWeight: 600 }}>Export Data</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Excel atau CSV sesuai filter aktif</div>
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
      },
      {
        key: 'manajemen',
        type: 'group' as const,
        label: 'Manajemen',
        children: [
          {
            key: 'archive',
            icon: <HistoryOutlined />,
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>
                  <div style={{ fontWeight: 600 }}>Arsip Guru</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>Lihat &amp; pulihkan data guru dihapus</div>
                </span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                  <Kbd>A</Kbd>
                </span>
              </div>
            ),
            onClick: () => navigate('/master/teachers/archive'),
          },
        ],
      },
    ],
  }

  // -------------------------------------------------------------------------
  // Shortcut keyboard (juga menjadi isi palet "?")
  // -------------------------------------------------------------------------

  const isBlocked = formOpen || importOpen || exportOpen || detail !== null

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
      run: () => navigate('/master/teachers/archive'),
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

  // Ikon sorter gaya Esceha.id — template di shared/components/TableSortIcon.
  // Dibungkus fungsi: antd memanggil sortIcon sebagai fungsi biasa, jadi komponen
  // harus dirender sebagai elemen agar hooks-nya legal.
  const sortIcon = ({ sortOrder }: { sortOrder?: 'ascend' | 'descend' | null }) => (
    <TableSortIcon sortOrder={sortOrder} />
  )

  // Urutan kolom sinkron dengan state sortBy (dipakai juga dropdown "Urutkan")
  const sortOrderOf = (key: keyof typeof SORT_PAIRS) =>
    columnSortOrder(sortBy, key, SORT_PAIRS)

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
      render: (v: string | null) => (privacy && v ? MASK : v || '-'),
    },
    {
      title: 'Mapel',
      dataIndex: 'subject',
      key: 'subject',
      responsive: ['lg'],
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Kontak',
      dataIndex: 'phone',
      key: 'phone',
      responsive: ['md'],
      render: (v: string | null) =>
        v ? (
          <Space size={4}>
            <span>{privacy ? MASK : v}</span>
            {!privacy && (
              <a href={waLink(v)} target="_blank" rel="noopener noreferrer" title="Chat WhatsApp">
                <WhatsAppOutlined style={{ color: token.colorSuccess }} />
              </a>
            )}
          </Space>
        ) : (
          '-'
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
      render: (v: TeacherStatus) => {
        const meta = TEACHER_STATUS_META[v]
        return (
          <StatusTag color={meta.color} icon={meta.icon}>
            {meta.label}
          </StatusTag>
        )
      },
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
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('id-ID') : '-'),
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
              title="Hapus guru ini?"
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

  const counts = useMemo(() => {
    const c = { total: allTeachers.length, active: 0, inactive: 0, on_leave: 0 }
    for (const t of allTeachers) c[t.status] += 1
    return c
  }, [allTeachers])

  // Sinkron dengan toggleSelectAll & dropdown pilihan tabel: semua baris hasil filter
  const allFilteredSelected = rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id))

  return (
    <div>
      <PageHeader
        title="Data Guru"
        subtitle={`Kelola ${totalActive || counts.total} pengajar, musyrif, dan staf.`}
        extra={
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
                Tambah Guru
              </Button>
            )}
          </Space>
        }
      />

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
          onClick={() => {
            setStatus('on_leave')
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
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} guru`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      {/* Bar aksi massal — muncul saat ada guru yang dipilih */}
      <BulkActionBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <Button size="small" icon={<ExportOutlined />} onClick={() => openExport('selected')}>
          Ekspor
        </Button>
        {canWrite && (
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => confirmBulkStatus('active')}>
            Aktifkan
          </Button>
        )}
        {canWrite && (
          <Button size="small" icon={<StopOutlined />} onClick={() => confirmBulkStatus('inactive')}>
            Nonaktifkan
          </Button>
        )}
        {canDelete && (
          <Button size="small" danger icon={<DeleteOutlined />} onClick={confirmBulkArchive}>
            Arsipkan
          </Button>
        )}
      </BulkActionBar>

      <TeacherForm
        open={formOpen}
        teacher={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <TeacherImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <TeacherExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={{
          search: debouncedSearch || undefined,
          status: status || undefined,
          gender,
          subject,
          sortBy,
        }}
        selectedIds={selectedIds}
        defaultScope={exportScope}
        filteredCount={rows.length}
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
