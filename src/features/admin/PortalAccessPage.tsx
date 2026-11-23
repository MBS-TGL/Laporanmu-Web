import { Alert, Button, Card, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DeleteOutlined, LogoutOutlined, ReloadOutlined } from '@ant-design/icons'
import { StatChip } from '../../shared/components/StatChip'
import {
  useDeletePushSubscription,
  usePortalAttempts,
  usePortalSessions,
  usePushSubscriptions,
  useRevokePortalSession,
  type PortalAttempt,
  type PortalSession,
  type PushSubscriptionRow,
} from './portal'

interface PortalAccessPageProps {
  active: boolean
}

function formatTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PortalAccessPage({ active }: PortalAccessPageProps) {
  const sessions = usePortalSessions(active)
  const attempts = usePortalAttempts(active)
  const subscriptions = usePushSubscriptions(active)
  const revoke = useRevokePortalSession()
  const removePush = useDeletePushSubscription()

  const sessionRows = sessions.data ?? []
  const activeSessions = sessionRows.filter((s) => s.is_active).length
  const attemptRows = attempts.data ?? []
  const pushRows = subscriptions.data ?? []

  const sessionColumns: ColumnsType<PortalSession> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_v, row) => (
        <div>
          <Typography.Text strong>{row.student_name}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {row.class_name ?? '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_v, row) =>
        row.is_active ? <Tag color="green">Aktif</Tag> : <Tag>Berakhir</Tag>,
    },
    { title: 'Dibuat', dataIndex: 'created_at', key: 'created_at', width: 130, render: formatTime },
    { title: 'Terakhir dilihat', dataIndex: 'last_seen_at', key: 'last_seen_at', width: 150, render: formatTime },
    { title: 'Kedaluwarsa', dataIndex: 'expires_at', key: 'expires_at', width: 130, render: formatTime },
    {
      title: '',
      key: 'action',
      width: 90,
      align: 'right',
      render: (_v, row) =>
        row.is_active ? (
          <Popconfirm
            title="Cabut sesi ini?"
            description="Santri harus login ulang di portal."
            okText="Ya, Cabut"
            cancelText="Batal"
            onConfirm={() => revoke.mutate(row.id)}
          >
            <Button size="small" danger icon={<LogoutOutlined />} loading={revoke.isPending}>
              Cabut
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  const attemptColumns: ColumnsType<PortalAttempt> = [
    { title: 'Kode (prefix)', dataIndex: 'code_prefix', key: 'code_prefix' },
    {
      title: 'Waktu',
      dataIndex: 'attempted_at',
      key: 'attempted_at',
      width: 180,
      render: formatTime,
    },
  ]

  const pushColumns: ColumnsType<PushSubscriptionRow> = [
    { title: 'Santri', dataIndex: 'student_name', key: 'student_name' },
    {
      title: 'Perangkat',
      dataIndex: 'user_agent',
      key: 'user_agent',
      render: (value: string | null) => (
        <Typography.Text ellipsis style={{ maxWidth: 260, display: 'inline-block' }}>
          {value ?? '—'}
        </Typography.Text>
      ),
    },
    { title: 'Terakhir dipakai', dataIndex: 'last_used_at', key: 'last_used_at', width: 160, render: formatTime },
    {
      title: '',
      key: 'action',
      width: 80,
      align: 'right',
      render: (_v, row) => (
        <Popconfirm
          title="Hapus langganan push?"
          description="Perangkat ini berhenti menerima notifikasi portal."
          okText="Ya, Hapus"
          cancelText="Batal"
          onConfirm={() => removePush.mutate(row.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} loading={removePush.isPending} />
        </Popconfirm>
      ),
    },
  ]

  const reloadAll = () => {
    void sessions.refetch()
    void attempts.refetch()
    void subscriptions.refetch()
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap>
        <StatChip
          icon={<LogoutOutlined />}
          label="Sesi aktif"
          value={activeSessions}
          color="emerald"
          loading={sessions.isLoading}
        />
        <StatChip
          icon={<LogoutOutlined />}
          label="Percobaan gagal 7 hari"
          value={attemptRows.length}
          color="rose"
          loading={attempts.isLoading}
        />
        <StatChip
          icon={<LogoutOutlined />}
          label="Langganan push"
          value={pushRows.length}
          color="indigo"
          loading={subscriptions.isLoading}
        />
        <Button icon={<ReloadOutlined />} onClick={reloadAll}>
          Muat Ulang
        </Button>
      </Space>

      <Card
        size="small"
        title="Sesi Portal Aktif"
        extra={<Typography.Text type="secondary">Diperbarui tiap 30 detik</Typography.Text>}
      >
        {sessions.isError ? (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat sesi portal"
            description={(sessions.error as Error).message}
            action={<Button size="small" onClick={() => void sessions.refetch()}>Coba lagi</Button>}
          />
        ) : (
          <Table<PortalSession>
            rowKey="id"
            size="small"
            columns={sessionColumns}
            dataSource={sessionRows}
            loading={sessions.isLoading}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 720 }}
            locale={{ emptyText: 'Belum ada sesi portal.' }}
          />
        )}
      </Card>

      <Card size="small" title="Percobaan Login Gagal (7 hari)">
        {attempts.isError ? (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat percobaan login"
            description={(attempts.error as Error).message}
            action={<Button size="small" onClick={() => void attempts.refetch()}>Coba lagi</Button>}
          />
        ) : (
          <Table<PortalAttempt>
            rowKey={(row) => `${row.code_prefix}-${row.attempted_at}`}
            size="small"
            columns={attemptColumns}
            dataSource={attemptRows}
            loading={attempts.isLoading}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{ emptyText: 'Tidak ada percobaan gagal. Bagus.' }}
          />
        )}
      </Card>

      <Card size="small" title="Langganan Push Portal">
        {subscriptions.isError ? (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat langganan push"
            description={(subscriptions.error as Error).message}
            action={<Button size="small" onClick={() => void subscriptions.refetch()}>Coba lagi</Button>}
          />
        ) : (
          <Table<PushSubscriptionRow>
            rowKey="id"
            size="small"
            columns={pushColumns}
            dataSource={pushRows}
            loading={subscriptions.isLoading}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 640 }}
            locale={{ emptyText: 'Belum ada perangkat yang mengaktifkan notifikasi.' }}
          />
        )}
      </Card>
    </Space>
  )
}
