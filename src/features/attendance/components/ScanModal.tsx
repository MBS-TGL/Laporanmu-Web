import { useEffect, useRef, useState } from 'react'
import { Input, Segmented, Select, Space, Tag, theme } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  MinusCircleOutlined,
  ScanOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { ModalFooter } from '../../../shared/components/ModalFooter'
import { ScanCamera } from '../../../shared/scan/ScanCamera'
import { scannerBeep, scannerBeepFail, scannerVibrate } from '../../../shared/scan/useQrScanner'
import { MONTH_NAMES, STATUS_META, STATUS_ORDER, WEEKDAY_SHORT, normalizeCode } from '../constants'
import type { AttendanceStatus } from '../types'
import type { ReportCardStudent } from '../../report-cards/types'

/**
 * Scan QR kartu pelajar → tandai absensi.
 * QR kartu pelajar berisi `${origin}/check?code={registration_code}` — param `code`
 * diekstrak; teks mentah juga diterima sebagai kode langsung.
 * Mesin kamera diseragamkan lewat shared ScanCamera (BarcodeDetector + jsQR).
 *
 * Kamera di-mount ulang setiap kali modal dibuka ({open && <ScanCamera/>}) —
 * state sesi selalu segar dan stream berhenti otomatis saat unmount.
 */

interface ScanLogEntry {
  key: number
  name: string
  status: AttendanceStatus
  day: number
  kind: 'ok' | 'sama' | 'unknown'
  detail?: string
}

interface Props {
  open: boolean
  onClose: () => void
  students: ReportCardStudent[]
  year: number
  month: number
  daysInMonth: number
  initialDay: number
  getCurrent: (studentId: string, day: number) => AttendanceStatus | ''
  onMark: (studentId: string, day: number, status: AttendanceStatus) => void
}

/** QR `/check?code=XXX&pin=...` → kode; teks mentah dianggap kode langsung */
function extractRegistrationCode(raw: string): string | null {
  const text = raw.trim()
  if (!text) return null
  if (text.includes('/check') || /^https?:\/\//i.test(text)) {
    try {
      const code = new URL(text).searchParams.get('code')
      if (code) return normalizeCode(code)
    } catch {
      /* URL tidak valid — lanjut ke teks mentah */
    }
  }
  return normalizeCode(text) || null
}

const LOG_LIMIT = 7

export function ScanModal(props: Props) {
  return (
    <AppModal
      title="Scan Kartu Pelajar"
      subtitle="Arahkan QR kartu santri ke kamera, status langsung tercatat di grid"
      icon={<ScanOutlined />}
      open={props.open}
      onCancel={props.onClose}
      width={560}
      footer={<ModalFooter onCancel={props.onClose} cancelText="Tutup" />}
      destroyOnHidden
    >
      {props.open && <ScanSession {...props} />}
    </AppModal>
  )
}

function ScanSession({ students, year, month, daysInMonth, initialDay, getCurrent, onMark }: Props) {
  const { token } = theme.useToken()

  const [day, setDay] = useState(initialDay)
  const [status, setStatus] = useState<AttendanceStatus>('H')
  const [log, setLog] = useState<ScanLogEntry[]>([])
  const [manualCode, setManualCode] = useState('')
  const [cameraNonce, setCameraNonce] = useState(0)

  const cooldownRef = useRef(new Map<string, number>())
  const lastUnknownRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const logKeyRef = useRef(0)

  // Nilai terbaru untuk loop kamera tanpa restart saat state berubah
  const latest = useRef({ students, day, status, getCurrent, onMark })
  const pushLog = (entry: Omit<ScanLogEntry, 'key'>) => {
    logKeyRef.current += 1
    setLog((prev) => [{ key: logKeyRef.current, ...entry }, ...prev].slice(0, LOG_LIMIT))
  }

  const handleText = (raw: string) => {
    const code = extractRegistrationCode(raw)
    if (!code) return

    const { students: roster, day: d, status: st, getCurrent: current, onMark: mark } = latest.current
    const student = roster.find((s) => normalizeCode(s.registration_code) === code)

    if (!student) {
      const now = Date.now()
      if (lastUnknownRef.current.text === code && now - lastUnknownRef.current.at < 2000) return
      lastUnknownRef.current = { text: code, at: now }
      scannerBeepFail()
      pushLog({ name: code, status: st, day: d, kind: 'unknown', detail: 'Kode tidak ada di kelas ini' })
      return
    }

    const now = Date.now()
    const last = cooldownRef.current.get(student.id)
    if (last && now - last < 1200) return
    cooldownRef.current.set(student.id, now)

    const existing = current(student.id, d)
    if (existing === st) {
      pushLog({ name: student.name, status: st, day: d, kind: 'sama', detail: `Sudah tercatat ${STATUS_META[st].label}` })
      scannerBeep()
      return
    }

    mark(student.id, d, st)
    scannerBeep()
    scannerVibrate()
    pushLog({
      name: student.name,
      status: st,
      day: d,
      kind: 'ok',
      detail: existing ? `Sebelumnya ${STATUS_META[existing].label}` : undefined,
    })
  }
  const handleTextRef = useRef(handleText)

  // sinkronkan nilai terbaru & handler terkini setelah setiap render (bukan saat render)
  useEffect(() => {
    latest.current = { students, day, status, getCurrent, onMark }
    handleTextRef.current = handleText
  })

  const handleManualSubmit = () => {
    const v = manualCode.trim()
    if (!v) return
    handleTextRef.current(v)
    setManualCode('')
  }

  const dayLabel = `${WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`

  const sessionStats = (() => {
    const counts = new Map<AttendanceStatus, number>()
    let unknown = 0
    for (const e of log) {
      if (e.kind === 'unknown') unknown++
      else if (e.kind === 'ok') counts.set(e.status, (counts.get(e.status) ?? 0) + 1)
    }
    return { counts, unknown }
  })()

  return (
    <div>
      <Space wrap size="small" style={{ marginBottom: 12 }}>
        <Select
          value={day}
          onChange={(v) => setDay(v as number)}
          style={{ width: 210 }}
          options={Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: `Hari ${i + 1}` }))}
        />
        <Tag style={{ marginInlineEnd: 0 }}>{dayLabel}</Tag>
      </Space>
      <Segmented
        block
        value={status}
        onChange={(v) => setStatus(v as AttendanceStatus)}
        options={STATUS_ORDER.map((s) => ({
          value: s,
          label: (
            <span style={{ color: STATUS_META[s].color, fontWeight: 600 }}>
              {s} · {STATUS_META[s].label}
            </span>
          ),
        }))}
        style={{ marginBottom: 14 }}
      />

      <ScanCamera
        key={cameraNonce}
        active
        cooldownMs={1200}
        onCode={(raw) => handleTextRef.current(raw)}
        onRetry={() => setCameraNonce((n) => n + 1)}
      />

      {/* Input manual — selalu tersedia */}
      <Input.Search
        placeholder="Atau ketik kode registrasi (mis. LPM-0001-001) lalu Enter"
        enterButton="Tandai"
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        onSearch={handleManualSubmit}
        style={{ marginBottom: 14, marginTop: 12 }}
      />

      {/* Log hasil scan sesi ini */}
      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 10,
          padding: 10,
          background: token.colorFillQuaternary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Hasil scan sesi ini</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
            {STATUS_ORDER.map((s) =>
              sessionStats.counts.get(s) ? (
                <Tag key={s} style={{ marginInlineEnd: 0, color: STATUS_META[s].color, fontWeight: 700 }}>
                  {s}×{sessionStats.counts.get(s)}
                </Tag>
              ) : null,
            )}
            {sessionStats.unknown > 0 && (
              <Tag color="red" style={{ marginInlineEnd: 0 }}>
                ?×{sessionStats.unknown}
              </Tag>
            )}
          </span>
        </div>

        {log.length === 0 ? (
          <div style={{ fontSize: 12.5, color: token.colorTextTertiary, padding: '6px 2px' }}>
            Belum ada kartu yang discan. Setiap scan masuk ke draf absensi, klik Simpan Absensi untuk menyimpan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {log.map((e) => {
              const icon =
                e.kind === 'ok' ? (
                  <CheckCircleFilled style={{ color: STATUS_META[e.status].color }} />
                ) : e.kind === 'sama' ? (
                  <MinusCircleOutlined style={{ color: token.colorTextTertiary }} />
                ) : (
                  <CloseCircleFilled style={{ color: token.colorError }} />
                )
              return (
                <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  {icon}
                  <span
                    style={{
                      fontWeight: 600,
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {e.name}
                  </span>
                  {e.detail && <span style={{ fontSize: 11.5, color: token.colorTextTertiary }}>{e.detail}</span>}
                  <Tag color={STATUS_META[e.status].color} style={{ marginInlineEnd: 0 }}>
                    {e.status} · hari {e.day}
                  </Tag>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
