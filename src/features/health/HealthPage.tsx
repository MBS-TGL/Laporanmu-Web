import { useMemo, useState } from 'react'
import {
  Alert,
  App,
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
  type TableColumnsType,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ImportOutlined,
  MedicineBoxOutlined,
  PlusCircleOutlined,
  PlusOutlined,
  PrinterOutlined,
  SwapOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { useStudentDetail } from '../students/useStudentDetail'
import { supabase } from '../../lib/supabase'
import {
  useAdjustMedicineStock,
  useDeleteHealthLogsBulk,
  useCreateHealthLog,
  useCreateMedicine,
  useDeleteHealthLog,
  useDeleteMedicine,
  useHealthLogs,
  useMedicines,
  useUpdateHealthLogStatus,
  useUpdateMedicine,
} from './hooks'
import { RESTING_STATUSES, STATUS_COLOR, STATUS_LABEL } from './constants'
import { printRekamJournal } from './export'
import { computeMedicineUsage, countTodayVisits, filterHealthLogs } from './stats'
import type { HealthPeriod, HealthLog, HealthFormValues, HealthMedicine, HealthMedicineFormValues, HealthStatus } from './types'
import { HealthForm } from './components/HealthForm'
import { MedicineForm } from './components/MedicineForm'
import { HealthInsights } from './components/HealthInsights'
import { DetailDrawer } from './components/DetailDrawer'
import { ExportModal } from './components/ExportModal'
import { ImportModal } from './components/ImportModal'
import { MedicineModal } from './components/MedicineModal'
import { RestockModal } from './components/RestockModal'

type TabKey = 'rekam' | 'observasi' | 'stok'

export function HealthPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const { open: openStudentDetail } = useStudentDetail()
  const [tab, setTab] = useState<TabKey>('rekam')
  const [logOpen, setLogOpen] = useState(false)
  const [formStudentId, setFormStudentId] = useState<string | undefined>(undefined)
  const [medicineOpen, setMedicineOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState<HealthMedicine | null>(null)
  const [restockMedicine, setRestockMedicine] = useState<HealthMedicine | null>(null)
  const [logImportOpen, setLogImportOpen] = useState(false)
  const [medImportOpen, setMedImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [detailLogId, setDetailLogId] = useState<string | null>(null)

  // Filter tab rekam — semua client-side (logs sudah termuat penuh)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<HealthPeriod>('all')
  const [statusFilter, setStatusFilter] = useState<HealthStatus | 'all'>('all')
  const [classFilter, setClassFilter] = useState<string | 'all'>('all')
  const [medSearch, setMedSearch] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

  const medicinesQuery = useMedicines()
  const logsQuery = useHealthLogs()
  const medicines = useMemo(() => medicinesQuery.data ?? [], [medicinesQuery.data])
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data])

  const createLogMutation = useCreateHealthLog()
  const statusMutation = useUpdateHealthLogStatus()
  const deleteLogMutation = useDeleteHealthLog()
  const bulkDeleteMutation = useDeleteHealthLogsBulk()
  const createMedicineMutation = useCreateMedicine()
  const updateMedicineMutation = useUpdateMedicine()
  const deleteMedicineMutation = useDeleteMedicine()
  const adjustStockMutation = useAdjustMedicineStock()

  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), [])
  const filters = useMemo(
    () => ({ search, period, status: statusFilter, className: classFilter }),
    [search, period, statusFilter, classFilter],
  )
  const filteredLogs = useMemo(() => filterHealthLogs(logs, filters, today), [logs, filters, today])
  const usage = useMemo(() => computeMedicineUsage(logs, 30, today), [logs, today])

  const resting = logs.filter((l) => RESTING_STATUSES.includes(l.status))
  const lowStock = medicines.filter((m) => m.stock <= m.min_stock)
  const todayCount = countTodayVisits(logs, today)
  const detailLog = logs.find((l) => l.id === detailLogId) ?? null
  const selectedLogs = useMemo(
    () => logs.filter((l) => selectedRowKeys.includes(l.id)),
    [logs, selectedRowKeys],
  )
  const medTerm = medSearch.trim().toLowerCase()
  const filteredMedicines = useMemo(() => {
    if (!medTerm) return medicines
    return medicines.filter(
      (m) => m.name.toLowerCase().includes(medTerm) || (m.category ?? '').toLowerCase().includes(medTerm),
    )
  }, [medicines, medTerm])

  const classOptions = useMemo(() => {
    const names = [...new Set(logs.map((l) => l.class_name).filter(Boolean))] as string[]
    return names.sort((a, b) => a.localeCompare(b)).map((n) => ({ value: n, label: n }))
  }, [logs])

  const openLogForm = (studentId?: string) => {
    setFormStudentId(studentId)
    setLogOpen(true)
  }

  /** Cetak jurnal medis: terpilih bila ada, jika tidak ikut filter aktif. */
  const handlePrintJournal = () => {
    const rows = selectedLogs.length > 0 ? selectedLogs : filteredLogs
    if (rows.length === 0) {
      message.info('Tidak ada data untuk dicetak')
      return
    }
    try {
      printRekamJournal(rows, today)
      void logAudit({
        action: 'EXPORT',
        source: 'OPERATIONAL',
        tableName: 'health_logs',
        newData: { printed: true, count: rows.length, scope: selectedLogs.length > 0 ? 'selected' : 'filtered' },
      })
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membuka dialog cetak')
    }
  }

  // ---------------- handlers rekam medis ----------------

  const handleCreateLog = async (values: HealthFormValues) => {
    // ambil nama & kelas santri dari DB (snapshot historis)
    const { data: student } = await supabase
      .from('students')
      // hint FK wajib sejak 0018 — students punya 2 FK ke classes
      .select('name, class_id, classes!students_class_id_fkey(name)')
      .eq('id', values.student_id)
      .single()
    const studentName = (student as { name: string } | null)?.name ?? '—'
    const className = (student as { classes?: { name: string } | null } | null)?.classes?.name ?? null
    const medicine = values.medicine_id ? medicines.find((m) => m.id === values.medicine_id) ?? null : null

    const { data: userData } = await supabase.auth.getUser()
    createLogMutation.mutate(
      { values, studentName, className, medicine, createdBy: userData.user?.id ?? null },
      {
        onSuccess: (log) => {
          message.success('Catatan kunjungan tersimpan' + (medicine ? ' — stok obat dikurangi' : ''))
          setLogOpen(false)
          setFormStudentId(undefined)
          void logAudit({
            action: 'INSERT',
            source: 'OPERATIONAL',
            tableName: 'health_logs',
            recordId: log.id,
            newData: { student: studentName, status: values.status, medicine: medicine?.name ?? null },
          })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan catatan'),
      },
    )
  }

  const handleMarkReturned = (log: HealthLog, opts?: { keepDrawer?: boolean }) => {
    statusMutation.mutate(
      { id: log.id, status: 'Returned' },
      {
        onSuccess: () => {
          message.success(`${log.student_name} dinyatakan sembuh & kembali KBM`)
          if (!opts?.keepDrawer) setDetailLogId(null)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal memperbarui'),
      },
    )
  }

  const handleDeleteLog = (log: HealthLog) => {
    deleteLogMutation.mutate(log.id, {
      onSuccess: () => {
        message.success('Catatan dihapus')
        setDetailLogId(null)
        setSelectedRowKeys((keys) => keys.filter((k) => k !== log.id))
        void logAudit({
          action: 'DELETE',
          source: 'OPERATIONAL',
          tableName: 'health_logs',
          recordId: log.id,
          oldData: { student: log.student_name, date: log.date, complaint: log.complaint },
        })
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
    })
  }

  const handleBulkDelete = () => {
    const ids = [...selectedRowKeys] as string[]
    bulkDeleteMutation.mutate(ids, {
      onSuccess: () => {
        message.success(`${ids.length} catatan dihapus`)
        setSelectedRowKeys([])
        void logAudit({
          action: 'DELETE',
          source: 'OPERATIONAL',
          tableName: 'health_logs',
          recordId: null,
          oldData: { ids, count: ids.length },
        })
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
    })
  }

  // ---------------- handler obat ----------------

  const handleMedicineSubmit = (values: HealthMedicineFormValues) => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menyimpan obat')
    if (editingMedicine) {
      updateMedicineMutation.mutate(
        { id: editingMedicine.id, values },
        {
          onSuccess: () => {
            message.success('Obat diperbarui')
            setMedicineOpen(false)
            setEditingMedicine(null)
            void logAudit({
              action: 'UPDATE',
              source: 'OPERATIONAL',
              tableName: 'health_medicines',
              recordId: editingMedicine.id,
              oldData: editingMedicine,
              newData: values,
            })
          },
          onError,
        },
      )
    } else {
      createMedicineMutation.mutate(values, {
        onSuccess: (med) => {
          message.success('Obat ditambahkan')
          setMedicineOpen(false)
          void logAudit({
            action: 'INSERT',
            source: 'OPERATIONAL',
            tableName: 'health_medicines',
            recordId: med.id,
            newData: values,
          })
        },
        onError,
      })
    }
  }

  const handleRestock = (amount: number, note: string) => {
    if (!restockMedicine) return
    const target = restockMedicine
    adjustStockMutation.mutate(
      { id: target.id, stock: target.stock + amount },
      {
        onSuccess: () => {
          message.success(`Stok ${target.name} +${amount} ${target.unit}`)
          setRestockMedicine(null)
          void logAudit({
            action: 'UPDATE',
            source: 'OPERATIONAL',
            tableName: 'health_medicines',
            recordId: target.id,
            oldData: { stock: target.stock },
            newData: { stock: target.stock + amount, restock: amount, note: note || null },
          })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambah stok'),
      },
    )
  }

  // ---------------- kolom tabel ----------------

  const logColumns: TableColumnsType<HealthLog> = [
    {
      title: 'Santri',
      key: 'student',
      width: 180,
      render: (_, l) => (
        <div style={{ minWidth: 0 }}>
          <Tooltip title={l.student_name}>
            <Typography.Link
              strong
              ellipsis
              style={{ maxWidth: 152, display: 'block', fontSize: 13 }}
              onClick={() => l.student_id && openStudentDetail(l.student_id)}
            >
              {l.student_name}
            </Typography.Link>
          </Tooltip>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
            {l.class_name ?? '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Waktu',
      key: 'when',
      width: 95,
      render: (_, l) => (
        <Typography.Text style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
          {new Date(`${l.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
          <br />
          {l.time}
        </Typography.Text>
      ),
      responsive: ['md'],
    },
    { title: 'Keluhan', dataIndex: 'complaint', key: 'complaint', ellipsis: true },
    { title: 'Diagnosis', dataIndex: 'diagnosis', key: 'diagnosis', ellipsis: true, responsive: ['lg'] },
    { title: 'Penanganan', dataIndex: 'treatment', key: 'treatment', ellipsis: true, responsive: ['md'] },
    {
      title: 'Obat',
      key: 'medicine',
      width: 165,
      render: (_, l) =>
        l.medicine_name ? (
          <Typography.Text ellipsis style={{ maxWidth: 145, display: 'block', fontSize: 12.5 }} title={l.medicine_name}>
            {l.medicine_name}
          </Typography.Text>
        ) : (
          '-'
        ),
      responsive: ['xl'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 115,
      render: (v: HealthStatus) => <StatusTag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</StatusTag>,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 140,
      render: (_, l) => (
        <Space size="small">
          {RESTING_STATUSES.includes(l.status) && canWrite && (
            <Button size="small" onClick={() => handleMarkReturned(l)}>
              Sembuh
            </Button>
          )}
          <Tooltip title="Lihat Detail">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); setDetailLogId(l.id) }} />
          </Tooltip>
          {canDelete && (
            <Popconfirm
              title="Hapus catatan ini?"
              onConfirm={(e) => { e?.stopPropagation(); handleDeleteLog(l) }}
              onCancel={(e) => e?.stopPropagation()}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const medicineColumns: TableColumnsType<HealthMedicine> = [
    {
      title: 'Nama Obat',
      dataIndex: 'name',
      key: 'name',
      render: (_, m) => <span style={{ fontWeight: 600 }}>{m.name}</span>,
    },
    { title: 'Kategori', dataIndex: 'category', key: 'category', responsive: ['md'] },
    {
      title: 'Stok',
      key: 'stock',
      width: 120,
      render: (_, m) => (
        <span style={{ fontWeight: 700, color: m.stock <= m.min_stock ? '#dc2626' : undefined }}>
          {m.stock} {m.unit}
        </span>
      ),
    },
    { title: 'Min.', dataIndex: 'min_stock', key: 'min_stock', width: 60, responsive: ['lg'] },
    {
      title: 'Terpakai 30 Hari',
      key: 'usage',
      width: 120,
      render: (_, m) => {
        const used = usage.get(m.id) ?? 0
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: used > 0 ? undefined : '#aaa' }}>
            {used} {used > 0 ? m.unit : ''}
          </span>
        )
      },
      responsive: ['md'],
    },
    { title: 'Keterangan', dataIndex: 'description', key: 'description', ellipsis: true, responsive: ['xl'] },
    {
      title: 'Aksi',
      key: 'actions',
      width: 120,
      render: (_, m) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <Tooltip title="Tambah Stok">
                <Button
                  size="small"
                  type="text"
                  icon={<PlusCircleOutlined />}
                  onClick={() => setRestockMedicine(m)}
                />
              </Tooltip>
            )}
            {canWrite && (
              <Tooltip title="Edit Obat">
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingMedicine(m)
                    setMedicineOpen(true)
                  }}
                />
              </Tooltip>
            )}
            {canDelete && (
              <Popconfirm
                title="Hapus obat ini?"
                description="Riwayat pemakaian tetap menyimpan nama obatnya."
                onConfirm={() =>
                  deleteMedicineMutation.mutate(m.id, {
                    onSuccess: () => message.success('Obat dihapus'),
                    onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
                  })
                }
                okText="Hapus"
                cancelText="Batal"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        ) : null,
    },
  ]

  const importMenu = {
    items: [
      { key: 'logs', icon: <FileTextOutlined />, label: 'Rekam Medis' },
      { key: 'medicines', icon: <MedicineBoxOutlined />, label: 'Stok Obat' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logs') setLogImportOpen(true)
      if (key === 'medicines') setMedImportOpen(true)
    },
  }

  return (
    <div>
      <PageHeader
        title="Kesehatan"
        subtitle="Rekam medis santri, observasi, dan stok obat poskestren"
        extra={
          <Space wrap>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'print',
                    icon: <PrinterOutlined />,
                    label: (
                      <div style={{ padding: '2px 0' }}>
                        <div style={{ fontWeight: 600 }}>Cetak Jurnal Medis</div>
                        <div style={{ fontSize: 11.5, opacity: 0.65 }}>PDF / Kertas</div>
                      </div>
                    ),
                  },
                  { type: 'divider' },
                  {
                    key: 'download',
                    icon: <FileExcelOutlined />,
                    label: (
                      <div style={{ padding: '2px 0' }}>
                        <div style={{ fontWeight: 600 }}>Unduh Data Rekam Medis</div>
                        <div style={{ fontSize: 11.5, opacity: 0.65 }}>XLSX / CSV</div>
                      </div>
                    ),
                  },
                ],
                onClick: ({ key }) => {
                  if (key === 'print') handlePrintJournal()
                  else setExportOpen(true)
                },
              }}
            >
              <Tooltip title="Opsi data (cetak jurnal / unduh rekap)">
                <Button icon={<ExportOutlined />} />
              </Tooltip>
            </Dropdown>
            {canWrite && (
              <>
                <Dropdown menu={importMenu}>
                  <Tooltip title="Impor data kesehatan">
                    <Button icon={<ImportOutlined />} />
                  </Tooltip>
                </Dropdown>
                <Button
                  icon={<MedicineBoxOutlined />}
                  onClick={() => {
                    setEditingMedicine(null)
                    setMedicineOpen(true)
                  }}
                >
                  Tambah Obat
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openLogForm()}>
                  Tambah Catatan
                </Button>
              </>
            )}
          </Space>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<FileTextOutlined />}
          label="Total Rekam Medis"
          value={logs.length}
          color="indigo"
          loading={logsQuery.isPending}
          active={tab === 'rekam'}
          onClick={() => setTab('rekam')}
        />
        <StatChip
          icon={<FileAddOutlined />}
          label="Kunjungan Hari Ini"
          value={todayCount}
          color="sky"
          active={tab === 'rekam' && period === 'today'}
          onClick={() => {
            setTab('rekam')
            setPeriod('today')
          }}
        />
        <StatChip
          icon={<EyeOutlined />}
          label="Sedang Observasi"
          value={resting.length}
          color="amber"
          active={tab === 'observasi'}
          onClick={() => setTab('observasi')}
        />
        <StatChip
          icon={<WarningOutlined />}
          label="Stok Obat Kritis"
          value={lowStock.length}
          color="rose"
          active={tab === 'stok'}
          onClick={() => setTab('stok')}
        />
      </div>

      <HealthInsights
        logs={logs}
        medicines={medicines}
        today={today}
        onSearchComplaint={(term) => {
          setSearch(term)
          setTab('rekam')
        }}
        onFilterClass={(className) => {
          setClassFilter(className)
          setTab('rekam')
        }}
      />

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
        items={[
          {
            key: 'rekam',
            label: 'Rekam Medis',
            children: (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <Segmented
                    value={period}
                    onChange={(v) => setPeriod(v as HealthPeriod)}
                    options={[
                      { label: 'Semua', value: 'all' },
                      { label: 'Hari Ini', value: 'today' },
                      { label: '7 Hari', value: '7d' },
                      { label: '30 Hari', value: '30d' },
                    ]}
                  />
                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ minWidth: 150 }}
                    options={[
                      { value: 'all', label: 'Semua Status' },
                      { value: 'UKS', label: STATUS_LABEL.UKS },
                      { value: 'Dormitory', label: STATUS_LABEL.Dormitory },
                      { value: 'Returned', label: STATUS_LABEL.Returned },
                    ]}
                  />
                  <Select
                    value={classFilter}
                    onChange={setClassFilter}
                    style={{ minWidth: 150 }}
                    options={[{ value: 'all', label: 'Semua Kelas' }, ...classOptions]}
                  />
                  <Input
                    placeholder="Cari santri / keluhan / obat"
                    allowClear
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 180 }}
                  />
                </div>

                {selectedRowKeys.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 12,
                      padding: '8px 12px',
                      background: '#e6f4ff',
                      borderRadius: 8,
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      {selectedRowKeys.length} dipilih
                    </Typography.Text>
                    <Button size="small" icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>
                      Export Terpilih
                    </Button>
                    {canDelete && (
                      <Popconfirm
                        title={`Hapus ${selectedRowKeys.length} catatan terpilih?`}
                        description="Tindakan tidak dapat dibatalkan."
                        onConfirm={handleBulkDelete}
                        okText="Hapus"
                        cancelText="Batal"
                        okButtonProps={{ loading: bulkDeleteMutation.isPending }}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          Hapus Terpilih
                        </Button>
                      </Popconfirm>
                    )}
                    <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>
                      Bersihkan
                    </Button>
                  </div>
                )}

                <Table<HealthLog>
                  rowKey="id"
                  columns={logColumns}
                  dataSource={filteredLogs}
                  loading={logsQuery.isLoading}
                  rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys([...keys]) }}
                  onRow={(record) => ({
                    onClick: (e) => {
                      if ((e.target as HTMLElement).closest('.ant-table-selection-column')) return
                      setDetailLogId(record.id)
                    },
                    style: { cursor: 'pointer' },
                  })}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={logs.length === 0 ? 'Belum ada catatan kunjungan' : 'Tidak ada catatan yang cocok dengan filter'}
                      />
                    ),
                  }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: 950 }}
                />
              </Card>
            ),
          },
          {
            key: 'observasi',
            label: `Santri Observasi${resting.length > 0 ? ` (${resting.length})` : ''}`,
            children: (
              <Card>
                {resting.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada santri yang sedang berobservasi" />
                ) : (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    {resting.map((l) => (
                      <Card
                        key={l.id}
                        size="small"
                        style={{ borderLeft: `4px solid ${l.status === 'UKS' ? '#d97706' : '#7c3aed'}` }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <Typography.Text strong>{l.student_name}</Typography.Text>
                            <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                              {l.class_name ?? '—'} · {l.complaint}
                            </Typography.Paragraph>
                          </div>
                          <Space>
                            <StatusTag color={STATUS_COLOR[l.status]}>{STATUS_LABEL[l.status]}</StatusTag>
                            {canWrite && (
                              <Button size="small" type="primary" ghost onClick={() => handleMarkReturned(l, { keepDrawer: true })}>
                                Sembuh
                              </Button>
                            )}
                            <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailLogId(l.id)}>
                              Detail
                            </Button>
                          </Space>
                        </div>
                      </Card>
                    ))}
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: 'stok',
            label: 'Stok Obat',
            children: (
              <Card>
                {lowStock.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`${lowStock.length} obat mencapai batas minimum`}
                    description={
                      <Space size={4} wrap>
                        {lowStock.map((m) => (
                          <Tag key={m.id} color="error">
                            {m.name} · {m.stock}/{m.min_stock} {m.unit}
                          </Tag>
                        ))}
                      </Space>
                    }
                  />
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <Input
                    placeholder="Cari obat / kategori"
                    allowClear
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  {canWrite && (
                    <Button icon={<SwapOutlined />} onClick={() => setMedImportOpen(true)}>
                      Import Obat
                    </Button>
                  )}
                  <Button icon={<FileExcelOutlined />} onClick={() => setExportOpen(true)}>
                    Export Stok
                  </Button>
                </div>
                <Table<HealthMedicine>
                  rowKey="id"
                  columns={medicineColumns}
                  dataSource={filteredMedicines}
                  loading={medicinesQuery.isLoading}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={medicines.length === 0 ? 'Belum ada obat di stok' : 'Tidak ada obat yang cocok'}
                      />
                    ),
                  }}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />

      <HealthForm
        open={logOpen}
        medicines={medicines}
        submitting={createLogMutation.isPending}
        initialStudentId={formStudentId}
        onCancel={() => {
          setLogOpen(false)
          setFormStudentId(undefined)
        }}
        onSubmit={(values) => void handleCreateLog(values)}
      />

      <MedicineForm
        open={medicineOpen}
        medicine={editingMedicine}
        submitting={createMedicineMutation.isPending || updateMedicineMutation.isPending}
        onCancel={() => {
          setMedicineOpen(false)
          setEditingMedicine(null)
        }}
        onSubmit={handleMedicineSubmit}
      />

      <RestockModal
        open={restockMedicine !== null}
        medicine={restockMedicine}
        submitting={adjustStockMutation.isPending}
        onCancel={() => setRestockMedicine(null)}
        onSubmit={handleRestock}
      />

      <DetailDrawer
        open={detailLog !== null}
        onClose={() => setDetailLogId(null)}
        log={detailLog}
        logs={logs}
        today={today}
        canWrite={canWrite}
        canDelete={canDelete}
        onMarkReturned={(l) => handleMarkReturned(l, { keepDrawer: true })}
        onDelete={handleDeleteLog}
        onAddVisit={(studentId) => {
          setDetailLogId(null)
          openLogForm(studentId)
        }}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filteredLogs={filteredLogs}
        selectedLogs={selectedLogs}
        medicines={medicines}
        usage={usage}
        today={today}
      />

      <ImportModal
        open={logImportOpen}
        onClose={() => setLogImportOpen(false)}
        medicines={medicines}
        logs={logs}
      />

      <MedicineModal
        open={medImportOpen}
        onClose={() => setMedImportOpen(false)}
        medicines={medicines}
      />
    </div>
  )
}
