import { useState, type ReactNode, type RefObject } from 'react'
import { Alert, Button, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import { CameraOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useQrScanner } from './useQrScanner'

/** Overlay hasil scan — berubah tiap `key` baru, tampil ±1.4 detik. */
export interface ScanFlash {
  ok: boolean
  text: string
  key: number
}

interface ScanCameraProps {
  /** true = kamera aktif (modal terbuka) */
  active: boolean
  /** Raw QR terbaca dari kamera — ekstraksi kode dilakukan pemanggil */
  onCode: (raw: string) => void
  /** Hentikan sementara deteksi (mis. saat konfirmasi tampil) */
  paused?: boolean
  /** Jeda minimal antar pembacaan teks yang sama (ms) */
  cooldownMs?: number
  /** Overlay hasil scan terakhir */
  flash?: ScanFlash | null
  /** Teks petunjuk di bawah kamera */
  hint?: string
  /** Bila diisi, alert error kamera menampilkan tombol "Coba Lagi" yang memanggil ini */
  onRetry?: () => void
  /** Slot kontrol tambahan di atas kamera (segmented arah, switch, dll) */
  toolbar?: ReactNode
}

/**
 * Panel kamera QR seragam: video + bingkai bidik + status engine +
 * pilih kamera + torch + overlay flash. Satu implementasi untuk semua
 * fitur scan — lihat SKILLS.md §Skill 4.
 */
export function ScanCamera({ active, onCode, paused, cooldownMs = 2000, flash, hint, toolbar, onRetry }: ScanCameraProps) {
  const [selectedDevice, setSelectedDevice] = useState<string | undefined>(undefined)
  const {
    videoRef,
    cameraState,
    cameraError,
    engine,
    devices,
    torchSupported,
    torchOn,
    toggleTorch,
  } = useQrScanner({ active, onDetect: onCode, paused, cooldownMs, deviceId: selectedDevice })

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {(toolbar || devices.length > 1 || torchSupported) && (
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          {toolbar}
          <Space size="middle" wrap>
            {devices.length > 1 && (
              <Select
                size="small"
                style={{ minWidth: 150 }}
                value={selectedDevice ?? devices[0]?.deviceId}
                onChange={setSelectedDevice}
                options={devices.map((d, i) => ({
                  value: d.deviceId,
                  label: d.label || `Kamera ${i + 1}`,
                }))}
              />
            )}
            {torchSupported && (
              <Tooltip title="Lampu kilat">
                <Button
                  size="small"
                  type={torchOn ? 'primary' : 'default'}
                  icon={<ThunderboltOutlined />}
                  onClick={() => void toggleTorch()}
                />
              </Tooltip>
            )}
          </Space>
        </Space>
      )}

      <div
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0b1120',
          aspectRatio: '16 / 9',
        }}
      >
        <video
          ref={videoRef as RefObject<HTMLVideoElement>}
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Bingkai bidik */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ position: 'relative', width: 200, height: 200 }}>
            {([
              { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
              { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
              { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
              { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
            ] as const).map((c, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  width: 34,
                  height: 34,
                  borderColor: '#ffffffcc',
                  borderStyle: 'solid',
                  borderWidth: 0,
                  ...c,
                }}
              />
            ))}
          </div>
        </div>

        {cameraState === 'starting' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: '#0b1120cc',
            }}
          >
            <Space direction="vertical" size={8} style={{ textAlign: 'center' }}>
              <Spin />
              <Typography.Text style={{ color: '#e2e8f0', fontSize: 13 }}>Membuka kamera…</Typography.Text>
            </Space>
          </div>
        )}

        {flash && (
          <div
            key={flash.key}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              background: flash.ok ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
              pointerEvents: 'none',
            }}
          >
            <Space
              direction="vertical"
              size={2}
              style={{ textAlign: 'center', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
            >
              {flash.ok ? (
                <CheckCircleOutlined style={{ fontSize: 34 }} />
              ) : (
                <CloseCircleOutlined style={{ fontSize: 34 }} />
              )}
              <Typography.Text strong style={{ color: '#fff', fontSize: 15 }}>
                {flash.text}
              </Typography.Text>
            </Space>
          </div>
        )}

        {engine && !cameraError && (
          <Tag
            style={{
              position: 'absolute',
              left: 10,
              bottom: 10,
              background: '#0b112099',
              color: '#cbd5e1',
              border: 'none',
            }}
          >
            <CameraOutlined /> {engine === 'native' ? 'BarcodeDetector' : 'jsQR'}
          </Tag>
        )}
      </div>

      {cameraError && (
        <Alert
          type="error"
          showIcon
          message={cameraError}
          action={
            onRetry ? (
              <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
                Coba Lagi
              </Button>
            ) : undefined
          }
          style={{ borderRadius: 10 }}
        />
      )}
      {hint && !cameraError && (
        <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', textAlign: 'center' }}>
          {hint}
        </Typography.Text>
      )}
    </Space>
  )
}
