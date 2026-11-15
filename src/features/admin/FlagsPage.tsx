import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Popconfirm,
  Row,
  Segmented,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  AppstoreOutlined,
  CodeOutlined,
  EditOutlined,
  ExperimentOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ToolOutlined,
  WarningOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip } from '../../shared/components/StatChip'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useDebounce } from '../../shared/hooks/useDebounce'
import {
  useFeatureFlags,
  useFlag,
  useToggleFlag,
  type FeatureFlag,
} from '../../shared/hooks/useFeatureFlags'
import {
  useAppSettings,
  useUpdateAppSetting,
  type MaintenanceMessageValue,
} from '../../shared/hooks/useAppSettings'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { FlagModal } from './components/FlagModal'

const CATEGORY_LABEL: Record<string, string> = {
  system: 'Sistem',
  module: 'Modul',
}

const CATEGORY_FILTERS = [
  { label: 'Semua', value: 'all' },
  { label: 'Sistem', value: 'system' },
  { label: 'Modul', value: 'module' },
]

export function FlagsPage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const qc = useQueryClient()
  const flagsQuery = useFeatureFlags()
  const toggleMutation = useToggleFlag()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [category, setCategory] = useState('all')
  const [flagModal, setFlagModal] = useState<{ open: boolean; flag: FeatureFlag | null }>({
    open: false,
    flag: null,
  })

  const maintenance = useFlag('system.maintenance', false)
  const settingsQuery = useAppSettings()
  const updateSetting = useUpdateAppSetting()

  // Draft pesan pemeliharaan — dihidrasi sekali dari app_settings agar
  // ketikan user tidak tertimpa saat refetch di tengah pengetikan
  const [msgDraft, setMsgDraft] = useState<{ message: string; until: Dayjs | null }>({
    message: '',
    until: null,
  })
  const [msgHydrated, setMsgHydrated] = useState(false)
  useEffect(() => {
    if (msgHydrated || !settingsQuery.data) return
    const raw = (settingsQuery.data.find((s) => s.key === 'maintenance.message')?.value ?? {}) as MaintenanceMessageValue
    setMsgDraft({ message: raw.message ?? '', until: raw.until ? dayjs(raw.until) : null })
    setMsgHydrated(true)
  }, [settingsQuery.data, msgHydrated])

  const saveMaintenanceMessage = () => {
    updateSetting.mutate(
      {
        key: 'maintenance.message',
        value: { message: msgDraft.message.trim(), until: msgDraft.until ? msgDraft.until.toISOString() : null },
      },
      {
        onSuccess: () => message.success('Pesan pemeliharaan disimpan'),
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan pesan'),
      },
    )
  }

  const flags = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    return (flagsQuery.data ?? []).filter((f) => {
      if (category !== 'all' && f.category !== category) return false
      if (!term) return true
      return [f.label, f.key, f.description ?? ''].some((v) => v.toLowerCase().includes(term))
    })
  }, [flagsQuery.data, debouncedSearch, category])

  const grouped = useMemo(() => {
    const map = new Map<string, FeatureFlag[]>()
    for (const flag of flags) {
      map.set(flag.category, [...(map.get(flag.category) ?? []), flag])
    }
    return [...map.entries()]
  }, [flags])

  const allFlags = flagsQuery.data ?? []
  const activeCount = allFlags.filter((f) => f.enabled).length
  const categories = new Set(allFlags.map((f) => f.category))

  const handleToggle = (flag: FeatureFlag, enabled: boolean) => {
    toggleMutation.mutate(
      { id: flag.id, enabled, key: flag.key },
      {
        onSuccess: () => message.success(`Flag "${flag.label}" ${enabled ? 'diaktifkan' : 'dimatikan'}`),
        onError: (err: Error) => message.error(err.message || 'Gagal mengubah flag'),
      },
    )
  }

  const shortcutItems = useMemo<ShortcutItem[]>(
    () => [
      {
        keys: ['R'],
        label: 'Segarkan feature flags',
        group: 'Aksi',
        icon: <ReloadOutlined />,
        run: () => void flagsQuery.refetch(),
      },
    ],
    [flagsQuery],
  )
  const shortcuts = useShortcuts({ items: shortcutItems })

  // Aksi tab diportal ke kanan judul shell — hasil dirender di JSX
  const actions = useTabActions(
    active,
    <>
      <Tooltip title="Segarkan flags (R)">
        <Button icon={<ReloadOutlined spin={flagsQuery.isFetching} />} aria-label="Segarkan flags" onClick={() => void flagsQuery.refetch()} />
      </Tooltip>
      <Tooltip title="Shortcut keyboard (?)">
        <Button aria-label="Bantuan shortcut keyboard" icon={<QuestionCircleOutlined />} onClick={shortcuts.open} />
      </Tooltip>
      <Tag icon={<ExperimentOutlined />} color="purple" style={{ borderRadius: 999 }}>
        Developer Tools
      </Tag>
    </>,
  )

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
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        transition: 'border-color .2s',
      }}
    >
      <div style={{ flex: 1 }}>
        <Space size={8} align="center">
          <b style={{ fontSize: 13.5 }}>{flag.label}</b>
          <code style={{ fontSize: 11, color: token.colorTextTertiary }}>{flag.key}</code>
          {flag.key === 'system.maintenance' && (
            <Tag color="gold" style={{ borderRadius: 999 }}>
              Developer-only bypass
            </Tag>
          )}
        </Space>
        {flag.description && (
          <div style={{ fontSize: 12.5, color: token.colorTextSecondary, marginTop: 4 }}>{flag.description}</div>
        )}
      </div>
      <Space size={4}>
        <Tooltip title="Edit flag">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label={`Edit ${flag.label}`}
            onClick={() => setFlagModal({ open: true, flag })}
          />
        </Tooltip>
        <Switch
          checked={flag.enabled}
          checkedChildren="AKTIF"
          unCheckedChildren="MATI"
          loading={toggleMutation.isPending && toggleMutation.variables?.id === flag.id}
          onChange={(checked) => handleToggle(flag, checked)}
        />
      </Space>
    </div>
  )

  return (
    <div>
      {actions}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<AppstoreOutlined />}
          label="Feature Flag"
          value={allFlags.length}
          color="indigo"
          loading={flagsQuery.isPending}
        />
        <StatChip
          icon={<SafetyCertificateOutlined />}
          label="Aktif"
          value={activeCount}
          color="emerald"
          loading={flagsQuery.isPending}
        />
        <StatChip
          icon={maintenance ? <WarningOutlined /> : <SafetyCertificateOutlined />}
          label="Maintenance"
          value={maintenance ? 'AKTIF' : 'Mati'}
          color={maintenance ? 'rose' : 'sky'}
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: maintenance ? '#f59e0b' : '#10b981' }} />
                Mode Maintenance
              </Space>
            }
          >
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Saat aktif, seluruh aplikasi tertutup untuk admin, pengurus, dan guru — hanya developer yang bisa
                masuk. Gunakan saat migrasi atau perbaikan besar.
              </Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space size={10}>
                  {maintenance ? (
                    <Tag color="warning" style={{ borderRadius: 999 }}>
                      Sistem dalam maintenance
                    </Tag>
                  ) : (
                    <Tag color="success" style={{ borderRadius: 999 }}>
                      Sistem normal
                    </Tag>
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
                    const flag = allFlags.find((f) => f.key === 'system.maintenance')
                    if (flag) handleToggle(flag, !maintenance)
                  }}
                >
                  <Switch checked={maintenance} loading={toggleMutation.isPending} />
                </Popconfirm>
              </div>
              {maintenance && (
                <>
                  <Input.TextArea
                    rows={2}
                    maxLength={300}
                    placeholder="Pesan kustom untuk pengguna (kosongkan untuk pesan default)"
                    value={msgDraft.message}
                    onChange={(e) => setMsgDraft((d) => ({ ...d, message: e.target.value }))}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <DatePicker
                      showTime={{ format: 'HH:mm' }}
                      placeholder="Perkiraan selesai (opsional)"
                      value={msgDraft.until}
                      onChange={(v) => setMsgDraft((d) => ({ ...d, until: v }))}
                      style={{ width: 220 }}
                    />
                    <Button
                      size="small"
                      type="primary"
                      loading={updateSetting.isPending}
                      onClick={saveMaintenanceMessage}
                    >
                      Simpan Pesan
                    </Button>
                  </div>
                </>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Info Sistem">
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <InfoRow label="Jumlah feature flag" value={String(allFlags.length)} />
              <InfoRow label="Kategori terdaftar" value={[...categories].map((c) => CATEGORY_LABEL[c] ?? c).join(', ') || '—'} />
              <InfoRow label="Supabase URL" value={supabaseUrlHost()} />
              <InfoRow label="Versi aplikasi" value={appVersion()} />
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
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={() => setFlagModal({ open: true, flag: null })}>
            Tambah Flag
          </Button>
        }
      >
        <Space wrap style={{ marginBottom: 14 }}>
          <Input
            placeholder="Cari flag / deskripsi…"
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Segmented value={category} onChange={(v) => setCategory(v as string)} options={CATEGORY_FILTERS} />
        </Space>

        {flagsQuery.isPending ? (
          <Typography.Text type="secondary">Memuat flag…</Typography.Text>
        ) : grouped.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada flag yang cocok" />
        ) : (
          grouped.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <Typography.Text strong style={{ fontSize: 12.5, color: token.colorTextSecondary, letterSpacing: '0.05em' }}>
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
            description="Pastikan migration 0023_feature_flags.sql sudah diterapkan di Supabase."
          />
        )}
      </Card>

      <FlagModal
        open={flagModal.open}
        flag={flagModal.flag}
        onClose={() => setFlagModal({ open: false, flag: null })}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
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
