import { Button, Tooltip, theme } from 'antd'
import { WhatsAppOutlined } from '@ant-design/icons'
import { canWhatsApp, waLink } from '../utils/wa'

interface WhatsAppButtonProps {
  phone?: string | null
  size?: 'small' | 'middle' | 'large'
  /** Tooltip saat nomor bisa dihubungi */
  label?: string
  /** Tooltip saat nomor kosong atau tidak valid */
  disabledHint?: string
}

/**
 * Ikon WhatsApp seragam: hijau saat nomor valid, abu-abu dan nonaktif saat
 * tidak. Satu aturan validasi (`canWhatsApp`) untuk semua halaman.
 */
export function WhatsAppButton({
  phone,
  size = 'middle',
  label = 'Chat WhatsApp',
  disabledHint = 'Nomor HP belum tersedia',
}: WhatsAppButtonProps) {
  const { token } = theme.useToken()
  const enabled = canWhatsApp(phone)

  return (
    <Tooltip title={enabled ? label : disabledHint}>
      <span>
        <Button
          type="text"
          size={size}
          aria-label={enabled ? label : disabledHint}
          disabled={!enabled}
          icon={<WhatsAppOutlined style={{ color: enabled ? token.colorSuccess : undefined }} />}
          onClick={() => {
            if (enabled && phone) window.open(waLink(phone), '_blank', 'noopener')
          }}
        />
      </span>
    </Tooltip>
  )
}
