import type { ReactNode } from 'react'
import { Button, Tooltip } from 'antd'

interface ModalFooterProps {
  /** Slot kiri: teks status ringkas / tombol sekunder (mis. Kembali). Kosong → semua tombol rata kanan. */
  left?: ReactNode
  onCancel?: () => void
  cancelText?: string
  cancelDisabled?: boolean
  onOk?: () => void
  /** Tanpa okText/onOk → hanya tombol kiri/kanan sekunder (varian Tutup). */
  okText?: string
  okIcon?: ReactNode
  okDanger?: boolean
  okDisabled?: boolean
  okLoading?: boolean
  /** Tooltip yang membungkus tombol utama saat disabled (alasan kenapa tidak bisa). */
  okTooltip?: string
}

/**
 * Footer modal standar: kiri = slot status opsional, kanan = Batal + aksi utama.
 * Satu komposisi untuk semua modal (dulu 3 bentuk footer tumpang-tindih).
 * Untuk dipakai lewat prop `footer=` AppModal maupun di dalam body wizard.
 */
export function ModalFooter({
  left,
  onCancel,
  cancelText = 'Batal',
  cancelDisabled,
  onOk,
  okText,
  okIcon,
  okDanger,
  okDisabled,
  okLoading,
  okTooltip,
}: ModalFooterProps) {
  const hasOk = okText !== undefined || onOk !== undefined
  const okButton = hasOk ? (
    <Button
      type="primary"
      danger={okDanger}
      icon={okIcon}
      disabled={okDisabled}
      loading={okLoading}
      onClick={onOk}
    >
      {okText}
    </Button>
  ) : null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: left ? 'space-between' : 'flex-end',
        gap: 8,
      }}
    >
      {left != null && (
        <div style={{ minWidth: 0, fontSize: 12.5, color: 'inherit' }}>{left}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {onCancel && (
          <Button onClick={onCancel} disabled={cancelDisabled}>
            {cancelText}
          </Button>
        )}
        {okButton &&
          (okTooltip && okDisabled ? (
            <Tooltip title={okTooltip}>
              <span style={{ display: 'inline-flex' }}>{okButton}</span>
            </Tooltip>
          ) : (
            okButton
          ))}
      </div>
    </div>
  )
}
