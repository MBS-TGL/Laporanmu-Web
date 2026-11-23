import { useState } from 'react'
import { Button, Descriptions, Drawer, Popconfirm, Space, Tag, Typography, theme } from 'antd'
import {
  CheckOutlined,
  ClockCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatusTag } from '../../../shared/components/StatusTag'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { useStudentDetail } from '../../students/useStudentDetail'
import { CATEGORY_LABEL, STATUS_META, URGENCY_META } from '../constants'
import { useCounselingParticipants, useStudentCounseling } from '../hooks'
import type { CounselingLog } from '../types'

interface DetailDrawerProps {
  log: CounselingLog | null
  canWrite: boolean
  canDelete: boolean
  onClose: () => void
  onEdit: (log: CounselingLog) => void
  onDelete: (log: CounselingLog) => void
  /** Toggle status lewat handler halaman agar state detail ikut tersinkron */
  onToggleStatus: (log: CounselingLog) => Promise<void>
  /** Buka detail sesi lain dari riwayat santri */
  onOpenLog: (log: CounselingLog) => void
  /** Catat sesi baru untuk santri yang sama */
  onNewSession: (log: CounselingLog) => void
}

/** Drawer detail sesi BK: seluruh isi kasus + riwayat sesi santri yang sama */
export function DetailDrawer({
  log,
  canWrite,
  canDelete,
  onClose,
  onEdit,
  onDelete,
  onToggleStatus,
  onOpenLog,
  onNewSession,
}: DetailDrawerProps) {
  const { token } = theme.useToken()
  const { open: openStudentDetail } = useStudentDetail()
  const historyQuery = useStudentCounseling(log?.student_id ?? null)
  const participantsQuery = useCounselingParticipants(log?.id ?? null)
  const participants = participantsQuery.data ?? []
  const [toggling, setToggling] = useState(false)

  if (!log) return null
  const urgencyMeta = URGENCY_META[log.urgency]
  const statusMeta = STATUS_META[log.status]
  const others = (historyQuery.data ?? []).filter((row) => row.id !== log.id)

  const labelStyle = { fontSize: 12 } as const
  const contentStyle = { fontSize: 13 } as const

  return (
    <Drawer
      open={Boolean(log)}
      onClose={onClose}
      size="min(560px, 96vw)"
      title={
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {formatDisplayName(log.student_name)}
            {log.class_name && (
              <Typography.Text type="secondary" style={{ fontSize: 12.5, marginLeft: 8 }}>
                {log.class_name}
              </Typography.Text>
            )}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            Sesi {dayjs(log.date).format('DD MMMM YYYY')} · {log.time}
          </Typography.Text>
        </div>
      }
      extra={
        <Space size="small">
          {log.student_id && (
            <Button
              size="small"
              icon={<UserOutlined />}
              onClick={() => openStudentDetail(log.student_id!)}
            >
              Profil Santri
            </Button>
          )}
          {canWrite && (
            <>
              {log.status === 'in_progress' ? (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CheckOutlined />}
                  loading={toggling}
                  onClick={() => {
                    setToggling(true)
                    void onToggleStatus(log).finally(() => setToggling(false))
                  }}
                >
                  Selesaikan
                </Button>
              ) : (
                <Button
                  size="small"
                  icon={<ClockCircleOutlined />}
                  loading={toggling}
                  onClick={() => {
                    setToggling(true)
                    void onToggleStatus(log).finally(() => setToggling(false))
                  }}
                >
                  Buka Lagi
                </Button>
              )}
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(log)}
              >
                Edit
              </Button>
            </>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus sesi BK ini?"
              description="Catatan akan dihapus permanen."
              okText="Hapus"
              cancelText="Batal"
              onConfirm={() => onDelete(log)}
            >
              <Button size="small" danger>
                Hapus
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusTag color={statusMeta.color}>{statusMeta.label}</StatusTag>
          <StatusTag color={urgencyMeta.color}>{`Urgensi ${urgencyMeta.label}`}</StatusTag>
          <Tag>{CATEGORY_LABEL[log.category]}</Tag>
          <Tag>Konselor: {log.counselor_name}</Tag>
        </div>

        <Descriptions
          column={1}
          size="small"
          bordered
          styles={{ label: { ...labelStyle, width: 150 }, content: contentStyle }}
        >
          <Descriptions.Item label="Keluhan & Masalah">
            <span style={{ whiteSpace: 'pre-wrap' }}>{log.complaint}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Diagnosis / Akar Masalah">
            {log.diagnosis ? <span style={{ whiteSpace: 'pre-wrap' }}>{log.diagnosis}</span> : <Typography.Text type="secondary">-</Typography.Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Rencana Tindakan">
            {log.action_plan ? <span style={{ whiteSpace: 'pre-wrap' }}>{log.action_plan}</span> : <Typography.Text type="secondary">-</Typography.Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Tenggat Tindak Lanjut">
            {log.next_session_date ? (
              dayjs(log.next_session_date).isBefore(dayjs(), 'day') && log.status === 'in_progress' ? (
                <Tag color="red">Lewat tenggat · {dayjs(log.next_session_date).format('DD MMM YYYY')}</Tag>
              ) : (
                dayjs(log.next_session_date).format('DD MMM YYYY')
              )
            ) : (
              <Typography.Text type="secondary">Belum ditentukan</Typography.Text>
            )}
          </Descriptions.Item>
          {participants.length > 0 && (
            <Descriptions.Item label="Peserta Kelompok">
              <Space size={[4, 4]} wrap>
                {participants.map((p) => (
                  <Tag key={p.student_id}>{p.name}{p.class_name ? ` · ${p.class_name}` : ''}</Tag>
                ))}
              </Space>
            </Descriptions.Item>
          )}
          {log.created_at && (
            <Descriptions.Item label="Dicatat">
              {dayjs(log.created_at).format('DD MMM YYYY HH:mm')}
            </Descriptions.Item>
          )}
          {log.updated_at && (
            <Descriptions.Item label="Diperbarui">
              {dayjs(log.updated_at).format('DD MMM YYYY HH:mm')}
            </Descriptions.Item>
          )}
        </Descriptions>

        {canWrite && (
          <Button
            block
            icon={<FileTextOutlined />}
            onClick={() => onNewSession(log)}
          >
            Catat Sesi Baru untuk {formatDisplayName(log.student_name)}
          </Button>
        )}

        <div>
          <Typography.Text
            strong
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}
          >
            <HistoryOutlined /> Riwayat Sesi Santri Ini
          </Typography.Text>
          {historyQuery.isPending ? (
            <Typography.Text type="secondary">Memuat riwayat…</Typography.Text>
          ) : others.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              Belum ada sesi lain untuk santri ini.
            </Typography.Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {others.map((row) => {
                const rowMeta = STATUS_META[row.status]
                return (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenLog(row)}
                    onKeyDown={(e) => e.key === 'Enter' && onOpenLog(row)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 10,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      cursor: 'pointer',
                      background: row.id === log.id ? token.colorPrimaryBg : undefined,
                    }}
                  >
                    <Typography.Text style={{ fontSize: 12.5, flexShrink: 0 }}>
                      {dayjs(row.date).format('DD MMM YY')}
                    </Typography.Text>
                    <Typography.Text
                      style={{ fontSize: 12.5, flex: 1, minWidth: 0 }}
                      ellipsis
                    >
                      {CATEGORY_LABEL[row.category]} · {row.complaint}
                    </Typography.Text>
                    <StatusTag color={rowMeta.color}>{rowMeta.label}</StatusTag>
                  </div>
                )
              })}
              {others.length >= 20 && (
                <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                  Menampilkan 20 sesi terakhir.
                </Typography.Text>
              )}
            </div>
          )}
        </div>
      </Space>
    </Drawer>
  )
}
