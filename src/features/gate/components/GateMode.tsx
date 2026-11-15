import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Alert, App, Button, Empty, Input } from 'antd'
import {
  CheckCircleOutlined,
  CloseOutlined,
  FullscreenOutlined,
  GatewayOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { ScanCamera } from '../../../shared/scan/ScanCamera'
import { scannerBeep, scannerVibrate } from '../../../shared/scan/useQrScanner'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { fetchPermitStudentByCode } from '../../leave-permit/api'
import { extractPermitRef, extractScannedCode } from '../../leave-permit/permitValidation'
import { effectiveStatus, formatPermitDateTime } from '../../leave-permit/permitUtils'
import type { LeavePermit, PermitStudentBrief } from '../../leave-permit/types'

interface GateModeProps {
  open: boolean
  onClose: () => void
  /** Seluruh izin ter-load dari halaman — resolve hasil scan & daftar live */
  permits: LeavePermit[]
  onGateAction: (permit: LeavePermit, action: 'depart' | 'return') => Promise<unknown>
  /** Santri discan tapi tak ada izin aktif → lanjut terbitkan lewat form */
  onIssueForStudent: (s: PermitStudentBrief) => void
}

type GateTarget =
  | { kind: 'permit'; permit: LeavePermit }
  | { kind: 'student'; student: PermitStudentBrief; actives: LeavePermit[] }
  | { kind: 'not-found'; raw: string }

interface ActivityItem {
  id: string
  name: string
  action: 'depart' | 'return'
  at: number
}

function useClock(active: boolean) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [active])
  return now
}

/**
 * Mode Gerbang fullscreen — stasiun kerja satpam/pengasuh:
 * jam besar, kamera scan raksasa, daftar "Sedang Keluar" live,
 * tombol aksi besar untuk sentuhan. Bisa dibuka via ?gate=1.
 */
export function GateMode({ open, onClose, permits, onGateAction, onIssueForStudent }: GateModeProps) {
  const { message } = App.useApp()
  const now = useClock(open)

  const [manualCode, setManualCode] = useState('')
  const [search, setSearch] = useState('')
  const [resolving, setResolving] = useState(false)
  const [target, setTarget] = useState<GateTarget | null>(null)
  const [actionBusy, setActionBusy] = useState<'depart' | 'return' | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  /** Naikkan untuk me-remount ScanCamera → restart kamera (tombol Coba Lagi) */
  const [retryKey, setRetryKey] = useState(0)

  const activePermits = useMemo(
    () => permits.filter((p) => p.status === 'issued' || p.status === 'departed'),
    [permits],
  )
  const outList = useMemo(
    () =>
      activePermits
        .filter((p) => p.status === 'departed')
        .sort((a, b) => a.return_deadline.localeCompare(b.return_deadline)),
    [activePermits],
  )
  const filteredOut = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return outList
    return outList.filter((p) =>
      `${p.student?.name ?? ''} ${p.student?.registration_code ?? ''} ${p.destination}`.toLowerCase().includes(q),
    )
  }, [outList, search])

  const resolveCode = useCallback(
    async (code: string) => {
      setResolving(true)
      try {
        const byPermitCode = permits.find((p) => p.student?.registration_code.toUpperCase() === code)
        if (byPermitCode) {
          scannerBeep()
          scannerVibrate()
          setTarget({ kind: 'permit', permit: byPermitCode })
          return
        }
        const student = await fetchPermitStudentByCode(code)
        scannerBeep()
        scannerVibrate()
        if (!student) {
          setTarget({ kind: 'not-found', raw: code })
          return
        }
        setTarget({
          kind: 'student',
          student,
          actives: activePermits.filter((p) => p.student_id === student.id),
        })
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Gagal mengenali kode')
      } finally {
        setResolving(false)
      }
    },
    [permits, activePermits, message],
  )

  const handleRaw = useCallback(
    async (raw: string) => {
      const permitRefId = extractPermitRef(raw)
      if (permitRefId) {
        const permit = permits.find((p) => p.id === permitRefId)
        scannerBeep()
        scannerVibrate()
        setTarget(
          permit ? { kind: 'permit', permit } : { kind: 'not-found', raw: `Izin ${permitRefId.slice(0, 8).toUpperCase()}` },
        )
        return
      }
      const code = extractScannedCode(raw)
      if (!code) return
      await resolveCode(code)
    },
    [permits, resolveCode],
  )

  const resetTarget = () => setTarget(null)

  const runAction = async (permit: LeavePermit, action: 'depart' | 'return') => {
    setActionBusy(action)
    try {
      await onGateAction(permit, action)
      // Toast sukses ditampilkan oleh handler halaman (handleDepart/handleReturn)
      const name = formatDisplayName(permit.student?.name ?? 'Santri')
      setActivity((prev) =>
        [{ id: `${permit.id}-${action}-${Date.now()}`, name, action, at: Date.now() }, ...prev].slice(0, 5),
      )
      resetTarget()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal memproses izin')
    } finally {
      setActionBusy(null)
    }
  }

  /** Keluar mode gerbang + bersihkan state agar buka berikutnya mulai dari nol */
  const closeAndReset = () => {
    setTarget(null)
    setManualCode('')
    setSearch('')
    setActionBusy(null)
    onClose()
  }

  // Esc = keluar mode gerbang
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(document.activeElement instanceof HTMLInputElement)) closeAndReset()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose])

  if (!open) return null

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen()
    } catch {
      // fullscreen opsional
    }
  }

  const renderActionButtons = (permit: LeavePermit) => (
    <>
      {permit.status === 'issued' && (
        <Button
          type="primary"
          size="large"
          className="gate-action-btn"
          icon={<SendOutlined />}
          loading={actionBusy === 'depart'}
          onClick={() => void runAction(permit, 'depart')}
        >
          PROSES BERANGKAT
        </Button>
      )}
      {['departed', 'overdue'].includes(permit.status) && (
        <Button
          type="primary"
          size="large"
          className="gate-action-btn"
          danger={effectiveStatus(permit) === 'overdue'}
          icon={<CheckCircleOutlined />}
          loading={actionBusy === 'return'}
          onClick={() => void runAction(permit, 'return')}
        >
          PROSES KEMBALI
        </Button>
      )}
      {['returned', 'cancelled'].includes(permit.status) && (
        <Alert type="info" showIcon message="Izin ini sudah selesai diproses" />
      )}
      <Button size="large" className="gate-scan-again" onClick={resetTarget}>
        Scan Lagi
      </Button>
    </>
  )

  return createPortal(
    <div className="gate-root">
      <header className="gate-header">
        <div className="gate-title">
          <GatewayOutlined />
          <span>Mode Gerbang</span>
        </div>
        <div className="gate-clock">
          {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          <span className="gate-date">
            {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="gate-header-actions">
          <Button type="text" icon={<FullscreenOutlined />} onClick={toggleFullscreen} title="Layar penuh" />
          <Button type="text" danger icon={<CloseOutlined />} onClick={closeAndReset} title="Keluar (Esc)" />
        </div>
      </header>

      <div className="gate-body">
        {/* Kiri: scanner + kartu aksi besar */}
        <section className="gate-scan-col">
          <ScanCamera
            key={retryKey}
            active={open}
            paused={target !== null || resolving}
            onCode={(raw) => void handleRaw(raw)}
            hint="Arahkan kartu santri atau surat izin ke kamera"
            onRetry={() => setRetryKey((k) => k + 1)}
          />

          {/* Kartu hasil scan — tombol raksasa di bawah kamera */}
          {target?.kind === 'permit' && (
            <div className="gate-result">
              <div className="gate-result-name">{formatDisplayName(target.permit.student?.name ?? 'Santri')}</div>
              <div className="gate-result-sub">
                {target.permit.student?.registration_code ?? ''} · {target.permit.student?.classes?.name ?? '—'} ·{' '}
                {target.permit.destination}
              </div>
              <div className="gate-result-actions">{renderActionButtons(target.permit)}</div>
            </div>
          )}
          {target?.kind === 'student' && (
            <div className="gate-result">
              <div className="gate-result-name">{formatDisplayName(target.student.name)}</div>
              <div className="gate-result-sub">
                {target.student.registration_code} · {target.student.classes?.name ?? '—'}
              </div>
              {target.actives.length === 0 ? (
                <div className="gate-result-actions">
                  <Alert type="warning" showIcon message="Tidak ada izin aktif untuk santri ini" />
                  <Button
                    type="primary"
                    size="large"
                    className="gate-action-btn"
                    icon={<SendOutlined />}
                    onClick={() => {
                      closeAndReset()
                      onIssueForStudent(target.student)
                    }}
                  >
                    TERBITKAN IZIN BARU
                  </Button>
                  <Button size="large" className="gate-scan-again" onClick={resetTarget}>
                    Scan Lagi
                  </Button>
                </div>
              ) : (
                <div className="gate-result-actions">
                  {target.actives.map((p) => (
                    <div key={p.id} style={{ display: 'grid', gap: 8 }}>
                      <div className="gate-result-sub">{p.destination} · batas {formatPermitDateTime(p.return_deadline)}</div>
                      {p.status === 'issued' && (
                        <Button type="primary" size="large" className="gate-action-btn" icon={<SendOutlined />} loading={actionBusy === 'depart'} onClick={() => void runAction(p, 'depart')}>
                          PROSES BERANGKAT
                        </Button>
                      )}
                      {p.status === 'departed' && (
                        <Button type="primary" size="large" className="gate-action-btn" icon={<CheckCircleOutlined />} loading={actionBusy === 'return'} onClick={() => void runAction(p, 'return')}>
                          PROSES KEMBALI
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button size="large" className="gate-scan-again" onClick={resetTarget}>
                    Scan Lagi
                  </Button>
                </div>
              )}
            </div>
          )}
          {target?.kind === 'not-found' && (
            <div className="gate-result">
              <div className="gate-result-name">Tidak dikenali</div>
              <div className="gate-result-sub">Kode: {target.raw}</div>
              <div className="gate-result-actions">
                <Alert type="error" showIcon message="Kode tidak ditemukan di data santri" />
                <Button size="large" className="gate-scan-again" onClick={resetTarget}>
                  Scan Lagi
                </Button>
              </div>
            </div>
          )}

          <Input
            className="gate-manual"
            placeholder="Atau ketik kode registrasi (mis. REG-001) lalu Enter"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onPressEnter={() => {
              if (manualCode.trim()) void resolveCode(manualCode.trim().toUpperCase())
            }}
            allowClear
            size="large"
          />
        </section>

        {/* Kanan: daftar live sedang keluar */}
        <section className="gate-list-col">
          <div className="gate-list-head">
            <span className="gate-list-title">Sedang Keluar</span>
            <span className="gate-list-count">{outList.length}</span>
          </div>
          <Input
            placeholder="Cari santri di daftar…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <div className="gate-list">
            {filteredOut.length === 0 && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada santri di luar" />
            )}
            {filteredOut.map((p) => {
              const late = effectiveStatus(p) === 'overdue'
              return (
                <div key={p.id} className={`gate-list-item${late ? ' is-late' : ''}`}>
                  <div className="gate-list-info">
                    <div className="gate-list-name">{formatDisplayName(p.student?.name ?? 'Santri')}</div>
                    <div className="gate-list-sub">
                      {p.student?.classes?.name ?? '—'} · {p.destination}
                    </div>
                    <div className={`gate-list-deadline${late ? ' is-late' : ''}`}>
                      batas {formatPermitDateTime(p.return_deadline)}
                    </div>
                  </div>
                  <Button
                    type="primary"
                    danger={late}
                    loading={actionBusy === 'return'}
                    onClick={() => void runAction(p, 'return')}
                    icon={<CheckCircleOutlined />}
                  >
                    Kembali
                  </Button>
                </div>
              )
            })}
          </div>

          {activity.length > 0 && (
            <div className="gate-activity">
              <div className="gate-activity-title">Baru Diproses</div>
              {activity.map((a) => (
                <div key={a.id} className="gate-activity-item">
                  <CheckCircleOutlined style={{ color: '#10b981' }} />
                  <span>
                    {a.name} — {a.action === 'depart' ? 'berangkat' : 'kembali'}
                  </span>
                  <span className="gate-activity-time">
                    {new Date(a.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body,
  )
}
