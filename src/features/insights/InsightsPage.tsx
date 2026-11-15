import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Segmented,
  Space,
  Spin,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import { motion } from 'motion/react'
import {
  BookOutlined,
  BulbOutlined,
  CopyOutlined,
  ExportOutlined,
  FallOutlined,
  SyncOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { IconBox } from '../../shared/components/IconBox'
import { StatChip } from '../../shared/components/StatChip'
import { useTabActions } from '../../shared/components/ActionsSlot'
import { useFlag } from '../../shared/hooks/useFeatureFlags'
import { swapTransition, swapVariants } from '../../shared/motion'
import { generateInsight } from './api'
import { InsightCharts } from './components/InsightCharts'
import { useSnapshot } from './hooks'
import type { InsightPreset } from './types'

const PRESETS: { key: InsightPreset; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'Ringkasan Umum', icon: <BulbOutlined /> },
  { key: 'risk', label: 'Santri Berisiko', icon: <FallOutlined /> },
  { key: 'ops', label: 'Operasional Harian', icon: <ThunderboltOutlined /> },
  { key: 'leadership', label: 'Laporan Pimpinan', icon: <ExportOutlined /> },
]

/** Inline `**tebal**` dari jawaban AI → <strong>; sisanya teks polos. */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))
}

/** Renderer mini untuk jawaban AI: heading "## ", bullet "- ", dan **tebal** inline. */
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
            {renderInline(b)}
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
        {renderInline(line)}
      </p>,
    )
  })
  flushBullets('ul-end')

  return <div style={{ color: token.colorText }}>{blocks}</div>
}

export function InsightsPage({ active }: { active: boolean }) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const aiEnabled = useFlag('insights.ai_enabled', true)

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

  // Aksi tab diportal ke kanan judul shell — WAJIB sebelum early-return
  // !aiEnabled agar urutan hook tetap konsisten; hasil dirender di JSX
  const actions = useTabActions(
    active,
    <>
      <Tooltip title="Muat data terbaru (R)">
        <Button
          icon={<SyncOutlined spin={snapshotQuery.isFetching} />}
          aria-label="Muat data terbaru"
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
    </>,
  )

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

  if (!aiEnabled) {
    return (
      <Alert
        type="info"
        showIcon
        message="Modul AI Insights Dinonaktifkan"
        description="Fitur ini sedang dimatikan oleh developer. Aktifkan kembali lewat flag insights.ai_enabled di tab Pengaturan Developer."
      />
    )
  }

  const view = generating ? 'generating' : result ? 'result' : 'empty'

  return (
    <div>
      {actions}

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

      {snapshot && !snapshotQuery.isPending && <InsightCharts snapshot={snapshot} />}

      <Card>
        {/*
          Baris kontrol: selector perspektif (Segmented — aktif = indigo, satu baris rapi,
          memilih = langsung menghasilkan; perilaku lama dipertahankan) di kiri, status
          snapshot + Salin di kanan. Satu CTA primer tetap di header tab ("Hasilkan Insight").
        */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Space wrap size={10}>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Perspektif
            </Typography.Text>
            <Segmented
              value={preset}
              onChange={(v) => void handleGenerate(v as InsightPreset)}
              disabled={generating || !snapshot}
              options={PRESETS.map((p) => ({ value: p.key, label: p.label, icon: p.icon }))}
            />
          </Space>
          <Space wrap size={10}>
            {snapshot && (
              <Tooltip title="Waktu data ringkasan diambil. Segarkan lewat tombol muat ulang di kanan atas.">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Snapshot {new Date(snapshot.generatedAt).toLocaleTimeString('id-ID')}
                </Typography.Text>
              </Tooltip>
            )}
            {result && !generating && (
              <Button icon={<CopyOutlined />} onClick={() => void handleCopy()}>
                Salin
              </Button>
            )}
          </Space>
        </div>

        {/*
          Pergantian state kosong/proses/hasil — fade-up singkat per ganti key.
          Sengaja TANPA AnimatePresence mode="wait": konten baru tidak boleh
          menunggu exit animation (bisa tertahan bila frame freeze/reduced-motion).
        */}
        <motion.div key={view} variants={swapVariants} initial="initial" animate="animate" transition={swapTransition}>
          {generating ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: token.colorTextSecondary, fontSize: 13 }}>
                AI sedang menganalisis data pondok…
              </div>
            </div>
          ) : result ? (
            <div style={{ maxWidth: 780 }}>
              <InsightText text={result} />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <IconBox icon={<BulbOutlined />} size={56} />
              </div>
              <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
                Belum ada insight
              </Typography.Title>
              <Typography.Paragraph type="secondary" style={{ maxWidth: 520, margin: '0 auto' }}>
                Pilih perspektif di atas, lalu klik <b>Hasilkan Insight</b>. AI menganalisis
                angka terkini dari modul siswa, kelas, asrama, tahfidz, poin, tabungan, dan
                perpustakaan, tanpa mengarang data.
              </Typography.Paragraph>
            </div>
          )}
        </motion.div>
      </Card>
    </div>
  )
}
