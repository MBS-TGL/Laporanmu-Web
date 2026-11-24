import { useMemo } from 'react'
import { Button, Card, Popconfirm, Skeleton, Switch, Tag, Typography, message, theme } from 'antd'
import { ApiOutlined, LockOutlined, ToolOutlined, WarningOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { useFeatureFlags, useToggleFlag } from '../../../shared/hooks/useFeatureFlags'
import { useRbac } from '../../../shared/rbac/useRbac'
import { fetchTableCount } from '../api'
import { useAutomationRuns, useIntegrityIssues } from '../hooks'
import { AUTOMATIONS } from '../automation'

interface SystemHealthProps {
  active: boolean
  onOpenDatabase: () => void
}

/**
 * Widget Kesehatan Sistem untuk tab Ringkasan: latensi DB (ping head-count),
 * status mode maintenance, temuan integritas, dan tugas terakhir yang
 * dieksekusi — semuanya dari data Supabase nyata, tanpa angka hiasan.
 */
export function SystemHealth({ active, onOpenDatabase }: SystemHealthProps) {
  const { token } = theme.useToken()
  const { role } = useRbac()
  const isDeveloper = role === 'developer'
  const flagsQuery = useFeatureFlags()
  const toggleMutation = useToggleFlag()

  const maintenanceFlag = useMemo(
    () => flagsQuery.data?.find((f) => f.key === 'system.maintenance'),
    [flagsQuery.data],
  )
  const maintenance = maintenanceFlag?.enabled ?? false

  // Ping = durasi head-count tabel kecil — proksi latensi DB dari browser
  const pingQuery = useQuery({
    queryKey: ['admin', 'db-ping'],
    queryFn: async () => {
      const t0 = performance.now()
      await fetchTableCount('profiles')
      return Math.round(performance.now() - t0)
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: active,
  })

  const integrityQuery = useIntegrityIssues()
  const openIssues = useMemo(
    () => (integrityQuery.data ?? []).filter((i) => i.count > 0),
    [integrityQuery.data],
  )

  const runsQuery = useAutomationRuns({ enabled: active })
  const lastRun = runsQuery.data?.[0]

  const latencyColor = (pingQuery.data ?? 0) <= 300 ? 'success' : (pingQuery.data ?? 0) <= 800 ? 'warning' : 'error'

  return (
    <Card
      title="Kesehatan Sistem"
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { display: 'flex', flexDirection: 'column' } }}
    >
      {/* Baris menyebar mengisi tinggi kartu agar setara dengan pasangannya */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'space-evenly' }}>
        <Row icon={<ApiOutlined />} label="Latensi Database" token={token}>
          {pingQuery.isPending ? (
            <Skeleton.Input active size="small" style={{ width: 70, height: 22 }} />
          ) : pingQuery.isError ? (
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              tidak terukur
            </Typography.Text>
          ) : (
            <Tag color={latencyColor} style={{ borderRadius: 999, fontVariantNumeric: 'tabular-nums', marginInlineEnd: 0 }}>
              {pingQuery.data} ms
            </Tag>
          )}
        </Row>

        <Row icon={<LockOutlined />} label="Mode Maintenance" token={token}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Tag color={maintenance ? 'error' : 'default'} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
              {maintenance ? 'Aktif' : 'Nonaktif'}
            </Tag>
            {isDeveloper && maintenanceFlag && (
              <Popconfirm
                title={maintenance ? 'Matikan Mode Maintenance?' : 'Aktifkan Mode Maintenance?'}
                description={
                  maintenance
                    ? 'Aplikasi akan kembali dibuka untuk semua pengguna.'
                    : 'Akses publik dan staf non-developer akan ditutup.'
                }
                okText={maintenance ? 'Buka Akses' : 'Tutup Akses'}
                cancelText="Batal"
                okButtonProps={{ danger: !maintenance, loading: toggleMutation.isPending }}
                onConfirm={() => {
                  toggleMutation.mutate(
                    { id: maintenanceFlag.id, enabled: !maintenance, key: maintenanceFlag.key },
                    {
                      onSuccess: () =>
                        message.success(
                          `Mode maintenance ${!maintenance ? 'diaktifkan' : 'dinonaktifkan'}`,
                        ),
                      onError: (err: Error) =>
                        message.error(err.message || 'Gagal mengubah mode maintenance'),
                    },
                  )
                }}
              >
                <Switch
                  size="small"
                  checked={maintenance}
                  loading={toggleMutation.isPending}
                  aria-label="Toggle mode maintenance"
                />
              </Popconfirm>
            )}
          </span>
        </Row>

        <Row icon={<WarningOutlined />} label="Temuan Integritas" token={token}>
          {integrityQuery.isPending ? (
            <Skeleton.Input active size="small" style={{ width: 90, height: 22 }} />
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <Tag
                color={openIssues.length > 0 ? 'warning' : 'success'}
                style={{ borderRadius: 999, fontVariantNumeric: 'tabular-nums', marginInlineEnd: 0 }}
              >
                {openIssues.length} jenis
              </Tag>
              <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={onOpenDatabase}>
                Lihat
              </Button>
            </span>
          )}
        </Row>

        <Row icon={<ToolOutlined />} label="Tugas Terakhir" token={token}>
          {runsQuery.isPending ? (
            <Skeleton.Input active size="small" style={{ width: 160, height: 22 }} />
          ) : lastRun ? (
            <Typography.Text style={{ fontSize: 12.5 }}>
              {AUTOMATIONS.find((a) => a.id === lastRun.automationId)?.label ?? lastRun.automationId}
              <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                {' '}· {dayjs(lastRun.startedAt).format('DD MMM HH:mm')}
              </Typography.Text>
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              belum pernah dijalankan
            </Typography.Text>
          )}
        </Row>
      </div>
    </Card>
  )
}

function Row({
  icon,
  label,
  token,
  children,
}: {
  icon: React.ReactNode
  label: string
  token: { colorTextSecondary: string; colorPrimary: string }
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: token.colorPrimary, display: 'inline-flex' }}>{icon}</span>
        <Typography.Text style={{ fontSize: 12.5, color: token.colorTextSecondary }}>{label}</Typography.Text>
      </span>
      {children}
    </div>
  )
}
