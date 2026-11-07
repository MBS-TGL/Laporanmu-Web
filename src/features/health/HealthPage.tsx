import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd'
import { DeleteOutlined, EyeOutlined, FileTextOutlined, PlusOutlined, WarningOutlined } from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { supabase } from '../../lib/supabase'
import {
  useCreateHealthLog,
  useCreateMedicine,
  useDeleteHealthLog,
  useDeleteMedicine,
  useHealthLogs,
  useMedicines,
  useUpdateHealthLogStatus,
  useUpdateMedicine,
} from './hooks'
import type {
  HealthLog,
  HealthLogFormValues,
  HealthMedicine,
  HealthMedicineFormValues,
  HealthStatus,
} from './types'
import { HealthLogForm } from './components/HealthLogForm'
import { MedicineForm } from './components/MedicineForm'

const STATUS_LABEL: Record<HealthStatus, string> = {
  UKS: 'Rawat di UKS',
  Asrama: 'Rest di Asrama',
  Kembali: 'Kembali KBM',
}

const STATUS_COLOR: Record<HealthStatus, string> = {
  UKS: 'orange',
  Asrama: 'purple',
  Kembali: 'green',
}

export function HealthPage() {
  const { message } = App.useApp()
  const { canWrite, canDelete } = usePermissions()
  const [tab, setTab] = useState<'rekam' | 'observasi' | 'stok'>('rekam')
  const [logOpen, setLogOpen] = useState(false)
  const [medicineOpen, setMedicineOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState<HealthMedicine | null>(null)
  const [search, setSearch] = useState('')

  const medicinesQuery = useMedicines()
  const logsQuery = useHealthLogs()
  const medicines = medicinesQuery.data ?? []
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data])

  const createLogMutation = useCreateHealthLog()
  const statusMutation = useUpdateHealthLogStatus()
  const deleteLogMutation = useDeleteHealthLog()
  const createMedicineMutation = useCreateMedicine()
  const updateMedicineMutation = useUpdateMedicine()
  const deleteMedicineMutation = useDeleteMedicine()

  const resting = logs.filter((l) => l.status === 'UKS' || l.status === 'Asrama')
  const lowStock = medicines.filter((m) => m.stock <= m.min_stock)

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return logs
    return logs.filter((l) =>
      [l.student_name, l.complaint, l.diagnosis, l.treatment, l.medicine_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    )
  }, [logs, search])

  const handleCreateLog = async (values: HealthLogFormValues) => {
    // ambil nama & kelas santri dari DB (snapshot historis)
    const { data: student } = await supabase
      .from('students')
      .select('name, class_id, classes(name)')
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

  const logColumns: TableColumnsType<HealthLog> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, l) => (
        <div>
          <div style={{ fontWeight: 600 }}>{l.student_name}</div>
          <span style={{ fontSize: 12, color: '#888' }}>{l.class_name ?? '—'}</span>
        </div>
      ),
    },
    {
      title: 'Waktu',
      key: 'when',
      width: 130,
      render: (_, l) => (
        <Typography.Text style={{ fontSize: 12.5 }}>
          {new Date(l.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
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
      render: (_, l) => (l.medicine_name ? <Tag>{l.medicine_name}</Tag> : '-'),
      responsive: ['xl'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (v: HealthStatus) => (
        <StatusTag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</StatusTag>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, l) => (
        <Space size="small">
          {(l.status === 'UKS' || l.status === 'Asrama') && canWrite && (
            <Button
              size="small"
              onClick={() =>
                statusMutation.mutate(
                  { id: l.id, status: 'Kembali' },
                  {
                    onSuccess: () => message.success(`${l.student_name} dinyatakan sembuh`),
                    onError: (err: Error) => message.error(err.message || 'Gagal memperbarui'),
                  },
                )
              }
            >
              Sembuh
            </Button>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus catatan ini?"
              onConfirm={() =>
                deleteLogMutation.mutate(l.id, {
                  onSuccess: () => message.success('Catatan dihapus'),
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
      ),
    },
  ]

  const medicineColumns: TableColumnsType<HealthMedicine> = [
    { title: 'Nama Obat', dataIndex: 'name', key: 'name', render: (_, m) => (
      <span style={{ fontWeight: 600 }}>{m.name}</span>
    ) },
    { title: 'Kategori', dataIndex: 'category', key: 'category', responsive: ['md'] },
    {
      title: 'Stok',
      key: 'stock',
      width: 130,
      render: (_, m) => (
        <span style={{ fontWeight: 700, color: m.stock <= m.min_stock ? '#dc2626' : undefined }}>
          {m.stock} {m.unit}
        </span>
      ),
    },
    { title: 'Min.', dataIndex: 'min_stock', key: 'min_stock', width: 60, responsive: ['lg'] },
    { title: 'Keterangan', dataIndex: 'description', key: 'description', ellipsis: true, responsive: ['xl'] },
    {
      title: 'Aksi',
      key: 'actions',
      width: 110,
      render: (_, m) =>
        canWrite || canDelete ? (
          <Space size="small">
            {canWrite && (
              <Button
                type="text"
                onClick={() => {
                  setEditingMedicine(m)
                  setMedicineOpen(true)
                }}
              >
                Edit
              </Button>
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

  return (
    <div>
      <PageHeader
        title="Kesehatan"
        subtitle="Rekam medis santri, observasi, dan stok obat poskestren"
        extra={
          canWrite ? (
            <Space>
              <Button
                onClick={() => {
                  setEditingMedicine(null)
                  setMedicineOpen(true)
                }}
              >
                Tambah Obat
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setLogOpen(true)}>
                Tambah Catatan
              </Button>
            </Space>
          ) : undefined
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

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'rekam' | 'observasi' | 'stok')}
        items={[
          {
            key: 'rekam',
            label: 'Rekam Medis',
            children: (
              <Card>
                <Input
                  placeholder="Cari santri / keluhan / obat"
                  allowClear
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ maxWidth: 300, marginBottom: 12 }}
                />
                <Table<HealthLog>
                  rowKey="id"
                  columns={logColumns}
                  dataSource={filteredLogs}
                  loading={logsQuery.isLoading}
                  locale={{
                    emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada catatan kunjungan" />,
                  }}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: true }}
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
                              <Button
                                size="small"
                                type="primary"
                                ghost
                                onClick={() =>
                                  statusMutation.mutate(
                                    { id: l.id, status: 'Kembali' },
                                    {
                                      onSuccess: () =>
                                        message.success(`${l.student_name} dinyatakan sembuh & kembali KBM`),
                                      onError: (err: Error) => message.error(err.message || 'Gagal memperbarui'),
                                    },
                                  )
                                }
                              >
                                Sembuh
                              </Button>
                            )}
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
                <Table<HealthMedicine>
                  rowKey="id"
                  columns={medicineColumns}
                  dataSource={medicines}
                  loading={medicinesQuery.isLoading}
                  locale={{
                    emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada obat di stok" />,
                  }}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />

      <HealthLogForm
        open={logOpen}
        medicines={medicines}
        submitting={createLogMutation.isPending}
        onCancel={() => setLogOpen(false)}
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
    </div>
  )
}
