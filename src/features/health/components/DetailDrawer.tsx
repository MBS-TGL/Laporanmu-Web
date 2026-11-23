import { useMemo } from 'react'
import { Button, Drawer, Empty, Popconfirm, Space, Tag, Typography, theme } from 'antd'
import {
  CalendarOutlined,
  FileAddOutlined,
  HeartOutlined,
  HistoryOutlined,
  MedicineBoxOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { useStudentDetail } from '../../students/useStudentDetail'
import { RESTING_STATUSES, STATUS_COLOR, STATUS_HEX, STATUS_LABEL } from '../constants'
import { shiftDate, topComplaintKeywords } from '../stats'
import type { HealthLog } from '../types'

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  /** Kunjungan yang sedang dilihat */
  log: HealthLog | null
  /** Semua log (sudah dimuat halaman) — riwayat difilter client-side, tanpa query baru */
  logs: HealthLog[]
  today: string
  canWrite: boolean
  canDelete: boolean
  onMarkReturned: (log: HealthLog) => void
  onDelete: (log: HealthLog) => void
  onAddVisit: (studentId: string) => void
}

function DetailRow({ label, value, muted }: { label: string; value: React.ReactNode; muted: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
      <span style={{ width: 92, flexShrink: 0, fontSize: 12.5, color: muted }}>{label}</span>
      <span style={{ fontSize: 13.5, flex: 1 }}>{value}</span>
    </div>
  )
}

/** Detail satu kunjungan + riwayat kesehatan santri tersebut. */
export function DetailDrawer({
  open,
  onClose,
  log,
  logs,
  today,
  canWrite,
  canDelete,
  onMarkReturned,
  onDelete,
  onAddVisit,
}: DetailDrawerProps) {
  const { token } = theme.useToken()
  const { open: openStudentDetail } = useStudentDetail()

  const history = useMemo(() => {
    if (!log) return []
    const related = logs.filter((l) =>
      l.student_id ? l.student_id === log.student_id : l.student_name === log.student_name,
    )
    return [...related].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  }, [logs, log])

  if (!log) return null

  const cutoff30 = shiftDate(today, -29)
  const last30 = history.filter((l) => l.date >= cutoff30 && l.date <= today).length
  const topComplaint = topComplaintKeywords(history, 1)[0]
  const isCurrentResting = RESTING_STATUSES.includes(log.status)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="min(460px, 94vw)"
      title={
        <Space size={8}>
          <HeartOutlined style={{ color: token.colorPrimary }} />
          <span>Detail Kunjungan</span>
        </Space>
      }
    >
      <div style={{ marginBottom: 14 }}>
        <Typography.Link strong style={{ fontSize: 16 }} onClick={() => log.student_id && openStudentDetail(log.student_id)}>
          {log.student_name}
        </Typography.Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <Tag>{log.class_name ?? 'Tanpa Kelas'}</Tag>
          <StatusTag color={STATUS_COLOR[log.status]}>{STATUS_LABEL[log.status] ?? log.status}</StatusTag>
        </div>
      </div>

      <div
        style={{
          background: token.colorFillAlter,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <DetailRow
          label="Waktu"
          muted={token.colorTextTertiary}
          value={
            <Space size={6}>
              <CalendarOutlined />
              {new Date(`${log.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              · {log.time}
            </Space>
          }
        />
        <DetailRow label="Keluhan" muted={token.colorTextTertiary} value={log.complaint} />
        <DetailRow label="Diagnosis" muted={token.colorTextTertiary} value={log.diagnosis ?? '-'} />
        <DetailRow label="Penanganan" muted={token.colorTextTertiary} value={log.treatment ?? '-'} />
        <DetailRow
          label="Obat"
          muted={token.colorTextTertiary}
          value={
            log.medicine_name ? (
              <Space size={6}>
                <MedicineBoxOutlined />
                {log.medicine_name}
              </Space>
            ) : (
              '-'
            )
          }
        />
        <DetailRow label="Status" muted={token.colorTextTertiary} value={STATUS_LABEL[log.status] ?? log.status} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <Tag color="processing">{history.length} kunjungan total</Tag>
        <Tag color="warning">{last30} dalam 30 hari</Tag>
        {topComplaint && <Tag color="error">sering: {topComplaint.label} ({topComplaint.count}×)</Tag>}
      </div>

      {(canWrite || canDelete) && (
        <Space style={{ marginBottom: 18 }} wrap>
          {canWrite && isCurrentResting && (
            <Button type="primary" ghost onClick={() => onMarkReturned(log)}>
              Tandai Sembuh
            </Button>
          )}
          {canWrite && log.student_id && (
            <Button icon={<FileAddOutlined />} onClick={() => onAddVisit(log.student_id as string)}>
              Tambah Kunjungan
            </Button>
          )}
          {canDelete && (
            <Popconfirm title="Hapus kunjungan ini?" onConfirm={() => onDelete(log)} okText="Hapus" cancelText="Batal">
              <Button danger>Hapus</Button>
            </Popconfirm>
          )}
        </Space>
      )}

      <Typography.Text strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <HistoryOutlined /> Riwayat Kunjungan Santri Ini
      </Typography.Text>
      {history.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada riwayat" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map((h) => (
            <div
              key={h.id}
              style={{
                borderLeft: `3px solid ${STATUS_HEX[h.status]}`,
                background: h.id === log.id ? token.colorPrimaryBg : token.colorFillQuaternary,
                borderRadius: 6,
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <Typography.Text style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(`${h.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · {h.time}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 12, color: token.colorTextTertiary }}>
                  {STATUS_LABEL[h.status] ?? h.status}
                </Typography.Text>
              </div>
              <Typography.Text style={{ fontSize: 13 }}>{h.complaint}</Typography.Text>
              {h.medicine_name && (
                <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>
                  <MedicineBoxOutlined /> {h.medicine_name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  )
}
