/* eslint-disable react-refresh/only-export-components */
// File ini mengekspor builder kolom (bukan komponen) — pola sama dengan router.tsx
import { Button, Dropdown, Modal, type TableColumnsType } from 'antd'
import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PrinterOutlined,
  SendOutlined,
  StopOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { StatusTag } from '../../../shared/components/StatusTag'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { effectiveStatus, STATUS_META } from '../permitUtils'
import type { LeavePermit } from '../types'

/** Handler aksi baris — dipasok PermitPage (mutation & modal tetap di halaman) */
export interface PermitColumnHandlers {
  canWrite: boolean
  canDelete: boolean
  onDetail: (p: LeavePermit) => void
  onPrint: (p: LeavePermit) => void
  onWa: (p: LeavePermit) => void
  onDepart: (p: LeavePermit) => void
  onReturn: (p: LeavePermit) => void
  onEdit: (p: LeavePermit) => void
  onReissue: (p: LeavePermit) => void
  onCancel: (p: LeavePermit) => void
  onDelete: (p: LeavePermit) => void
}

/** Deadline ringkas di kolom tabel */
function DeadlineText({ value }: { value: string }) {
  return (
    <span style={{ fontSize: 12.5 }}>
      {new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}{' '}
      {new Date(value).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

/** Kolom tabel izin — dibangun dengan handler halaman (pola builder) */
export function buildPermitColumns(
  h: PermitColumnHandlers,
  modal: ReturnType<typeof Modal.useModal>[0],
): TableColumnsType<LeavePermit> {
  return [
    {
      title: 'Santri',
      key: 'student',
      render: (_, p) => (
        <div style={{ minWidth: 150 }}>
          <div style={{ fontWeight: 600 }}>{p.student?.name ? formatDisplayName(p.student.name) : '—'}</div>
          <span style={{ fontSize: 12, color: '#888' }}>
            {p.student?.registration_code}
            {p.student?.classes?.name ? ` · ${p.student.classes.name}` : ''}
          </span>
        </div>
      ),
    },
    { title: 'Tujuan', dataIndex: 'destination', key: 'destination', ellipsis: true },
    { title: 'Keperluan', dataIndex: 'purpose', key: 'purpose', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Keluar',
      dataIndex: 'leave_date',
      key: 'leave_date',
      width: 105,
      render: (v: string) =>
        new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      responsive: ['md'],
    },
    {
      title: 'Batas Kembali',
      dataIndex: 'return_deadline',
      key: 'return_deadline',
      width: 135,
      render: (v: string) => <DeadlineText value={v} />,
      responsive: ['md'],
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, p) => {
        const s = effectiveStatus(p)
        return <StatusTag color={STATUS_META[s].color}>{STATUS_META[s].label}</StatusTag>
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, p) => {
        const phone = p.phone ?? p.student?.phone ?? null
        const active = ['issued', 'departed', 'overdue'].includes(p.status)
        return (
          <Dropdown
            trigger={['click']}
            menu={{
              onClick: ({ key }) => {
                if (key === 'detail') h.onDetail(p)
                else if (key === 'print') h.onPrint(p)
                else if (key === 'wa') h.onWa(p)
                else if (key === 'depart') h.onDepart(p)
                else if (key === 'return') h.onReturn(p)
                else if (key === 'edit') h.onEdit(p)
                else if (key === 'reissue') h.onReissue(p)
                else if (key === 'cancel') {
                  modal.confirm({
                    title: 'Batalkan izin ini?',
                    content: 'Status akan berubah menjadi dibatalkan.',
                    okText: 'Batalkan',
                    okButtonProps: { danger: true },
                    cancelText: 'Batal',
                    onOk: () => h.onCancel(p),
                  })
                } else if (key === 'delete') {
                  modal.confirm({
                    title: 'Hapus permanen izin ini?',
                    content: 'Data izin akan dihapus dan tidak bisa dikembalikan.',
                    okText: 'Hapus',
                    okButtonProps: { danger: true },
                    cancelText: 'Batal',
                    onOk: () => h.onDelete(p),
                  })
                }
              },
              items: [
                { key: 'detail', icon: <EyeOutlined />, label: 'Detail' },
                { key: 'print', icon: <PrinterOutlined />, label: 'Cetak Surat' },
                { key: 'wa', icon: <WhatsAppOutlined />, label: 'Kirim WA', disabled: !phone },
                { type: 'divider' },
                ...(p.status === 'issued' && h.canWrite
                  ? [{ key: 'depart', icon: <SendOutlined />, label: 'Proses Berangkat' }]
                  : []),
                ...(['departed', 'overdue'].includes(p.status) && h.canWrite
                  ? [{ key: 'return', icon: <CheckCircleOutlined />, label: 'Proses Kembali' }]
                  : []),
                ...(active && h.canWrite ? [{ key: 'edit', icon: <EditOutlined />, label: 'Edit' }] : []),
                ...(h.canWrite ? [{ key: 'reissue', icon: <CopyOutlined />, label: 'Izin Ulang' }] : []),
                ...(active && h.canWrite ? [{ key: 'cancel', icon: <StopOutlined />, label: 'Batalkan', danger: true }] : []),
                ...(h.canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Hapus', danger: true }] : []),
              ],
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        )
      },
    },
  ]
}
