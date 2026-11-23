import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Input,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  ApiOutlined,
  CopyOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { StatChip } from '../../shared/components/StatChip'
import { AppModal } from '../../shared/components/AppModal'
import { ModalFooter } from '../../shared/components/ModalFooter'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useApiKeys, useApiKeyUsage, useCreateApiKey, useRevokeApiKey, useApiRequestLogs, type ApiRequestLogRow } from './integrations'

/** Contoh payload webhook — nama field persis seperti RPC ppdb_admission_upsert. */
const SAMPLE_PAYLOAD = `curl -X POST "$SUPABASE_URL/functions/v1/ppdb-webhook" \\
  -H "x-api-key: lmk_xxxxxxxxxxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "registration_number": "PPDB-2026-0001",
    "full_name": "Ahmad Fauzan",
    "gender": "L",
    "birth_place": "Tangerang",
    "birth_date": "2013-05-17",
    "origin_school": "SDN 1",
    "target_grade": "7",
    "parent_name": "Bpk. Hasan",
    "parent_phone": "62812xxxxxxx"
  }'`

/** Webhook dipanggil server eksternal (bukan user Supabase) — wajib no-verify-jwt. */
const DEPLOY_COMMAND = "supabase functions deploy ppdb-webhook --no-verify-jwt"

export function IntegrationsPage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const keysQuery = useApiKeys()
  const usageQuery = useApiKeyUsage()
  const createMutation = useCreateApiKey()
  const revokeMutation = useRevokeApiKey()

  const [nameDraft, setNameDraft] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  // Log permintaan webhook — server-paginated, 10/halaman
  const LOG_PAGE_SIZE = 10
  const [logPage, setLogPage] = useState(1)
  const logsQuery = useApiRequestLogs(logPage, LOG_PAGE_SIZE)
  const logColumns = useMemo(
    () => [
      {
        title: 'Waktu',
        dataIndex: 'created_at',
        width: 150,
        render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm:ss'),
      },
      {
        title: 'Path',
        dataIndex: 'path',
        render: (v: string | null) => (
          <code style={{ fontSize: 12 }}>{v ?? '—'}</code>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        width: 90,
        render: (v: number | null) =>
          v === null ? (
            <Tag>?</Tag>
          ) : (
            <Tag color={v < 400 ? 'success' : v < 500 ? 'warning' : 'error'} style={{ borderRadius: 6 }}>
              {v}
            </Tag>
          ),
      },
      {
        title: 'IP Sumber',
        dataIndex: 'source_ip',
        width: 140,
        render: (v: string | null) => v ?? '—',
      },
    ] as TableColumnsType<ApiRequestLogRow>,
    [],
  )

  const openCreate = () => {
    setNameDraft('')
    setCreatedKey(null)
    setCreateOpen(true)
  }

  const submitCreate = () => {
    createMutation.mutate(nameDraft.trim(), {
      onSuccess: ({ rawKey }) => setCreatedKey(rawKey),
      onError: (err: Error) => message.error(err.message || 'Gagal membuat API key'),
    })
  }

  const copyKey = async () => {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    message.success('API key disalin')
  }

  const actions = useTabActions(
    active,
    <>
      <Tooltip title="Segarkan (R)">
        <Button
          icon={<ReloadOutlined spin={keysQuery.isFetching} />}
          aria-label="Segarkan data integrasi"
          onClick={() => {
            void keysQuery.refetch()
            void usageQuery.refetch()
          }}
        />
      </Tooltip>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
        Buat Key
      </Button>
    </>,
  )

  const columns = [
    {
      title: 'Nama',
      dataIndex: 'name',
      render: (name: string) => (
        <Space size={8}>
          <KeyOutlined style={{ color: token.colorTextSecondary }} />
          <Typography.Text strong>{name}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Prefix',
      dataIndex: 'key_prefix',
      render: (prefix: string) => <code style={{ fontSize: 12 }}>{prefix}…</code>,
    },
    {
      title: 'Status',
      dataIndex: 'revoked_at',
      width: 110,
      render: (revokedAt: string | null) =>
        revokedAt ? (
          <Tag color="error" style={{ borderRadius: 999 }}>
            Dicabut
          </Tag>
        ) : (
          <Tag color="success" style={{ borderRadius: 999 }}>
            Aktif
          </Tag>
        ),
    },
    {
      title: 'Terakhir dipakai',
      dataIndex: 'last_used_at',
      width: 160,
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : 'Belum pernah'),
    },
    {
      title: 'Dibuat',
      dataIndex: 'created_at',
      width: 140,
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 100,
      render: (_: unknown, row: { id: string; name: string; revoked_at: string | null }) =>
        row.revoked_at ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Tidak ada
          </Typography.Text>
        ) : (
          <Popconfirm
            title="Cabut key ini?"
            description="Webhook dengan key ini langsung ditolak. Key yang dicabut tidak bisa diaktifkan kembali."
            okText="Ya, Cabut"
            cancelText="Batal"
            okButtonProps={{ danger: true, loading: revokeMutation.isPending }}
            onConfirm={() =>
              revokeMutation.mutate(
                { id: row.id, name: row.name },
                {
                  onSuccess: () => message.success('API key dicabut'),
                  onError: (err: Error) => message.error(err.message || 'Gagal mencabut key'),
                },
              )
            }
          >
            <Button size="small" danger icon={<StopOutlined />}>
              Cabut
            </Button>
          </Popconfirm>
        ),
    },
  ]

  return (
    <div>
      {actions}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <StatChip
          icon={<KeyOutlined />}
          label="API Key"
          value={(keysQuery.data ?? []).length}
          color="indigo"
          loading={keysQuery.isPending}
        />
        <StatChip
          icon={<ApiOutlined />}
          label="Key Aktif"
          value={(keysQuery.data ?? []).filter((k) => !k.revoked_at).length}
          color="emerald"
          loading={keysQuery.isPending}
        />
        <StatChip
          icon={<ApiOutlined />}
          label="Permintaan 24 Jam"
          value={usageQuery.data?.last24h ?? 0}
          color="sky"
          loading={usageQuery.isPending}
        />
      </div>

      <Card
        title={
          <Space>
            <KeyOutlined />
            API Key Webhook PPDB
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          Key dipakai web formulir PPDB untuk mengirim pendaftar ke webhook. Raw key hanya tampil sekali saat dibuat;
          sistem menyimpan hash-nya. Pendaftar yang sama (nomor registrasi sama) diperbarui, bukan diduplikasi.
        </Typography.Paragraph>
        {keysQuery.isPending ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : keysQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat API key"
            description="Pastikan migration 0051_ppdb_webhook.sql sudah diterapkan di Supabase."
          />
        ) : keysQuery.data.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Belum ada API key. Buat key pertama, lalu pasang di web formulir PPDB."
          />
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={keysQuery.data}
            pagination={false}
            scroll={{ x: 640 }}
          />
        )}
      </Card>

      <Card
        title={
          <Space>
            <ApiOutlined />
            Endpoint Webhook
          </Space>
        }
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Satu kali deploy perubahan ini"
            description={
              <Typography.Text style={{ fontSize: 12.5 }}>
                Jalankan <code>{DEPLOY_COMMAND}</code> di terminal. Tanpa <code>--no-verify-jwt</code>, permintaan dari
                server formulir eksternal ditolak Supabase sebelum sampai ke function. Rate limit otomatis: maksimal 30
                permintaan per menit per key.
              </Typography.Text>
            }
          />
          <div>
            <Typography.Text strong style={{ fontSize: 12.5 }}>
              URL (ganti dengan project ref Anda)
            </Typography.Text>
            <pre style={codeStyle(token)}>
              POST {'{SUPABASE_URL}'}/functions/v1/ppdb-webhook{'\n'}Header: x-api-key: &lt;API key&gt;
            </pre>
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 12.5 }}>
              Contoh permintaan
            </Typography.Text>
            <pre style={codeStyle(token)}>{SAMPLE_PAYLOAD}</pre>
          </div>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <ApiOutlined />
            Log Permintaan (7 hari terakhir)
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
          Jejak setiap permintaan webhook: waktu, path, status HTTP, dan IP sumber — untuk diagnosa
          kegagalan pengiriman PPDB.
        </Typography.Paragraph>
        {logsQuery.isPending ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
          </div>
        ) : logsQuery.isError ? (
          <Alert type="error" showIcon message="Gagal memuat log permintaan" description={String(logsQuery.error)} />
        ) : (logsQuery.data?.data.length ?? 0) === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Belum ada permintaan webhook dalam 7 hari terakhir."
          />
        ) : (
          <Table<ApiRequestLogRow>
            rowKey="id"
            size="small"
            columns={logColumns}
            dataSource={logsQuery.data.data}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: logPage,
              pageSize: LOG_PAGE_SIZE,
              total: logsQuery.data.total,
              showSizeChanger: false,
              onChange: setLogPage,
            }}
          />
        )}
      </Card>

      <AppModal
        title={createdKey ? 'API Key Dibuat' : 'Buat API Key'}
        subtitle={
          createdKey
            ? 'Salin sekarang. Setelah ditutup, key tidak bisa dilihat lagi.'
            : 'Nama key membantu mengenali pemakainya, misalnya "Web PPDB Resmi".'
        }
        icon={<KeyOutlined />}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnHidden
        size="md"
      >
        {createdKey ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="Key ini hanya tampil sekali"
              description="Simpan di tempat aman sebelum menutup dialog. Kalau hilang, buat key baru lalu cabut yang lama."
            />
            <Input.TextArea readOnly value={createdKey} autoSize style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <Button type="primary" icon={<CopyOutlined />} onClick={() => void copyKey()}>
              Salin Key
            </Button>
            <ModalFooter onCancel={() => setCreateOpen(false)} okText="Tutup" onOk={() => setCreateOpen(false)} />
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Input
              placeholder="Nama key, misal Web PPDB Resmi"
              value={nameDraft}
              maxLength={60}
              onChange={(e) => setNameDraft(e.target.value)}
              onPressEnter={() => nameDraft.trim().length >= 2 && submitCreate()}
            />
            <ModalFooter
              onCancel={() => setCreateOpen(false)}
              okText="Buat Key"
              okDisabled={nameDraft.trim().length < 2}
              okLoading={createMutation.isPending}
              onOk={submitCreate}
            />
          </Space>
        )}
      </AppModal>
    </div>
  )
}

function codeStyle(token: { colorBgLayout: string; colorBorderSecondary: string }) {
  return {
    margin: 0,
    marginTop: 6,
    padding: 12,
    borderRadius: 10,
    background: token.colorBgLayout,
    border: `1px solid ${token.colorBorderSecondary}`,
    fontSize: 12,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  }
}
