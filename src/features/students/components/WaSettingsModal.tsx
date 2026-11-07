import { useEffect, useState } from 'react'
import { App, Alert, Input, Space, Tag, Typography, theme } from 'antd'
import { WhatsAppOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useUpdateWaSettings, useWaSettingsStatus } from '../hooks'

interface WaSettingsModalProps {
  open: boolean
  onClose: () => void
}

/** Pengaturan token Fonnte untuk broadcast WA — token tidak pernah dibaca ulang ke browser */
export function WaSettingsModal({ open, onClose }: WaSettingsModalProps) {
  const { message } = App.useApp()
  const { token: themeToken } = theme.useToken()
  const { canDelete } = usePermissions() // kredensial akun → developer/admin saja
  const statusQuery = useWaSettingsStatus()
  const updateMutation = useUpdateWaSettings()

  const [token, setToken] = useState('')
  const [senderName, setSenderName] = useState('')

  // Prefill nama pengirim saat data status pertama kali terbaca
  const [prevStatusLoaded, setPrevStatusLoaded] = useState(false)
  const status = statusQuery.data
  if (status && !prevStatusLoaded) {
    setPrevStatusLoaded(true)
    setSenderName(status.sender_name ?? '')
  }

  // Reset field token tiap kali modal dibuka — token lama tidak pernah ditampilkan
  useEffect(() => {
    if (open) setToken('')
  }, [open])

  const configured = status?.configured ?? false

  const handleSave = () => {
    if (!token.trim() && !configured) {
      message.warning('Tempel token Fonnte terlebih dahulu')
      return
    }
    updateMutation.mutate(
      { token, senderName },
      {
        onSuccess: () => {
          message.success('Pengaturan WA disimpan')
          setToken('')
          onClose()
        },
        onError: (err: Error) =>
          message.error(err.message || 'Gagal menyimpan pengaturan — pastikan role developer/admin'),
      },
    )
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={520}
      title="Pengaturan WA (Fonnte)"
      subtitle="Token device untuk broadcast WhatsApp ke wali santri"
      icon={<WhatsAppOutlined style={{ color: themeToken.colorSuccess }} />}
      okText="Simpan"
      okButtonProps={{ loading: updateMutation.isPending, disabled: !canDelete }}
      onOk={handleSave}
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Alert
          type={configured ? 'success' : 'warning'}
          showIcon
          message={configured ? 'Token Fonnte terpasang — broadcast siap digunakan' : 'Token belum diatur — broadcast WA dinonaktifkan'}
          description={
            configured
              ? 'Biarkan kolom token kosong untuk tetap memakai token yang tersimpan.'
              : 'Isi token untuk mengaktifkan pengiriman broadcast.'
          }
          style={{ borderRadius: 10 }}
        />

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Token Fonnte
          </Typography.Text>
          <Input.Password
            placeholder="Tempel token dari dashboard fonnte.com → Device → Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="new-password"
          />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '6px 0 0' }}>
            Token tersimpan di database internal dan <strong>tidak pernah dikirim ke browser</strong> —
            pengiriman lewat Edge Function. Device WhatsApp harus tetap online di fonnte.com.
          </Typography.Paragraph>
        </div>

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Nama pengirim <Tag style={{ borderRadius: 6, fontSize: 11 }}>opsional</Tag>
          </Typography.Text>
          <Input
            placeholder="mis. Pengasuhan Laporanmu"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            maxLength={40}
          />
        </div>

        {!canDelete && (
          <Alert
            type="info"
            showIcon
            message="Hanya developer/admin yang dapat mengubah token"
            style={{ borderRadius: 10 }}
          />
        )}
      </Space>
    </AppModal>
  )
}
