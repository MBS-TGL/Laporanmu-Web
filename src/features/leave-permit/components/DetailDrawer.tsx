import {
  Button,
  Descriptions,
  Drawer,
  Popconfirm,
  Space,
  Timeline,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PrinterOutlined,
  SendOutlined,
  StopOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { waLink } from '../../students/wa'
import {
  effectiveStatus,
  formatPermitDate,
  formatPermitDateTime,
  permitNo,
  permitWaText,
  STATUS_META,
} from '../permitUtils'
import type { LeavePermit } from '../types'

interface Props {
  permit: LeavePermit | null
  onClose: () => void
  canWrite: boolean
  canDelete: boolean
  busy: boolean
  onDepart: (p: LeavePermit) => void
  onReturn: (p: LeavePermit) => void
  onCancel: (p: LeavePermit) => void
  onDelete: (p: LeavePermit) => void
  onEdit: (p: LeavePermit) => void
  onPrint: (p: LeavePermit) => void
  /** Duplikat izin ini ke form penerbitan baru */
  onReissue: (p: LeavePermit) => void
}

/** Drawer detail izin: ringkasan, timeline status, dan aksi cepat */
export function DetailDrawer({
  permit,
  onClose,
  canWrite,
  canDelete,
  busy,
  onDepart,
  onReturn,
  onCancel,
  onDelete,
  onEdit,
  onPrint,
  onReissue,
}: Props) {
  const { token } = theme.useToken()
  if (!permit) return null

  const status = effectiveStatus(permit)
  const waPhone = permit.phone ?? permit.student?.phone ?? null

  return (
    <Drawer
      title={
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>{formatDisplayName(permit.student?.name ?? 'Santri')}</span>
            <StatusTag color={STATUS_META[status].color}>{STATUS_META[status].label}</StatusTag>
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400 }}>
            Surat Izin Keluar · No. {permitNo(permit.id)}
          </Typography.Text>
        </div>
      }
      open={!!permit}
      onClose={onClose}
      size="min(440px, 94vw)"
      destroyOnHidden
    >
      <Descriptions column={1} size="small" style={{ marginBottom: 20 }}>
        <Descriptions.Item label="Kode / Kelas">
          {permit.student?.registration_code ?? '-'} · {permit.student?.classes?.name ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Tujuan">{permit.destination}</Descriptions.Item>
        <Descriptions.Item label="Keperluan">{permit.purpose}</Descriptions.Item>
        <Descriptions.Item label="Telepon">{waPhone ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Penerbit">{permit.issuer?.name ?? '-'}</Descriptions.Item>
        <Descriptions.Item label="Diterbitkan">
          {permit.created_at ? formatPermitDateTime(permit.created_at) : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>
        Perjalanan Izin
      </Typography.Text>
      <Timeline
        style={{ marginBottom: 20 }}
        items={[
          {
            color: 'green',
            children: (
              <>
                <div style={{ fontWeight: 600 }}>Diterbitkan</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {permit.created_at ? formatPermitDateTime(permit.created_at) : '-'}
                  {permit.issuer?.name ? ` oleh ${permit.issuer.name}` : ''}
                </div>
              </>
            ),
          },
          {
            color: ['departed', 'overdue', 'returned'].includes(permit.status) ? 'green' : 'gray',
            children: (
              <>
                <div style={{ fontWeight: 600 }}>Berangkat</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {formatPermitDate(permit.leave_date)}
                  {permit.gate_log_id ? ' · tercatat di gerbang' : ''}
                </div>
              </>
            ),
          },
          {
            color: status === 'overdue' ? 'red' : permit.status === 'returned' ? 'green' : 'gray',
            children: (
              <>
                <div style={{ fontWeight: 600 }}>Batas Kembali</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {formatPermitDateTime(permit.return_deadline)}
                </div>
              </>
            ),
          },
          {
            color: permit.status === 'returned' ? 'green' : status === 'overdue' ? 'red' : 'gray',
            children: (
              <>
                <div style={{ fontWeight: 600 }}>Kembali</div>
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {permit.status === 'returned'
                    ? 'Santri telah kembali'
                    : status === 'overdue'
                      ? 'Belum kembali (melewati batas!)'
                      : 'Menunggu santri kembali'}
                </div>
              </>
            ),
          },
        ]}
      />

      <Space wrap>
        <Button icon={<PrinterOutlined />} onClick={() => onPrint(permit)}>
          Cetak
        </Button>
        <Tooltip title={waPhone ? 'Kirim pengingat via WhatsApp' : 'Nomor HP wali belum tersedia'}>
          <span>
            <Button
              icon={<WhatsAppOutlined />}
              disabled={!waPhone}
              onClick={() => waPhone && window.open(waLink(waPhone, permitWaText(permit)), '_blank', 'noopener')}
              style={waPhone ? { color: '#16a34a', borderColor: '#16a34a' } : undefined}
            >
              WA Wali
            </Button>
          </span>
        </Tooltip>
        {canWrite && permit.status === 'issued' && (
          <Button type="primary" icon={<SendOutlined />} loading={busy} onClick={() => onDepart(permit)}>
            Proses Berangkat
          </Button>
        )}
        {canWrite && ['departed', 'overdue'].includes(permit.status) && (
          <Button type="primary" icon={<CheckCircleOutlined />} loading={busy} onClick={() => onReturn(permit)}>
            Proses Kembali
          </Button>
        )}
        {canWrite && ['issued', 'departed', 'overdue'].includes(permit.status) && (
          <Button icon={<EditOutlined />} onClick={() => onEdit(permit)}>
            Edit
          </Button>
        )}
        {canWrite && (
          <Button icon={<CopyOutlined />} onClick={() => onReissue(permit)} title="Duplikat ke izin baru">
            Izin Ulang
          </Button>
        )}
        {canWrite && ['issued', 'departed', 'overdue'].includes(permit.status) && (
          <Popconfirm
            title="Batalkan izin ini?"
            description="Status akan berubah menjadi dibatalkan."
            okText="Batalkan"
            okButtonProps={{ danger: true }}
            cancelText="Batal"
            onConfirm={() => onCancel(permit)}
          >
            <Button danger icon={<StopOutlined />} disabled={busy}>
              Batalkan
            </Button>
          </Popconfirm>
        )}
        {canDelete && (
          <Popconfirm
            title="Hapus permanen izin ini?"
            description="Data izin akan dihapus dan tidak bisa dikembalikan."
            okText="Hapus"
            okButtonProps={{ danger: true }}
            cancelText="Batal"
            onConfirm={() => onDelete(permit)}
          >
            <Button danger type="text" icon={<DeleteOutlined />} disabled={busy}>
              Hapus
            </Button>
          </Popconfirm>
        )}
      </Space>
    </Drawer>
  )
}
