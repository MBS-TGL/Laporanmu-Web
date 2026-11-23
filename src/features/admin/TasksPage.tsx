import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useQueryClient } from '@tanstack/react-query'
import {
  CaretRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  LoadingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatChip } from '../../shared/components/StatChip'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { logAudit } from '../../shared/utils/auditLogger'
import { insertTaskRun, runDetachRefs, runRotateAuditLogs, runSyncStats } from './api'
import { useIntegrityIssues, useImportTaskRuns, useRotationPreview, useTaskRuns } from './hooks'
import { ConfirmTaskModal, type TaskPreviewRow } from './components/ConfirmTaskModal'
import {
  clearTaskLogs,
  formatDuration,
  loadTaskLogs,
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

export function TasksPage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const qc = useQueryClient()
  const [runningId, setRunningId] = useState<TaskId | null>(null)
  const [progress, setProgress] = useState(0)
  const [rotationDays, setRotationDays] = useState(45)
  const [confirmTask, setConfirmTask] = useState<TaskDef | null>(null)
  const [logSearch, setLogSearch] = useState('')
  const debouncedLogSearch = useDebounce(logSearch, 300)

  // Riwayat server-side (tabel task_runs, migrasi 0062) — persist lintas perangkat
  const runsQuery = useTaskRuns({ enabled: active })
  const importRunsMutation = useImportTaskRuns()
  const integrityQuery = useIntegrityIssues()
  const rotationPreview = useRotationPreview(rotationDays, confirmTask?.id === 'rotate_logs')
  const logs = useMemo(() => runsQuery.data ?? [], [runsQuery.data])

  // Migrasi sekali: riwayat localStorage lama diunggah ke server lalu dibuang
  const didMigrate = useRef(false)
  useEffect(() => {
    if (!runsQuery.isSuccess || didMigrate.current) return
    didMigrate.current = true
    if ((runsQuery.data ?? []).length === 0) {
      const local = loadTaskLogs()
      if (local.length > 0) {
        importRunsMutation.mutate(local, {
          onSuccess: () => {
            clearTaskLogs()
            message.info(`${local.length} riwayat lama dimigrasi ke server`)
          },
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runsQuery.isSuccess, runsQuery.data])

  const recordRun = (task: TaskDef, ok: boolean, durationMs: number, detail: string, affected: Record<string, number> | null) => {
    insertTaskRun({ taskKey: task.id, ok, durationMs, affected, detail })
      .then(() => void qc.invalidateQueries({ queryKey: ['admin', 'task-runs'] }))
      .catch(() => message.warning('Riwayat gagal tersimpan ke server'))
  }

  const finishRun = (task: TaskDef, startedAt: number, summary: string, affected: Record<string, number> | null) => {
    setRunningId(null)
    setProgress(0)
    message.success(`${task.label} selesai — ${summary}`)
    recordRun(task, true, Date.now() - startedAt, summary, affected)
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

    const runner = async (): Promise<{ summary: string; affected: Record<string, number> | null }> => {
      if (task.id === 'sync_stats') {
        setProgress(60)
        const stats = await runSyncStats()
        return { summary: summarizeStats(stats), affected: stats }
      }
      if (task.id === 'detach_refs') {
        setProgress(50)
        const { classRefs, dormRefs } = await runDetachRefs()
        setProgress(85)
        const summary = `${classRefs} relasi kelas, ${dormRefs} relasi asrama dilepas`
        return { summary, affected: { classRefs, dormRefs } }
      }
      setProgress(40)
      const deleted = await runRotateAuditLogs(rotationDays)
      setProgress(85)
      return { summary: `${deleted} audit log dihapus (> ${rotationDays} hari)`, affected: { deleted } }
    }

    runner()
      .then(({ summary, affected }) => finishRun(task, startedAt, summary, affected))
      .catch((err: unknown) => {
        setRunningId(null)
        setProgress(0)
        const detail = err instanceof Error ? err.message : 'Gagal menjalankan tugas'
        message.error(detail)
        recordRun(task, false, Date.now() - startedAt, detail, null)
      })
  }

  // Dry-run preview untuk modal konfirmasi task destruktif
  const preview = useMemo<TaskPreviewRow[]>(() => {
    if (!confirmTask) return []
    if (confirmTask.id === 'rotate_logs') {
      return [
        {
          label: `Audit log lebih lama dari ${rotationDays} hari`,
          value: `${(rotationPreview.data ?? 0).toLocaleString('id-ID')} baris akan dihapus`,
        },
      ]
    }
    if (confirmTask.id === 'detach_refs') {
      const classRefs = integrityQuery.data?.find((i) => i.id === 'refs_dead_class')?.count ?? 0
      const dormRefs = integrityQuery.data?.find((i) => i.id === 'refs_dead_dorm')?.count ?? 0
      return [
        { label: 'Santri menunjuk kelas terhapus', value: `${classRefs} relasi akan dilepas` },
        { label: 'Santri menunjuk asrama terhapus', value: `${dormRefs} relasi akan dilepas` },
      ]
    }
    return []
  }, [confirmTask, rotationDays, rotationPreview.data, integrityQuery.data])

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
        width: 160,
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
        width: 95,
        render: (v: number) => (
          <Tag style={{ borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{formatDuration(v)}</Tag>
        ),
      },
      {
        title: 'Waktu',
        dataIndex: 'startedAt',
        key: 'startedAt',
        width: 140,
        render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
      },
      {
        title: 'Status',
        dataIndex: 'ok',
        key: 'ok',
        width: 85,
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

  // Tag info diportal ke kanan judul shell — hasil dirender di JSX
  const actions = useTabActions(
    active,
    <Tooltip title="Tugas dijalankan langsung dari browser (direct query)">
      <Tag icon={<ThunderboltOutlined />} color="geekblue" style={{ borderRadius: 999 }}>
        Direct Query
      </Tag>
    </Tooltip>,
  )

  return (
    <div>
      {actions}
      {/* ── Layout: tugas di kiri, riwayat di kanan (xl) ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {TASKS.map((task) => {
              const isRunning = runningId === task.id
              return (
                <Card
                  key={task.id}
                  size="small"
                  style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
                  styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
                >
                  <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'stretch' }}>
                    {/* ikon */}
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: task.destructive ? 'rgba(244, 63, 94, 0.08)' : `${token.colorPrimary}1A`,
                        color: task.destructive ? '#f43f5e' : token.colorPrimary,
                        display: 'grid', placeItems: 'center', fontSize: 16,
                      }}
                    >
                      {isRunning ? <LoadingOutlined /> : <ThunderboltOutlined />}
                    </div>

                    {/* konten */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <Space size={8} align="center">
                        <b style={{ fontSize: 13.5 }}>{task.label}</b>
                        <Tag color={task.destructive ? 'error' : 'success'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                          {task.destructive ? 'Destruktif' : 'Aman'}
                        </Tag>
                      </Space>

                      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginTop: 6, marginBottom: 10 }}>
                        {task.description}
                      </Typography.Paragraph>

                      {task.id === 'rotate_logs' && (
                        <Space size={6} style={{ marginBottom: 10 }}>
                          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                            Hapus log lebih lama dari
                          </Typography.Text>
                          <Select
                            size="small" value={rotationDays} onChange={setRotationDays}
                            options={ROTATION_OPTIONS} style={{ width: 110 }} disabled={isRunning}
                          />
                        </Space>
                      )}

                      {/* area aksi: selalu di dasar kartu */}
                      <div style={{ marginTop: 'auto' }}>
                        {isRunning ? (
                          <Progress percent={progress} size="small" strokeColor={token.colorPrimary} />
                        ) : task.destructive ? (
                          <Tooltip title="Perlu konfirmasi ketik JALANKAN + pratinjau dampak">
                            <Button type="default" danger icon={<CaretRightOutlined />} block disabled={runningId !== null} onClick={() => setConfirmTask(task)}>
                              Jalankan
                            </Button>
                          </Tooltip>
                        ) : (
                          <Button
                            type="primary"
                            icon={<CaretRightOutlined />}
                            onClick={() => runTask(task)}
                            block
                            disabled={runningId !== null}
                          >
                            Jalankan
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </Space>
        </Col>

        <Col xs={24} xl={14}>
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
                  style={{ width: 180, maxWidth: '100%' }}
                />
                <Tooltip title="Riwayat tersimpan di server — tampil sama di semua perangkat">
                  <Tag icon={<CheckCircleOutlined />} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    Server
                  </Tag>
                </Tooltip>
              </Space>
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <StatChip icon={<HistoryOutlined />} label="Total Eksekusi" value={logs.length} color="indigo" />
              <StatChip icon={<CheckCircleOutlined />} label="Berhasil" value={successCount} color="emerald" />
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
              loading={runsQuery.isPending}
              scroll={{ x: 'max-content' }}
              pagination={logs.length > 8 ? { pageSize: 8, showSizeChanger: false } : false}
              locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat — jalankan salah satu tugas di atas" />,
              }}
            />
          </Card>
        </Col>
      </Row>

      <ConfirmTaskModal
        task={confirmTask}
        preview={preview}
        previewLoading={confirmTask?.id === 'rotate_logs' ? rotationPreview.isPending : integrityQuery.isPending}
        confirmWord="JALANKAN"
        open={confirmTask !== null}
        loading={runningId !== null}
        onClose={() => setConfirmTask(null)}
        onConfirm={() => {
          const task = confirmTask
          setConfirmTask(null)
          if (task) runTask(task)
        }}
      />
    </div>
  )
}
