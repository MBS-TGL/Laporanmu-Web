import { useEffect, useState } from 'react'
import { Alert, App, Button, Form, Grid, Input, Typography } from 'antd'
import { IdcardOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import { PortalCard } from '../public/PortalCard'
import { PortalDashboard } from './PortalDashboard'
import { rpcPortalLogin, rpcPortalLogout, type PortalSession } from './api'

const SESSION_KEY = 'laporanmu_portal_session'

function loadSession(): PortalSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PortalSession
    if (!parsed.token || (parsed.expiresAt && new Date(parsed.expiresAt) < new Date())) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Portal Santri (P5c, halaman publik /portal): login kode registrasi +
 * PIN → dashboard (jadwal, nilai, absensi, poin, SPP, tahfidz, push).
 * Sesi token 12 jam disimpan sessionStorage — pola sama dgn CBT /exam.
 */
export function PortalPage() {
  const { message } = App.useApp()
  const [session, setSession] = useState<PortalSession | null>(() => loadSession())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sesi tersimpan tapi sudah kedaluwarsa saat mount → bersihkan
  useEffect(() => {
    if (!session) sessionStorage.removeItem(SESSION_KEY)
  }, [session])

  const login = async (values: { code?: string; pin?: string }) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await rpcPortalLogin(String(values.code ?? '').trim(), String(values.pin ?? '').trim())
      const next: PortalSession = { token: res.token, expiresAt: res.expires_at }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
      setSession(next)
      message.success(`Selamat datang, ${res.student.name}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const logout = async () => {
    if (session) {
      try {
        await rpcPortalLogout(session.token)
      } catch {
        // Sesi tetap diakhiri di perangkat ini
      }
    }
    sessionStorage.removeItem(SESSION_KEY)
    setSession(null)
    setError(null)
  }

  return (
    <PortalShell wide={Boolean(session)}>
      {session ? (
        <PortalDashboard session={session} onLogout={() => void logout()} />
      ) : (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <PortalCard
            tint="indigo"
            icon={<UserOutlined />}
            title="Portal Santri"
            description="Masuk dengan kode registrasi dan PIN untuk melihat jadwal, nilai, kehadiran, poin, tagihan SPP, dan tahfidz kamu."
            bullets={[
              'Data hanya tampil di perangkat ini selama 12 jam',
              'PIN didapat dari pihak sekolah (staf pembina kelas)',
              'Aktifkan notifikasi untuk pengumuman dan tagihan baru',
            ]}
            footnote="Lupa PIN? Hubungi staf sekolah untuk dibuatkan PIN baru."
          >
            <Form layout="vertical" onFinish={login}>
              <Form.Item
                name="code"
                label="Kode Registrasi"
                rules={[{ required: true, message: 'Kode registrasi wajib diisi' }]}
              >
                <Input size="large" placeholder="Contoh: 2026-0001" autoFocus autoComplete="username" />
              </Form.Item>
              <Form.Item
                name="pin"
                label="PIN"
                rules={[
                  { required: true, message: 'PIN wajib diisi' },
                  { pattern: /^\d{4,6}$/, message: 'PIN 4-6 angka' },
                ]}
              >
                <Input.Password
                  size="large"
                  placeholder="PIN 4-6 angka"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="current-password"
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={submitting} icon={<SendOutlined />}>
                Masuk Portal
              </Button>
              {error && (
                <Alert type="error" showIcon style={{ marginTop: 12 }} message={error} />
              )}
            </Form>
          </PortalCard>
        </div>
      )}
    </PortalShell>
  )
}

/** Shell publik portal — ringkasan fokus login & dashboard santri.
 * Lebar mengikuti state: dashboard desktop butuh 2 kolom (1040),
 * login tetap 720. Padding mobile lebih rapat dari desktop. */
function PortalShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const screens = Grid.useBreakpoint()
  const isDesktop = Boolean(screens.lg)
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: isDesktop ? '28px 24px' : '16px 12px',
      }}
    >
      <div style={{ maxWidth: wide && isDesktop ? 1040 : 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo-icon.png" alt="Logo Laporanmu" width={44} height={44} style={{ marginBottom: 6 }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Portal Santri
          </Typography.Title>
          <Typography.Text type="secondary">Laporanmu</Typography.Text>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>
            <IdcardOutlined style={{ marginInlineEnd: 4 }} />
            Laporanmu · Portal khusus santri
          </Typography.Text>
        </div>
      </div>
    </div>
  )
}
