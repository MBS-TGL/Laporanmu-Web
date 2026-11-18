import { useState } from 'react'
import { App, Input, Space, Typography } from 'antd'
import { QrcodeOutlined, ScanOutlined, SearchOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ScanCamera, type ScanFlash } from '../../../shared/scan/ScanCamera'
import { scannerBeep, scannerBeepFail, scannerVibrate } from '../../../shared/scan/useQrScanner'
import type { Student } from '../types'

/** Ambil kode registrasi dari hasil scan: URL portal (/check?code=X) atau teks polos */
function extractScanCode(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    const code = url.searchParams.get('code')
    if (code) return code.trim()
  } catch {
    // Bukan URL — perlakukan sebagai teks polos
  }
  const match = text.match(/[?&]code=([^&\s]+)/)
  if (match) return decodeURIComponent(match[1])
  return text
}

interface ScanModalProps {
  open: boolean
  onClose: () => void
  allStudents: Student[]
  onSelectStudent: (s: Student) => void
}

/**
 * Scan QR kartu santri dengan kamera perangkat atau input barcode manual
 * untuk langsung membuka profil siswa.
 */
export function ScanModal({ open, onClose, allStudents, onSelectStudent }: ScanModalProps) {
  const { message } = App.useApp()
  const [manualCode, setManualCode] = useState('')
  const [flash, setFlash] = useState<ScanFlash | null>(null)

  const handleResolveCode = (raw: string) => {
    const code = extractScanCode(raw).toLowerCase()
    if (!code) return

    const student = allStudents.find(
      (s) =>
        s.registration_code.toLowerCase() === code ||
        (s.nisn && s.nisn.toLowerCase() === code) ||
        (s.nis && s.nis.toLowerCase() === code),
    )

    if (student) {
      scannerBeep()
      scannerVibrate()
      setFlash({ ok: true, text: student.name, key: Date.now() })
      message.success(`Ditemukan: ${student.name}`)
      onClose()
      onSelectStudent(student)
    } else {
      scannerBeepFail()
      setFlash({ ok: false, text: 'Tidak ditemukan', key: Date.now() })
      message.error(`Siswa dengan kode "${code}" tidak ditemukan`)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      width={460}
      title="Scan Kartu Santri"
      subtitle="Arahkan kamera ke QR kartu santri untuk membuka profil"
      icon={<QrcodeOutlined />}
      footer={<ModalFooter onCancel={onClose} cancelText="Tutup" />}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <ScanCamera
          active={open}
          paused={false}
          flash={flash}
          onCode={handleResolveCode}
        />

        <div style={{ textAlign: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Atau masukkan kode registrasi / NISN secara manual:
          </Typography.Text>
        </div>

        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="Ketik kode registrasi atau NISN…"
            prefix={<SearchOutlined />}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onPressEnter={() => {
              handleResolveCode(manualCode)
              setManualCode('')
            }}
          />
          <Input.Search
            enterButton={<ScanOutlined />}
            onSearch={(v) => {
              handleResolveCode(v)
              setManualCode('')
            }}
          />
        </Space.Compact>
      </div>
    </AppModal>
  )
}
