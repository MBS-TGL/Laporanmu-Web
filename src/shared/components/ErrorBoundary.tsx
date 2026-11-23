import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Button, Space, Tag, Typography, theme } from 'antd'
import {
  CopyOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useProfile } from '../hooks/useProfile'
import { StatusView } from './StatusView'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  componentStack: string
}

/**
 * Error boundary per-route — mencegah layar kosong saat render halaman
 * atau lazy chunk gagal dimuat (mis. setelah deploy versi baru).
 * Chunk lama yang hilang → muat ulang otomatis sekali.
 */
const CHUNK_FAILED = /dynamically imported module|importing a module script|failed to fetch dynamically/i

function ErrorFallback({
  error,
  componentStack,
  onReset,
}: {
  error: Error
  componentStack: string
  onReset: () => void
}) {
  const { token } = theme.useToken()
  const { role } = useProfile()
  // Developer (atau mode dev lokal) melihat detail teknis; pengguna lain tidak.
  const showDetails = import.meta.env.DEV || role === 'developer'
  const [copied, setCopied] = useState(false)

  const details = [
    `Pesan: ${error.message}`,
    `Nama error: ${error.name}`,
    `Halaman: ${typeof window !== 'undefined' ? window.location.href : '-'}`,
    `Waktu: ${new Date().toISOString()}`,
    `User agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
    '',
    'Stack:',
    error.stack ?? '(tidak tersedia)',
    '',
    'Component stack:',
    componentStack || '(tidak tersedia)',
  ].join('\n')

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard diblokir browser: biarkan pengguna memilih teks manual.
    }
  }

  const preStyle = {
    margin: 0,
    padding: 16,
    background: token.colorFillQuaternary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 10,
    fontSize: 12,
    lineHeight: 1.55,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    overflow: 'auto',
    maxHeight: 360,
    color: token.colorText,
  }

  if (!showDetails) {
    return (
      <StatusView
        icon={<ExclamationCircleOutlined aria-hidden="true" />}
        tone="error"
        title="Halaman tidak dapat ditampilkan"
        description="Terjadi gangguan saat memuat halaman ini. Coba muat ulang. Jika masih berlanjut, hubungi administrator sekolah."
        actions={
          <>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
            >
              Muat Ulang
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => window.location.assign('/')}>
              Kembali ke Beranda
            </Button>
          </>
        }
      />
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space align="start" size={12}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              background: token.colorErrorBg,
              color: token.colorError,
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            <ExclamationCircleOutlined aria-hidden="true" />
          </div>
          <div>
            <Typography.Title level={3} style={{ margin: 0, fontSize: 22 }}>
              Halaman gagal dirender
            </Typography.Title>
            <Typography.Text type="secondary">
              Detail teknis ini hanya tampil untuk developer.
            </Typography.Text>
          </div>
        </Space>

        <Alert
          type="warning"
          showIcon
          message="Mode developer"
          description="Salin detail di bawah dan cek komponen pada component stack sebelum melapor."
        />

        <Space wrap size={8}>
          <Tag color="red">{error.name || 'Error'}</Tag>
          <Typography.Text code copyable={false}>{error.message}</Typography.Text>
        </Space>

        <pre style={preStyle}>{details}</pre>

        <Space wrap>
          <Button type="primary" icon={<ReloadOutlined />} onClick={onReset}>
            Coba Lagi
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={() => void copyDetails()}
            disabled={!navigator.clipboard}
          >
            {copied ? 'Tersalin' : 'Salin Detail'}
          </Button>
          <Button onClick={() => window.location.reload()}>Muat Ulang</Button>
          <Button icon={<HomeOutlined />} onClick={() => window.location.assign('/')}>
            Beranda
          </Button>
        </Space>
      </Space>
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Chunk gagal dimuat (deploy baru) — muat ulang sekali per sesi
    if (CHUNK_FAILED.test(error.message) && !sessionStorage.getItem('laporanmu_chunk_reloaded')) {
      sessionStorage.setItem('laporanmu_chunk_reloaded', '1')
      window.location.reload()
      return
    }
    this.setState({ componentStack: info.componentStack ?? '' })
    console.error('Route error:', error, info.componentStack)
  }

  render() {
    const { error, componentStack } = this.state
    if (!error) return this.props.children

    return (
      <ErrorFallback
        error={error}
        componentStack={componentStack}
        onReset={() => this.setState({ error: null, componentStack: '' })}
      />
    )
  }
}
