import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
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
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatusTag } from '../../shared/components/StatusTag'
import { useProfile } from '../../shared/hooks/useProfile'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  useCreateFollowup,
  useCreateTask,
  useDeleteTask,
  useGenerateToken,
  useGradeSubmission,
  useRevokeToken,
  useSuspensionDailyLogs,
  useSuspensionDetail,
  useSuspensionFollowups,
  useSuspensionSubmissions,
  useSuspensionTasks,
  useSuspensionTokens,
  useUpdateSuspensionStatus,
} from './hooks'
import type { SuspensionFollowup, SuspensionStatus, SuspensionTask } from './types'

const STATUS_META: Record<SuspensionStatus, { label: string; color: string }> = {
  aktif: { label: 'Aktif', color: 'orange' },
  selesai: { label: 'Selesai', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'default' },
}

export function SkorsingDetailPage() {
  const { id = '' } = useParams()
  const { message } = App.useApp()
  const { profile } = useProfile()
  const isAdmin = profile?.role === 'developer' || profile?.role === 'admin'

  const detailQuery = useSuspensionDetail(id || undefined)
  const detail = detailQuery.data ?? null
  const statusMutation = useUpdateSuspensionStatus()

  return (
    <div>
      <PageHeader
        title={detail ? `Skorsing — ${detail.student?.name ?? ''}` : 'Detail Skorsing'}
        subtitle={
          detail
            ? `${detail.jenjang} · ${dayjs(detail.start_date).format('DD MMM')} — ${dayjs(detail.end_date).format('DD MMM YYYY')}`
            : undefined
        }
        extra={
          <Space>
            <Link to="/suspension">
              <Button icon={<ArrowLeftOutlined />}>Daftar</Button>
            </Link>
            {isAdmin && detail?.status === 'aktif' && (
              <Button
                type="primary"
                onClick={() =>
                  statusMutation.mutate(
                    { id, status: 'selesai' },
                    {
                      onSuccess: () => message.success('Skorsing diselesaikan'),
                      onError: (err: Error) => message.error(err.message || 'Gagal'),
                    },
                  )
                }
              >
                Selesaikan
              </Button>
            )}
            {isAdmin && detail?.status === 'aktif' && (
              <Button danger onClick={() =>
                statusMutation.mutate(
                  { id, status: 'dibatalkan' },
                  {
                    onSuccess: () => message.success('Skorsing dibatalkan'),
                    onError: (err: Error) => message.error(err.message || 'Gagal'),
                  },
                )
              }>
                Batalkan
              </Button>
            )}
          </Space>
        }
      />

      {!detail ? (
        <Card loading={detailQuery.isLoading}>
          {!detailQuery.isLoading && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Skorsing tidak ditemukan" />
          )}
        </Card>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Status">
                <StatusTag color={STATUS_META[detail.status].color}>
                  {STATUS_META[detail.status].label}
                </StatusTag>
              </Descriptions.Item>
              <Descriptions.Item label="Jenjang">{detail.jenjang}</Descriptions.Item>
              <Descriptions.Item label="No. Registrasi">
                {detail.student?.registration_code ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Masa Pembinaan">
                {dayjs(detail.start_date).format('DD MMM')} — {dayjs(detail.end_date).format('DD MMM YYYY')} (
                {dayjs(detail.end_date).diff(dayjs(detail.start_date), 'day') + 1} hari)
              </Descriptions.Item>
            </Descriptions>
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message={`Alasan (internal): ${detail.reason_summary}`}
              description="Alasan ini tidak pernah tampil di halaman wali santri."
            />
          </Card>

          <TokenPanel suspensionId={id} />
          <TasksPanel suspensionId={id} />
          <SubmissionsPanel suspensionId={id} />
          <DailyLogsPanel suspensionId={id} />
          <FollowupsPanel suspensionId={id} />
        </Space>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Token wali
// ------------------------------------------------------------
function TokenPanel({ suspensionId }: { suspensionId: string }) {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const isAdmin = profile?.role === 'developer' || profile?.role === 'admin'
  const tokensQuery = useSuspensionTokens(suspensionId)
  const generateMutation = useGenerateToken()
  const revokeMutation = useRevokeToken()
  const [daysValid, setDaysValid] = useState(14)
  const [freshToken, setFreshToken] = useState<string | null>(null)

  const tokens = tokensQuery.data ?? []

  const handleGenerate = () => {
    generateMutation.mutate(
      { suspensionId, daysValid, createdBy: profile?.id ?? null },
      {
        onSuccess: (res) => {
          setFreshToken(res.token)
          message.success('Token dibuat — salin sekarang, raw tidak akan ditampilkan lagi')
          void logAudit({
            action: 'INSERT',
            source: 'SECURITY',
            tableName: 'suspension_tokens',
            recordId: res.id,
            newData: { suspension_id: suspensionId, expires_at: res.expires_at },
          })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal membuat token'),
      },
    )
  }

  return (
    <Card title="Tautan Akses Wali">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {isAdmin && (
          <Space wrap>
            <Select value={daysValid} onChange={setDaysValid} style={{ width: 170 }}>
              <Select.Option value={7}>Berlaku 7 hari</Select.Option>
              <Select.Option value={14}>Berlaku 14 hari</Select.Option>
              <Select.Option value={30}>Berlaku 30 hari</Select.Option>
            </Select>
            <Button icon={<LinkOutlined />} onClick={handleGenerate} loading={generateMutation.isPending}>
              Generate Tautan Wali
            </Button>
          </Space>
        )}

        {freshToken && (
          <Alert
            type="success"
            showIcon={false}
            message="Tautan wali (salin sekarang — tidak akan ditampilkan lagi):"
            description={
              <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                <Input readOnly value={`${window.location.origin}/suspension/${freshToken}`} />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/suspension/${freshToken}`)
                    message.success('Tautan disalin')
                  }}
                />
              </Space.Compact>
            }
          />
        )}

        {tokens.length === 0 ? (
          <Typography.Text type="secondary">Belum ada token dibuat.</Typography.Text>
        ) : (
          <Table
            rowKey="id"
            size="small"
            dataSource={tokens}
            pagination={false}
            columns={[
              { title: 'Prefix', dataIndex: 'token_prefix', key: 'p', width: 110 },
              {
                title: 'Kedaluwarsa',
                dataIndex: 'expires_at',
                key: 'exp',
                render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
              },
              {
                title: 'Dipakai',
                dataIndex: 'use_count',
                key: 'use',
                width: 80,
                render: (v: number) => `${v}×`,
              },
              {
                title: 'Terakhir',
                dataIndex: 'last_used_at',
                key: 'last',
                render: (v: string | null) => (v ? dayjs(v).format('DD MMM HH:mm') : '—'),
                responsive: ['md'],
              },
              {
                title: 'Status',
                key: 'st',
                width: 110,
                render: (_, t) =>
                  t.revoked_at ? (
                    <Tag>Dicabut</Tag>
                  ) : new Date(t.expires_at) < new Date() ? (
                    <Tag color="red">Kedaluwarsa</Tag>
                  ) : (
                    <Tag color="green">Aktif</Tag>
                  ),
              },
              ...(isAdmin
                ? [
                    {
                      title: '',
                      key: 'a',
                      width: 90,
                      render: (_: unknown, t: { id: string; revoked_at: string | null }) =>
                        !t.revoked_at ? (
                          <Button
                            size="small"
                            danger
                            onClick={() =>
                              revokeMutation.mutate(
                                { tokenId: t.id, revokedBy: profile?.id ?? null },
                                { onSuccess: () => message.success('Token dicabut') },
                              )
                            }
                          >
                            Cabut
                          </Button>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Space>
    </Card>
  )
}

// ------------------------------------------------------------
// Tugas
// ------------------------------------------------------------
function TasksPanel({ suspensionId }: { suspensionId: string }) {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const tasksQuery = useSuspensionTasks(suspensionId)
  const createMutation = useCreateTask()
  const deleteMutation = useDeleteTask()
  const [form] = Form.useForm()
  const isAdmin = profile?.role === 'developer' || profile?.role === 'admin'

  const tasks = tasksQuery.data ?? []

  const handleAdd = (values: { subject: string; title: string; description?: string; due: Dayjs }) => {
    createMutation.mutate(
      {
        suspensionId,
        subject: values.subject,
        title: values.title,
        description: values.description,
        dueDate: values.due?.format('YYYY-MM-DD'),
        createdBy: profile?.id ?? null,
      },
      {
        onSuccess: (task) => {
          message.success('Tugas ditambahkan')
          form.resetFields()
          void logAudit({
            action: 'INSERT',
            source: 'OPERATIONAL',
            tableName: 'suspension_tasks',
            recordId: task.id,
            newData: { subject: task.subject, title: task.title },
          })
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menambah tugas'),
      },
    )
  }

  const columns: TableColumnsType<SuspensionTask> = [
    { title: 'Mapel', dataIndex: 'subject', key: 'subject', width: 140 },
    { title: 'Tugas', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: 'Keterangan', dataIndex: 'description', key: 'desc', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Tenggat',
      dataIndex: 'due_date',
      key: 'due',
      width: 110,
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM') : '—'),
      responsive: ['md'],
    },
    { title: 'Dari', dataIndex: 'created_by_name', key: 'by', width: 140, ellipsis: true, responsive: ['xl'] },
    {
      title: '',
      key: 'a',
      width: 60,
      render: (_, t) =>
        (isAdmin || t.created_by === profile?.id) && (
          <Popconfirm
            title="Hapus tugas ini?"
            onConfirm={() =>
              deleteMutation.mutate(t.id, {
                onSuccess: () => message.success('Tugas dihapus'),
                onError: (err: Error) => message.error(err.message || 'Gagal menghapus'),
              })
            }
            okText="Hapus"
            cancelText="Batal"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
    },
  ]

  return (
    <Card title="Tugas Pembinaan dari Guru">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {canCreateTaskNote(profile?.role) && (
          <Form form={form} layout="inline" onFinish={handleAdd}>
            <Form.Item name="subject" rules={[{ required: true, message: 'Mapel wajib' }]}>
              <Input placeholder="Mapel (mis. Matematika)" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="title" rules={[{ required: true, message: 'Judul wajib' }]}>
              <Input placeholder="Judul tugas" style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="due">
              <DatePicker placeholder="Tenggat" style={{ width: 140 }} />
            </Form.Item>
            <Button type="primary" icon={<PlusOutlined />} htmlType="submit" loading={createMutation.isPending}>
              Tambah
            </Button>
          </Form>
        )}
        <Table<SuspensionTask>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={tasks}
          loading={tasksQuery.isLoading}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada tugas" />,
          }}
          pagination={false}
        />
      </Space>
    </Card>
  )
}

function canCreateTaskNote(role: string | null | undefined): boolean {
  return !!role && ['developer', 'admin', 'pengurus', 'guru'].includes(role)
}

// ------------------------------------------------------------
// Submissions (penilaian)
// ------------------------------------------------------------
function SubmissionsPanel({ suspensionId }: { suspensionId: string }) {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const tasksQuery = useSuspensionTasks(suspensionId)
  const submissionsQuery = useSuspensionSubmissions(suspensionId)
  const gradeMutation = useGradeSubmission()
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [score, setScore] = useState<number>(80)
  const [comment, setComment] = useState('')

  const tasks = useMemo(
    () => new Map((tasksQuery.data ?? []).map((t) => [t.id, t])),
    [tasksQuery.data],
  )
  const submissions = submissionsQuery.data ?? []

  const canGrade = (t?: SuspensionTask) =>
    !!t && (profile?.role === 'developer' || profile?.role === 'admin' || t.created_by === profile?.id)

  return (
    <Card title="Bukti & Penilaian Tugas">
      {submissions.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada bukti tugas dikirim" />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {submissions.map((sub) => {
            const task = tasks.get(sub.task_id)
            const grading = gradingId === sub.id
            return (
              <Card
                key={sub.id}
                size="small"
                style={{ borderLeft: `4px solid ${sub.status === 'dinilai' ? '#10b981' : '#d97706'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <Typography.Text strong>
                      {task ? `${task.subject} — ${task.title}` : 'Tugas'}
                    </Typography.Text>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Dikirim {dayjs(sub.submitted_at).format('DD MMM HH:mm')}
                        {sub.note ? ` · ${sub.note}` : ''}
                      </Typography.Text>
                    </div>
                  </div>
                  <Space size="small">
                    {sub.status === 'dinilai' ? (
                      <StatusTag color="green">Nilai {sub.score}</StatusTag>
                    ) : (
                      <StatusTag color="orange">Belum Dinilai</StatusTag>
                    )}
                    {canGrade(task) && (
                      <Button size="small" onClick={() => setGradingId(grading ? null : sub.id)}>
                        {grading ? 'Tutup' : 'Nilai'}
                      </Button>
                    )}
                  </Space>
                </div>

                {(sub.photo_data ?? []).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {sub.photo_data.map((photo, i) => (
                      <img
                        key={i}
                        src={`data:image/jpeg;base64,${photo}`}
                        alt={`Bukti ${i + 1}`}
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                    ))}
                  </div>
                )}

                {sub.teacher_comment && (
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                    Komentar guru: {sub.teacher_comment}
                  </Typography.Paragraph>
                )}

                {grading && (
                  <Space wrap style={{ marginTop: 10 }}>
                    <InputNumber
                      min={0}
                      max={100}
                      value={score}
                      onChange={(v: number | null) => setScore(v ?? 0)}
                      style={{ width: 110 }}
                      addonAfter="/100"
                    />
                    <Input
                      placeholder="Komentar guru"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      style={{ width: 260 }}
                      maxLength={200}
                    />
                    <Button
                      type="primary"
                      size="small"
                      loading={gradeMutation.isPending}
                      onClick={() => {
                        gradeMutation.mutate(
                          { id: sub.id, score, comment, gradedBy: profile?.id ?? null },
                          {
                            onSuccess: () => {
                              message.success('Nilai tersimpan')
                              setGradingId(null)
                              setComment('')
                              void logAudit({
                                action: 'UPDATE',
                                source: 'OPERATIONAL',
                                tableName: 'suspension_task_submissions',
                                recordId: sub.id,
                                newData: { score, status: 'dinilai' },
                              })
                            },
                            onError: (err: Error) => message.error(err.message || 'Gagal menyimpan nilai'),
                          },
                        )
                      }}
                    >
                      Simpan Nilai
                    </Button>
                  </Space>
                )}
              </Card>
            )
          })}
        </Space>
      )}
    </Card>
  )
}

// ------------------------------------------------------------
// Log harian
// ------------------------------------------------------------
function DailyLogsPanel({ suspensionId }: { suspensionId: string }) {
  const logsQuery = useSuspensionDailyLogs(suspensionId)
  const logs = logsQuery.data ?? []
  const detail = useSuspensionDetail(suspensionId)
  const total = detail.data
    ? dayjs(detail.data.end_date).diff(dayjs(detail.data.start_date), 'day') + 1
    : 0

  const columns: TableColumnsType<{ log_date: string; entries: Record<string, unknown>; note_optional: string | null }> = [
    {
      title: 'Tanggal',
      dataIndex: 'log_date',
      key: 'd',
      width: 130,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Item Terisi',
      key: 'count',
      width: 110,
      render: (_, l) => Object.keys(l.entries ?? {}).length,
    },
    {
      title: 'Catatan Wali',
      dataIndex: 'note_optional',
      key: 'note',
      ellipsis: true,
    },
  ]

  return (
    <Card title="Log Harian dari Wali">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col xs={12} sm={8} xl={6}>
            <Statistic title="Hari Terisi" value={logs.length} suffix={`/ ${total}`} />
          </Col>
        </Row>
        {logs.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Wali belum mengisi log harian" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={logs}
            loading={logsQuery.isLoading}
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowRender: (l) => (
                <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', margin: 0 }}>
                  {JSON.stringify(l.entries, null, 2)}
                </pre>
              ),
            }}
          />
        )}
      </Space>
    </Card>
  )
}

// ------------------------------------------------------------
// Followups
// ------------------------------------------------------------
function FollowupsPanel({ suspensionId }: { suspensionId: string }) {
  const { message } = App.useApp()
  const { profile } = useProfile()
  const followupsQuery = useSuspensionFollowups(suspensionId)
  const createMutation = useCreateFollowup()
  const [method, setMethod] = useState<SuspensionFollowup['method']>('call')
  const [notes, setNotes] = useState('')

  const followups = followupsQuery.data ?? []
  const METHOD_LABEL: Record<string, string> = { call: 'Telepon', wa: 'WhatsApp', visit: 'Kunjungan' }

  return (
    <Card title="Verifikasi Pembina (mingguan)">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {profile?.role && ['developer', 'admin', 'pengurus', 'guru'].includes(profile.role) && (
          <Space wrap>
            <Select
              value={method}
              onChange={setMethod}
              style={{ width: 140 }}
              options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Input
              placeholder="Catatan verifikasi…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: 320 }}
              maxLength={200}
            />
            <Button
              type="primary"
              loading={createMutation.isPending}
              disabled={!notes.trim()}
              onClick={() => {
                createMutation.mutate(
                  { suspensionId, method, notes, createdBy: profile?.id ?? null },
                  {
                    onSuccess: () => {
                      message.success('Verifikasi tercatat')
                      setNotes('')
                      void logAudit({
                        action: 'INSERT',
                        source: 'OPERATIONAL',
                        tableName: 'suspension_followups',
                        newData: { suspension_id: suspensionId, method },
                      })
                    },
                    onError: (err: Error) => message.error(err.message || 'Gagal mencatat'),
                  },
                )
              }}
            >
              Catat
            </Button>
          </Space>
        )}
        {followups.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada verifikasi tercatat" />
        ) : (
          followups.map((f) => (
            <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Tag color="blue">{METHOD_LABEL[f.method] ?? f.method}</Tag>
              <div>
                <Typography.Text style={{ fontSize: 13 }}>{f.notes}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                    {dayjs(f.contacted_at).format('DD MMM YYYY HH:mm')}
                  </Typography.Text>
                </div>
              </div>
            </div>
          ))
        )}
      </Space>
    </Card>
  )
}
