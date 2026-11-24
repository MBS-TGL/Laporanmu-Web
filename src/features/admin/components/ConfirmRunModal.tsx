import { useEffect, useState } from 'react'
import { Input, Skeleton, Space, Typography } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ModalNotice } from '../../../shared/components/ModalNotice'
import type { Automation } from '../automation'

export interface RunPreviewRow {
  label: string
  value: string
}

interface ConfirmRunModalProps {
  automation: Automation | null
  /** Dry-run: perkiraan dampak eksekusi (baris terdampak dst.) */
  preview: RunPreviewRow[]
  previewLoading: boolean
  /** Kata yang harus diketik pengguna untuk mengaktifkan tombol eksekusi */
  confirmWord: string
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: () => void
}

const CONFIRM_HINT = 'JALANKAN'

/**
 * Konfirmasi eksekusi otomasi destruktif dengan dry-run preview + konfirmasi
 * ketik — mencegah klik-menghapus data dalam jumlah besar secara tidak sengaja.
 */
export function ConfirmRunModal({
  automation,
  preview,
  previewLoading,
  confirmWord,
  open,
  loading,
  onClose,
  onConfirm,
}: ConfirmRunModalProps) {
  const [confirmText, setConfirmText] = useState('')

  // Reset ketikan tiap kali modal dibuka
  useEffect(() => {
    if (open) setConfirmText('')
  }, [open])

  const ready = confirmText.trim() === confirmWord

  return (
    <AppModal
      title={`Jalankan "${automation?.label ?? ''}"?`}
      subtitle="Periksa perkiraan dampak di bawah sebelum mengeksekusi — tindakan ini tidak bisa dibatalkan."
      icon={<ExclamationCircleOutlined />}
      open={open && automation !== null}
      onCancel={onClose}
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelDisabled={loading}
          onOk={onConfirm}
          okText="Jalankan Sekarang"
          okDanger
          okDisabled={!ready || loading}
          okLoading={loading}
          okTooltip={ready ? undefined : `Ketik "${confirmWord}" untuk mengaktifkan`}
        />
      }
      size="sm"
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <ModalNotice tone="warning" title="Tindakan permanen">
          {automation?.description} Data yang diubah/dihapus tidak dikembalikan. Eksekusi tercatat di riwayat dan audit log.
        </ModalNotice>

        <div>
          <Typography.Text strong style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>
            Perkiraan dampak (dry-run)
          </Typography.Text>
          {previewLoading ? (
            <Skeleton.Input active size="small" block style={{ height: 40 }} />
          ) : preview.length === 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              Tidak ada data untuk dipratinjau.
            </Typography.Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {preview.map((row) => (
                <div
                  key={row.label}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}
                >
                  <Typography.Text type="secondary">{row.label}</Typography.Text>
                  <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {row.value}
                  </Typography.Text>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Typography.Text strong style={{ fontSize: 12.5, display: 'block', marginBottom: 6 }}>
            Ketik <Typography.Text code>{CONFIRM_HINT}</Typography.Text> untuk mengonfirmasi
          </Typography.Text>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_HINT}
            onPressEnter={ready ? onConfirm : undefined}
            status={confirmText && !ready ? 'error' : undefined}
          />
        </div>
      </Space>
    </AppModal>
  )
}
