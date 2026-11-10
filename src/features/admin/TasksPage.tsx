import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CaretRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { logAudit } from '../../shared/utils/auditLogger'
import { runDetachRefs, runRotateAuditLogs, runSyncStats } from './api'
import {
  clearTaskLogs,
  formatDuration,
  loadTaskLogs,
  saveTaskLog,
  TASKS,
  type TaskDef,
  type TaskId,
  type TaskRunLog,
} from './tasks'

const ROTATION_OPTIONS = [
  { value: 30, label: '30 hari' },
  { value: 45, label: '45 hari' },
  { value: 60, label: '60 hari' },
  { value: 90, label: '90 hari' },
]

function summarizeStats(stats: Record<string, number>): string {
  return Object.entries(stats)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
}

export function TasksPage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const [runningId, setRunningId] = useState<TaskId | null>(null)
  const [progress, setProgress] = useState(0)
  const [rotationDays, setRotationDays] = useState(45)
  const [logs, setLogs] = useState<TaskRunLog[]>(() => loadTaskLogs())
  const [logSearch, setLogSearch] = useState('')
  const debouncedLogSearch = useDebounce(logSearch, 300)

  const finishRun = (task: TaskDef, startedAt: number, summary: string) => {
    setRunningId(null)
    setProgress(0)
    const next = saveTaskLog({
      id: `${Date.now()}`,
      taskId: task.id,
      startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      ok: true,
      summary,
    })
    setLogs(next)
    message.success(`${task.label} selesai — ${summary}`)
    void logAudit({
      action: 'EXECUTE',
      source: 'SYSTEM',
      tableName: 'tasks',
      recordId: task.id,
      newData: { aksi: 'task_manual', ringkasan: summary },
    })
  }

  const runTask = (task: TaskDef) => {
    const startedAt = Date.now()
    setRunningId(task.id)
    setProgress(20)

    const runner = async (): Promise<string> => {
      if (task.id === 'sync_stats') {
        setProgress(60)
        const stats = await runSyncStats()
        return summarizeStats(stats)
      }
      if (task.id === 'detach_refs') {
        setProgress(50)
        const { classRefs, dormRefs } = await runDetachRefs()
        setProgress(85)
        return `${classRefs} relasi kelas, ${dormRefs} relasi asrama dilepas`
      }
      setProgress(40)
      const deleted = await runRotateAuditLogs(rotationDays)
      setProgress(85)
      return `${deleted} audit log dihapus (> ${rotationDays} hari)`
    }

    runner()
      .then((summary) => finishRun(task, startedAt, summary))
      .catch((err: unknown) => {
        setRunningId(null)
        setProgress(0)
        message.error(err instanceof Error ? err.message : 'Gagal menjalankan tugas')
      })
  }

  const confirmRun = (task: TaskDef) => {
    if (!task.destructive) {
      runTask(task)
      return
    }
    modal.confirm({
      title: `Jalankan "${task.label}"?`,
      icon: <ExclamationCircleOutlined style={{ color: '#f59e0b' }} />,
      content: task.description + ' Tindakan ini permanen dan tercatat di audit log.',
      okText: 'Jalankan',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () => runTask(task),
    })
  }

  const filteredLogs = useMemo(() => {
    const term = debouncedLogSearch.trim().toLowerCase()
    if (!term) return logs
    return logs.filter((l) => {
      const taskLabel = TASKS.find((t) => t.id === l.taskId)?.label.toLowerCase() ?? ''
      return taskLabel.includes(term) || l.summary.toLowerCase().includes(term)
    })
  }, [logs, debouncedLogSearch])

  const successCount = logs.filter((l) => l.ok).length
  const lastRun = logs[0]

  const logColumns = useMemo<TableColumnsType<TaskRunLog>>(
    () => [
      {
        title: 'Tugas',
        dataIndex: 'taskId',
        key: 'taskId',
        width: 200,
        render: (id: TaskId) => TASKS.find((t) => t.id === id)?.label ?? id,
      },
      {
        title: 'Ringkasan',
        dataIndex: 'summary',
        key: 'summary',
        render: (v: string) => <span style={{ fontSize: 12.5 }}>{v}</span>,
      },
      {
        title: 'Durasi',
        dataIndex: 'durationMs',
        key: 'durationMs',
        width: 110,
        render: (v: number) => (
          <Tag style={{ borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(v)}</Tag>
        ),
      },
      {
        title: 'Waktu',
        dataIndex: 'startedAt',
        key: 'startedAt',
        width: 160,
        render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
      },
      {
        title: 'Status',
        dataIndex: 'ok',
        key: 'ok',
        width: 100,
        render: (ok: boolean) =>
          ok ? (
            <Tag color="success" style={{ borderRadius: 999 }}>
              Sukses
            </Tag>
          ) : (
            <Tag color="error" style={{ borderRadius: 999 }}>
              Gagal
            </Tag>
          ),
      },
    ],
    [],
  )

  return (
    <div>
      <PageHeader
        title="Otomasi"
        subtitle="Picu tugas pemeliharaan berat secara manual — tanpa menunggu jadwal"
        extra={
          <Tooltip title="Tugas dijalankan langsung dari browser (direct query)">
            <Tag icon={<ThunderboltOutlined />} color="geekblue" style={{ borderRadius: 999 }}>
              Direct Query
            </Tag>
          </Tooltip>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {TASKS.map((task) => {
          const isRunning = runningId === task.id
          return (
            <Col xs={24} md={8} key={task.id}>
              <Card
                size="small"
                style={{ height: '100%' }}
                styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%' } }}
              >
                <Space size={12} align="start" style={{ width: '100%' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      flexShrink: 0,
                      background: task.destructive ? 'rgba(244, 63, 94, 0.08)' : `${token.colorPrimary}1A`,
                      color: task.destructive ? '#f43f5e' : token.colorPrimary,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 16,
                    }}
                  >
                    {isRunning ? <LoadingOutlined /> : <ThunderboltOutlined />}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Space size={8} align="center">
                      <b style={{ fontSize: 13.5 }}>{task.label}</b>
                      {task.destructive ? (
                        <Tag color="error" style={{ borderRadius: 999 }}>
                          Destruktif
                        </Tag>
                      ) : (
                        <Tag color="success" style={{ borderRadius: 999 }}>
                          Aman
                        </Tag>
                      )}
                    </Space>
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 6, marginBottom: 10, flex: 1 }}>
                      {task.description}
                    </Typography.Paragraph>

                    {task.id === 'rotate_logs' && (
                      <Space size={6} style={{ marginBottom: 10 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                          Hapus log lebih lama dari
                        </Typography.Text>
                        <Select
                          size="small"
                          value={rotationDays}
                          onChange={setRotationDays}
                          options={ROTATION_OPTIONS}
                          style={{ width: 110 }}
                          disabled={isRunning}
                        />
                      </Space>
                    )}

                    {isRunning ? (
                      <Progress percent={progress} size="small" strokeColor={token.colorPrimary} />
                    ) : (
                      <Button
                        type={task.destructive ? 'default' : 'primary'}
                        danger={task.destructive}
                        icon={<CaretRightOutlined />}
                        onClick={() => confirmRun(task)}
                        block
                        disabled={runningId !== null}
                      >
                        Jalankan
                      </Button>
                    )}
                  </div>
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card
        title={
          <Space>
            <HistoryOutlined />
            Riwayat Eksekusi
          </Space>
        }
        size="small"
        extra={
          <Space>
            <Input
              size="small"
              placeholder="Cari riwayat…"
              allowClear
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              style={{ width: 180 }}
            />
            <Button
              size="small"
              icon={<DeleteOutlined />}
              disabled={logs.length === 0}
              onClick={() =>
                modal.confirm({
                  title: 'Hapus semua riwayat?',
                  content: 'Riwayat hanya tersimpan di perangkat ini.',
                  okText: 'Hapus',
                  okButtonProps: { danger: true },
                  cancelText: 'Batal',
                  onOk: () => {
                    clearTaskLogs()
                    setLogs([])
                    message.success('Riwayat dihapus')
                  },
                })
              }
            >
              Hapus
            </Button>
          </Space>
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <StatChip icon={<HistoryOutlined />} label="Total Eksekusi" value={logs.length} color="indigo" />
          <StatChip
            icon={<CheckCircleOutlined />}
            label="Berhasil"
            value={successCount}
            color="emerald"
          />
          <StatChip
            icon={<ClockCircleOutlined />}
            label="Terakhir"
            value={lastRun ? formatDuration(lastRun.durationMs) : '–'}
            color="amber"
          />
        </div>
        <Table<TaskRunLog>
          rowKey="id"
          size="small"
          columns={logColumns}
          dataSource={filteredLogs}
          pagination={logs.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat — jalankan salah satu tugas di atas" />,
          }}
        />
      </Card>
    </div>
  )
}
