import { useMemo, type ReactNode } from 'react'
import type { MenuProps } from 'antd'
import {
  CameraOutlined,
  ExportOutlined,
  FileExcelOutlined,
  IdcardOutlined,
  RiseOutlined,
  SyncOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { actionMenuLabel } from '../../../shared/components/ActionMenu'

interface HeaderMenuDeps {
  canWrite: boolean
  onImport: () => void
  onExport: () => void
  onBulkPhoto: () => void
  onWaSettings: () => void
  onBulkCard: () => void
  onOpenPromote: () => void
  onResetPoints: () => void
}

/** Menu "Lainnya" di header tab Santri Aktif — grup Data & Manajemen */
export function useHeaderMenu({
  canWrite,
  onImport,
  onExport,
  onBulkPhoto,
  onWaSettings,
  onBulkCard,
  onOpenPromote,
  onResetPoints,
}: HeaderMenuDeps): MenuProps {
  // Item menu aksi halaman — gaya seragam dua baris (judul + deskripsi) via helper shared.
  const menuItem = (
    key: string,
    icon: ReactNode,
    title: string,
    desc: string,
    shortcut?: string[],
    extra?: { danger?: boolean; disabled?: boolean; onClick?: () => void },
  ) => ({
    key,
    icon,
    danger: extra?.danger,
    disabled: extra?.disabled,
    onClick: extra?.onClick,
    label: actionMenuLabel(title, desc, shortcut),
  })

  return useMemo(
    () => ({
      items: [
        {
          key: 'data',
          type: 'group' as const,
          label: 'Data',
          children: [
            menuItem('import', <FileExcelOutlined />, 'Impor Data', 'Unggah dari Excel atau Google Sheets', ['I'], { disabled: !canWrite, onClick: onImport }),
            menuItem('export', <ExportOutlined />, 'Ekspor Data', 'Cadangkan seluruh database', ['Ctrl', 'E'], { onClick: onExport }),
            menuItem('bulk-photo', <CameraOutlined />, 'Bulk Foto', 'Update foto siswa secara masal via NISN', ['B'], { disabled: !canWrite, onClick: onBulkPhoto }),
            menuItem('wa-settings', <WhatsAppOutlined />, 'Pengaturan WA', 'Token Fonnte untuk broadcast wali santri', ['W'], { disabled: !canWrite, onClick: onWaSettings }),
          ],
        },
        {
          key: 'manajemen',
          type: 'group' as const,
          label: 'Manajemen',
          children: [
            menuItem('bulk-card', <IdcardOutlined />, 'Cetak Kartu Massal', 'Per kelas, semua aktif, atau sesuai filter', ['C'], { onClick: onBulkCard }),
            menuItem('promote', <RiseOutlined />, 'Kenaikan Kelas', 'Wizard promosi massal & kelulusan tahun ajaran', undefined, { disabled: !canWrite, onClick: onOpenPromote }),
            menuItem('reset-points', <SyncOutlined />, 'Reset Poin', 'Bersihkan semua poin untuk semester baru', undefined, { danger: true, disabled: !canWrite, onClick: onResetPoints }),
          ],
        },
      ],
    }),
    [canWrite, onImport, onExport, onBulkPhoto, onWaSettings, onBulkCard, onOpenPromote, onResetPoints],
  )
}
