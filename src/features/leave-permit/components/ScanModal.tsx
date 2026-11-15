import { useCallback, useState } from 'react'
import { Alert, App, Button, Input, Segmented, Space, Tag, theme } from 'antd'
import { CheckCircleOutlined, ScanOutlined, SendOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ScanCamera } from '../../../shared/scan/ScanCamera'
import { scannerBeep, scannerVibrate } from '../../../shared/scan/useQrScanner'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { fetchPermitStudentByCode } from '../api'
import {
  extractPermitRef,
  extractScannedCode,
} from '../permitValidation'
import { effectiveStatus } from '../permitUtils'
import type { LeavePermit, PermitStudentBrief } from '../types'

type ScanMode = 'gate' | 'issue'

interface Props {
  open: boolean
  onClose: () => void
  mode: ScanMode
  onModeChange: (m: ScanMode) => void
  /** Seluruh izin ter-load dari halaman — dipakai resolve hasil scan */
  permits: LeavePermit[]
  /** Mode issue: lanjut ke form terbitkan dengan santri terpilih */
  onIssueForStudent: (s: PermitStudentBrief) => void
  /** Mode gate: proses berangkat/kembali (mutation dipegang halaman) */
  onGateAction: (permit: LeavePermit, action: 'depart' | 'return') => Promise<unknown>
}

type GateTarget =
  | { kind: 'permit'; permit: LeavePermit }
  | { kind: 'student'; student: PermitStudentBrief; actives: LeavePermit[] }
  | { kind: 'issue-ready'; student: PermitStudentBrief }
  | { kind: 'not-found'; raw: string }

/**
 * Scan QR kartu santri / surat izin dengan kamera.
 * Kamera & decoder hybrid ada di useQrScanner (multidevice).
 */
export function ScanModal({ open, onClose, mode, onModeChange, permits, onIssueForStudent, onGateAction }: Props) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [manualCode, setManualCode] = useState('')
  const [resolving, setResolving] = useState(false)
  const [target, setTarget] = useState<GateTarget | null>(null)
  const [actionBusy, setActionBusy] = useState<'depart' | 'return' | null>(null)
  /** Naikkan untuk me-remount ScanCamera → restart kamera (tombol Coba Lagi) */
  const [retryKey, setRetryKey] = useState(0)

  const activePermits = useCallback(
    () => permits.filter((p) => p.status === 'issued' || p.status === 'departed'),
    [permits],
  )

  // ------------------------------------------------------------
  // Resolusi hasil scan
  // ------------------------------------------------------------
  const resolveCode = useCallback(
    async (code: string) => {
      setResolving(true)
      try {
        if (mode === 'gate') {
          // Cari di izin yang sudah ter-load (cepat, tanpa fetch)
          const byPermitCode = permits.find(
            (p) => p.student?.registration_code.toUpperCase() === code,
          )
          if (byPermitCode) {
            scannerBeep()
            scannerVibrate()
            setTarget({ kind: 'permit', permit: byPermitCode })
            return
          }
          // Kartu santri → fetch profil, tampilkan izin aktif miliknya
          const student = await fetchPermitStudentByCode(code)
          scannerBeep()
          scannerVibrate()
          if (!student) {
            setTarget({ kind: 'not-found', raw: code })
            return
          }
          const actives = activePermits().filter((p) => p.student_id === student.id)
          setTarget({ kind: 'student', student, actives })
        } else {
          const student = await fetchPermitStudentByCode(code)
          scannerBeep()
          scannerVibrate()
          setTarget(student ? { kind: 'issue-ready', student } : { kind: 'not-found', raw: code })
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Gagal mengenali kode')
      } finally {
        setResolving(false)
      }
    },
    [mode, permits, message, activePermits],
  )

  const handleRaw = useCallback(
    async (raw: string) => {
      // QR dari surat izin cetak → langsung proses izin itu (mode gerbang)
      const permitRefId = extractPermitRef(raw)
      if (permitRefId) {
        if (mode !== 'gate') {
          message.info('Ini QR surat izin, pindah ke mode Proses Gerbang untuk memprosesnya')
          return
        }
        const permit = permits.find((p) => p.id === permitRefId)
        scannerBeep()
        scannerVibrate()
        setTarget(permit ? { kind: 'permit', permit } : { kind: 'not-found', raw: `Izin ${permitRefId.slice(0, 8).toUpperCase()}` })
        return
      }

      const code = extractScannedCode(raw)
      if (!code) return
      await resolveCode(code)
    },
    [mode, permits, message, resolveCode],
  )

  const resetTarget = () => {
    setTarget(null)
  }

  /** Tutup modal + bersihkan state agar buka berikutnya mulai dari nol */
  const closeAndReset = () => {
    resetTarget()
    setManualCode('')
    onClose()
  }

  const handleGateAction = async (permit: LeavePermit, action: 'depart' | 'return') => {
    setActionBusy(action)
    try {
      // Toast sukses ditampilkan oleh handler halaman (handleDepart/handleReturn)
      await onGateAction(permit, action)
      resetTarget()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses izin')
    } finally {
      setActionBusy(null)
    }
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <AppModal
      title="Scan Kartu / Surat Izin"
      subtitle="Arahkan QR kartu santri atau surat izin ke kamera"
      icon={<ScanOutlined />}
      open={open}
      onCancel={closeAndReset}
      width={520}
      footer={
        <ModalFooter
          left={
            <Segmented
              value={mode}
              onChange={(v) => {
                onModeChange(v as ScanMode)
                resetTarget()
              }}
              options={[
                { label: 'Proses Gerbang', value: 'gate' },
                { label: 'Terbitkan Izin', value: 'issue' },
              ]}
            />
          }
          onCancel={closeAndReset}
          cancelText="Tutup"
        />
      }
      destroyOnHidden
    >
      {/* Panel kamera seragam — shared ScanCamera (pilih kamera, torch, flash) */}
      <ScanCamera
        key={retryKey}
        active={open}
        paused={target !== null || resolving}
        onCode={(raw) => void handleRaw(raw)}
        hint="Kartu santri, surat izin, atau QR lain yang berisi kode registrasi"
        onRetry={() => setRetryKey((k) => k + 1)}
      />

      {/* Hasil scan — kartu aksi */}
      {target?.kind === 'permit' && (
        <ScanActionCard
          title={formatDisplayName(target.permit.student?.name ?? 'Santri')}
          subtitle={`${target.permit.student?.registration_code ?? ''} · ${target.permit.student?.classes?.name ?? '-'}`}
          extra={`Tujuan: ${target.permit.destination}`}
          status={effectiveStatus(target.permit)}
          actions={
            <>
              {target.permit.status === 'issued' && (
                <Button type="primary" block loading={actionBusy === 'depart'} onClick={() => void handleGateAction(target.permit, 'depart')} icon={<SendOutlined />}>
                  Proses Berangkat
                </Button>
              )}
              {['departed', 'overdue'].includes(target.permit.status) && (
                <Button type="primary" block loading={actionBusy === 'return'} onClick={() => void handleGateAction(target.permit, 'return')} icon={<CheckCircleOutlined />}>
                  Proses Kembali
                </Button>
              )}
              {['returned', 'cancelled'].includes(target.permit.status) && (
                <Alert type="info" showIcon message="Izin ini sudah selesai diproses" />
              )}
              <Button block onClick={resetTarget}>Scan Lagi</Button>
            </>
          }
        />
      )}

      {target?.kind === 'student' && (
        <ScanActionCard
          title={formatDisplayName(target.student.name)}
          subtitle={`${target.student.registration_code} · ${target.student.classes?.name ?? '-'}`}
          actions={
            <>
              {target.actives.length === 0 && (
                <Alert type="warning" showIcon message="Tidak ada izin aktif untuk santri ini" />
              )}
              {target.actives.map((p) => (
                <div key={p.id} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
                    {p.destination} · batas {new Date(p.return_deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {p.status === 'issued' && (
                    <Button type="primary" block loading={actionBusy === 'depart'} onClick={() => void handleGateAction(p, 'depart')} icon={<SendOutlined />}>
                      Proses Berangkat
                    </Button>
                  )}
                  {p.status === 'departed' && (
                    <Button type="primary" block loading={actionBusy === 'return'} onClick={() => void handleGateAction(p, 'return')} icon={<CheckCircleOutlined />}>
                      Proses Kembali
                    </Button>
                  )}
                </div>
              ))}
              <Button block onClick={resetTarget}>Scan Lagi</Button>
            </>
          }
        />
      )}

      {target?.kind === 'issue-ready' && (
        <ScanActionCard
          title={formatDisplayName(target.student.name)}
          subtitle={`${target.student.registration_code} · ${target.student.classes?.name ?? '-'}`}
          actions={
            <>
              <Button
                type="primary"
                block
                icon={<SendOutlined />}
                onClick={() => {
                  closeAndReset()
                  onIssueForStudent(target.student)
                }}
              >
                Lanjutkan Terbitkan Izin
              </Button>
              <Button block onClick={resetTarget}>Scan Lagi</Button>
            </>
          }
        />
      )}

      {target?.kind === 'not-found' && (
        <ScanActionCard
          title="Tidak dikenali"
          subtitle={`Kode: ${target.raw}`}
          actions={
            <>
              <Alert type="error" showIcon message="Kode tidak ditemukan di data santri" />
              <Button block onClick={resetTarget}>Scan Lagi</Button>
            </>
          }
        />
      )}

      {/* Input manual — selalu tersedia sebagai fallback */}
      <Space.Compact style={{ width: '100%', marginTop: 12 }}>
        <Input
          placeholder="Atau ketik kode registrasi (mis. REG-001)"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onPressEnter={() => manualCode.trim() && void resolveCode(manualCode.trim().toUpperCase())}
          allowClear
        />
        <Button
          type="primary"
          disabled={!manualCode.trim()}
          loading={resolving}
          onClick={() => void resolveCode(manualCode.trim().toUpperCase())}
        >
          Proses
        </Button>
      </Space.Compact>
    </AppModal>
  )
}

function ScanActionCard({
  title,
  subtitle,
  extra,
  status,
  actions,
}: {
  title: string
  subtitle?: string
  extra?: string
  status?: string
  actions: React.ReactNode
}) {
  const { token } = theme.useToken()
  return (
    <div className="scan-result-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <CheckCircleOutlined style={{ fontSize: 22, color: token.colorSuccess }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: token.colorTextTertiary }}>{subtitle}</div>}
        </div>
        {status && <Tag color={status === 'overdue' ? 'red' : status === 'departed' ? 'orange' : 'blue'}>{status}</Tag>}
      </div>
      {extra && <div style={{ fontSize: 12.5, marginBottom: 10, color: token.colorTextSecondary }}>{extra}</div>}
      <div style={{ display: 'grid', gap: 8 }}>{actions}</div>
    </div>
  )
}
