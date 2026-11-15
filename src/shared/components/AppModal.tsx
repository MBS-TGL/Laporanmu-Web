import type { ReactNode } from 'react'
import { Button, Drawer, Grid, Modal, Typography, theme, type ModalProps } from 'antd'
import { motion } from 'motion/react'
import { IconBox } from './IconBox'
import { modalBodyTransition, modalBodyVariants } from '../motion'

const { Text } = Typography

export interface AppModalProps extends ModalProps {
  /** Ikon di kotak kiri judul. */
  icon?: ReactNode
  /** Teks kecil di bawah judul. */
  subtitle?: string
  /** Ukuran standar modal — dipakai bila `width` tidak diberikan (default 'md'). */
  size?: ModalSize
}

/** Skala lebar modal standar aplikasi. `width` eksplisit tetap menang bila diberikan. */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'
export const MODAL_SIZE: Record<ModalSize, number> = { sm: 480, md: 520, lg: 680, xl: 800 }

// Modal seragam aplikasi. Desktop: Modal centered. Mobile (<768px): otomatis
// menjadi bottom sheet (Drawer placement="bottom", sudut atas membulat,
// full-width) — satu pintu untuk semua modal, pola native ponsel.
// Scroll dikelola penuh lewat inline `styles` (header/footer/body) — tanpa
// CSS global: konten panjang tidak meluber keluar layar, scroll terjadi di
// body saja, header & footer tetap terlihat. Divider memakai token border antd.
//
// Judul seragam: kalau `icon` / `subtitle` diberikan, header dirender
// sebagai [kotak ikon] + judul + subjudul. Tanpa keduanya, judul
// tetap string biasa seperti bawaan antd.
//
// Motion (MOTION 2 / DESIGN.md): hanya konten buatan aplikasi yang dianimasikan
// (fade-up, tujuan = hierarki baca). Permukaan & zoom modal tetap milik antd;
// hormat prefers-reduced-motion via MotionConfig di providers.
export function AppModal({
  styles,
  title,
  icon,
  subtitle,
  children,
  footer,
  open,
  onCancel,
  onOk,
  okText = 'Simpan',
  cancelText = 'Batal',
  okType,
  okButtonProps,
  cancelButtonProps,
  confirmLoading,
  destroyOnHidden,
  maskClosable,
  zIndex,
  closable,
  keyboard,
  afterOpenChange,
  size,
  width,
  ...props
}: AppModalProps) {
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  // md === false berarti viewport < 768px. Sebelum breakpoint terukur
  // (screens kosong) anggap desktop supaya tidak berkedip.
  const isSheet = screens.md === false
  const resolvedWidth = width ?? MODAL_SIZE[size ?? 'md']

  const hasRichTitle = Boolean(icon || subtitle)
  const divider = `1px solid ${token.colorBorderSecondary}`

  const headerNode = hasRichTitle ? (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {icon && <IconBox icon={icon} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
        {subtitle && (
          <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
            {subtitle}
          </Text>
        )}
      </div>
    </div>
  ) : (
    title
  )

  // Footer default sheet saat pemanggil tidak memberi footer kustom tapi
  // memberi onOk — mereplikasi footer default Modal (Batal + Simpan).
  // Footer render-function (bentuk Modal) tidak bisa dirender Drawer — dipakai
  // hanya di desktop; di sheet dianggap tanpa footer kustom.
  const customFooter: ReactNode | undefined =
    footer !== undefined && typeof footer !== 'function' ? footer : undefined
  const sheetFooter =
    customFooter !== undefined
      ? customFooter
      : onOk
        ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => onCancel?.({} as React.MouseEvent<HTMLButtonElement>)} {...cancelButtonProps}>
              {cancelText}
            </Button>
            <Button
              type={okType === 'danger' ? 'primary' : (okType ?? 'primary')}
              danger={okType === 'danger'}
              loading={confirmLoading}
              onClick={onOk}
              {...okButtonProps}
            >
              {okText}
            </Button>
          </div>
        )
        : null

  if (isSheet) {
    // Bottom sheet: konsumsi subset styles Modal-shaped yang ada padanannya
    // di Drawer (header/body/footer); root/container tidak berlaku di Drawer.
    // Bentuk function dari styles hanya bermakna untuk Modal — diabaikan di sheet.
    const styleObj = typeof styles === 'function' ? undefined : styles
    const { header, body, footer: footerStyles, ...restStyles } = styleObj ?? {}
    return (
      <Drawer
        placement="bottom"
        open={open}
        onClose={onCancel ? () => onCancel?.({} as React.MouseEvent<HTMLButtonElement>) : undefined}
        zIndex={zIndex}
        maskClosable={maskClosable}
        destroyOnHidden={destroyOnHidden}
        closable={closable}
        keyboard={keyboard}
        afterOpenChange={afterOpenChange}
        title={headerNode}
        footer={sheetFooter}
        styles={{
          content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          section: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
          header: {
            flexShrink: 0,
            paddingBottom: 12,
            marginBottom: 8,
            borderBottom: divider,
            ...header,
          },
          body: {
            maxHeight: '72dvh',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            ...body,
          },
          footer: {
            flexShrink: 0,
            paddingTop: 12,
            borderTop: divider,
            ...footerStyles,
          },
          ...restStyles,
        }}
      >
        <motion.div
          variants={modalBodyVariants}
          initial="initial"
          animate="animate"
          transition={modalBodyTransition}
          style={{ minHeight: 0 }}
        >
          {children}
        </motion.div>
      </Drawer>
    )
  }

  return (
    <Modal
      centered
      width={resolvedWidth}
      title={headerNode}
      footer={footer}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText={okText}
      cancelText={cancelText}
      okType={okType}
      okButtonProps={okButtonProps}
      cancelButtonProps={cancelButtonProps}
      confirmLoading={confirmLoading}
      destroyOnHidden={destroyOnHidden}
      maskClosable={maskClosable}
      zIndex={zIndex}
      closable={closable}
      keyboard={keyboard}
      afterOpenChange={afterOpenChange}
      styles={{
        root: { maxWidth: 'calc(100vw - 24px)' },
        container: {
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100dvh - 48px)',
          overflow: 'hidden',
        },
        header: {
          flexShrink: 0,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: divider,
        },
        footer: {
          flexShrink: 0,
          marginTop: 16,
          paddingTop: 12,
          borderTop: divider,
        },
        body: {
          flex: '1 1 auto',
          minHeight: 0,
          maxHeight: 'calc(100dvh - 220px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          paddingRight: 4,
        },
        ...styles,
      }}
      {...props}
    >
      <motion.div
        variants={modalBodyVariants}
        initial="initial"
        animate="animate"
        transition={modalBodyTransition}
        style={{ minHeight: 0 }}
      >
        {children}
      </motion.div>
    </Modal>
  )
}
