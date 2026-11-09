import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import {
  CodeOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SafetyOutlined,
  ToolOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '../../shared/components/PageHeader'
import { useFeatureFlags, useFlag, useToggleFlag, type FeatureFlag } from '../../shared/hooks/useFeatureFlags'

const CATEGORY_LABEL: Record<string, string> = {
  system: 'Sistem',
  module: 'Modul',
}

const CATEGORY_FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'system', label: 'Sistem' },
  { value: 'module', label: 'Modul' },
]

export function DeveloperSettingsPage() {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const flagsQuery = useFeatureFlags()
  const toggleMutation = useToggleFlag()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const maintenance = useFlag('system.maintenance', false)

  const flags = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (flagsQuery.data ?? []).filter((f) => {
      if (category !== 'all' && f.category !== category) return false
      if (!term) return true
      return [f.label, f.key, f.description ?? ''].some((v) => v.toLowerCase().includes(term))
    })
  }, [flagsQuery.data, search, category])

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureFlag[]>()
    for (const flag of flags) {
      map.set(flag.category, [...(map.get(flag.category) ?? []), flag])
    }
    return [...map.entries()]
  }, [flags])

  const handleToggle = (flag: FeatureFlag, enabled: boolean) => {
    toggleMutation.mutate(
      { id: flag.id, enabled, key: flag.key },
      {
        onSuccess: () => message.success(`Flag "${flag.label}" ${enabled ? 'diaktifkan' : 'dimatikan'}`),
        onError: (err: Error) => message.error(err.message || 'Gagal mengubah flag'),
      },
    )
  }

  const renderFlag = (flag: FeatureFlag) => (
    <div
      key={flag.key}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid #eef2f7',
        background: '#fff',
      }}
    >
      <div style={{ flex: 1 }}>
        <Space size={8} align="center">
          <b style={{ fontSize: 13.5 }}>{flag.label}</b>
          <code style={{ fontSize: 11, color: '#64748b' }}>{flag.key}</code>
          {flag.key === 'system.maintenance' && <Tag color="gold">Developer-only bypass</Tag>}
        </Space>
        {flag.description && (
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{flag.description}</div>
        )}
      </div>
      <Switch
        checked={flag.enabled}
        checkedChildren="AKTIF"
        unCheckedChildren="MATI"
        loading={toggleMutation.isPending && toggleMutation.variables?.id === flag.id}
        onChange={(checked) => handleToggle(flag, checked)}
      />
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Pengaturan Developer"
        subtitle="Feature flags, mode maintenance, dan alat diagnosis aplikasi"
        extra={<Tag icon={<ExperimentOutlined />} color="purple">Developer Tools</Tag>}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: maintenance ? '#f59e0b' : '#10b981' }} />
                Mode Maintenance
              </Space>
            }
            size="small"
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Saat aktif, seluruh aplikasi tertutup untuk admin, pengurus, dan guru — hanya developer yang bisa
                masuk. Gunakan saat migrasi atau perbaikan besar.
              </Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={10}>
                  <SafetyOutlined style={{ color: maintenance ? '#f59e0b' : '#10b981' }} />
                  {maintenance ? (
                    <Tag color="warning">Sistem dalam maintenance</Tag>
                  ) : (
                    <Tag color="success">Sistem normal</Tag>
                  )}
                </Space>
                <Popconfirm
                  title={maintenance ? 'Matikan maintenance?' : 'Aktifkan maintenance?'}
                  description={
                    maintenance
                      ? 'Semua role akan bisa mengakses aplikasi kembali.'
                      : 'Admin, pengurus, dan guru akan langsung terkunci dari aplikasi.'
                  }
                  okText="Ya, lanjutkan"
                  cancelText="Batal"
                  onConfirm={() => {
                    const flag = (flagsQuery.data ?? []).find((f) => f.key === 'system.maintenance')
                    if (flag) handleToggle(flag, !maintenance)
                  }}
                >
                  <Switch checked={maintenance} loading={toggleMutation.isPending} />
                </Popconfirm>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Info Sistem" size="small">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <InfoRow label="Jumlah feature flag" value={String(flagsQuery.data?.length ?? 0)} />
              <InfoRow label="Supabase URL" value={supabaseUrlHost()} />
              <InfoRow label="Versi aplikasi" value={appVersion()} />
              <InfoRow label="Mode Debug" value="lihat flag system.debug_mode" />
            </Space>
            <Space wrap style={{ marginTop: 12 }}>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  qc.invalidateQueries()
                  message.success('Semua cache query dibuang — data akan diambil ulang')
                }}
              >
                Buang Cache Query
              </Button>
              <Button size="small" icon={<CodeOutlined />} onClick={() => window.location.reload()}>
                Muat Ulang Aplikasi
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <ToolOutlined />
            Feature Flags
          </Space>
        }
        size="small"
      >
        <Space wrap style={{ marginBottom: 14 }}>
          <Input
            placeholder="Cari flag / deskripsi… (Ctrl+K tidak perlu)"
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Segmented value={category} onChange={(v) => setCategory(v as string)} options={CATEGORY_FILTERS} />
        </Space>

        {flagsQuery.isLoading ? (
          <Typography.Text type="secondary">Memuat flag…</Typography.Text>
        ) : grouped.length === 0 ? (
          <Empty description="Tidak ada flag yang cocok" />
        ) : (
          grouped.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <Typography.Text strong style={{ fontSize: 12.5, color: '#64748b', letterSpacing: '0.05em' }}>
                {CATEGORY_LABEL[cat] ?? cat.toUpperCase()}
              </Typography.Text>
              <Row gutter={[10, 10]} style={{ marginTop: 8 }}>
                {items.map((flag) => (
                  <Col xs={24} xl={12} key={flag.key}>
                    {renderFlag(flag)}
                  </Col>
                ))}
              </Row>
            </div>
          ))
        )}

        {flagsQuery.isError && (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat feature flags"
            description="Pastikan migration 0020 sudah diterapkan di Supabase."
          />
        )}
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{value}</Typography.Text>
    </div>
  )
}

function supabaseUrlHost(): string {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL as string).host
  } catch {
    return 'tidak tersedia'
  }
}

function appVersion(): string {
  return (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.0.0'
}
