import { useMemo, useState } from 'react'
import { Alert, App, Button, Input, Radio, Space, Tag, Typography, theme } from 'antd'
import { SendOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { StatusTag } from '../../../shared/components/StatusTag'
import { useSendWaBroadcast, useWaSettingsStatus } from '../hooks'
import { STUDENT_STATUS_META } from '../status'
import { WA_MERGE_TAGS, WA_TEMPLATES, renderWaMessage, waLink, waPhoneDigits, type WaTemplateId } from '../wa'
import type { Student } from '../types'

/** Maksimum penerima yang dirender — sisanya tetap ikut "Kirim Semua" */
const MAX_PREVIEW = 15

/** Pesan ramah untuk reason gagal dari Edge Function / Fonnte */
function waErrorText(reason: string): string {
  const r = reason.toLowerCase()
  if (r.includes('token invalid')) return 'Token Fonnte tidak valid — periksa Pengaturan WA'
  if (r.includes('belum diatur')) return 'Token Fonnte belum diatur — atur di menu Lainnya → Pengaturan WA'
  if (r.includes('quota')) return 'Kuota Fonnte habis — cek paket di dashboard fonnte.com'
  if (r.includes('target invalid')) return 'Ada nomor telepon tidak valid — periksa data siswa'
  if (r.includes('disconnect')) return 'Device WhatsApp disconnected — buka fonnte.com dan scan ulang QR'
  return reason
}

interface BroadcastModalProps {
  open: boolean
  onClose: () => void
  /** Siswa terpilih — yang tanpa nomor telepon tidak bisa dikirimi */
  students: Student[]
}

export function BroadcastModal({ open, onClose, students }: BroadcastModalProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const [templateId, setTemplateId] = useState<WaTemplateId>('laporan')
  const [customBody, setCustomBody] = useState('')

  const statusQuery = useWaSettingsStatus()
  const sendMutation = useSendWaBroadcast()
  const tokenConfigured = statusQuery.data?.configured ?? false

  const recipients = useMemo(() => students.filter((s) => !!s.phone), [students])
  const noPhoneCount = students.length - recipients.length

  const template = WA_TEMPLATES.find((t) => t.id === templateId)
  const body = templateId === 'custom' ? customBody : (template?.body ?? '')

  // Preview pesan per penerima (dirender maksimal MAX_PREVIEW)
  const previews = useMemo(
    () => recipients.slice(0, MAX_PREVIEW).map((s) => ({ student: s, text: renderWaMessage(body, s) })),
    [recipients, body],
  )

  const handleSendAll = () => {
    if (recipients.length === 0) return
    sendMutation.mutate(
      recipients.map((s) => ({
        target: waPhoneDigits(s.phone!),
        message: renderWaMessage(body, s),
      })),
      {
        onSuccess: (result) => {
          if (result.ok) {
            message.success(`${result.sent ?? recipients.length} pesan masuk antrean Fonnte — dikirim berurutan dengan jeda 5–10 detik`)
            onClose()
          } else {
            message.error(waErrorText(result.reason ?? 'Gagal mengirim broadcast'))
          }
        },
        onError: (err: Error) => message.error(err.message || 'Gagal mengirim broadcast'),
      },
    )
  }

  const handleOpenOne = (student: Student) => {
    window.open(waLink(student.phone!, renderWaMessage(body, student)), '_blank', 'noopener')
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={640}
      title="Broadcast WhatsApp ke Wali"
      subtitle={`${recipients.length} wali punya nomor terdaftar`}
      icon={<WhatsAppOutlined style={{ color: token.colorSuccess }} />}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Pesan dikirim via Fonnte — jeda acak 5–10 detik antar pesan
          </Typography.Text>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={onClose}>Tutup</Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sendMutation.isPending}
              disabled={
                !tokenConfigured ||
                recipients.length === 0 ||
                (templateId === 'custom' && !customBody.trim())
              }
              onClick={handleSendAll}
            >
              Kirim Semua
            </Button>
          </div>
        </div>
      }
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        {!tokenConfigured && (
          <Alert
            type="warning"
            showIcon
            message="Token Fonnte belum diatur — pengiriman dinonaktifkan"
            description="Atur token di menu Lainnya → Pengaturan WA. Sementara itu, kirim manual satu per satu lewat tombol Buka."
            style={{ borderRadius: 10 }}
          />
        )}

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Template pesan
          </Typography.Text>
          <Radio.Group
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value as WaTemplateId)}
            optionType="button"
            buttonStyle="solid"
            options={WA_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
          />
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
            {template?.description}
          </Typography.Paragraph>
        </div>

        {templateId === 'custom' && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {WA_MERGE_TAGS.map((tag) => (
                <Tag
                  key={tag}
                  style={{ borderRadius: 6, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                  onClick={() => setCustomBody((prev) => `${prev}${tag}`)}
                >
                  {tag}
                </Tag>
              ))}
            </div>
            <Input.TextArea
              rows={5}
              placeholder={'Assalamu\'alaikum Bpk/Ibu {wali}, ...'}
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
            />
          </div>
        )}

        {noPhoneCount > 0 && (
          <Alert
            type="warning"
            showIcon
            message={`${noPhoneCount} siswa terpilih tanpa nomor telepon — dilewati`}
            style={{ borderRadius: 10 }}
          />
        )}

        <div>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Pratinjau {recipients.length > MAX_PREVIEW ? `${MAX_PREVIEW} dari ${recipients.length} penerima` : 'penerima'}
          </Typography.Text>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {previews.map(({ student, text }) => (
              <div
                key={student.id}
                style={{
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 0 }}>
                    {student.name}
                    <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                      {student.classes?.name ?? '—'} · {student.phone}
                    </Typography.Text>
                  </span>
                  <StatusTag color={STUDENT_STATUS_META[student.status].color}>
                    {STUDENT_STATUS_META[student.status].label}
                  </StatusTag>
                  <Button size="small" icon={<WhatsAppOutlined style={{ color: token.colorSuccess }} />} onClick={() => handleOpenOne(student)}>
                    Buka
                  </Button>
                </div>
                <div
                  style={{
                    background: token.colorFillQuaternary,
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    color: token.colorTextSecondary,
                  }}
                >
                  {text}
                </div>
              </div>
            ))}
            {recipients.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Tidak ada siswa terpilih dengan nomor telepon.
              </Typography.Text>
            )}
          </Space>
        </div>
      </Space>
    </AppModal>
  )
}
