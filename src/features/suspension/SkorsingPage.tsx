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
  Select,
  Statistic,
  Table,
  Typography,
  Tag,
  type TableColumnsType,
} from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { logAudit } from '../../shared/utils/auditLogger'
import { usePermissions } from '../../shared/hooks/useProfile'
import { supabase } from '../../lib/supabase'
import { searchStudents } from '../students/api'
import { useCreateSuspension, useSuspensions } from './hooks'
import type { Suspension, SuspensionStatus } from './types'

const STATUS_META: Record<SuspensionStatus, { label: string; color: string }> = {
  aktif: { label: 'Aktif', color: 'orange' },
  selesai: { label: 'Selesai', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'default' },
}

function isSmaGrade(grade: string | null): boolean {
  const g = Number(grade)
  return g === 10 || g === 11 || g === 12
}

export function SkorsingPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { canWrite } = usePermissions()
  const suspensionsQuery = useSuspensions()
  const suspensions = useMemo(() => suspensionsQuery.data ?? [], [suspensionsQuery.data])
  const createMutation = useCreateSuspension()

  const [formOpen, setFormOpen] = useState(false)

  const active = suspensions.filter((s) => s.status === 'aktif')
  const done = suspensions.filter((s) => s.status === 'selesai')

  const columns: TableColumnsType<Suspension> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, s) => (
        <Link to={`/suspension/detail/${s.id}`} style={{ fontWeight: 600 }}>
          {s.student?.name ?? '—'}
        </Link>
      ),
    },
    {
      title: 'Jenjang',
      dataIndex: 'jenjang',
      key: 'jenjang',
      width: 90,
      render: (v: string) => <Tag>{v}</Tag>,
      responsive: ['md'],
    },
    {
      title: 'Periode',
      key: 'period',
      width: 230,
      render: (_, s) => (
        <Typography.Text style={{ fontSize: 12.5 }}>
          {new Date(s.start_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} —{' '}
          {new Date(s.end_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Typography.Text>
      ),
    },
    {
      title: 'Alasan (internal)',
      dataIndex: 'reason_summary',
      key: 'reason',
      ellipsis: true,
      responsive: ['lg'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (v: SuspensionStatus) => (
        <StatusTag color={STATUS_META[v].color}>{STATUS_META[v].label}</StatusTag>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 90,
      render: (_, s) => <Link to={`/suspension/detail/${s.id}`}>Detail</Link>,
    },
  ]

  const handleCreate = async (input: {
    student_id: string
    jenjang: 'SMP' | 'SMA'
    start_date: string
    end_date: string
    reason_summary: string
  }) => {
    const { data: userData } = await supabase.auth.getUser()
    createMutation.mutate(
      { ...input, violation_report_id: null, createdBy: userData.user?.id ?? null },
      {
        onSuccess: (created) => {
          message.success('Skorsing diterbitkan — buka detail untuk membuat tautan wali')
          setFormOpen(false)
          void logAudit({
            action: 'INSERT',
            source: 'OPERATIONAL',
            tableName: 'suspensions',
            recordId: created.id,
            newData: {
              student: created.student?.name,
              start_date: created.start_date,
              end_date: created.end_date,
            },
          })
          navigate(`/suspension/detail/${created.id}`)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menerbitkan skorsing'),
      },
    )
  }

  return (
    <div>
      <PageHeader
        title="Skorsing & Pembinaan"
        subtitle="Skorsing santri dan pembinaan di rumah bersama wali"
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFormOpen(true)}>
              Terbitkan Skorsing
            </Button>
          ) : undefined
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Aktif" value={active.length} loading={suspensionsQuery.isLoading} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Selesai" value={done.length} /></Card>
        </Col>
        <Col xs={12} sm={8} xl={6}>
          <Card><Statistic title="Total" value={suspensions.length} /></Card>
        </Col>
      </Row>

      <Card>
        <Table<Suspension>
          rowKey="id"
          columns={columns}
          dataSource={suspensions}
          loading={suspensionsQuery.isLoading}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Belum ada skorsing — terbitkan saat ada pelanggaran berat"
              />
            ),
          }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
        />
      </Card>

      <SuspensionFormModal
        open={formOpen}
        submitting={createMutation.isPending}
        onCancel={() => setFormOpen(false)}
        onSubmit={(values) => void handleCreate(values)}
      />
    </div>
  )
}

interface SuspensionFormShape {
  student_id: string
  start_date: Dayjs
  end_date: Dayjs
  reason_summary: string
}

function SuspensionFormModal({
  open,
  submitting,
  onCancel,
  onSubmit,
}: {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: {
    student_id: string
    jenjang: 'SMP' | 'SMA'
    start_date: string
    end_date: string
    reason_summary: string
  }) => void
}) {
  const [form] = Form.useForm<SuspensionFormShape>()
  const [studentSearch, setStudentSearch] = useState('')
  const debouncedSearch = useDebouncedValue(studentSearch)
  const studentsQuery = useQuery({
    queryKey: ['students', 'search', debouncedSearch],
    queryFn: () => searchStudents(debouncedSearch),
    staleTime: 30_000,
    enabled: open,
  })

  const handleFinish = async (values: SuspensionFormShape) => {
    // jenjang ditentukan dari tingkat kelas santri
    const { data: student } = await supabase
      .from('students')
      .select('id, class_id, classes(grade)')
      .eq('id', values.student_id)
      .single()
    const grade = (student as { classes?: { grade: string | null } | null } | null)?.classes?.grade ?? null
    const jenjang = isSmaGrade(grade) ? 'SMA' : 'SMP'
    onSubmit({
      student_id: values.student_id,
      jenjang,
      start_date: values.start_date.format('YYYY-MM-DD'),
      end_date: values.end_date.format('YYYY-MM-DD'),
      reason_summary: values.reason_summary,
    })
  }

  return (
    <Modal
      title="Terbitkan Skorsing"
      open={open}
      onCancel={onCancel}
      onOk={() => void form.submit()}
      confirmLoading={submitting}
      width={560}
      destroyOnHidden
    >
      <Form<SuspensionFormShape>
        form={form}
        layout="vertical"
        onFinish={(values) => void handleFinish(values)}
        disabled={submitting}
        initialValues={{ start_date: dayjs(), end_date: dayjs().add(3, 'day') }}
      >
        <Form.Item name="student_id" label="Santri" rules={[{ required: true, message: 'Santri wajib dipilih' }]}>
          <Select
            showSearch
            placeholder="Cari nama atau kode registrasi"
            filterOption={false}
            onSearch={setStudentSearch}
            loading={studentsQuery.isPending}
            notFoundContent="Tidak ditemukan"
            options={(studentsQuery.data ?? []).map((s) => ({
              value: s.id,
              label: `${s.name} (${s.registration_code})`,
            }))}
          />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="start_date" label="Mulai" rules={[{ required: true, message: 'Tanggal mulai wajib' }]}>
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="end_date"
              label="Selesai"
              dependencies={['start_date']}
              rules={[
                { required: true, message: 'Tanggal selesai wajib' },
                ({ getFieldValue }) => ({
                  validator(_, value: Dayjs) {
                    const start = getFieldValue('start_date') as Dayjs | undefined
                    if (!value || !start || !value.isBefore(start, 'day')) return Promise.resolve()
                    return Promise.reject(new Error('Tanggal selesai tidak boleh sebelum mulai'))
                  },
                }),
              ]}
            >
              <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="reason_summary"
          label="Alasan Skorsing (internal kesiswaan/BK)"
          rules={[{ required: true, message: 'Alasan wajib diisi' }]}
          extra="Tidak akan pernah tampil di halaman wali santri."
        >
          <Input.TextArea rows={3} maxLength={500} placeholder="Ringkasan pelanggaran berat yang menyebabkan skorsing" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
