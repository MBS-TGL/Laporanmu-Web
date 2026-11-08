import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Table,
  Typography,
  type TableColumnsType,
} from 'antd'
import { PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { supabase } from '../../lib/supabase'
import { useDebounce } from '../../shared/hooks/useDebounce'
import {
  useCreatePermit,
  usePermitStudents,
  usePermits,
  useUpdatePermitStatus,
} from './hooks'
import type { LeavePermit, PermitFormValues, PermitStatus } from './types'

const STATUS_META: Record<PermitStatus, { label: string; color: string }> = {
  issued: { label: 'Diterbitkan', color: 'blue' },
  departed: { label: 'Berangkat', color: 'orange' },
  returned: { label: 'Kembali', color: 'green' },
  overdue: { label: 'Terlambat', color: 'red' },
  cancelled: { label: 'Dibatalkan', color: 'default' },
}

const PURPOSE_PRESETS = [
  'Pulang ke rumah',
  'Belanja kebutuhan',
  'Kontrol kesehatan',
  'Keperluan keluarga',
  'Mengurus administrasi',
  'Lainnya',
]

export function PermitPage() {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const [statusFilter, setStatusFilter] = useState<PermitStatus | ''>('')
  const [formOpen, setFormOpen] = useState(false)
  const [printPermit, setPrintPermit] = useState<LeavePermit | null>(null)

  const permitsQuery = usePermits(statusFilter || undefined)
  const permits = useMemo(() => permitsQuery.data ?? [], [permitsQuery.data])
  const createMutation = useCreatePermit()
  const statusMutation = useUpdatePermitStatus()

  const today = new Date().toISOString().slice(0, 10)
  const issuedToday = permits.filter((p) => p.leave_date === today && p.status !== 'cancelled').length
  const active = permits.filter((p) => p.status === 'departed').length
  const overdue = permits.filter((p) => p.status === 'departed' && new Date(p.return_deadline) < new Date()).length

  const handleCreate = async (values: PermitFormValues) => {
    const { data: userData } = await supabase.auth.getUser()
    createMutation.mutate(
      { values, issuedBy: userData.user?.id ?? null },
      {
        onSuccess: (permit) => {
          message.success('Surat izin diterbitkan')
          setFormOpen(false)
          void logAudit({
            action: 'INSERT',
            source: 'OPERATIONAL',
            tableName: 'leave_permits',
            recordId: permit.id,
            newData: { student: permit.student?.name, destination: values.destination },
          })
          setPrintPermit(permit)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menerbitkan izin'),
      },
    )
  }

  const columns: TableColumnsType<LeavePermit> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{p.student?.name ?? '—'}</div>
          <span style={{ fontSize: 12, color: '#888' }}>{p.student?.registration_code}</span>
        </div>
      ),
    },
    { title: 'Tujuan', dataIndex: 'destination', key: 'destination', ellipsis: true },
    { title: 'Keperluan', dataIndex: 'purpose', key: 'purpose', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Keluar',
      dataIndex: 'leave_date',
      key: 'leave_date',
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      responsive: ['md'],
    },
    {
      title: 'Batas Kembali',
      dataIndex: 'return_deadline',
      key: 'return_deadline',
      width: 150,
      render: (v: string) => (
        <Typography.Text style={{ fontSize: 12.5 }}>
          {new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}{' '}
          {new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </Typography.Text>
      ),
      responsive: ['md'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: PermitStatus, p) => {
        const effective: PermitStatus =
          v === 'departed' && new Date(p.return_deadline) < new Date() ? 'overdue' : v
        return <StatusTag color={STATUS_META[effective].color}>{STATUS_META[effective].label}</StatusTag>
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 130,
      render: (_, p) => (
        <Space size="small">
          <Button type="text" icon={<PrinterOutlined />} onClick={() => setPrintPermit(p)} />
          {canWrite && ['issued', 'departed', 'overdue'].includes(p.status) && (
            <Button
              size="small"
              danger
              onClick={() =>
                statusMutation.mutate(
                  { id: p.id, status: 'cancelled' },
                  {
                    onSuccess: () => message.success('Izin dibatalkan'),
                    onError: (err: Error) => message.error(err.message || 'Gagal membatalkan'),
                  },
                )
              }
            >
              Batalkan
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Izin Keluar Pondok"
        subtitle="Terbitkan surat izin pulang dan pantau statusnya"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
              Terbitkan Izin
            </Button>
          ) : undefined
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Diterbitkan Hari Ini" value={issuedToday} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card>
            <Statistic
              title="Sedang Keluar"
              value={active}
              valueStyle={{ color: active > 0 ? '#d97706' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card>
            <Statistic
              title="Terlambat"
              value={overdue}
              valueStyle={{ color: overdue > 0 ? '#dc2626' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Segmented
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as PermitStatus | '')}
          options={[
            { label: 'Semua', value: '' },
            { label: 'Diterbitkan', value: 'issued' },
            { label: 'Berangkat', value: 'departed' },
            { label: 'Kembali', value: 'returned' },
            { label: 'Dibatalkan', value: 'cancelled' },
          ]}
        />
      </Card>

      <Card>
        <Table<LeavePermit>
          rowKey="id"
          columns={columns}
          dataSource={permits}
          loading={permitsQuery.isLoading}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada izin keluar" />,
          }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: true }}
        />
      </Card>

      <PermitFormModal
        open={formOpen}
        submitting={createMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={(values) => void handleCreate(values)}
      />

      <PermitPrintModal permit={printPermit} onClose={() => setPrintPermit(null)} />
    </div>
  )
}

// ------------------------------------------------------------
// Form penerbitan
// ------------------------------------------------------------
function PermitFormModal({
  open,
  submitting,
  onCancel,
  onSubmit,
}: {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: PermitFormValues) => void
}) {
  const [form] = Form.useForm()
  const [studentSearch, setStudentSearch] = useState('')
  const debouncedSearch = useDebounce(studentSearch)
  const studentsQuery = usePermitStudents(debouncedSearch)

  const selectedId = Form.useWatch('student_id', form)
  const selectedStudent = (studentsQuery.data ?? []).find((s) => s.id === selectedId)

  const handleFinish = (values: {
    student_id: string
    phone?: string
    destination: string
    purpose: string
    leave_date: Dayjs
    return_date: Dayjs
    return_time: Dayjs
  }) => {
    onSubmit({
      student_id: values.student_id,
      phone: values.phone,
      destination: values.destination,
      purpose: values.purpose,
      leave_date: values.leave_date.format('YYYY-MM-DD'),
      return_date: values.return_date.format('YYYY-MM-DD'),
      return_time: values.return_time.format('HH:mm'),
    })
  }

  return (
    <Modal
      title="Terbitkan Surat Izin Keluar"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        disabled={submitting}
        initialValues={{ leave_date: dayjs(), return_date: dayjs(), return_time: dayjs().add(3, 'hour') }}
      >
        <Form.Item name="student_id" label="Cari Santri" rules={[{ required: true, message: 'Santri wajib dipilih' }]}>
          <Select
            showSearch
            placeholder="Ketik nama santri"
            filterOption={false}
            onSearch={setStudentSearch}
            loading={studentsQuery.isPending}
            notFoundContent={studentsQuery.isPending ? 'Mencari…' : 'Tidak ditemukan'}
            options={(studentsQuery.data ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} (${s.registration_code})`,
            }))}
          />
        </Form.Item>

        {selectedStudent && (
          <Form.Item name="phone" label="No. Telepon" initialValue={selectedStudent.phone ?? undefined}>
            <Input maxLength={20} placeholder="08xxxxxxxxxx" />
          </Form.Item>
        )}

        <Form.Item name="destination" label="Tujuan" rules={[{ required: true, message: 'Tujuan wajib diisi' }]}>
          <Input maxLength={120} placeholder="Rumah orang tua, rumah sakit…" />
        </Form.Item>

        <Form.Item
          name="purpose"
          label="Keperluan"
          rules={[{ required: true, message: 'Keperluan wajib diisi' }]}
          extra={
            <Space wrap size={4} style={{ marginTop: 6 }}>
              {PURPOSE_PRESETS.map((preset) => (
                <Button key={preset} size="small" type="dashed" onClick={() => form.setFieldValue('purpose', preset)}>
                  {preset}
                </Button>
              ))}
            </Space>
          }
        >
          <Input maxLength={150} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="leave_date"
              label="Tanggal Keluar"
              rules={[{ required: true, message: 'Tanggal keluar wajib diisi' }]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="return_date"
              label="Tanggal Kembali"
              dependencies={['leave_date']}
              rules={[
                { required: true, message: 'Tanggal kembali wajib diisi' },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs) {
                    const leave = getFieldValue('leave_date') as Dayjs | undefined
                    if (!value || !leave || !value.isBefore(leave, 'day')) return Promise.resolve()
                    return Promise.reject(new Error('Tanggal kembali tidak boleh lebih awal dari tanggal keluar'))
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="return_time"
          label="Jam Kembali"
          rules={[{ required: true, message: 'Jam kembali wajib diisi' }]}
        >
          <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

// ------------------------------------------------------------
// Cetak surat izin (print khusus: hanya .permit-print-root)
// ------------------------------------------------------------
function PermitPrintModal({ permit, onClose }: { permit: LeavePermit | null; onClose: () => void }) {
  if (!permit) return null
  const fmtDate = (v: string) =>
    new Date(v).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Modal
      title="Cetak Surat Izin Keluar"
      open={!!permit}
      onCancel={onClose}
      width={560}
      footer={
        <Space>
          <Button onClick={onClose}>Tutup</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Cetak
          </Button>
        </Space>
      }
    >
      <div className="permit-print-root">
        <div className="permit-letter">
          <div className="permit-letter-head">
            <img src="/logo-icon.png" alt="Logo Laporanmu" width={44} height={44} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#1a5c35' }}>PENGASUHAN SANTRI</div>
              <div style={{ fontSize: 11, color: '#475569' }}>Laporanmu Boarding School — Jember</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', margin: '12px 0 4px', fontWeight: 800, fontSize: 15, textDecoration: 'underline' }}>
            IZIN KELUAR PONDOK
          </div>
          <div style={{ textAlign: 'center', fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
            No: {permit.id.slice(0, 8).toUpperCase()} · {fmtDate(permit.leave_date)}
          </div>
          <table className="permit-letter-table">
            <tbody>
              <tr><td>Nama</td><td>{permit.student?.name ?? '—'}</td></tr>
              <tr><td>Kelas</td><td>{permit.student?.registration_code ?? '—'}</td></tr>
              <tr><td>No. Telepon</td><td>{permit.phone ?? '—'}</td></tr>
              <tr><td>Tujuan</td><td>{permit.destination}</td></tr>
              <tr><td>Keperluan</td><td>{permit.purpose}</td></tr>
              <tr><td>Hari / Tanggal Keluar</td><td>{fmtDate(permit.leave_date)}</td></tr>
              <tr>
                <td>Batas Kembali</td>
                <td>
                  {new Date(permit.return_deadline).toLocaleString('id-ID', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </td>
              </tr>
            </tbody>
          </table>
          <table className="permit-letter-sign">
            <tbody>
              <tr>
                <td>
                  <div>Staf Pengasuhan Santri</div>
                  <div className="permit-sign-space" />
                  <div style={{ fontWeight: 700 }}>( .............................. )</div>
                </td>
                <td>
                  <div>Wali Santri</div>
                  <div className="permit-sign-space" />
                  <div style={{ fontWeight: 700 }}>( .............................. )</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

