import { useQuery } from '@tanstack/react-query'
import { Drawer, Empty, Space, Spin, Tag, Typography, theme } from 'antd'
import { EnterOutlined, ExportOutlined, HistoryOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { fetchGateLogsByStudent } from '../api'
import type { GateLog } from '../types'

interface HistoryDrawerProps {
  open: boolean
  onClose: () => void
  student: { id: string; name: string; registration_code: string; class_name?: string | null } | null
}

/** Drawer riwayat gerbang satu siswa (klik nama siswa di tabel) */
export function HistoryDrawer({ open, onClose, student }: HistoryDrawerProps) {
  const { token } = theme.useToken()

  const historyQuery = useQuery({
    queryKey: ['gate-logs', 'student', student?.id, open],
    queryFn: () => fetchGateLogsByStudent(student!.id, 50),
    enabled: open && Boolean(student?.id),
  })

  const logs = historyQuery.data ?? []
  const todayLogs = logs.filter((l) => dayjs(l.occurred_at).isSame(dayjs(), 'day'))
  const todayEntry = todayLogs.filter((l) => l.direction === 'entry').length
  const todayExit = todayLogs.filter((l) => l.direction === 'exit').length

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="min(440px, 94vw)"
      title={
        <Space size={8}>
          <HistoryOutlined />
          <span>Riwayat Gerbang</span>
        </Space>
      }
    >
      {student && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {formatDisplayName(student.name)}
          </Typography.Text>
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              {student.registration_code}
              {student.class_name ? ` · ${student.class_name}` : ''}
            </Typography.Text>
          </div>
          <Space size="small" style={{ marginTop: 8 }}>
            <Tag color="green" icon={<EnterOutlined />}>
              {todayEntry} masuk hari ini
            </Tag>
            <Tag color="orange" icon={<ExportOutlined />}>
              {todayExit} keluar hari ini
            </Tag>
          </Space>
        </div>
      )}

      {historyQuery.isPending ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      ) : logs.length === 0 ? (
        <Empty description="Belum ada log gerbang" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {logs.map((log: GateLog) => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '8px 0 8px 12px',
                borderLeft: `3px solid ${
                  log.direction === 'exit' ? token.colorWarning : token.colorSuccess
                }`,
                marginBottom: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <Space size={6}>
                  {log.direction === 'exit' ? (
                    <Tag color="orange" icon={<ExportOutlined />} style={{ marginInlineEnd: 0 }}>
                      Keluar
                    </Tag>
                  ) : (
                    <Tag color="green" icon={<EnterOutlined />} style={{ marginInlineEnd: 0 }}>
                      Masuk
                    </Tag>
                  )}
                  <Typography.Text style={{ fontSize: 13 }}>
                    {dayjs(log.occurred_at).format('DD MMM YYYY HH:mm')}
                  </Typography.Text>
                </Space>
                {(log.note || log.recorder?.name) && (
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12, display: 'block', marginTop: 2 }}
                  >
                    {log.note ? `${log.note} · ` : ''}
                    {log.recorder?.name ? `dicatat ${log.recorder.name}` : ''}
                  </Typography.Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}
