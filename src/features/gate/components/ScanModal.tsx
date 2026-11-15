import { useRef, useState } from 'react'
import { App, Button, Input, Segmented, Space, Switch, Tag, Tooltip, Typography, theme } from 'antd'
import { EnterOutlined, ExportOutlined, ScanOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ScanCamera, type ScanFlash } from '../../../shared/scan/ScanCamera'
import { scannerBeep, scannerBeepFail, scannerVibrate } from '../../../shared/scan/useQrScanner'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { fetchStudentByGateCode } from '../api'
import { useGateRecord } from '../hooks'
import type { GateDirection, GateStudentLite } from '../types'

/** Ambil kode registrasi dari hasil scan: URL portal (/check?code=X) atau teks polos */
function extractScanCode(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  try {
    const url = new URL(text)
    const code = url.searchParams.get('code')
    if (code) return code.trim()
  } catch {
    // Bukan URL — perlakukan sebagai kode polos
  }
  const match = text.match(/[?&]code=([^&\s]+)/)
  if (match) return decodeURIComponent(match[1])
  return text
}

interface RecentScan {
  key: number
  name: string
  code: string
  direction: GateDirection
  at: string
}

interface ScanModalProps {
  open: boolean
  onClose: () => void
  /** Arah aktif bersama dengan kartu entry manual */
  direction: GateDirection
  onDirectionChange: (d: GateDirection) => void
}

/**
 * Scan QR kartu santri dengan kamera — tercatat otomatis sesuai arah aktif.
 * Mesin kamera & UI video diseragamkan lewat shared ScanCamera.
 */
export function ScanModal({ open, onClose, direction, onDirectionChange }: ScanModalProps) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()

  const lockRef = useRef(false)
  const recentKeyRef = useRef(0)
  const flashTimerRef = useRef<number | undefined>(undefined)

  const record = useGateRecord()

  const [recent, setRecent] = useState<RecentScan[]>([])
  const [flash, setFlash] = useState<ScanFlash | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [confirmEach, setConfirmEach] = useState(false)

  const showFlash = (ok: boolean, text: string) => {
    window.clearTimeout(flashTimerRef.current)
    setFlash({ ok, text, key: Date.now() })
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1400)
  }

  const pushRecent = (student: GateStudentLite, dir: GateDirection) => {
    recentKeyRef.current += 1
    setRecent((prev) =>
      [
        {
          key: recentKeyRef.current,
          name: student.name,
          code: student.registration_code,
          direction: dir,
          at: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ].slice(0, 8),
    )
  }

  const resolveAndRecord = async (rawCode: string): Promise<void> => {
    const code = rawCode.trim()
    if (!code) {
      showFlash(false, 'QR tidak berisi kode yang valid')
      scannerBeepFail()
      return
    }
    const student = await fetchStudentByGateCode(code)
    if (!student) {
      showFlash(false, `Kode "${code}" tidak dikenali`)
      scannerBeepFail()
      return
    }
    if (confirmEach) {
      const ok = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: student.name,
          content: `Catat ${direction === 'exit' ? 'keluar' : 'masuk'} gerbang?`,
          okText: 'Catat',
          cancelText: 'Batal',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!ok) return
    }
    await record(student, direction)
    showFlash(true, student.name)
    scannerBeep()
    scannerVibrate()
    pushRecent(student, direction)
  }

  const handleCode = (raw: string) => {
    if (lockRef.current || !open) return
    lockRef.current = true
    void resolveAndRecord(extractScanCode(raw))
      .catch((err: unknown) => {
        scannerBeepFail()
        message.error(err instanceof Error ? err.message : 'Gagal mencatat log gerbang')
      })
      .finally(() => {
        lockRef.current = false
      })
  }

  // Reset kondisi scan lewat handler tutup (bukan effect, agar tidak setState sinkron)
  const handleClose = () => {
    setRecent([])
    setFlash(null)
    setManualCode('')
    lockRef.current = false
    onClose()
  }

  const handleManual = () => {
    if (!manualCode.trim()) {
      message.warning('Ketik kode registrasi atau NISN terlebih dahulu')
      return
    }
    void resolveAndRecord(manualCode)
      .then(() => setManualCode(''))
      .catch((err: unknown) =>
        message.error(err instanceof Error ? err.message : 'Gagal mencatat log gerbang'),
      )
  }

  const dirLabel = direction === 'exit' ? 'Keluar' : 'Masuk'

  return (
    <AppModal
      open={open}
      onCancel={handleClose}
      size="lg"
      title="Scan Kartu Santri"
      subtitle={`QR kartu dipindai otomatis, tercatat sebagai ${dirLabel}`}
      icon={<ScanOutlined />}
      footer={
        <ModalFooter
          left={
            <Space.Compact style={{ flex: 1, minWidth: 260 }}>
              <Input
                placeholder="Kamera bermasalah? Ketik kode registrasi / NISN"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onPressEnter={handleManual}
                allowClear
              />
              <Button type="primary" onClick={handleManual}>
                Catat
              </Button>
            </Space.Compact>
          }
          onCancel={handleClose}
          cancelText="Tutup"
        />
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <ScanCamera
          active={open}
          cooldownMs={2000}
          onCode={handleCode}
          flash={flash}
          hint={`Arahkan QR pada kartu portal santri ke dalam bingkai, kartu tercatat otomatis${confirmEach ? ' setelah konfirmasi' : ''}.`}
          toolbar={
            <Space wrap>
              <Segmented
                value={direction}
                onChange={(v) => onDirectionChange(v as GateDirection)}
                options={[
                  { label: 'Masuk', value: 'entry', icon: <EnterOutlined /> },
                  { label: 'Keluar', value: 'exit', icon: <ExportOutlined /> },
                ]}
              />
              <Tooltip title="Tampilkan konfirmasi sebelum tiap hasil scan dicatat">
                <Space size={6}>
                  <Typography.Text style={{ fontSize: 12.5 }}>Konfirmasi tiap scan</Typography.Text>
                  <Switch size="small" checked={confirmEach} onChange={setConfirmEach} />
                </Space>
              </Tooltip>
            </Space>
          }
        />

        {recent.length > 0 && (
          <div>
            <Typography.Text strong style={{ fontSize: 13 }}>
              Scan terakhir
            </Typography.Text>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recent.map((r) => (
                <div
                  key={r.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    padding: '4px 10px',
                    borderRadius: 8,
                    background: token.colorFillQuaternary,
                  }}
                >
                  <Tag color={r.direction === 'exit' ? 'orange' : 'green'} style={{ marginInlineEnd: 0 }}>
                    {r.direction === 'exit' ? 'Keluar' : 'Masuk'}
                  </Tag>
                  <span style={{ fontWeight: 600 }}>{formatDisplayName(r.name)}</span>
                  <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>{r.code}</span>
                  <span style={{ marginLeft: 'auto', color: token.colorTextTertiary, fontSize: 12 }}>
                    {r.at}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Space>
    </AppModal>
  )
}
