import { useEffect, useMemo, useState } from 'react'
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
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { usePermissions } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import { supabase } from '../../lib/supabase'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { searchStudents } from '../students/api'
import { useProfile } from '../../shared/hooks/useProfile'
import {
  useCounselingLogs,
  useCreateCounseling,
  useDeleteCounseling,
  useUpdateCounselingStatus,
} from './hooks'
import type {
  CounselingCategory,
  CounselingFormValues,
  CounselingLog,
  CounselingStatus,
  CounselingUrgency,
} from './types'

const CATEGORY_LABEL: Record<CounselingCategory, string> = {
  pribadi: 'Pribadi',
  sosial: 'Sosial',
  akademik: 'Belajar',
  karir: 'Karir',
}

const URGENCY_META: Record<CounselingUrgency, { label: string; color: string }> = {
  ringan: { label: 'Ringan', color: 'green' },
  sedang: { label: 'Sedang', color: 'orange' },
  tinggi: { label: 'Tinggi', color: 'red' },
}

const STATUS_META: Record<CounselingStatus, { label: string; color: string }> = {
  proses: { label: 'Dalam Proses', color: 'gold' },
  selesai: { label: 'Selesai', color: 'green' },
}

interface CounselingFormShape {
  student_id: string
  counselor_name: string
  date: Dayjs
  time: Dayjs
  category: CounselingCategory
  complaint: string
  diagnosis?: string
  action_plan?: string
  urgency: CounselingUrgency
  status: CounselingStatus
}

export function CounselingPage() {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const { canWrite, canDelete } = usePermissions()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [category, setCategory] = useState<CounselingCategory | undefined>()
  const [urgency, setUrgency] = useState<CounselingUrgency | undefined>()
  const [status, setStatus] = useState<CounselingStatus | undefined>()
  const [formOpen, setFormOpen] = useState(false)

  const logsQuery = useCounselingLogs({
    search: debouncedSearch || undefined,
    category,
    urgency,
    status,
  })
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data])
  const createMutation = useCreateCounseling()
  const statusMutation = useUpdateCounselingStatus()
  const deleteMutation = useDeleteCounseling()

  const handleCreate = async (values: CounselingFormValues) => {
    // ambil nama & kelas santri (snapshot historis)
    const { data: student } = await supabase
      .from('students')
      .select('name, class_id, classes(name)')
      .eq('id', values.student_id)
      .single()
    const studentName = (student as { name: string } | null)?.name ?? '—'
    const className = (student as { classes?: { name: string } | null } | null)?.classes?.name ?? null

    const { data: userData } = await supabase.auth.getUser()
    createMutation.mutate(
      {
        values: {
          student_id: values.student_id,
          counselor_name: values.counselor_name,
          date: values.date,
          time: values.time,
          category: values.category,
          complaint: values.complaint,
          diagnosis: values.diagnosis,
          action_plan: values.action_plan,
          urgency: values.urgency,
          status: values.status,
        },
        studentName,
        className,
        createdBy: userData.user?.id ?? null,
      },
      {
        onSuccess: (log) => {
          message.success('Sesi BK tersimpan')
          setFormOpen(false)
          void logAudit({
            action: 'INSERT',
            source: 'OPERATIONAL',
            tableName: 'counseling_logs',
            recordId: log.id,
            newData: { student: studentName, category: values.category, urgency: values.urgency },
          })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan sesi BK'),
      },
    )
  }

  const columns: TableColumnsType<CounselingLog> = [
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
      responsive: ['md'],
      render: (_, l) => (
        <Typography.Text style={{ fontSize: 12.5 }}>
          {new Date(l.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
          <br />
          {l.time}
        </Typography.Text>
      ),
    },
    { title: 'Konselor', dataIndex: 'counselor_name', key: 'counselor', ellipsis: true, responsive: ['lg'] },
    { title: 'Kategori', key: 'category', width: 100, render: (_, l) => <Tag>{CATEGORY_LABEL[l.category]}</Tag> },
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
          <Button
            size="small"
            onClick={() =>
              statusMutation.mutate(
                { id: l.id, status: v === 'proses' ? 'selesai' : 'proses' },
                {
                  onSuccess: () =>
                    message.success(
                      v === 'proses' ? 'Sesi ditandai selesai' : 'Sesi kembali dalam proses',
                    ),
                  onError: (err: Error) => message.error(err.message || 'Gagal memperbarui status'),
                },
              )
            }
          >
            {STATUS_META[v].label === 'Selesai' ? '↺ Buka Lagi' : '✓ Selesaikan'}
          </Button>
        ) : (
          <StatusTag color={STATUS_META[v].color}>{STATUS_META[v].label}</StatusTag>
        ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 60,
      render: (_, l) =>
        canDelete ? (
          <Popconfirm
            title='Hapus sesi BK ini?'
            description='Catatan akan dihapus permanen.'
            onConfirm={() =>
              deleteMutation.mutate(l.id, {
                onSuccess: () => message.success('Sesi BK dihapus'),
                onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
              })
            }
            okText='Hapus'
            cancelText='Batal'
          >
            <Button type='text' danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null,
    },
  ]

  const activeCount = logs.filter((l) => l.status === 'proses').length
  const highUrgency = logs.filter((l) => l.urgency === 'tinggi' && l.status === 'proses').length

  return (
    <div>
      <PageHeader
        title="Bimbingan & Konseling (BK)"
        subtitle="Pembinaan karakter, solusi psikososial, dan arahan karir santri"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
              Catat Sesi BK
            </Button>
          ) : undefined
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Total Sesi" value={logs.length} loading={logsQuery.isLoading} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Dalam Proses" value={activeCount} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card>
            <Statistic
              title="Urgensi Tinggi Aktif"
              value={highUrgency}
              valueStyle={{ color: highUrgency > 0 ? '#dc2626' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Input
            placeholder="Cari santri, konselor, keluhan…"
            allowClear
            prefix={'⌕'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Kategori"
            allowClear
            style={{ minWidth: 130 }}
            value={category}
            onChange={setCategory}
            options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Select
            placeholder="Urgensi"
            allowClear
            style={{ minWidth: 120 }}
            value={urgency}
            onChange={setUrgency}
            options={Object.entries(URGENCY_META).map(([value, m]) => ({ value, label: m.label }))}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ minWidth: 150 }}
            value={status}
            onChange={setStatus}
            options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
          />
        </Space>
      </Card>

      <Card>
        <Table<CounselingLog>
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={logsQuery.isLoading}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada sesi BK tercatat" />,
          }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: true }}
        />
      </Card>

      <CounselingFormModal
        open={formOpen}
        submitting={createMutation.isPending}
        defaultCounselor={profile?.name ?? ''}
        onCancel={() => setFormOpen(false)}
        onSubmit={(values) => void handleCreate(values)}
      />
    </div>
  )
}


function CounselingFormModal({
  open,
  submitting,
  defaultCounselor,
  onCancel,
  onSubmit,
}: {
  open: boolean
  submitting: boolean
  defaultCounselor: string
  onCancel: () => void
  onSubmit: (values: CounselingFormValues) => void
}) {
  const [form] = Form.useForm<CounselingFormShape>()
  const [studentSearch, setStudentSearch] = useState('')
  const debouncedSearch = useDebouncedValue(studentSearch)
  const studentsQuery = useStudentsQuery(debouncedSearch)

  useEffect(() => {
    if (open) {
      form.resetFields()
      form.setFieldsValue({
        counselor_name: defaultCounselor,
        date: dayjs(),
        time: dayjs(),
        category: 'pribadi',
        urgency: 'ringan',
        status: 'proses',
      })
    }
  }, [open, form, defaultCounselor])

  const handleFinish = (values: CounselingFormShape) => {
    onSubmit({
      student_id: values.student_id,
      counselor_name: values.counselor_name,
      date: values.date.format('YYYY-MM-DD'),
      time: values.time.format('HH:mm'),
      category: values.category,
      complaint: values.complaint,
      diagnosis: values.diagnosis,
      action_plan: values.action_plan,
      urgency: values.urgency,
      status: values.status,
    })
  }

  return (
    <Modal
      title="Catat Sesi Bimbingan BK"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={580}
      destroyOnHidden
    >
      <Form<CounselingFormShape> form={form} layout="vertical" onFinish={handleFinish} disabled={submitting}>
        <Form.Item name="student_id" label="Pilih Santri" rules={[{ required: true, message: 'Santri wajib dipilih' }]}>
          <Select
            showSearch
            placeholder="Cari nama atau kode registrasi"
            filterOption={false}
            onSearch={setStudentSearch}
            loading={studentsQuery.isPending}
            notFoundContent={studentsQuery.isPending ? 'Mencari…' : 'Tidak ditemukan'}
            options={(studentsQuery.data ?? []).map((s: { id: string; name: string; registration_code: string }) => ({
              value: s.id,
              label: `${s.name} (${s.registration_code})`,
            }))}
          />
        </Form.Item>

        <Form.Item name="counselor_name" label="Konselor / Pembimbing">
          <Input maxLength={80} placeholder="Nama ustadz / ustadzah pembimbing" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="date" label="Tanggal Bimbingan" rules={[{ required: true, message: 'Tanggal wajib diisi' }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="time" label="Jam Sesi" rules={[{ required: true, message: 'Jam wajib diisi' }]}>
              <DatePicker.TimePicker style={{ width: '100%' }} format="HH:mm" minuteStep={5} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="category" label="Kategori Bimbingan" rules={[{ required: true }]}>
          <Select
            options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>

        <Form.Item
          name="complaint"
          label="Keluhan & Masalah Santri"
          rules={[{ required: true, message: 'Keluhan wajib diisi' }]}
        >
          <Input.TextArea
            rows={3}
            maxLength={500}
            placeholder="Jelaskan keluhan, gejala psikososial, atau kebingungan yang dihadapi santri…"
          />
        </Form.Item>

        <Form.Item name="diagnosis" label="Diagnosis / Identifikasi Akar Masalah">
          <Input maxLength={150} placeholder="Contoh: Homesickness ringan, penurunan motivasi" />
        </Form.Item>

        <Form.Item name="action_plan" label="Rencana Tindakan / Solusi BK">
          <Input maxLength={200} placeholder="Contoh: Bimbingan supportif, koordinasi asrama" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="urgency" label="Tingkat Urgensi" rules={[{ required: true }]}>
              <Select
                options={Object.entries(URGENCY_META).map(([value, m]) => ({ value, label: m.label }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="Status Sesi" rules={[{ required: true }]}>
              <Select
                options={Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}

function useStudentsQuery(search: string) {
  return useQuery({
    queryKey: ['students', 'search', search],
    queryFn: () => searchStudents(search),
    staleTime: 30_000,
  })
}
