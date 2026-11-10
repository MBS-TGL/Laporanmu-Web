import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ExportOutlined,
  FallOutlined,
  ReloadOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { StatChip } from '../../shared/components/StatChip'
import { generateInsight } from './api'
import { useSnapshot } from './hooks'
import type { InsightPreset } from './types'

const PRESETS: { key: InsightPreset; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'Ringkasan Umum', icon: <BulbOutlined /> },
  { key: 'risk', label: 'Santri Berisiko', icon: <FallOutlined /> },
  { key: 'ops', label: 'Operasional Harian', icon: <ThunderboltOutlined /> },
  { key: 'leadership', label: 'Laporan Pimpinan', icon: <ExportOutlined /> },
]

/** Renderer mini untuk jawaban AI: heading "## " dan bullet "- ". */
function InsightText({ text }: { text: string }) {
  const { token } = theme.useToken()
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={key} style={{ margin: '6px 0 6px', paddingLeft: 20 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {b}
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line) {
      flushBullets(`ul-${index}`)
      return
    }
    if (line.startsWith('## ')) {
      flushBullets(`ul-${index}`)
      blocks.push(
        <Typography.Title level={5} key={`h-${index}`} style={{ marginTop: 14, marginBottom: 4 }}>
          {line.slice(3)}
        </Typography.Title>,
      )
      return
    }
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2))
      return
    }
    flushBullets(`ul-${index}`)
    blocks.push(
      <p key={`p-${index}`} style={{ margin: '6px 0' }}>
        {line}
      </p>,
    )
  })
  flushBullets('ul-end')

  return <div style={{ color: token.colorText }}>{blocks}</div>
}

export function InsightsPage() {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const snapshotQuery = useSnapshot()
  const snapshot = snapshotQuery.data

  const [preset, setPreset] = useState<InsightPreset>('general')
  const [result, setResult] = useState<string>('')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = async (which: InsightPreset = preset) => {
    setPreset(which)
    if (!snapshot) return
    setGenerating(true)
    try {
      const text = await generateInsight(snapshot, which)
      setResult(text)
      if (text.startsWith('Maaf') || text.startsWith('Tidak bisa') || text.startsWith('API Key')) {
        message.warning('Jawaban AI tidak optimal — periksa koneksi atau API key')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menghasilkan insight')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      message.success('Insight disalin ke clipboard')
    } catch {
      message.error('Gagal menyalin')
    }
  }

  const chips = useMemo(
    () => [
      {
        icon: <TeamOutlined />,
        label: 'Santri Aktif',
        value: snapshot?.studentTotal ?? '…',
        color: 'indigo' as const,
      },
      {
        icon: <FallOutlined />,
        label: 'Poin Berisiko',
        value: snapshot?.studentRisk ?? '…',
        color: 'rose' as const,
      },
      {
        icon: <ThunderboltOutlined />,
        label: 'Setoran Tahfidz 7 Hari',
        value: snapshot?.tahfidz7d ?? '…',
        color: 'emerald' as const,
      },
      {
        icon: <WalletOutlined />,
        label: 'Saldo Tabungan',
        value: snapshot
          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(
              snapshot.savingsBalance,
            )
          : '…',
        color: 'sky' as const,
      },
      {
        icon: <BookOutlined />,
        label: 'Buku Terlambat',
        value: snapshot?.booksOverdue ?? '…',
        color: 'amber' as const,
      },
    ],
    [snapshot],
  )

  return (
    <div>
      <PageHeader
        title="AI Insights"
        subtitle="Analisis cerdas data pondok — ringkasan, temuan, dan saran tindak lanjut"
        extra={
          <Space wrap>
            <Tooltip title="Muat data terbaru (R)">
              <Button
                icon={<SyncOutlined spin={snapshotQuery.isFetching} />}
                onClick={() => void snapshotQuery.refetch()}
              />
            </Tooltip>
            <Button
              type="primary"
              icon={<BulbOutlined />}
              loading={generating}
              disabled={!snapshot}
              onClick={() => void handleGenerate(preset)}
            >
              Hasilkan Insight
            </Button>
          </Space>
        }
      />

      {!snapshotQuery.isPending && snapshotQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data ringkasan"
          description="Data pondok tidak bisa diambil. Coba muat ulang halaman."
        />
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {chips.map((chip) => (
          <StatChip
            key={chip.label}
            icon={chip.icon}
            label={chip.label}
            value={chip.value}
            color={chip.color}
            loading={snapshotQuery.isPending}
          />
        ))}
      </div>

      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 600 }}>Perspektif:</span>
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              icon={p.icon}
              type={preset === p.key ? 'primary' : 'default'}
              loading={generating && preset === p.key}
              disabled={generating || !snapshot}
              onClick={() => void handleGenerate(p.key)}
            >
              {p.label}
            </Button>
          ))}
          {result && !generating && (
            <Space style={{ marginLeft: 'auto' }}>
              <Button icon={<CopyOutlined />} onClick={() => void handleCopy()}>
                Salin
              </Button>
            </Space>
          )}
        </div>

        {generating ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: token.colorTextTertiary }}>
              AI sedang menganalisis data pondok…
            </div>
          </div>
        ) : result ? (
          <div
            style={{
              padding: '4px 4px 0',
              borderLeft: `3px solid ${token.colorPrimaryBg}`,
              paddingLeft: 16,
            }}
          >
            <InsightText text={result} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <CheckCircleOutlined style={{ fontSize: 40, color: token.colorPrimaryBg }} />
            <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>
              Belum ada insight
            </Typography.Title>
            <Typography.Text type="secondary">
              Pilih perspektif di atas, lalu klik <b>Hasilkan Insight</b>. AI menganalisis angka
              terkini dari modul siswa, kelas, asrama, tahfidz, poin, tabungan, dan perpustakaan —
              tanpa mengarang data.
            </Typography.Text>
            {snapshot && (
              <div style={{ marginTop: 10 }}>
                <Tag icon={<ReloadOutlined />}>
                  Snapshot: {new Date(snapshot.generatedAt).toLocaleTimeString('id-ID')}
                </Tag>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
