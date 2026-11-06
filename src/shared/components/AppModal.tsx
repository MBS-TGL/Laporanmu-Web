import { Modal, type ModalProps } from 'antd'

// Modal seragam aplikasi: selalu centered, body punya tinggi maksimum
// (inline style — dijamin menang atas style antd), sehingga modal
// panjang tidak meluber keluar layar: scroll terjadi di body saja,
// header & footer tetap terlihat. Global CSS di index.css menjadi
// cadangan untuk modal di luar AppModal.
export function AppModal({ styles, ...props }: ModalProps) {
  return (
    <Modal
      centered
      styles={{
        body: {
          maxHeight: 'calc(100dvh - 220px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4,
        },
        ...styles,
      }}
      {...props}
    />
  )
}
