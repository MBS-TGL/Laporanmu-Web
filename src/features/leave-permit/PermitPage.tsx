import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Space,
  Table,
  Tooltip,
} from 'antd'
import {
  BarChartOutlined,
  ExportOutlined,
  ImportOutlined,
  PrinterOutlined,
  PlusOutlined,
  QrcodeOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  StopOutlined,
  CheckCircleOutlined,
  WhatsAppOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { ActionBar } from '../../shared/components/ActionBar'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useTablePagination } from '../../shared/hooks/useTablePagination'
import { waLink } from '../students/wa'
import { supabase } from '../../lib/supabase'
import { formatDisplayName } from '../../shared/utils/displayName'
import {
  useConfirmDeparture,
  useConfirmReturn,
  useCreatePermit,
  useDeletePermit,
  usePermits,
  useUpdatePermit,
  useUpdatePermitStatus,
} from './hooks'
import { effectiveStatus, filterPermits, permitWaText } from './permitUtils'
import { usePermitFilters } from './usePermitFilters'
import { buildPermitColumns } from './components/PermitColumns'
import { StatsRow } from './components/StatsRow'
import { FilterBar } from './components/FilterBar'
import { FormModal } from './components/FormModal'
import { PermitBatchPrint, PrintModal, PermitRecapPrint } from './components/PrintModal'
import { DetailDrawer } from './components/DetailDrawer'
import { ScanModal } from './components/ScanModal'
import { IssueModal } from './components/IssueModal'
import { ImportModal } from './components/ImportModal'
import { ExportModal } from './components/ExportModal'
import { WaReminder } from './components/WaReminder'
import { PermitInsights } from './components/PermitInsights'
import type { LeavePermit, PermitFormValues, PermitStudentBrief } from './types'

export function PermitPage() {
  const { message, modal } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()

  // ------------------------------------------------------------
  // Filter state — dipindah ke usePermitFilters (search, tanggal,
  // kelas, status tersinkron URL, chips, hasil filter in-memory)
  // ------------------------------------------------------------
  const permitsQuery = usePermits()
  const permits = useMemo(() => permitsQuery.data ?? [], [permitsQuery.data])
  const {
    search,
    setSearch,
    searchInputRef,
    dateRange,
    setDateRange,
    classId,
    setClassId,
    statusFilter,
    changeStatus,
    classesQuery,
    chips,
    filtered,
  } = usePermitFilters(permits)

  const pg = useTablePagination(filtered.length, { pageSizeOptions: [10, 20, 50] })

  // ------------------------------------------------------------
  // Modal / drawer state (disimpan id → selalu data terbaru dari query)
  // ------------------------------------------------------------
  // Preset santri dari halaman lain (Mode Gerbang di halaman Gerbang mengirim
  // via location.state — form langsung terbuka dengan santri terisi)
  // ------------------------------------------------------------
  const navState = (location.state ?? {}) as { presetStudent?: PermitStudentBrief } | null

  const [formOpen, setFormOpen] = useState(() => Boolean(navState?.presetStudent))
  const [editId, setEditId] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [presetStudent, setPresetStudent] = useState<PermitStudentBrief | null>(
    navState?.presetStudent ?? null,
  )
  const [detailId, setDetailId] = useState<string | null>(null)
  const [printId, setPrintId] = useState<string | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanMode, setScanMode] = useState<'gate' | 'issue'>('gate')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'filtered' | 'selected'>('filtered')
  const [recapPrinting, setRecapPrinting] = useState(false)
  const [batchPrinting, setBatchPrinting] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [waReminder, setWaReminder] = useState<{ open: boolean; permits: LeavePermit[] }>({
    open: false,
    permits: [],
  })
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // ------------------------------------------------------------
  // Data
  // ------------------------------------------------------------
  const createMutation = useCreatePermit()
  const updateMutation = useUpdatePermit()
  const statusMutation = useUpdatePermitStatus()
  const deleteMutation = useDeletePermit()
  const departureMutation = useConfirmDeparture()
  const returnMutation = useConfirmReturn()

  const editPermit = useMemo(() => permits.find((p) => p.id === editId) ?? null, [permits, editId])
  const duplicatePermit = useMemo(() => permits.find((p) => p.id === duplicateId) ?? null, [permits, duplicateId])
  const detailPermit = useMemo(() => permits.find((p) => p.id === detailId) ?? null, [permits, detailId])
  const printPermit = useMemo(() => permits.find((p) => p.id === printId) ?? null, [permits, printId])
  const selectedPermits = useMemo(
    () => selectedIds.map((id) => permits.find((p) => p.id === id)).filter((p): p is LeavePermit => !!p),
    [selectedIds, permits],
  )
  const overduePermits = useMemo(() => permits.filter((p) => effectiveStatus(p) === 'overdue'), [permits])

  // Mode Gerbang kini milik halaman Gerbang (deep-link /gate?gate=1)

  // ------------------------------------------------------------
  // Statistik klikabel
  // ------------------------------------------------------------
  const today = dayjs().format('YYYY-MM-DD')
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
  const stats = useMemo(() => {
    let issuedToday = 0
    let out = 0
    let overdue = 0
    let thisMonth = 0
    for (const p of permits) {
      if (p.status === 'cancelled') continue
      if (p.leave_date === today) issuedToday++
      if (p.leave_date >= monthStart) thisMonth++
      if (p.status === 'departed') out++
      if (effectiveStatus(p) === 'overdue') overdue++
    }
    return { issuedToday, out, overdue, thisMonth }
  }, [permits, today, monthStart])

  // ------------------------------------------------------------
  // Aksi
  // ------------------------------------------------------------
  const isBlocked =
    formOpen ||
    scanOpen ||
    bulkOpen ||
    importOpen ||
    exportOpen ||
    waReminder.open ||
    !!detailId ||
    !!printId ||
    recapPrinting ||
    batchPrinting

  const openCreate = () => {
    setEditId(null)
    setDuplicateId(null)
    setPresetStudent(null)
    setFormOpen(true)
  }

  const openEdit = (p: LeavePermit) => {
    setDetailId(null)
    setEditId(p.id)
    setDuplicateId(null)
    setPresetStudent(null)
    setFormOpen(true)
  }

  const openDuplicate = (p: LeavePermit) => {
    setDetailId(null)
    setEditId(null)
    setDuplicateId(p.id)
    setPresetStudent(null)
    setFormOpen(true)
  }

  const handleCreate = async (values: PermitFormValues) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const permit = await createMutation.mutateAsync({ values, issuedBy: userData.user?.id ?? null })
      message.success('Surat izin diterbitkan')
      closeForm()
      setPrintId(permit.id)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menerbitkan izin')
    }
  }

  const handleUpdate = async (values: PermitFormValues) => {
    if (!editPermit) return
    try {
      await updateMutation.mutateAsync({ id: editPermit.id, values })
      message.success('Surat izin diperbarui')
      closeForm()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memperbarui izin')
    }
  }

  const handleDepart = async (p: LeavePermit) => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      await departureMutation.mutateAsync({ permit: p, recordedBy: userData.user?.id ?? null })
      message.success(`${formatDisplayName(p.student?.name ?? 'Santri')} tercatat berangkat`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses keberangkatan')
    }
  }

  const handleReturn = async (p: LeavePermit) => {
    try {
      await returnMutation.mutateAsync(p)
      message.success(`${formatDisplayName(p.student?.name ?? 'Santri')} tercatat kembali`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses kepulangan')
    }
  }

  const handleGateAction = async (permit: LeavePermit, action: 'depart' | 'return') => {
    if (action === 'depart') await handleDepart(permit)
    else await handleReturn(permit)
  }

  const handleCancelStatus = (p: LeavePermit) => {
    statusMutation.mutate(
      { id: p.id, status: 'cancelled' },
      {
        onSuccess: () => message.success('Izin dibatalkan'),
        onError: (err: Error) => message.error(err.message || 'Gagal membatalkan'),
      },
    )
  }

  const handleDelete = (p: LeavePermit) => {
    deleteMutation.mutate(p.id, {
      onSuccess: () => {
        message.success('Izin dihapus permanen')
        setDetailId(null)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus izin'),
    })
  }

  const handleBulkCancel = async () => {
    let ok = 0
    for (const id of selectedIds) {
      try {
        await statusMutation.mutateAsync({ id, status: 'cancelled' })
        ok++
      } catch {
        // lanjut ke baris berikutnya
      }
    }
    message.success(`${ok} izin dibatalkan`)
    setSelectedIds([])
  }

  const handleWa = (p: LeavePermit) => {
    const phone = p.phone ?? p.student?.phone ?? null
    if (!phone) {
      message.warning('Nomor telepon tidak tersedia untuk santri ini')
      return
    }
    window.open(waLink(phone, permitWaText(p)), '_blank', 'noopener')
  }

  /** Hapus location.state preset (dari Mode Gerbang) agar tidak terbuka ulang saat refresh */
  const clearNavState = () => {
    if (location.state) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditId(null)
    setDuplicateId(null)
    setPresetStudent(null)
    clearNavState()
  }

  const handleScanIssue = (student: PermitStudentBrief) => {
    setScanOpen(false)
    setEditId(null)
    setDuplicateId(null)
    setPresetStudent(student)
    setFormOpen(true)
  }

  const printRecap = () => {
    setRecapPrinting(true)
  }

  /** Proses kembali untuk banyak izin sekaligus (hari eksodus) */
  const handleBulkReturn = async () => {
    const returnable = selectedPermits.filter((p) => ['departed', 'overdue'].includes(p.status))
    if (returnable.length === 0) {
      message.warning('Tidak ada izin terpilih yang sedang berangkat')
      return
    }
    let ok = 0
    for (const p of returnable) {
      try {
        await returnMutation.mutateAsync(p)
        ok++
      } catch {
        // lanjut ke baris berikutnya
      }
    }
    message.success(`${ok} santri tercatat kembali`)
    setSelectedIds([])
  }

  // ------------------------------------------------------------
  // Shortcut keyboard
  // ------------------------------------------------------------
  const shortcutItems: ShortcutItem[] = [
    { keys: ['N'], label: 'Terbitkan Izin', group: 'Aksi', icon: <PlusOutlined />, run: openCreate, when: canWrite },
    { keys: ['S'], label: 'Scan Kartu / Surat', group: 'Aksi', icon: <QrcodeOutlined />, run: () => setScanOpen(true) },
    { keys: ['P'], label: 'Pulang Massal', group: 'Aksi', icon: <TeamOutlined />, run: () => setBulkOpen(true), when: canWrite },
    { keys: ['E'], label: 'Ekspor Data', group: 'Aksi', icon: <ExportOutlined />, run: () => { setExportScope('filtered'); setExportOpen(true) } },
    { keys: ['I'], label: 'Impor Izin', group: 'Aksi', icon: <ImportOutlined />, run: () => setImportOpen(true), when: canWrite },
    { keys: ['R'], label: 'Cetak Rekap', group: 'Aksi', icon: <PrinterOutlined />, run: printRecap },
    { keys: ['/'], label: 'Fokus Pencarian', group: 'Navigasi', icon: <SearchOutlined />, run: () => searchInputRef.current?.focus() },
    { keys: ['?'], label: 'Bantuan Shortcut', group: 'Bantuan', icon: <QuestionCircleOutlined />, run: () => shortcuts.toggle() },
  ]
  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  // ------------------------------------------------------------
  // Kolom tabel (builder di components/PermitColumns.tsx)
  // ------------------------------------------------------------
  const columns = useMemo(
    () =>
      buildPermitColumns(
        {
          canWrite,
          canDelete,
          onDetail: (p) => setDetailId(p.id),
          onPrint: (p) => setPrintId(p.id),
          onWa: handleWa,
          onDepart: (p) => void handleDepart(p),
          onReturn: (p) => void handleReturn(p),
          onEdit: openEdit,
          onReissue: openDuplicate,
          onCancel: handleCancelStatus,
          onDelete: handleDelete,
        },
        modal,
      ),
    // Handler halaman stabil (useCallback-free tapi definisi baru tak masalah — tabel dirender ulang bersama halaman)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canWrite, canDelete, modal],
  )

  return (
    <div>
      <PageHeader
        title="Izin Keluar Pondok"
        subtitle="Terbitkan surat izin keluar, proses gerbang, dan pantau statusnya"
        extra={
          <Space wrap size={6}>
            <Tooltip title="Bantuan shortcut (?)">
              <Button icon={<QuestionCircleOutlined />} onClick={() => shortcuts.open()} />
            </Tooltip>
            <Tooltip title="Scan kartu / surat izin (S)">
              <Button icon={<QrcodeOutlined />} onClick={() => setScanOpen(true)} />
            </Tooltip>
            {canWrite && (
              <Tooltip title="Pulang massal (P)">
                <Button icon={<TeamOutlined />} onClick={() => setBulkOpen(true)} />
              </Tooltip>
            )}
            {canWrite && (
              <Tooltip title="Impor izin dari Excel/CSV (I)">
                <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)} />
              </Tooltip>
            )}
            <Tooltip title="Ekspor data (E)">
              <Button icon={<ExportOutlined />} onClick={() => { setExportScope('filtered'); setExportOpen(true) }} />
            </Tooltip>
            <Tooltip title="Cetak rekap harian (R)">
              <Button icon={<PrinterOutlined />} onClick={printRecap} />
            </Tooltip>
            <Tooltip title="Insight bulan ini">
              <Button
                icon={<BarChartOutlined />}
                onClick={() => setInsightsOpen((v) => !v)}
                type={insightsOpen ? 'primary' : 'default'}
              />
            </Tooltip>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Terbitkan Izin
              </Button>
            )}
          </Space>
        }
      />

      {/* Statistik klikabel = filter cepat */}
      <StatsRow
        stats={stats}
        loading={permitsQuery.isLoading}
        statusFilter={statusFilter}
        onToggleStatus={(s) => changeStatus(statusFilter === s ? '' : s)}
        onToggleMonth={() => setDateRange(dateRange ? null : [dayjs().startOf('month'), dayjs()])}
      />

      {insightsOpen && <PermitInsights permits={permits} />}

      {stats.overdue > 0 && statusFilter !== 'overdue' && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${stats.overdue} santri belum kembali melewati batas waktu`}
          action={
            <Space size={6}>
              {overduePermits.some((p) => p.phone ?? p.student?.phone) && (
                <Tooltip title="Kirim pengingat WA ke wali">
                  <Button size="small" icon={<WhatsAppOutlined />} onClick={() => setWaReminder({ open: true, permits: overduePermits })}>
                    WA
                  </Button>
                </Tooltip>
              )}
              <Button size="small" danger onClick={() => changeStatus('overdue')}>
                Lihat
              </Button>
            </Space>
          }
        />
      )}

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchInputRef={searchInputRef}
        dateRange={dateRange}
        onDateRange={setDateRange}
        classId={classId}
        onClassId={setClassId}
        statusFilter={statusFilter}
        onStatusChange={changeStatus}
        classes={classesQuery.data ?? []}
        classesLoading={classesQuery.isLoading}
        chips={chips}
      />

      <Card>
        <Table<LeavePermit>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={permitsQuery.isLoading}
          locale={{
            emptyText: (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada izin keluar">
                {canWrite && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Terbitkan Izin Pertama
                  </Button>
                )}
              </Empty>
            ),
          }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
            preserveSelectedRowKeys: true,
          }}
          rowClassName={(p) => (effectiveStatus(p) === 'overdue' ? 'permit-row-overdue' : '')}
          pagination={pg.pagination}
          scroll={{ x: true }}
        />
      </Card>

      <ActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        actions={[
          {
            key: 'return',
            label: 'Tandai Kembali',
            icon: <CheckCircleOutlined />,
            hidden: !canWrite,
            loading: returnMutation.isPending,
            confirm: {
              title: `Tandai ${selectedPermits.filter((p) => ['departed', 'overdue'].includes(p.status)).length} santri kembali?`,
              description: 'Semua izin terpilih yang sedang berangkat akan diproses kembali.',
              okText: 'Ya, Proses Kembali',
            },
            onClick: handleBulkReturn,
          },
          { key: 'print', label: 'Cetak Surat', icon: <PrinterOutlined />, onClick: () => setBatchPrinting(true) },
          {
            key: 'wa',
            label: 'WA',
            icon: <WhatsAppOutlined />,
            tooltip: 'Kirim pengingat ke wali santri terpilih',
            onClick: () => setWaReminder({ open: true, permits: selectedPermits }),
          },
          {
            key: 'cancel',
            label: 'Batalkan',
            icon: <StopOutlined />,
            variant: 'danger',
            hidden: !canWrite,
            loading: statusMutation.isPending,
            confirm: {
              title: `Batalkan ${selectedIds.length} izin terpilih?`,
              description: 'Semua izin terpilih akan berstatus dibatalkan.',
              okText: 'Ya, Batalkan Izin',
            },
            onClick: handleBulkCancel,
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
        ]}
      />

      {/* Modal & drawer */}
      <FormModal
        open={formOpen}
        submitting={createMutation.isPending || updateMutation.isPending}
        editPermit={editPermit}
        duplicatePermit={duplicatePermit}
        presetStudent={presetStudent}
        onScanClick={() => {
          setFormOpen(false)
          setScanMode('issue')
          setScanOpen(true)
        }}
        onCancel={closeForm}
        onSubmit={(values) => (editPermit ? void handleUpdate(values) : void handleCreate(values))}
      />

      <PrintModal permit={printPermit} onClose={() => setPrintId(null)} />

      <DetailDrawer
        permit={detailPermit}
        onClose={() => setDetailId(null)}
        canWrite={canWrite}
        canDelete={canDelete}
        busy={
          departureMutation.isPending ||
          returnMutation.isPending ||
          statusMutation.isPending ||
          deleteMutation.isPending
        }
        onDepart={(p) => void handleDepart(p)}
        onReturn={(p) => void handleReturn(p)}
        onCancel={handleCancelStatus}
        onDelete={handleDelete}
        onEdit={openEdit}
        onPrint={(p) => setPrintId(p.id)}
        onReissue={openDuplicate}
      />

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        mode={scanMode}
        onModeChange={setScanMode}
        permits={permits}
        onIssueForStudent={handleScanIssue}
        onGateAction={handleGateAction}
      />

      <IssueModal open={bulkOpen} onClose={() => setBulkOpen(false)} existingPermits={permits} />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filteredRows={filtered}
        selectedIds={selectedIds}
        defaultScope={exportScope}
      />

      <PermitRecapPrint
        printing={recapPrinting}
        dateRange={{
          from: dateRange?.[0]?.format('YYYY-MM-DD') ?? today,
          to: dateRange?.[1]?.format('YYYY-MM-DD') ?? today,
        }}
        permits={filterPermits(permits, {
          from: dateRange?.[0]?.format('YYYY-MM-DD') ?? today,
          to: dateRange?.[1]?.format('YYYY-MM-DD') ?? today,
        }).filter((p) => p.status !== 'cancelled')}
        onDone={() => setRecapPrinting(false)}
      />

      {/* Cetak massal surat terpilih */}
      <PermitBatchPrint permits={selectedPermits} printing={batchPrinting} onDone={() => setBatchPrinting(false)} />

      {/* Pengingat WA ke wali */}
      <WaReminder
        open={waReminder.open}
        permits={waReminder.permits}
        onClose={() => setWaReminder({ open: false, permits: [] })}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
