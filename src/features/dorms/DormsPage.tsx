import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  type InputRef,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { StatChip } from '../../shared/components/StatChip'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import {
  useAssignStudents,
  useCreateDorm,
  useDeleteDorm,
  useDormOccupancy,
  useDorms,
  useUpdateDorm,
} from './hooks'
import { DormForm } from './components/DormForm'
import { AssignModal } from './components/AssignModal'
import { DetailDrawer } from './components/DetailDrawer'
import { TabPlacements } from './components/TabPlacements'
import type { Dorm, DormFormValues, DormGender, DormStatus } from './types'

const STATUS_META: Record<string, { label: string; color?: string; icon: ReactNode }> = {
  aktif: { label: 'Aktif', color: 'green', icon: <CheckCircleOutlined /> },
  penuh: { label: 'Penuh', color: 'orange', icon: <TeamOutlined /> },
  nonaktif: { label: 'Nonaktif', icon: <StopOutlined /> },
}

const GENDER_LABEL: Record<string, string> = {
  putra: 'Putra',
  putri: 'Putri',
  campur: 'Campur',
}

const GENDER_COLOR: Record<string, string> = {
  putra: 'geekblue',
  putri: 'magenta',
  campur: 'purple',
}

interface AssignState {
  studentIds: string[]
  fixedDormId?: string
}

export function DormsPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()

  const [search, setSearch] = useState('')
  const [gender, setGender] = useState<DormGender | undefined>()
  const [status, setStatus] = useState<DormStatus | undefined>()
  const [showPenuhOnly, setShowPenuhOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Dorm | null>(null)
  const [drawerDorm, setDrawerDorm] = useState<Dorm | null>(null)
  const [assignState, setAssignState] = useState<AssignState | null>(null)
  const searchRef = useRef<InputRef>(null)

  const filters = useMemo(
    () => ({ search: search || undefined, gender, status }),
    [search, gender, status],
  )

  const dormsQuery = useDorms(filters)
  // Statistik global — tidak terpengaruh filter
  const statsQuery = useDorms({})
  const occupancyQuery = useDormOccupancy()

  const createMutation = useCreateDorm()
  const updateMutation = useUpdateDorm()
  const deleteMutation = useDeleteDorm()
  const assignMutation = useAssignStudents()

  const occupancyMap = useMemo(
    () => new Map((occupancyQuery.data ?? []).map((o) => [o.dorm_id, o.occupied])),
    [occupancyQuery.data],
  )

  const stats = useMemo(() => {
    const all = statsQuery.data ?? []
    const capacity = all.reduce((sum, d) => sum + d.capacity, 0)
    const occupied = (occupancyQuery.data ?? []).reduce((sum, o) => sum + o.occupied, 0)
    const full = all.filter((d) => (occupancyMap.get(d.id) ?? 0) >= d.capacity && d.capacity > 0).length
    return {
      total: all.length,
      capacity,
      occupied,
      occupancyPct: capacity > 0 ? Math.round((occupied / capacity) * 100) : 0,
      full,
    }
  }, [statsQuery.data, occupancyQuery.data, occupancyMap])

  // Filter klien "hanya kamar penuh" — data sudah lengkap (tanpa pagination server)
  const rows = useMemo(() => {
    const data = dormsQuery.data ?? []
    if (!showPenuhOnly) return data
    return data.filter((d) => (occupancyMap.get(d.id) ?? 0) >= d.capacity && d.capacity > 0)
  }, [dormsQuery.data, showPenuhOnly, occupancyMap])

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
  // Export CSV
  // ------------------------------------------------------------
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const rowsExport = dormsQuery.data ?? []
      if (rowsExport.length === 0) {
        message.warning('Tidak ada kamar untuk diekspor')
        return
      }
      const csv = Papa.unparse({
        fields: ['Kamar', 'Gender', 'Kapasitas', 'Terisi', 'Okupansi %', 'Musyrif', 'Status'],
        data: rowsExport.map((d) => {
          const occupied = occupancyMap.get(d.id) ?? 0
          const pct = d.capacity > 0 ? Math.round((occupied / d.capacity) * 100) : 0
          return [
            d.name,
            d.gender ? (GENDER_LABEL[d.gender] ?? d.gender) : '',
            d.capacity,
            occupied,
            pct,
            d.musyrif?.name ?? '',
            STATUS_META[d.status]?.label ?? d.status,
          ]
        }),
      })
      // BOM agar UTF-8 terbaca benar saat dibuka di Excel
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `asrama-${dayjs().format('YYYY-MM-DD')}.csv`
      link.click()
      URL.revokeObjectURL(url)
      message.success(`${rowsExport.length} kamar diekspor`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal mengekspor CSV')
    } finally {
      setExporting(false)
    }
  }

  // ------------------------------------------------------------
  // Shortcut keyboard (palet via tombol ? atau ikon di header)
  // ------------------------------------------------------------
  const anyOverlayOpen = formOpen || !!drawerDorm || !!assignState
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
        keys: ['Ctrl', 'K'],
        label: 'Fokus pencarian',
        group: 'Aksi',
        icon: <SearchOutlined />,
        run: () => searchRef.current?.focus(),
      },
    ],
    [canWrite],
  )

  const { isOpen, close, toggle, sections } = useShortcuts({
    items: [
      ...shortcutItems,
      {
        keys: ['?'],
        label: 'Palet shortcut',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => toggle(),
      },
    ],
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
      render: (_, row) => {
        const occupied = occupancyMap.get(row.id) ?? 0
        const pct = row.capacity > 0 ? Math.min(100, Math.round((occupied / row.capacity) * 100)) : 0
        const stroke = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
        return (
          <Space size={10}>
            <Progress
              percent={pct}
              showInfo={false}
              size="small"
              style={{ width: 72, marginBottom: 0 }}
              strokeColor={stroke}
            />
            <Typography.Text style={{ fontSize: 12.5 }}>
              {occupied}/{row.capacity}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Musyrif',
      key: 'musyrif',
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
        const autoFull = v === 'aktif' && row.capacity > 0 && occupied >= row.capacity
        return (
          <Space size={4} wrap>
            {v && <StatusTag color={STATUS_META[v].color} icon={STATUS_META[v].icon}>{STATUS_META[v].label}</StatusTag>}
            {autoFull && <Tag color="orange">penuh (otomatis)</Tag>}
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

  const kamarTab = (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <StatChip
          icon={<TeamOutlined />}
          label="Total Kamar"
          value={stats.total}
          color="indigo"
          loading={statsQuery.isLoading}
          onClick={() => {
            setShowPenuhOnly(false)
            setStatus(undefined)
            setSearch('')
            setGender(undefined)
          }}
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
          loading={statsQuery.isLoading}
          active={showPenuhOnly}
          onClick={() => setShowPenuhOnly((v) => !v)}
        />
        <StatChip
          icon={<TeamOutlined />}
          label="Kapasitas Total"
          value={stats.capacity}
          color="purple"
          loading={statsQuery.isLoading}
        />
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            ref={searchRef}
            placeholder="Cari nama kamar"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 240 }}
          />
          <Select
            placeholder="Gender"
            allowClear
            style={{ minWidth: 140 }}
            value={gender}
            onChange={(v) => {
              setGender(v)
              setPage(1)
            }}
            options={[
              { value: 'putra', label: 'Putra' },
              { value: 'putri', label: 'Putri' },
              { value: 'campur', label: 'Campur' },
            ]}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 140 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              { value: 'aktif', label: 'Aktif' },
              { value: 'penuh', label: 'Penuh' },
              { value: 'nonaktif', label: 'Nonaktif' },
            ]}
          />
        </Space>
      </Card>

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
                description={showPenuhOnly ? 'Tidak ada kamar penuh' : 'Belum ada kamar'}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: rows.length,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} kamar`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Asrama"
        subtitle="Kelola kamar, okupansi, dan penempatan santri"
        extra={
          <>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void handleExport()}>
              Export CSV
            </Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Tambah Kamar
              </Button>
            )}
          </>
        }
      />

      <Tabs
        defaultActiveKey="kamar"
        items={[
          { key: 'kamar', label: 'Kamar', children: kamarTab },
          {
            key: 'penempatan',
            label: 'Penempatan Santri',
            children: (
              <TabPlacements
                onAssign={(ids) => openAssign(ids)}
                onMoveOne={(id) => openAssign([id])}
                onEvict={handleEvict}
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
      />

      <AssignModal
        open={!!assignState}
        initialStudentIds={assignState?.studentIds}
        fixedDormId={assignState?.fixedDormId}
        submitting={assignMutation.isPending}
        onCancel={() => setAssignState(null)}
        onSubmit={handleAssignSubmit}
      />

      <ShortcutsModal open={isOpen} onClose={close} sections={sections} />
    </div>
  )
}
