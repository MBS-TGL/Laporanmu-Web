import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result, Space } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Error boundary per-route — mencegah layar kosong saat render halaman
 * atau lazy chunk gagal dimuat (mis. setelah deploy versi baru).
 * Chunk lama yang hilang → muat ulang otomatis sekali.
 */
const CHUNK_FAILED = /dynamically imported module|importing a module script|failed to fetch dynamically/i

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Chunk gagal dimuat (deploy baru) — muat ulang sekali per sesi
    if (CHUNK_FAILED.test(error.message) && !sessionStorage.getItem('laporanmu_chunk_reloaded')) {
      sessionStorage.setItem('laporanmu_chunk_reloaded', '1')
      window.location.reload()
      return
    }
    console.error('Route error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Result
          status="error"
          title="Terjadi kesalahan"
          subTitle={
            <>
              Halaman ini gagal ditampilkan. Coba muat ulang — jika masih berlanjut,
              hubungi administrator.
            </>
          }
          extra={
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => {
                  this.setState({ error: null })
                }}
              >
                Coba Lagi
              </Button>
              <Button onClick={() => window.location.assign('/')}>Kembali ke Beranda</Button>
            </Space>
          }
        />
      </div>
    )
  }
}
