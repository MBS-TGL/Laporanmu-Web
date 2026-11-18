import { useMemo, useState, type Key } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  Segmented,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
  type TableColumnsType,
} from 'antd'
import {
  EnterOutlined,
  ExportOutlined,
  GatewayOutlined,
  ImportOutlined,
  ScanOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { ActionBar } from '../../shared/components/ActionBar'
import { FilterChips, type FilterChip } from '../../shared/components/FilterChips'
import { formatDisplayName } from '../../shared/utils/displayName'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { useStudentDetail } from '../students/useStudentDetail'
import { supabase } from '../../lib/supabase'
import { useConfirmDeparture, useConfirmReturn, usePermits } from '../leave-permit/hooks'
import type { LeavePermit } from '../leave-permit/types'
import { useGateLogs, useGateTodayStats } from './hooks'
import { EntryCard } from './components/EntryCard'
import { StatsRow } from './components/StatsRow'
import { ActivePermitsDrawer, OutsideStudentsDrawer, PermitItem } from './components/StatsDrawers'
import { HistoryDrawer } from './components/HistoryDrawer'
import { ExportModal } from './components/ExportModal'
import { ImportModal } from './components/ImportModal'
import { GateMode } from './components/GateMode'
import { ScanModal } from './components/ScanModal'
import type { GateDirection, GateLog, GateLogFilters } from './types'

const DIRECTION_OPTIONS = [
  { label: 'Semua', value: '' },
  { label: 'Keluar', value: 'exit' },
  { label: 'Masuk', value: 'entry' },
]

export function GatePage() {
  const { open: openStudentDetail } = useStudentDetail()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filter tabel
  const [search, setSearch] = useState('')
  const [direction, setDirection] = useState<GateDirection | ''>('')
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)
  // Tabel server-paginated: total asli dari logsQuery, di-override di prop Table.
  const pg = useTablePagination(0, { label: 'log' })

  // Mode & fitur halaman
  const [entryDirection, setEntryDirection] = useState<GateDirection>('entry')
  const [live, setLive] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Key[]>([])
  const [scanOpen, setScanOpen] = useState(false)
  /** Mode Gerbang fullscreen: URL sumber tunggal (?gate=1) — tombol/shortcut/deep-link langsung buka */
  const gateOpen = searchParams.get('gate') === '1'
  const openGate = () => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('gate', '1'); return next }, { replace: true })
  const handleGateClose = () => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('gate'); return next }, { replace: true })
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [importOpen, setImportOpen] = useState(false)
  const [historyStudent, setHistoryStudent] = useState<GateLog['student'] | null>(null)
  const [outsideOpen, setOutsideOpen] = useState(false)
  const [permitsOpen, setPermitsOpen] = useState(false)
  const [pendingPermit, setPendingPermit] = useState<{ id: string; kind: 'depart' | 'return' } | null>(
    null,
  )

  const filters: GateLogFilters = useMemo(
    () => ({
      search: search || undefined,
      direction: direction || undefined,
      from: dateRange?.[0]?.startOf('day').format(),
      to: dateRange?.[1]?.endOf('day').format(),
      page: pg.page,
      pageSize: pg.pageSize,
    }),
    [search, direction, dateRange, pg.page, pg.pageSize],
  )

  const exportFilters = useMemo<Omit<GateLogFilters, 'page' | 'pageSize'>>(
    () => ({
      search: search || undefined,
      direction: direction || undefined,
      from: dateRange?.[0]?.startOf('day').format(),
      to: dateRange?.[1]?.endOf('day').format(),
    }),
    [search, direction, dateRange],
  )

  const logsQuery = useGateLogs(filters, { live })
  const statsQuery = useGateTodayStats(live)

  // Reconcile izin keluar: daftar izin aktif untuk diproses di gerbang
  const permitsQuery = usePermits()
  const departureMutation = useConfirmDeparture()
  const returnMutation = useConfirmReturn()
  const activePermits = useMemo(
    () =>
      (permitsQuery.data ?? []).filter((p) => p.status === 'issued' || p.status === 'departed'),
    [permitsQuery.data],
  )

  const handleDepart = async (permitId: string) => {
    const permit = (permitsQuery.data ?? []).find((p) => p.id === permitId)
    if (!permit) return
    setPendingPermit({ id: permitId, kind: 'depart' })
    const { data: userData } = await supabase.auth.getUser()
    departureMutation.mutate(
      { permit, recordedBy: userData.user?.id ?? null },
      {
        onSuccess: () => message.success(`${permit.student?.name ?? 'Santri'} tercatat berangkat`),
        onError: (err: Error) => message.error(err.message || 'Gagal mencatat keberangkatan'),
        onSettled: () => setPendingPermit(null),
      },
    )
  }

  const handleReturn = (permitId: string) => {
    const permit = (permitsQuery.data ?? []).find((p) => p.id === permitId)
    if (!permit) return
    setPendingPermit({ id: permitId, kind: 'return' })
    returnMutation.mutate(permit, {
      onSuccess: () => {
        const late = new Date() > new Date(permit.return_deadline)
        message.success(
          late
            ? `${permit.student?.name ?? 'Santri'} kembali (terlambat)`
            : `${permit.student?.name ?? 'Santri'} kembali tepat waktu`,
        )
      },
      onError: (err: Error) => message.error(err.message || 'Gagal mencatat kepulangan'),
      onSettled: () => setPendingPermit(null),
    })
  }

  /** Handler Mode Gerbang — mutateAsync agar kartu aksi tahu kapan selesai */
  const handleGateAction = async (permit: LeavePermit, action: 'depart' | 'return') => {
    if (action === 'depart') {
      const { data: userData } = await supabase.auth.getUser()
      await departureMutation.mutateAsync({ permit, recordedBy: userData.user?.id ?? null })
      message.success(`${formatDisplayName(permit.student?.name ?? 'Santri')} tercatat berangkat`)
    } else {
      await returnMutation.mutateAsync(permit)
      const late = new Date() > new Date(permit.return_deadline)
      message.success(
        late
          ? `${formatDisplayName(permit.student?.name ?? 'Santri')} kembali (terlambat)`
          : `${formatDisplayName(permit.student?.name ?? 'Santri')} kembali tepat waktu`,
      )
    }
  }

  /** Santri discan tanpa izin aktif → lanjut ke form terbitkan di halaman Izin Keluar */
  const handleGateIssueForStudent = (s: { id: string; name: string; registration_code: string; phone: string | null }) => {
    navigate('/leave-permit', { state: { presetStudent: s } })
  }

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = []
    if (search) {
      chips.push({ key: 'search', label: `Cari: ${search}`, onClear: () => setSearch('') })
    }
    if (direction) {
      chips.push({
        key: 'direction',
        label: `Arah: ${direction === 'exit' ? 'Keluar' : 'Masuk'}`,
        onClear: () => setDirection(''),
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
  }, [search, direction, dateRange])

  const selectedRowKeys = useMemo(
    () => selectedIds.filter((id) => (logsQuery.data?.data ?? []).some((l) => l.id === id)),
    [selectedIds, logsQuery.data],
  )

  const columns: TableColumnsType<GateLog> = [
    {
      title: 'Waktu',
      dataIndex: 'occurred_at',
      key: 'occurred_at',
      width: 170,
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
    {
      title: 'Siswa',
      key: 'student',
      render: (_, row) => (
        <div>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontWeight: 500 }}
            onClick={() => setHistoryStudent(row.student ?? null)}
          >
            {row.student?.name ? formatDisplayName(row.student.name) : '-'}
          </Button>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
            onClick={() => row.student && openStudentDetail(row.student.id)}
          >
            {row.student?.registration_code} · Detail siswa
          </Button>
        </div>
      ),
    },
    {
      title: 'Kelas',
      key: 'class',
      width: 120,
      responsive: ['md'],
      render: (_, row) => row.student?.classes?.name ?? '-',
    },
    {
      title: 'Arah',
      dataIndex: 'direction',
      key: 'direction',
      width: 110,
      render: (v: GateDirection) =>
        v === 'exit' ? (
          <StatusTag color="orange" icon={<ExportOutlined />}>
            Keluar
          </StatusTag>
        ) : (
          <StatusTag color="green" icon={<EnterOutlined />}>
            Masuk
          </StatusTag>
        ),
    },
    {
      title: 'Catatan',
      dataIndex: 'note',
      key: 'note',
      render: (v: string | null) => v || '-',
      responsive: ['md'],
    },
    {
      title: 'Dicatat Oleh',
      key: 'recorder',
      render: (_, row) => row.recorder?.name ?? '-',
      responsive: ['lg'],
    },
  ]

  const cardPermits = activePermits.slice(0, 3)

  return (
    <div>
      <PageHeader
        title="Laporan Gerbang"
        subtitle="Log keluar-masuk santri di gerbang"
        extra={
          <Space size="small" wrap>
            <Tooltip title="Perbarui otomatis tiap 30 detik">
              <Space size={6}>
                <Typography.Text style={{ fontSize: 13 }}>Live</Typography.Text>
                <Switch size="small" checked={live} onChange={setLive} />
              </Space>
            </Tooltip>
            <Tooltip title="Ekspor log gate">
              <Button icon={<ExportOutlined />} onClick={() => { setExportScope('filtered'); setExportOpen(true) }} />
            </Tooltip>
            <Tooltip title="Impor log gate">
              <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)} />
            </Tooltip>
            <Tooltip title="Buka mode gerbang">
              <Button icon={<GatewayOutlined />} onClick={openGate} />
            </Tooltip>
            <Button type="primary" icon={<ScanOutlined />} onClick={() => setScanOpen(true)}>
              Scan Kamera
            </Button>
          </Space>
        }
      />

      <StatsRow
        stats={statsQuery.data}
        loading={statsQuery.isPending}
        activePermitCount={activePermits.length}
        onOpenOutside={() => setOutsideOpen(true)}
        onOpenPermits={() => setPermitsOpen(true)}
      />

      {/* Reconcile izin keluar: proses keberangkatan & kepulangan (ringkas) */}
      {activePermits.length > 0 && (
        <Card title={`Izin Santri Aktif (${activePermits.length})`} size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {cardPermits.map((p) => (
              <PermitItem
                key={p.id}
                permit={p}
                departing={pendingPermit?.id === p.id && pendingPermit.kind === 'depart'}
                returning={pendingPermit?.id === p.id && pendingPermit.kind === 'return'}
                onDepart={(id) => void handleDepart(id)}
                onReturn={handleReturn}
              />
            ))}
            {activePermits.length > cardPermits.length && (
              <Button type="link" size="small" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setPermitsOpen(true)}>
                Tampilkan semua {activePermits.length} izin aktif
              </Button>
            )}
          </Space>
        </Card>
      )}

      <EntryCard
        direction={entryDirection}
        onDirectionChange={setEntryDirection}
        onOpenScan={() => setScanOpen(true)}
      />

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari nama siswa"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              pg.setPage(1)
            }}
            style={{ width: 220 }}
          />
          <Segmented
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={(v) => {
              setDirection(v as GateDirection | '')
              pg.setPage(1)
            }}
          />
          <DatePicker.RangePicker
            value={dateRange}
            presets={[
              { label: 'Hari ini', value: [dayjs().startOf('day'), dayjs()] },
              { label: '7 hari', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs()] },
              { label: '30 hari', value: [dayjs().subtract(29, 'day').startOf('day'), dayjs()] },
            ]}
            onChange={(v) => {
              setDateRange(v as [Dayjs, Dayjs] | null)
              pg.setPage(1)
            }}
          />
        </Space>
        <FilterChips chips={activeFilterChips} marginTop={12} />
      </Card>

      <Card>
        <Table<GateLog>
          rowKey="id"
          columns={columns}
          dataSource={logsQuery.data?.data ?? []}
          loading={logsQuery.isPending}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedIds(keys),
            preserveSelectedRowKeys: true,
          }}
          pagination={{ ...pg.pagination, total: logsQuery.data?.total ?? 0 }}
          scroll={{ x: true }}
        />
      </Card>

      <ActionBar
        count={selectedRowKeys.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            key: 'export',
            label: 'Ekspor',
            icon: <ExportOutlined />,
            onClick: () => {
              setExportScope('selected')
              setExportOpen(true)
            },
          },
        ]}
      />

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        direction={entryDirection}
        onDirectionChange={setEntryDirection}
      />
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={exportFilters}
        selectedIds={selectedRowKeys.map(String)}
        defaultScope={exportScope}
        filteredCount={logsQuery.data?.total ?? 0}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <HistoryDrawer
        open={Boolean(historyStudent)}
        onClose={() => setHistoryStudent(null)}
        student={
          historyStudent
            ? {
                id: historyStudent.id,
                name: historyStudent.name,
                registration_code: historyStudent.registration_code,
                class_name: historyStudent.classes?.name ?? null,
              }
            : null
        }
      />
      <OutsideStudentsDrawer
        open={outsideOpen}
        onClose={() => setOutsideOpen(false)}
        outside={statsQuery.data?.outside ?? []}
      />
      <ActivePermitsDrawer
        open={permitsOpen}
        onClose={() => setPermitsOpen(false)}
        permits={activePermits}
        pending={pendingPermit}
        onDepart={(id) => void handleDepart(id)}
        onReturn={handleReturn}
      />

      {/* Mode Gerbang fullscreen — stasiun scan satpam (deep-link ?gate=1) */}
      <GateMode
        open={gateOpen}
        onClose={handleGateClose}
        permits={permitsQuery.data ?? []}
        onGateAction={handleGateAction}
        onIssueForStudent={handleGateIssueForStudent}
      />
    </div>
  )
}
