import { Button, Typography } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { signOut } from '../../features/auth/api'

const { Title, Text } = Typography

/**
 * Layar untuk akun ber-role 'pending': terautentikasi tapi belum diberi akses
 * sampai admin mengaktifkannya (role diubah di /admin > Pengguna).
 * Ditampilkan oleh ProtectedRoute menggantikan panel 403 generik.
 */
export function PendingGate({ email }: { email?: string | null }) {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      // ProtectedRoute otomatis mengarahkan ke /login setelah sesi hilang;
      // state direset bila signOut gagal agar tombol bisa dicoba lagi.
      setSigningOut(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100dvh',
        padding: 24,
        background: 'var(--bg-layout, #f5f6f8)',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: 'center',
          background: '#fff',
          borderRadius: 12,
          padding: '40px 32px',
          border: '1px solid #e5e7eb',
        }}
      >
        <ClockCircleOutlined
          aria-hidden="true"
          style={{ fontSize: 40, color: '#d48806', marginBottom: 16 }}
        />
        <Title level={4} style={{ marginTop: 0 }}>
          Akun Menunggu Persetujuan
        </Title>
        <Text style={{ display: 'block', marginBottom: 8 }}>
          Akun Anda sudah terdaftar, tetapi belum diaktifkan. Administrator akan memberi akses
          setelah akun disetujui.
        </Text>
        {email && (
          <Text style={{ display: 'block', marginBottom: 8 }}>
            Akun: <strong>{email}</strong>
          </Text>
        )}
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Hubungi admin sekolah bila akun Anda seharusnya sudah aktif.
        </Text>
        <Button onClick={handleSignOut} loading={signingOut}>
          Keluar
        </Button>
      </div>
    </div>
  )
}
