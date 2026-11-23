import { useEffect, useMemo, useRef, useState } from 'react'
import {
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  AppstoreOutlined,
  ApartmentOutlined,
  CheckCircleOutlined,
  DeploymentUnitOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ImportOutlined,
  MoreOutlined,
  PlusOutlined,
  PrinterOutlined,
  QuestionCircleOutlined,
  RestOutlined,
  SearchOutlined,
  TableOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import Papa from 'papaparse'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { StatChip } from '../../shared/components/StatChip'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { ShortcutsModal, Kbd } from '../../shared/components/ShortcutsModal'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import {
  fetchDormResidentIds,
  downloadDormsXlsx,
  downloadPlacementsXlsx,
  type DormExportRow,
} from './api'
import { usePlacementsExport } from './hooks'
import {
  useAssignStudents,
  useCreateDorm,
  useDeleteDorm,
  useDormOccupancy,
  useDorms,
  useMusyrifBrief,
  useUpdateDorm,
} from './hooks'
import { DormForm } from './components/DormForm'
import { AssignModal } from './components/AssignModal'
import { DetailDrawer } from './components/DetailDrawer'
import { TabPlacements } from './components/TabPlacements'
import { BoardView } from './components/BoardView'
import { ImportModal } from './components/ImportModal'
import { DistributeModal } from './components/DistributeModal'
import { PlaceModal } from './components/PlaceModal'
import { PrintModal } from './components/PrintModal'
import {
  GENDER_COLOR,
  GENDER_LABEL,
  GENDER_OPTIONS,
  occupancyStroke,
  STATUS_META,
  STATUS_OPTIONS,
} from './meta'
import type { Dorm, DormFormValues, DormGender, DormStatus } from './types'

// ------------------------------------------------------------
// Persistensi mode tampilan (pola versi-key ala Sidebar)
// ------------------------------------------------------------
const VIEW_KEY = 'dorms-view-v1'
type ViewMode = 'tabel' | 'papan'

function loadView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'papan' ? 'papan' : 'tabel'
  } catch {
    return 'tabel'
  }
}

interface AssignState {
  studentIds: string[]
  fixedDormId?: string
}

export function DormsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  // ------------------------------------------------------------
  // Filter — dihitung di KLIEN (data kamar ≤200 baris, satu fetch)
  // ------------------------------------------------------------
  const [search, setSearch] = useState('')
  const [gender, setGender] = useState<DormGender | undefined>()
  const [status, setStatus] = useState<DormStatus | undefined>()
  const [musyrifId, setMusyrifId] = useState<string | undefined>()
  const [showPenuhOnly, setShowPenuhOnly] = useState(false)
  const [showTersediaOnly, setShowTersediaOnly] = useState(false)
  const [view, setView] = useState<ViewMode>(loadView)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dorm | null>(null)
  const [drawerDorm, setDrawerDorm] = useState<Dorm | null>(null)
  const [assignState, setAssignState] = useState<AssignState | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [distributeOpen, setDistributeOpen] = useState(false)
  const [textPlaceOpen, setTextPlaceOpen] = useState(false)
  /** null = tertutup; array id kamar yang dicetak (1 kamar dari drawer / semua dari header) */
  const [rosterDormIds, setRosterDormIds] = useState<string[] | null>(null)
  const searchRef = useRef<InputRef>(null)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view)
    } catch {
      /* private mode — abaikan */
    }
  }, [view])

  const dormsQuery = useDorms()
  const occupancyQuery = useDormOccupancy()
  const musyrifQuery = useMusyrifBrief()

  const createMutation = useCreateDorm()
  const updateMutation = useUpdateDorm()
  const deleteMutation = useDeleteDorm()
  const assignMutation = useAssignStudents()

  const occupancyMap = useMemo(
    () => new Map((occupancyQuery.data ?? []).map((o) => [o.dorm_id, o.occupied])),
    [occupancyQuery.data],
  )

  const allDorms = dormsQuery.data ?? []

  const isFull = (d: Dorm) => d.capacity > 0 && (occupancyMap.get(d.id) ?? 0) >= d.capacity

  const stats = useMemo(() => {
    const capacity = allDorms.reduce((sum, d) => sum + d.capacity, 0)
    const occupied = (occupancyQuery.data ?? []).reduce((sum, o) => sum + o.occupied, 0)
    return {
      total: allDorms.length,
      capacity,
      occupied,
      occupancyPct: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
      full: allDorms.filter(isFull).length,
      available: allDorms.filter((d) => d.status !== 'inactive' && d.capacity - (occupancyMap.get(d.id) ?? 0) > 0)
        .length,
      emptyBeds: allDorms.reduce((sum, d) => sum + Math.max(0, d.capacity - (occupancyMap.get(d.id) ?? 0)), 0),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDorms, occupancyQuery.data, occupancyMap])

  // Filter klien — instan, tanpa refetch server
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allDorms.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q) && !d.musyrif?.name?.toLowerCase().includes(q))
        return false
      if (gender && d.gender !== gender) return false
      if (status && d.status !== status) return false
      if (musyrifId && d.musyrif_id !== musyrifId) return false
      if (showPenuhOnly && !isFull(d)) return false
      if (
        showTersediaOnly &&
        (d.status === 'inactive' || d.capacity - (occupancyMap.get(d.id) ?? 0) <= 0)
      )
        return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDorms, search, gender, status, musyrifId, showPenuhOnly, showTersediaOnly, occupancyMap])

  const pg = useTablePagination(rows.length, { label: 'kamar' })

  const resetFilters = () => {
    setSearch('')
    setGender(undefined)
    setStatus(undefined)
    setMusyrifId(undefined)
    setShowPenuhOnly(false)
    setShowTersediaOnly(false)
    pg.setPage(1)
  }

  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    if (search)
      chips.push({ key: 'search', label: `Cari: "${search}"`, onClear: () => setSearch('') })
    if (gender)
      chips.push({
        key: 'gender',
        label: `Gender: ${GENDER_LABEL[gender]}`,
        onClear: () => setGender(undefined),
      })
    if (status)
      chips.push({
        key: 'status',
        label: `Status: ${STATUS_META[status].label}`,
        onClear: () => setStatus(undefined),
      })
    if (musyrifId) {
      const name = (musyrifQuery.data ?? []).find((t) => t.id === musyrifId)?.name
      chips.push({ key: 'musyrif', label: `Musyrif: ${name ?? ''}`, onClear: () => setMusyrifId(undefined) })
    }
    if (showPenuhOnly)
      chips.push({ key: 'penuh', label: 'Hanya penuh', onClear: () => setShowPenuhOnly(false) })
    if (showTersediaOnly)
      chips.push({ key: 'tersedia', label: 'Hanya bersisa slot', onClear: () => setShowTersediaOnly(false) })
    return chips
  }, [search, gender, status, musyrifId, showPenuhOnly, showTersediaOnly, musyrifQuery.data])

  // ------------------------------------------------------------
  // CRUD kamar
  // ------------------------------------------------------------
  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (dorm: Dorm) => {
    setEditing(dorm)
    setFormOpen(true)
  }

  const handleSubmit = (values: DormFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan kamar')
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, values },
        {
          onSuccess: () => {
            message.success('Kamar diperbarui')
            setFormOpen(false)
          },
          onError,
        },
      )
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          message.success('Kamar ditambahkan')
          setFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = (dorm: Dorm) => {
    deleteMutation.mutate(dorm.id, {
      onSuccess: () => {
        message.success('Kamar dihapus — penghuni dikosongkan')
        if (drawerDorm?.id === dorm.id) setDrawerDorm(null)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus kamar'),
    })
  }

  // ------------------------------------------------------------
  // Penempatan santri
  // ------------------------------------------------------------
  const openAssign = (studentIds: string[], fixedDormId?: string) =>
    setAssignState({ studentIds, fixedDormId })

  const handleAssignSubmit = (studentIds: string[], dormId: string | null) => {
    assignMutation.mutate(
      { ids: studentIds, dormId },
      {
        onSuccess: () => {
          message.success(
            dormId
              ? `${studentIds.length} santri ditempatkan ke kamar`
              : `${studentIds.length} santri dikosongkan dari asrama`,
          )
          setAssignState(null)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan penempatan'),
      },
    )
  }

  const handleEvict = (studentIds: string[]) => {
    assignMutation.mutate(
      { ids: studentIds, dormId: null },
      {
        onSuccess: () => message.success(`${studentIds.length} santri dikosongkan dari asrama`),
        onError: (err: Error) => message.error(err.message || 'Gagal mengosongkan penempatan'),
      },
    )
  }

  // ------------------------------------------------------------
  // Export CSV/Excel kamar (mengikuti filter aktif) & penempatan
  // ------------------------------------------------------------
  const buildDormExportRows = (): DormExportRow[] =>
    rows.map((d) => {
      const occupied = occupancyMap.get(d.id) ?? 0
      return {
        name: d.name,
        gender: d.gender ? (GENDER_LABEL[d.gender] ?? null) : null,
        capacity: d.capacity,
        occupied,
        musyrifName: d.musyrif?.name ?? null,
        status: STATUS_META[d.status]?.label ?? d.status,
      }
    })

  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const exportRows = buildDormExportRows()
      if (exportRows.length === 0) {
        message.warning('Tidak ada kamar untuk diekspor')
        return
      }
      const csv = Papa.unparse({
        fields: ['Kamar', 'Gender', 'Kapasitas', 'Terisi', 'Okupansi %', 'Musyrif', 'Status'],
        data: exportRows.map((d) => [
          d.name,
          d.gender ?? '',
          d.capacity,
          d.occupied,
          d.capacity > 0 ? Math.round((d.occupied / d.capacity) * 100) : 0,
          d.musyrifName ?? '',
          d.status,
        ]),
      })
      // BOM agar UTF-8 terbaca benar saat dibuka di Excel
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `asrama-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${exportRows.length} kamar diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor CSV')
    } finally {
      setExporting(false)
    }
  }

  const handleExportXlsx = async () => {
    setExporting(true)
    try {
      const exportRows = buildDormExportRows()
      if (exportRows.length === 0) {
        message.warning('Tidak ada kamar untuk diekspor')
        return
      }
      await downloadDormsXlsx(exportRows)
      message.success(`${exportRows.length} kamar diekspor (Excel)`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor Excel')
    } finally {
      setExporting(false)
    }
  }

  const placementsExportMutation = usePlacementsExport()
  const handleExportPlacementsXlsx = () => {
    placementsExportMutation.mutate({ placement: 'all' }, {
      onSuccess: (data) => {
        if (data.length === 0) {
          message.warning('Tidak ada data penempatan untuk diekspor')
          return
        }
        void downloadPlacementsXlsx(data)
        message.success(`${data.length} baris penempatan diekspor (Excel)`)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mengekspor penempatan'),
    })
  }

  /** Kosongkan seluruh penghuni satu kamar — id diambil saat tombol ditekan */
  const handleEvictDorm = (dorm: Dorm) => {
    void fetchDormResidentIds(dorm.id)
      .then((ids) => {
        if (ids.length > 0) handleEvict(ids)
      })
      .catch((err: Error) => message.error(err.message || 'Gagal mengambil penghuni kamar'))
  }

  const handlePrintAllRosters = () => {
    if (allDorms.length === 0) {
      message.warning('Belum ada kamar untuk dicetak')
      return
    }
    setRosterDormIds(allDorms.map((d) => d.id))
  }

  // ------------------------------------------------------------
  // Shortcut keyboard (palet via tombol ? atau ikon di header)
  // ------------------------------------------------------------
  const anyOverlayOpen =
    formOpen ||
    !!drawerDorm ||
    !!assignState ||
    importOpen ||
    distributeOpen ||
    textPlaceOpen ||
    rosterDormIds !== null
  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['N'],
        label: 'Tambah Kamar',
        description: 'Buka form kamar baru',
        group: 'Aksi',
        icon: <PlusOutlined />,
        run: openCreate,
        when: canWrite,
      },
      {
        keys: ['D'],
        label: 'Distribusi Otomatis',
        description: 'Bagi santri belum ditempatkan ke kamar bersisa',
        group: 'Aksi',
        icon: <DeploymentUnitOutlined />,
        run: () => setDistributeOpen(true),
        when: canWrite,
      },
      {
        keys: ['I'],
        label: 'Import Kamar',
        description: 'Impor kamar dari CSV',
        group: 'Aksi',
        icon: <ImportOutlined />,
        run: () => setImportOpen(true),
        when: canWrite,
      },
      {
        keys: ['T'],
        label: 'Penempatan via Teks',
        description: 'Tempel daftar kamar & santri, dicocokkan otomatis',
        group: 'Aksi',
        icon: <FileTextOutlined />,
        run: () => setTextPlaceOpen(true),
        when: canWrite,
      },
      {
        keys: ['E'],
        label: 'Export CSV',
        description: 'Unduh kamar sesuai filter aktif',
        group: 'Aksi',
        icon: <DownloadOutlined />,
        run: () => void handleExport(),
      },
      {
        keys: ['Ctrl', 'K'],
        label: 'Fokus pencarian',
        group: 'Aksi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
      {
        keys: ['B'],
        label: 'Ganti Tampilan',
        description: 'Tabel ↔ Papan kamar',
        group: 'Tampilan',
        icon: <AppstoreOutlined />,
        run: () => setView((v) => (v === 'tabel' ? 'papan' : 'tabel')),
      },
      {
        keys: ['?'],
        label: 'Palet shortcut',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => toggle(),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canWrite, rows],
  )

  const { isOpen, close, toggle, sections } = useShortcuts({
    items: shortcutItems,
    isBlocked: anyOverlayOpen,
  })

  // ------------------------------------------------------------
  // Tabel kamar
  // ------------------------------------------------------------
  const columns: TableColumnsType<Dorm> = [
    {
      title: 'Kamar',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_, row) => (
        <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => setDrawerDorm(row)}>
          {row.name}
        </Button>
      ),
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      width: 110,
      render: (v: DormGender | null) =>
        v ? <StatusTag color={GENDER_COLOR[v]}>{GENDER_LABEL[v] ?? v}</StatusTag> : '-',
    },
    {
      title: 'Okupansi',
      key: 'occupancy',
      width: 180,
      responsive: ['md'],
      sorter: (a, b) => {
        const pa = a.capacity > 0 ? (occupancyMap.get(a.id) ?? 0) / a.capacity : 0
        const pb = b.capacity > 0 ? (occupancyMap.get(b.id) ?? 0) / b.capacity : 0
        return pa - pb
      },
      render: (_, row) => {
        const occupied = occupancyMap.get(row.id) ?? 0
        const pct = row.capacity > 0 ? Math.min(100, Math.round((occupied / row.capacity) * 100)) : 0
        return (
          <Space size={10}>
            <Progress
              percent={pct}
              showInfo={false}
              size="small"
              style={{ width: 72, marginBottom: 0 }}
              strokeColor={occupancyStroke(pct)}
            />
            <Typography.Text style={{ fontSize: 12.5 }}>
              {occupied}/{row.capacity}
            </Typography.Text>
            {occupied > row.capacity && (
              <Tag color="red" style={{ marginInlineEnd: 0 }}>
                +{occupied - row.capacity}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Musyrif',
      key: 'musyrif',
      sorter: (a, b) => (a.musyrif?.name ?? '').localeCompare(b.musyrif?.name ?? ''),
      render: (_, row) => row.musyrif?.name || '-',
      responsive: ['lg'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (v: DormStatus | null, row) => {
        const occupied = occupancyMap.get(row.id) ?? 0
        const autoFull = v === 'active' && row.capacity > 0 && occupied >= row.capacity
        return (
          <Space size={4} wrap>
            {v && <StatusTag color={STATUS_META[v].color} icon={STATUS_META[v].icon}>{STATUS_META[v].label}</StatusTag>}
            {autoFull && <Tag color="orange">penuh (otomatis)</Tag>}
            {occupied > row.capacity && <Tag color="red">lebih {occupied - row.capacity}</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 90,
      render: (_, row) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
            {canDelete && (
              <Popconfirm
                title="Hapus kamar ini?"
                description={
                  (occupancyMap.get(row.id) ?? 0) > 0
                    ? `${occupancyMap.get(row.id)} penghuni akan dikosongkan dari kamar ini.`
                    : 'Data akan ditandai terhapus (soft delete).'
                }
                onConfirm={() => handleDelete(row)}
                okText="Hapus"
                cancelText="Batal"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
  ]

  const roomTab = (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <StatChip
          icon={<ApartmentOutlined />}
          label="Total Kamar"
          value={stats.total}
          color="indigo"
          loading={dormsQuery.isLoading}
          onClick={resetFilters}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Santri Tertempatkan"
          value={`${stats.occupied} · ${stats.occupancyPct}%`}
          color="emerald"
          loading={occupancyQuery.isLoading}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Kamar Penuh"
          value={stats.full}
          color="rose"
          loading={dormsQuery.isLoading}
          active={showPenuhOnly}
          onClick={() => {
            setShowPenuhOnly((v) => !v)
            setShowTersediaOnly(false)
            pg.setPage(1)
          }}
        />
        <StatChip
          icon={<PlusOutlined />}
          label="Bersisa Slot"
          value={stats.available}
          color="amber"
          loading={dormsQuery.isLoading}
          active={showTersediaOnly}
          onClick={() => {
            setShowTersediaOnly((v) => !v)
            setShowPenuhOnly(false)
            pg.setPage(1)
          }}
        />
        <StatChip
          icon={<RestOutlined />}
          label="Tempat Tidur Kosong"
          value={stats.emptyBeds}
          color="purple"
          loading={dormsQuery.isLoading}
        />
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input
            ref={searchRef}
            placeholder="Cari nama kamar / musyrif"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pg.setPage(1)
            }}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Select
            placeholder="Gender"
            allowClear
            style={{ minWidth: 140 }}
            value={gender}
            onChange={(v) => {
              setGender(v)
              pg.setPage(1)
            }}
            options={GENDER_OPTIONS}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 140 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              pg.setPage(1)
            }}
            options={STATUS_OPTIONS}
          />
          <Select
            placeholder="Musyrif"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 170 }}
            value={musyrifId}
            onChange={(v) => {
              setMusyrifId(v)
              pg.setPage(1)
            }}
            loading={musyrifQuery.isLoading}
            options={(musyrifQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
          />
          <Segmented
            style={{ marginInlineStart: 'auto' }}
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            options={[
              { value: 'tabel', label: 'Tabel', icon: <TableOutlined /> },
              { value: 'papan', label: 'Papan', icon: <AppstoreOutlined /> },
            ]}
          />
        </div>
        <FilterChips chips={filterChips} />
      </Card>

      {view === 'papan' ? (
        <BoardView
          dorms={rows}
          occupancyMap={occupancyMap}
          canWrite={canWrite}
          canDelete={canDelete}
          loading={dormsQuery.isPending}
          onOpen={(dorm) => setDrawerDorm(dorm)}
          onFill={(dorm) => openAssign([], dorm.id)}
          onEdit={openEdit}
          onDelete={handleDelete}
          onEvictAll={handleEvictDorm}
        />
      ) : (
        <Card>
          <Table<Dorm>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={dormsQuery.isPending}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    allDorms.length === 0
                      ? 'Belum ada kamar'
                      : 'Tidak ada kamar yang cocok dengan filter'
                  }
                />
              ),
            }}
            pagination={pg.pagination}
            scroll={{ x: true }}
          />
        </Card>
      )}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Asrama"
        subtitle="Kamar, keterisian, dan penempatan santri"
        extra={
          <>
            <Dropdown
              trigger={['click']}
              placement="bottomRight"
              overlayStyle={{ minWidth: 320 }}
              menu={{
                items: [
                  {
                    key: 'data',
                    type: 'group' as const,
                    label: 'Data',
                    children: [
                      {
                        key: 'import',
                        icon: <ImportOutlined />,
                        disabled: !canWrite,
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>
                              <div style={{ fontWeight: 600 }}>Import Kamar (CSV)</div>
                              <div style={{ fontSize: 12, opacity: 0.65 }}>Unggah data kamar dari file CSV</div>
                            </span>
                            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                              <Kbd>I</Kbd>
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: 'export-csv',
                        icon: <FileTextOutlined />,
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>
                              <div style={{ fontWeight: 600 }}>Export Kamar (CSV)</div>
                              <div style={{ fontSize: 12, opacity: 0.65 }}>Sesuai filter kamar aktif</div>
                            </span>
                            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                              <Kbd>E</Kbd>
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: 'export-xlsx',
                        icon: <FileExcelOutlined />,
                        label: (
                          <div>
                            <div style={{ fontWeight: 600 }}>Export Kamar (Excel)</div>
                            <div style={{ fontSize: 12, opacity: 0.65 }}>Spreadsheet .xlsx berformat rapi</div>
                          </div>
                        ),
                      },
                      {
                        key: 'export-placements-xlsx',
                        icon: <FileExcelOutlined />,
                        label: (
                          <div>
                            <div style={{ fontWeight: 600 }}>Export Penempatan Santri</div>
                            <div style={{ fontSize: 12, opacity: 0.65 }}>Seluruh penempatan santri (Excel)</div>
                          </div>
                        ),
                      },
                    ],
                  },
                  {
                    key: 'manajemen',
                    type: 'group' as const,
                    label: 'Manajemen',
                    children: [
                      {
                        key: 'text-place',
                        icon: <EditOutlined />,
                        disabled: !canWrite,
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>
                              <div style={{ fontWeight: 600 }}>Penempatan via Teks</div>
                              <div style={{ fontSize: 12, opacity: 0.65 }}>Tempel daftar kamar &amp; santri</div>
                            </span>
                            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
                              <Kbd>T</Kbd>
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: 'print',
                        icon: <PrinterOutlined />,
                        label: (
                          <div>
                            <div style={{ fontWeight: 600 }}>Cetak Daftar Penghuni</div>
                            <div style={{ fontSize: 12, opacity: 0.65 }}>Cetak roster seluruh kamar</div>
                          </div>
                        ),
                      },
                    ],
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'import') setImportOpen(true)
                  if (key === 'export-csv') void handleExport()
                  if (key === 'export-xlsx') void handleExportXlsx()
                  if (key === 'export-placements-xlsx') handleExportPlacementsXlsx()
                  if (key === 'text-place') setTextPlaceOpen(true)
                  if (key === 'print') handlePrintAllRosters()
                },
              }}
            >
              <Tooltip title="Impor, ekspor & manajemen data asrama">
                <Button icon={<MoreOutlined />} loading={exporting} />
              </Tooltip>
            </Dropdown>
            {canWrite && (
              <>
                <Tooltip title="Bagi santri belum ditempatkan ke kamar bersisa">
                  <Button icon={<DeploymentUnitOutlined />} onClick={() => setDistributeOpen(true)} />
                </Tooltip>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                  Tambah Kamar
                </Button>
              </>
            )}
          </>
        }
      />

      <Tabs
        defaultActiveKey="rooms"
        items={[
          { key: 'rooms', label: 'Kamar', children: roomTab },
          {
            key: 'penempatan',
            label: 'Penempatan Santri',
            children: (
              <TabPlacements
                onAssign={(ids) => openAssign(ids)}
                onMoveOne={(id) => openAssign([id])}
                onEvict={handleEvict}
                onOpenTextPlace={() => setTextPlaceOpen(true)}
              />
            ),
          },
        ]}
      />

      <DormForm
        open={formOpen}
        dorm={editing}
        submitting={createMutation.isPending || updateMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <DetailDrawer
        dorm={drawerDorm}
        occupied={drawerDorm ? (occupancyMap.get(drawerDorm.id) ?? 0) : 0}
        onClose={() => setDrawerDorm(null)}
        onFill={() => drawerDorm && openAssign([], drawerDorm.id)}
        onMove={(studentId) => openAssign([studentId])}
        onEvict={(studentId) => handleEvict([studentId])}
        onPrint={() => drawerDorm && setRosterDormIds([drawerDorm.id])}
        onEvictAll={() => drawerDorm && handleEvictDorm(drawerDorm)}
      />

      <AssignModal
        open={!!assignState}
        initialStudentIds={assignState?.studentIds}
        fixedDormId={assignState?.fixedDormId}
        submitting={assignMutation.isPending}
        onCancel={() => setAssignState(null)}
        onSubmit={handleAssignSubmit}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <DistributeModal open={distributeOpen} onClose={() => setDistributeOpen(false)} />

      <PlaceModal open={textPlaceOpen} onClose={() => setTextPlaceOpen(false)} />

      <PrintModal
        open={rosterDormIds !== null}
        onClose={() => setRosterDormIds(null)}
        dorms={allDorms.filter((d) => rosterDormIds?.includes(d.id) ?? false)}
      />

      <ShortcutsModal open={isOpen} onClose={close} sections={sections} />
    </div>
  )
}
