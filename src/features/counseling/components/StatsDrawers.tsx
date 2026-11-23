import { useMemo, useState } from 'react'
import { Button, Drawer, Empty, Input, Tag, Typography, theme } from 'antd'
import { CheckOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatusTag } from '../../../shared/components/StatusTag'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { URGENCY_META } from '../constants'
import { useCounselingStatList, useUpdateCounselingStatus } from '../hooks'
import type { CounselingLog, CounselingStatListKind } from '../types'

// ------------------------------------------------------------------
// Baris sesi di drawer statistik — klik untuk membuka detail
// ------------------------------------------------------------------
interface SessionItemProps {
  log: CounselingLog
  completing: boolean
  onOpenDetail: (log: CounselingLog) => void
  onComplete: (log: CounselingLog) => void
}

function SessionItem({ log, completing, onOpenDetail, onComplete }: SessionItemProps) {
  const { token } = theme.useToken()
  const meta = URGENCY_META[log.urgency]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(log)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenDetail(log)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1px solid ${log.urgency === 'high' ? '#fca5a5' : token.colorBorderSecondary}`,
        background: log.urgency === 'high' ? '#fff1f0' : undefined,
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            {formatDisplayName(log.student_name)}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {log.class_name ?? '-'}
          </Typography.Text>
          <StatusTag color={meta.color}>{meta.label}</StatusTag>
        </div>
        <Typography.Paragraph
          type="secondary"
          style={{ fontSize: 12, margin: 0, marginTop: 2 }}
          ellipsis={{ rows: 1 }}
        >
          {log.complaint}
        </Typography.Paragraph>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography.Text type="secondary" style={{ fontSize: 11.5, display: 'block' }}>
          {dayjs(log.date).format('DD MMM')}
        </Typography.Text>
        <Button
          size="small"
          type="primary"
          ghost
          icon={<CheckOutlined />}
          loading={completing}
          onClick={(e) => {
            e.stopPropagation()
            onComplete(log)
          }}
        >
          Selesai
        </Button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Drawer daftar sesi (dalam proses / urgensi tinggi)
// ------------------------------------------------------------------
interface StatListDrawerProps {
  kind: CounselingStatListKind
  open: boolean
  onClose: () => void
  onOpenDetail: (log: CounselingLog) => void
}

const DRAWER_META: Record<CounselingStatListKind, { title: string; empty: string }> = {
  in_progress: { title: 'Sesi Dalam Proses', empty: 'Tidak ada sesi dalam proses' },
  high: { title: 'Sesi Urgensi Tinggi Aktif', empty: 'Tidak ada sesi urgensi tinggi' },
}

function StatListDrawer({ kind, open, onClose, onOpenDetail }: StatListDrawerProps) {
  const [search, setSearch] = useState('')
  const listQuery = useCounselingStatList(kind, open)
  const statusMutation = useUpdateCounselingStatus()
  const meta = DRAWER_META[kind]

  const filtered = useMemo(() => {
    const rows = listQuery.data ?? []
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      `${row.student_name} ${row.class_name ?? ''} ${row.complaint} ${row.counselor_name}`
        .toLowerCase()
        .includes(q),
    )
  }, [listQuery.data, search])

  const countTag = (
    <Tag color={kind === 'high' ? 'red' : 'gold'}>{listQuery.data?.length ?? 0}</Tag>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="min(520px, 94vw)"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {meta.title} {countTag}
        </span>
      }
    >
      <Input
        placeholder="Cari santri, kelas, keluhan…"
        prefix={<SearchOutlined />}
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {listQuery.isPending ? (
        <Typography.Text type="secondary">Memuat…</Typography.Text>
      ) : filtered.length === 0 ? (
        <Empty description={meta.empty} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((log) => (
            <SessionItem
              key={log.id}
              log={log}
              completing={statusMutation.isPending && statusMutation.variables?.id === log.id}
              onOpenDetail={onOpenDetail}
              onComplete={(l) => statusMutation.mutate({ id: l.id, status: 'completed' })}
            />
          ))}
        </div>
      )}
    </Drawer>
  )
}

export function InProgressDrawer(props: Omit<StatListDrawerProps, 'kind'>) {
  return <StatListDrawer {...props} kind="in_progress" />
}

export function HighUrgencyDrawer(props: Omit<StatListDrawerProps, 'kind'>) {
  return <StatListDrawer {...props} kind="high" />
}
