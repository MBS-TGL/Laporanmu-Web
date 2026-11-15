import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatChip } from '../../../shared/components/StatChip'
import { usePermissions } from '../../../shared/hooks/useProfile'
import {
  useAttendanceMachines,
  useDeleteMachine,
  useMachineAttendanceLogs,
  useSyncMachineToAttendance,
} from './hooks'
import { MachineModal } from './MachineModal'
import { ImportModal } from './ImportModal'
import type { AttendanceMachine, MachineAttendanceLog } from './types'

export function AttendancePage() {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()

  const [date, setDate] = useState<dayjs.Dayjs>(dayjs())
  const [machineFilter, setMachineFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalOpen, setModalOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<AttendanceMachine | null>(null)

  const dateStr = date.format('YYYY-MM-DD')

  const machinesQuery = useAttendanceMachines()
  const machines = machinesQuery.data ?? []

  const logsQuery = useMachineAttendanceLogs({
    date: dateStr,
    machineId: machineFilter,
    matchedStatus: statusFilter,
  })
  const logs = logsQuery.data ?? []

  const syncMutation = useSyncMachineToAttendance()
  const deleteMachineMutation = useDeleteMachine()

  const counts = useMemo(() => {
    return {
      total: logs.length,
      matched: logs.filter((l) => l.matched_status !== 'unmatched').length,
      unmatched: logs.filter((l) => l.matched_status === 'unmatched').length,
      synced: logs.filter((l) => l.synced_at !== null).length,
    }
  }, [logs])

  const handleSync = () => {
    syncMutation.mutate(dateStr, {
      onSuccess: (count) => {
        message.success(`${count} santri berhasil ditandai Hadir (H) di absensi harian tanggal ${dateStr}!`)
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyinkronkan absensi'),
    })
  }

  const handleDeleteMachine = (m: AttendanceMachine) => {
    deleteMachineMutation.mutate(m.id, {
      onSuccess: () => message.success(`Mesin "${m.name}" dihapus`),
      onError: (err: Error) => message.error(err.message || 'Gagal menghapus mesin'),
    })
  }

  // Kolom log scan
  const logColumns: TableColumnsType<MachineAttendanceLog> = [
    {
      title: 'Waktu Scan',
      key: 'time',
      width: 150,
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>
            {new Date(r.scan_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
            {new Date(r.scan_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </div>
        </div>
      ),
    },
    {
      title: 'Santri Terpeta',
      key: 'student',
      render: (_, r) =>
        r.students ? (
          <div>
            <span style={{ fontWeight: 600 }}>{r.students.name}</span>
            <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
              {r.students.registration_code}
              {r.students.classes?.name && ` · ${r.students.classes.name}`}
            </div>
          </div>
        ) : (
          <span style={{ color: token.colorTextTertiary }}>Belum terdaftar</span>
        ),
    },
    {
      title: 'ID Mesin (UID)',
      dataIndex: 'device_user_id',
      key: 'uid',
      width: 140,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Mesin',
      key: 'machine',
      render: (_, r) => r.attendance_machines?.name ?? '—',
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (_, r) => {
        if (r.matched_status === 'matched') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>Otomatis</Tag>
        }
        if (r.matched_status === 'manual') {
          return <Tag color="processing">Manual</Tag>
        }
        return <Tag color="error" icon={<QuestionCircleOutlined />}>Tidak Dikenal</Tag>
      },
    },
    {
      title: 'Sinkron Absensi',
      key: 'synced',
      width: 130,
      align: 'center',
      render: (_, r) =>
        r.synced_at ? (
          <Tag color="cyan">Tersinkron</Tag>
        ) : (
          <span style={{ color: token.colorTextTertiary, fontSize: 11.5 }}>Belum</span>
        ),
    },
  ]

  // Kolom master mesin
  const machineColumns: TableColumnsType<AttendanceMachine> = [
    {
      title: 'Nama Mesin',
      dataIndex: 'name',
      key: 'name',
      render: (v, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{v}</span>
          {r.location && (
            <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>{r.location}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Serial Number',
      dataIndex: 'serial_no',
      key: 'serial',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Terakhir Aktif',
      dataIndex: 'last_seen_at',
      key: 'last_seen',
      render: (v: string | null) =>
        v ? (
          <span>
            {new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })},{' '}
            {new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
        ) : (
          <span style={{ color: token.colorTextTertiary }}>Belum pernah aktif</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'status',
      width: 100,
      align: 'center',
      render: (v: boolean) =>
        v ? <Tag color="success">Aktif</Tag> : <Tag color="default">Nonaktif</Tag>,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_, r) => (
        <Space size={4}>
          {canWrite && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingMachine(r)
                  setModalOpen(true)
                }}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title={`Hapus mesin "${r.name}"?`}
              onConfirm={() => handleDeleteMachine(r)}
              okText="Hapus"
              cancelText="Batal"
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card styles={{ body: { padding: '12px 16px' } }} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Tooltip title="Muat ulang">
            <Button
              icon={<ReloadOutlined spin={logsQuery.isFetching} />}
              onClick={() => {
                void logsQuery.refetch()
                void machinesQuery.refetch()
              }}
            />
          </Tooltip>
          {canWrite && (
            <>
              <Tooltip title="Impor log dari mesin presensi">
                <Button
                  icon={<CloudUploadOutlined />}
                  onClick={() => setImportOpen(true)}
                  disabled={machines.length === 0}
                />
              </Tooltip>
              <Button
                type="primary"
                icon={<SyncOutlined />}
                loading={syncMutation.isPending}
                onClick={handleSync}
                disabled={counts.matched === 0}
                style={{ marginLeft: 'auto' }}
              >
                Sinkronkan ke Absensi ({counts.matched})
              </Button>
            </>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <StatChip
          icon={<ClockCircleOutlined />}
          label="Total Scan Hari Ini"
          value={counts.total}
          color="indigo"
          loading={logsQuery.isPending}
        />
        <StatChip
          icon={<CheckCircleOutlined />}
          label="Cocok (Siswa)"
          value={counts.matched}
          color="emerald"
          loading={logsQuery.isPending}
        />
        <StatChip
          icon={<QuestionCircleOutlined />}
          label="Tidak Dikenal"
          value={counts.unmatched}
          color={counts.unmatched > 0 ? 'rose' : 'slate'}
          loading={logsQuery.isPending}
        />
        <StatChip
          icon={<SyncOutlined />}
          label="Tersinkron Absensi"
          value={counts.synced}
          color="amber"
          loading={logsQuery.isPending}
        />
      </div>

      <Tabs
        items={[
          {
            key: 'logs',
            label: `Log Scan Realtime (${logs.length})`,
            children: (
              <Card>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                  <DatePicker
                    value={date}
                    onChange={(d) => d && setDate(d)}
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                  <Select
                    placeholder="Semua mesin"
                    allowClear
                    style={{ width: 180 }}
                    value={machineFilter}
                    onChange={setMachineFilter}
                    options={machines.map((m) => ({ value: m.id, label: m.name }))}
                  />
                  <Select
                    placeholder="Semua status"
                    allowClear
                    style={{ width: 160 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: 'matched', label: 'Cocok Otomatis' },
                      { value: 'manual', label: 'Cocok Manual' },
                      { value: 'unmatched', label: 'Tidak Dikenal' },
                    ]}
                  />
                </div>

                <Table<MachineAttendanceLog>
                  rowKey="id"
                  size="small"
                  columns={logColumns}
                  dataSource={logs}
                  loading={logsQuery.isPending}
                  pagination={{ pageSize: 25, showTotal: (t) => `Total ${t} log scan` }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={`Belum ada log scan pada tanggal ${dateStr}`}
                      />
                    ),
                  }}
                  scroll={{ x: true }}
                />
              </Card>
            ),
          },
          {
            key: 'machines',
            label: `Master Mesin (${machines.length})`,
            children: (
              <Card
                title="Daftar Mesin Presensi Terdaftar"
                extra={
                  canWrite && (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingMachine(null)
                        setModalOpen(true)
                      }}
                    >
                      Tambah Mesin
                    </Button>
                  )
                }
              >
                <Table<AttendanceMachine>
                  rowKey="id"
                  size="middle"
                  columns={machineColumns}
                  dataSource={machines}
                  loading={machinesQuery.isPending}
                  pagination={false}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Belum ada mesin presensi — daftarkan mesin pertama"
                      />
                    ),
                  }}
                />
              </Card>
            ),
          },
        ]}
      />

      <MachineModal
        open={modalOpen}
        editing={editingMachine}
        onClose={() => setModalOpen(false)}
      />

      <ImportModal
        open={importOpen}
        machines={machines}
        onClose={() => setImportOpen(false)}
      />
    </div>
  )
}
