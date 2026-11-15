import { useMemo, useState } from 'react'
import { Avatar, List, Segmented, Space, Tag, Typography, theme } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import { ModalSection } from '../../../shared/components/ModalSection'
import { logAudit } from '../../../shared/utils/auditLogger'
import { waLink } from '../../students/wa'
import type { Teacher } from '../types'

const { Text } = Typography

const WA_TEMPLATES = [
  {
    id: 'info',
    label: 'Info Akun Sistem',
    body: "Assalamu'alaikum {nama}.\n\nBerikut informasi akun Anda di sistem Laporanmu.",
  },
  {
    id: 'notif',
    label: 'Notifikasi Baru',
    body: "Assalamu'alaikum {nama}.\n\nAda notifikasi baru untuk Anda di sistem Laporanmu.",
  },
] as const

interface WaModalProps {
  open: boolean
  /** Guru terpilih yang akan dikirimi WA — sudah difilter pemanggil */
  teachers: Teacher[]
  onClose: () => void
}

/** WA Massal: kirim pesan template berurutan via wa.me ke guru terpilih */
export function WaModal({ open, teachers, onClose }: WaModalProps) {
  const { token } = theme.useToken()
  const [templateId, setTemplateId] = useState<string>('info')
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())

  const template = WA_TEMPLATES.find((t) => t.id === templateId) ?? WA_TEMPLATES[0]

  // Reset progres tiap kali modal dibuka untuk seleksi baru
  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSentIds(new Set())
      setTemplateId('info')
    }
  }

  const withPhone = useMemo(() => teachers.filter((t) => t.phone), [teachers])
  const withoutPhone = teachers.length - withPhone.length

  const next = withPhone.find((t) => !sentIds.has(t.id))
  const allSent = withPhone.length > 0 && !next

  const send = () => {
    if (!next?.phone) return
    const text = template.body.replace('{nama}', next.name)
    window.open(waLink(next.phone, text), '_blank', 'noopener')
    setSentIds((prev) => new Set(prev).add(next.id))
    void logAudit({
      action: 'BROADCAST',
      source: 'OPERATIONAL',
      tableName: 'teachers',
      recordId: next.id,
      newData: { channel: 'whatsapp', template: template.id, recipient: next.phone },
    })
  }

  return (
    <AppModal
      title="WA Massal Guru"
      subtitle={`${withPhone.length} guru dengan nomor WhatsApp terpilih`}
      icon={<SendOutlined />}
      open={open}
      onCancel={onClose}
      width={520}
      destroyOnHidden
      footer={
        <ModalFooter
          left={
            <Text type="secondary" style={{ fontSize: 12.5 }}>
              {sentIds.size} dari {withPhone.length} terkirim
            </Text>
          }
          onCancel={onClose}
          okText={next ? `Kirim ke ${next.name.split(' ')[0]}` : 'Semua Terkirim'}
          okDisabled={!next}
          onOk={send}
          okTooltip={next ? undefined : 'Semua guru terkirim'}
        />
      }
    >
      <ModalSection title="Template Pesan" />
      <Segmented
        block
        value={templateId}
        onChange={(v) => setTemplateId(v as string)}
        options={WA_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
      />
      <div
        style={{
          marginTop: 10,
          marginBottom: 16,
          padding: '10px 12px',
          background: token.colorFillQuaternary,
          borderRadius: 10,
          fontSize: 13,
          whiteSpace: 'pre-wrap',
        }}
      >
        {template.body.replace('{nama}', next?.name ?? '[Nama Guru]')}
      </div>

      {withoutPhone > 0 && (
        <ModalNotice tone="warning" title="Tanpa nomor WA">
          {withoutPhone} guru terpilih tidak punya nomor WhatsApp dan dilewati.
        </ModalNotice>
      )}

      <ModalSection title={`Penerima (${withPhone.length})`} />
      <List
        size="small"
        dataSource={withPhone}
        locale={{ emptyText: 'Tidak ada guru terpilih dengan nomor WA' }}
        renderItem={(t) => (
          <List.Item
            style={
              t.id === next?.id
                ? { background: token.colorPrimaryBg, borderRadius: 8, paddingInline: 8 }
                : undefined
            }
          >
            <Space size={10}>
              <Avatar size={28} style={{ fontSize: 13, fontWeight: 600 }}>
                {t.name.charAt(0).toUpperCase()}
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t.phone}
                </Text>
              </div>
            </Space>
            {sentIds.has(t.id) ? (
              <Tag color="green" style={{ marginInlineEnd: 0, borderRadius: 6 }}>
                Terkirim
              </Tag>
            ) : t.id === next?.id ? (
              <Tag color="processing" style={{ marginInlineEnd: 0, borderRadius: 6 }}>
                Berikutnya
              </Tag>
            ) : (
              <Tag style={{ marginInlineEnd: 0, borderRadius: 6 }}>Menunggu</Tag>
            )}
          </List.Item>
        )}
      />
      {allSent && (
        <ModalNotice tone="success" title="Selesai">
          Semua guru terkirim. Tutup modal ini bila sudah selesai.
        </ModalNotice>
      )}
    </AppModal>
  )
}
