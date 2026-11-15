import { useMemo, useRef, useState, type Key } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Popconfirm,
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
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { ActionBar } from '../../shared/components/ActionBar'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions, useProfile } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { formatDisplayName } from '../../shared/utils/displayName'
import { supabase } from '../../lib/supabase'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useStudentDetail } from '../students/useStudentDetail'
import {
  useCounselingLogs,
  useCounselingStats,
  useCreateCounseling,
  useDeleteCounseling,
  useUpdateCounseling,
  useUpdateCounselingStatus,
} from './hooks'
import { CATEGORY_OPTIONS, STATUS_META, STATUS_OPTIONS, URGENCY_META, URGENCY_OPTIONS } from './constants'
import type { CounselingCategory, CounselingFormValues, CounselingLog, CounselingStatus, CounselingUrgency } from './types'
import { StatsRow } from './components/StatsRow'
import { InProgressDrawer, HighUrgencyDrawer } from './components/StatsDrawers'
import { DetailDrawer } from './components/DetailDrawer'
import { FormModal } from './components/FormModal'
import { ExportModal } from './components/ExportModal'
import { LettersPage } from './letters/LettersPage'

// Snapshot nama & kelas santri tersimpan historis di baris sesi
async function fetchStudentSnapshot(studentId: string): Promise<{ name: string; className: string | null }> {
  const { data: student } = await supabase
    .from('students')
    // hint FK wajib sejak 0018 — students punya 2 FK ke classes
    .select('name, class_id, classes!students_class_id_fkey(name)')
    .eq('id', studentId)
    .single()
  return {
    name: (student as { name: string } | null)?.name ?? '—',
    className: (student as { classes?: { name: string } | null } | null)?.classes?.name ?? null,
  }
}

function CounselingSessions() {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const { canWrite, canDelete } = usePermissions()
  const { open: openStudentDetail } = useStudentDetail()

  // Filter tabel
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const [category, setCategory] = useState<CounselingCategory | undefined>()
  const [urgency, setUrgency] = useState<CounselingUrgency | undefined>()
  const [status, setStatus] = useState<CounselingStatus | undefined>()
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Fitur halaman
  const [formOpen, setFormOpen] = useState(false)
  const [editLog, setEditLog] = useState<CounselingLog | null>(null)
  const [presetStudent, setPresetStudent] = useState<{ value: string; label: string } | null>(null)
  const [detailLog, setDetailLog] = useState<CounselingLog | null>(null)
  const [inProgressOpen, setInProgressOpen] = useState(false)
  const [highOpen, setHighOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [selectedIds, setSelectedIds] = useState<Key[]>([])
  const searchInputRef = useRef<InputRef>(null)

  const filters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category,
      urgency,
      status,
      from: dateRange?.[0]?.format('YYYY-MM-DD'),
      to: dateRange?.[1]?.format('YYYY-MM-DD'),
      page,
      pageSize,
    }),
    [debouncedSearch, category, urgency, status, dateRange, page, pageSize],
  )

  const logsQuery = useCounselingLogs(filters)
  const statsQuery = useCounselingStats()
  const rows = useMemo(() => logsQuery.data?.data ?? [], [logsQuery.data])
  const selectedRowKeys = useMemo(
    () => selectedIds.filter((id) => (logsQuery.data?.data ?? []).some((l) => l.id === id)),
    [selectedIds, logsQuery.data],
  )

  const createMutation = useCreateCounseling()
  const updateMutation = useUpdateCounseling()
  const statusMutation = useUpdateCounselingStatus()
  const deleteMutation = useDeleteCounseling()

  // ------------------------------------------------------------
  // Aksi
  // ------------------------------------------------------------
  const isBlocked =
    formOpen || exportOpen || Boolean(detailLog) || inProgressOpen || highOpen

  const openCreate = () => {
    setEditLog(null)
    setPresetStudent(null)
    setFormOpen(true)
  }

  const openEdit = (log: CounselingLog) => {
    setDetailLog(null)
    setEditLog(log)
    setFormOpen(true)
  }

  const openNewForStudent = (log: CounselingLog) => {
    setDetailLog(null)
    setEditLog(null)
    if (!log.student_id) {
      openCreate()
      return
    }
    setPresetStudent({ value: log.student_id, label: log.student_name })
    setFormOpen(true)
  }

  const handleToggleStatus = (log: CounselingLog) => {
    const next: CounselingStatus = log.status === 'in_progress' ? 'completed' : 'in_progress'
    return statusMutation.mutateAsync(
      { id: log.id, status: next },
      {
        onSuccess: () => {
          setDetailLog((prev) => (prev && prev.id === log.id ? { ...prev, status: next } : prev))
        },
      },
    ).catch((err: Error) => {
      message.error(err.message || 'Gagal memperbarui status')
    })
  }

  const handleDelete = (log: CounselingLog) => {
    deleteMutation.mutate(log.id, {
      onSuccess: () => {
        setDetailLog((prev) => (prev && prev.id === log.id ? null : prev))
        void logAudit({
          action: 'DELETE',
          source: 'OPERATIONAL',
          tableName: 'counseling_logs',
          recordId: log.id,
          oldData: { student: log.student_name, category: log.category },
        })
        message.success('Sesi BK dihapus')
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
    })
  }

  const handleSubmit = async (values: CounselingFormValues) => {
    try {
      const { name, className } = await fetchStudentSnapshot(values.student_id)
      const { data: userData } = await supabase.auth.getUser()
      if (editLog) {
        await updateMutation.mutateAsync({ id: editLog.id, values, studentName: name, className })
        void logAudit({
          action: 'UPDATE',
          source: 'OPERATIONAL',
          tableName: 'counseling_logs',
          recordId: editLog.id,
          newData: { student: name, category: values.category, urgency: values.urgency },
        })
        message.success('Sesi BK diperbarui')
      } else {
        const created = await createMutation.mutateAsync({
          values,
          studentName: name,
          className,
          createdBy: userData.user?.id ?? null,
        })
        void logAudit({
          action: 'INSERT',
          source: 'OPERATIONAL',
          tableName: 'counseling_logs',
          recordId: created.id,
          newData: { student: name, category: values.category, urgency: values.urgency },
        })
        message.success('Sesi BK tersimpan')
      }
      setFormOpen(false)
      setEditLog(null)
      setPresetStudent(null)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menyimpan sesi BK')
    }
  }

  const handleBulkComplete = async () => {
    let ok = 0
    for (const id of selectedRowKeys) {
      try {
        await statusMutation.mutateAsync({ id: String(id), status: 'completed' })
        ok++
      } catch {
        // lanjut ke baris berikutnya
      }
    }
    message.success(`${ok} sesi ditandai selesai`)
    setSelectedIds([])
  }

  const handleBulkDelete = async () => {
    let ok = 0
    for (const id of selectedRowKeys) {
      try {
        await deleteMutation.mutateAsync(String(id))
        ok++
      } catch {
        // lanjut ke baris berikutnya
      }
    }
    void logAudit({
      action: 'DELETE',
      source: 'OPERATIONAL',
      tableName: 'counseling_logs',
      newData: { bulk: true, count: ok },
    })
    message.success(`${ok} sesi dihapus`)
    setSelectedIds([])
  }

  // ------------------------------------------------------------
  // Filter chips & shortcut
  // ------------------------------------------------------------
  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    if (search) chips.push({ key: 'search', label: `Cari: ${search}`, onClear: () => setSearch('') })
    if (category) {
      chips.push({
        key: 'category',
        label: `Kategori: ${CATEGORY_OPTIONS.find((o) => o.value === category)?.label}`,
        onClear: () => setCategory(undefined),
      })
    }
    if (urgency) {
      chips.push({
        key: 'urgency',
        label: `Urgensi: ${URGENCY_META[urgency].label}`,
        onClear: () => setUrgency(undefined),
      })
    }
    if (status) {
      chips.push({
        key: 'status',
        label: `Status: ${STATUS_META[status].label}`,
        onClear: () => setStatus(undefined),
      })
    }
    if (dateRange) {
      chips.push({
        key: 'date',
        label: `${dateRange[0].format('DD/MM')} – ${dateRange[1].format('DD/MM')}`,
        onClear: () => setDateRange(null),
      })
    }
    return chips
  }, [search, category, urgency, status, dateRange])

  const shortcutItems: ShortcutItem[] = [
    { keys: ['N'], label: 'Catat Sesi BK', group: 'Aksi', run: openCreate, when: canWrite },
    { keys: ['E'], label: 'Ekspor Data', group: 'Aksi', run: () => { setExportScope('filtered'); setExportOpen(true) } },
    { keys: ['/'], label: 'Fokus Pencarian', group: 'Navigasi', run: () => searchInputRef.current?.focus() },
    { keys: ['?'], label: 'Bantuan Shortcut', group: 'Bantuan', run: () => shortcuts.toggle() },
  ]
  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  // ------------------------------------------------------------
  // Kolom tabel
  // ------------------------------------------------------------
  const columns: TableColumnsType<CounselingLog> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, l) => (
        <div>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontWeight: 600 }}
            onClick={() =>
              l.student_id
                ? openStudentDetail(l.student_id)
                : setDetailLog(l)
            }
          >
            {formatDisplayName(l.student_name)}
          </Button>
          <div style={{ fontSize: 12, color: '#888' }}>{l.class_name ?? '—'}</div>
        </div>
      ),
    },
    {
      title: 'Waktu',
      key: 'when',
      width: 110,
      responsive: ['md'],
      render: (_, l) => (
        <Typography.Text style={{ fontSize: 12.5 }}>
          {dayjs(l.date).format('DD MMM YY')}
          <br />
          {l.time}
        </Typography.Text>
      ),
    },
    { title: 'Konselor', dataIndex: 'counselor_name', key: 'counselor', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Kategori',
      key: 'category',
      width: 100,
      responsive: ['md'],
      render: (_, l) => <Tag>{CATEGORY_OPTIONS.find((o) => o.value === l.category)?.label}</Tag>,
    },
    { title: 'Keluhan', dataIndex: 'complaint', key: 'complaint', ellipsis: true },
    {
      title: 'Urgensi',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 100,
      render: (v: CounselingUrgency) => (
        <StatusTag color={URGENCY_META[v].color}>{URGENCY_META[v].label}</StatusTag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v: CounselingStatus, l) =>
        canWrite ? (
          <Tooltip title={v === 'in_progress' ? 'Tandai selesai' : 'Kembali dalam proses'}>
            <Button
              size="small"
              loading={statusMutation.isPending && statusMutation.variables?.id === l.id}
              onClick={() => handleToggleStatus(l)}
            >
              {v === 'in_progress' ? '✓ Selesaikan' : '↺ Buka Lagi'}
            </Button>
          </Tooltip>
        ) : (
          <StatusTag color={STATUS_META[v].color}>{STATUS_META[v].label}</StatusTag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, l) => (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            title="Detail sesi"
            onClick={() => setDetailLog(l)}
          />
          {canWrite && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              title="Edit sesi"
              onClick={() => openEdit(l)}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus sesi BK ini?"
              description="Catatan akan dihapus permanen."
              onConfirm={() => handleDelete(l)}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Bimbingan & Konseling"
        subtitle="Pembinaan karakter, solusi psikososial, dan arahan karir santri"
        extra={
          <Space size="small" wrap>
            <Tooltip title="Ekspor data sesi BK">
              <Button
                icon={<ExportOutlined />}
                onClick={() => {
                  setExportScope('filtered')
                  setExportOpen(true)
                }}
              />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Catat Sesi BK
              </Button>
            )}
          </Space>
        }
      />

      <StatsRow
        stats={statsQuery.data}
        loading={statsQuery.isPending}
        onOpenInProgress={() => setInProgressOpen(true)}
        onOpenHighUrgency={() => setHighOpen(true)}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            ref={searchInputRef}
            placeholder="Cari santri, konselor, keluhan…"
            allowClear
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Kategori"
            allowClear
            style={{ minWidth: 130 }}
            value={category}
            onChange={(v) => {
              setCategory(v)
              setPage(1)
            }}
            options={CATEGORY_OPTIONS}
          />
          <Select
            placeholder="Urgensi"
            allowClear
            style={{ minWidth: 120 }}
            value={urgency}
            onChange={(v) => {
              setUrgency(v)
              setPage(1)
            }}
            options={URGENCY_OPTIONS}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 150 }}
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={STATUS_OPTIONS}
          />
          <DatePicker.RangePicker
            value={dateRange}
            presets={[
              { label: 'Hari ini', value: [dayjs().startOf('day'), dayjs()] },
              { label: '7 hari', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs()] },
              { label: '30 hari', value: [dayjs().subtract(29, 'day').startOf('day'), dayjs()] },
              { label: 'Bulan ini', value: [dayjs().startOf('month'), dayjs()] },
            ]}
            onChange={(v) => {
              setDateRange(v as [Dayjs, Dayjs] | null)
              setPage(1)
            }}
          />
        </Space>
        <FilterChips chips={activeFilterChips} marginTop={12} />
      </Card>

      <Card>
        <Table<CounselingLog>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={logsQuery.isPending}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedIds(keys),
            preserveSelectedRowKeys: true,
          }}
          onRow={(record) => ({
            onClick: (e) => {
              const target = e.target as HTMLElement
              if (target.closest('button, a, input, label, .ant-popover, .ant-tag')) return
              setDetailLog(record)
            },
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada sesi BK tercatat" />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: logsQuery.data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} sesi`,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          scroll={{ x: true }}
        />
      </Card>

      <ActionBar
        count={selectedRowKeys.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            key: 'complete',
            label: 'Selesaikan',
            hidden: !canWrite,
            loading: statusMutation.isPending,
            confirm: {
              title: `Selesaikan ${selectedRowKeys.length} sesi terpilih?`,
              description: 'Semua sesi terpilih akan berstatus selesai.',
              okText: 'Ya, Selesaikan',
            },
            onClick: handleBulkComplete,
          },
          {
            key: 'export',
            label: 'Ekspor',
            icon: <ExportOutlined />,
            onClick: () => {
              setExportScope('selected')
              setExportOpen(true)
            },
          },
          {
            key: 'delete',
            label: 'Hapus',
            icon: <DeleteOutlined />,
            variant: 'danger',
            hidden: !canDelete,
            loading: deleteMutation.isPending,
            confirm: {
              title: `Hapus ${selectedRowKeys.length} sesi terpilih?`,
              description: 'Catatan akan dihapus permanen.',
              okText: 'Ya, Hapus',
            },
            onClick: handleBulkDelete,
          },
        ]}
      />

      <FormModal
        open={formOpen}
        submitting={createMutation.isPending || updateMutation.isPending}
        editLog={editLog}
        presetStudent={presetStudent}
        defaultCounselor={profile?.name ?? ''}
        onCancel={() => {
          setFormOpen(false)
          setEditLog(null)
          setPresetStudent(null)
        }}
        onSubmit={(values) => void handleSubmit(values)}
      />
      <DetailDrawer
        log={detailLog}
        canWrite={canWrite}
        canDelete={canDelete}
        onClose={() => setDetailLog(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
        onToggleStatus={handleToggleStatus}
        onOpenLog={setDetailLog}
        onNewSession={openNewForStudent}
      />
      <InProgressDrawer
        open={inProgressOpen}
        onClose={() => setInProgressOpen(false)}
        onOpenDetail={(log) => {
          setInProgressOpen(false)
          setDetailLog(log)
        }}
      />
      <HighUrgencyDrawer
        open={highOpen}
        onClose={() => setHighOpen(false)}
        onOpenDetail={(log) => {
          setHighOpen(false)
          setDetailLog(log)
        }}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={{
          search: debouncedSearch || undefined,
          category,
          urgency,
          status,
          from: dateRange?.[0]?.format('YYYY-MM-DD'),
          to: dateRange?.[1]?.format('YYYY-MM-DD'),
        }}
        selectedIds={selectedRowKeys.map(String)}
        defaultScope={exportScope}
        filteredCount={logsQuery.data?.total ?? 0}
      />
      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}

// Halaman induk BK: tab Sesi BK (utama) & Surat Resmi — deep-link via ?tab=surat-resmi
export function CounselingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'surat-resmi' ? 'surat-resmi' : 'sesi'
  return (
    <Tabs
      activeKey={tab}
      onChange={(key) => setSearchParams(key === 'sesi' ? {} : { tab: key })}
      items={[
        { key: 'sesi', label: 'Sesi BK', children: <CounselingSessions /> },
        { key: 'surat-resmi', label: 'Surat Resmi', children: <LettersPage /> },
      ]}
    />
  )
}
