import { App, Button, Dropdown, Grid, Space, Tooltip, theme } from 'antd'
import {
  EditOutlined,
  EyeOutlined,
  IdcardOutlined,
  InboxOutlined,
  MoreOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { WhatsAppButton } from '../../../shared/components/WhatsAppButton'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { waLink } from '../wa'
import type { Student } from '../types'

interface StudentActionsProps {
  row: Student
  canWrite: boolean
  canDelete: boolean
  onDetail: (s: Student) => void
  onCard: (s: Student) => void
  onEdit: (s: Student) => void
  onDelete: (id: string) => void
}

/**
 * Aksi baris santri aktif: tiga aksi utama (detail, WhatsApp, edit), sisanya
 * di menu tiga titik. Arsip memakai ikon kotak masuk, bukan tempat sampah,
 * karena datanya bisa dipulihkan dari tab Arsip.
 */
export function StudentActions({
  row,
  canWrite,
  canDelete,
  onDetail,
  onCard,
  onEdit,
  onDelete,
}: StudentActionsProps) {
  const { token } = theme.useToken()
  const { modal } = App.useApp()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const confirmArchive = () => {
    modal.confirm({
      title: 'Arsipkan santri ini?',
      content: `${formatDisplayName(row.name)} akan dipindah ke tab Arsip dan bisa dipulihkan kapan saja.`,
      okText: 'Ya, Arsipkan',
      cancelText: 'Batal',
      onOk: () => onDelete(row.id),
    })
  }

  const moreItems = [
    { key: 'card', icon: <IdcardOutlined />, label: 'Kartu portal', onClick: () => onCard(row) },
    ...(canDelete
      ? [{ key: 'archive', icon: <InboxOutlined />, label: 'Arsipkan', onClick: confirmArchive }]
      : []),
  ]

  const moreButton = (
    <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: moreItems }}>
      <Tooltip title="Aksi lainnya">
        <Button type="text" aria-label="Aksi lainnya" icon={<MoreOutlined />} />
      </Tooltip>
    </Dropdown>
  )

  if (isMobile) {
    return (
      <Dropdown
        trigger={['click']}
        placement="bottomRight"
        menu={{
          items: [
            { key: 'detail', icon: <EyeOutlined />, label: 'Lihat detail', onClick: () => onDetail(row) },
            { key: 'card', icon: <IdcardOutlined />, label: 'Kartu portal', onClick: () => onCard(row) },
            {
              key: 'wa',
              icon: <WhatsAppOutlined style={{ color: row.phone ? token.colorSuccess : undefined }} />,
              label: 'WhatsApp',
              disabled: !row.phone,
              onClick: () => row.phone && window.open(waLink(row.phone), '_blank', 'noopener'),
            },
            ...(canWrite
              ? [{ key: 'edit', icon: <EditOutlined />, label: 'Edit data', onClick: () => onEdit(row) }]
              : []),
            ...(canDelete
              ? [
                  { type: 'divider' as const },
                  { key: 'archive', icon: <InboxOutlined />, label: 'Arsipkan', onClick: confirmArchive },
                ]
              : []),
          ],
        }}
      >
        <Tooltip title="Aksi lainnya">
          <Button type="text" aria-label="Aksi lainnya" icon={<MoreOutlined />} />
        </Tooltip>
      </Dropdown>
    )
  }

  return (
    <Space size={0}>
      <Tooltip title="Lihat detail">
        <Button
          type="text"
          aria-label="Lihat detail"
          icon={<EyeOutlined />}
          onClick={() => onDetail(row)}
        />
      </Tooltip>
      <WhatsAppButton phone={row.phone} />
      {canWrite && (
        <Tooltip title="Edit data">
          <Button
            type="text"
            aria-label="Edit data"
            icon={<EditOutlined />}
            onClick={() => onEdit(row)}
          />
        </Tooltip>
      )}
      {moreButton}
    </Space>
  )
}
