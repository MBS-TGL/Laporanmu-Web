import { App, Button, Empty, Space, Table, Tooltip, Typography, theme, type TableColumnsType } from 'antd'
import { CopyOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { waLink } from '../../students/wa'
import { effectiveStatus, formatPermitDateTime, permitWaText, permitReminderWaText } from '../permitUtils'
import type { LeavePermit } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Izin yang di-remind (departed/overdue, idealnya yang lewat batas) */
  permits: LeavePermit[]
}

/**
 * Kirim pengingat WA ke wali santri yang belum kembali.
 * Daftar + tombol kirim per baris (popup blocker membatasi buka banyak tab sekaligus).
 */
export function WaReminder({ open, onClose, permits }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const withPhone = permits.filter((p) => p.phone ?? p.student?.phone)

  const copyText = async (p: LeavePermit) => {
    try {
      await navigator.clipboard.writeText(permitReminderWaText(p))
      message.success('Teks pengingat disalin')
    } catch {
      message.error('Gagal menyalin teks')
    }
  }

  const columns: TableColumnsType<LeavePermit> = [
    {
      title: 'Santri',
      key: 'student',
      render: (_, p) => (
        <div>
          <div style={{ fontWeight: 600 }}>{formatDisplayName(p.student?.name ?? 'Santri')}</div>
          <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
            {p.student?.classes?.name ?? '-'} · {p.destination}
          </span>
        </div>
      ),
    },
    {
      title: 'Batas Kembali',
      dataIndex: 'return_deadline',
      key: 'deadline',
      width: 150,
      render: (v: string, p) => (
        <Typography.Text type={effectiveStatus(p) === 'overdue' ? 'danger' : undefined} style={{ fontSize: 12.5 }}>
          {formatPermitDateTime(v)}
        </Typography.Text>
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      render: (_, p) => {
        const phone = p.phone ?? p.student?.phone
        const text = effectiveStatus(p) === 'overdue' ? permitReminderWaText(p) : permitWaText(p)
        return (
          <Space.Compact>
            <Tooltip title={phone ? 'Kirim pengingat via WhatsApp' : 'Nomor HP wali belum tersedia'}>
              <span>
                <Button
                  size="small"
                  icon={<WhatsAppOutlined />}
                  style={phone ? { color: '#16a34a', borderColor: '#16a34a' } : undefined}
                  disabled={!phone}
                  onClick={() => phone && window.open(waLink(phone, text), '_blank', 'noopener')}
                >
                  Kirim
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Salin teks pengingat">
              <Button size="small" icon={<CopyOutlined />} onClick={() => void copyText(p)} />
            </Tooltip>
          </Space.Compact>
        )
      },
    },
  ]

  return (
    <AppModal
      title="Pengingat WA Wali"
      subtitle={`${permits.length} izin dipilih · ${withPhone.length} memiliki nomor telepon`}
      icon={<WhatsAppOutlined />}
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <ModalFooter
          left={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Popup browser membatasi buka banyak WA sekaligus: kirim satu per satu, atau salin teksnya.
            </Typography.Text>
          }
          onCancel={onClose}
          cancelText="Tutup"
        />
      }
    >
      {withPhone.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada nomor telepon pada izin terpilih" />
      ) : (
        <Table<LeavePermit>
          rowKey="id"
          columns={columns}
          dataSource={permits}
          pagination={false}
          size="small"
          scroll={{ y: 380 }}
        />
      )}
    </AppModal>
  )
}
