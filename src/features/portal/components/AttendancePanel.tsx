import { useState } from 'react'
import { Empty, Tooltip, Typography, theme } from 'antd'
import { summarizeDays, type AttendanceStatus, type PortalAttendanceRow } from '../api'

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const DAY_HEADERS = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mn']

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  H: 'Hadir',
  S: 'Sakit',
  I: 'Izin',
  A: 'Alpa',
  P: 'Pulang cepat',
}

/** Warna semantik status (satu sumber untuk sel kalender + legenda). */
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  H: '#10b981',
  S: '#f59e0b',
  I: '#3b82f6',
  A: '#ef4444',
  P: '#64748b',
}

/**
 * Kehadiran bulanan: kalender mini (Senin-awal) dari `days` jsonb +
 * rekap H/S/I/A/P. Tap/hover satu tanggal menampilkan statusnya
 * (interaksi nyata, bukan tooltip hover-saja).
 */
export function AttendancePanel({ rows }: { rows: PortalAttendanceRow[] }) {
  if (rows.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Belum ada catatan kehadiran bulan ini
          </Typography.Text>
        }
      />
    )
  }
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {rows.map((row) => (
        <MonthCalendar key={`${row.year}-${row.month}`} row={row} />
      ))}
    </div>
  )
}

function MonthCalendar({ row }: { row: PortalAttendanceRow }) {
  const { token: t } = theme.useToken()
  const [active, setActive] = useState<number | null>(null)

  const s = summarizeDays(row.days)
  const total = s.H + s.S + s.I + s.A + s.P
  const pct = total > 0 ? Math.round((s.H / total) * 100) : null

  const daysInMonth = new Date(row.year, row.month, 0).getDate()
  // Offset Senin-awal: JS getDay() 0=Minggu
  const firstWeekday = (new Date(row.year, row.month - 1, 1).getDay() + 6) % 7

  const activeStatus = active !== null ? (row.days[String(active)] as AttendanceStatus | undefined) : undefined

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {MONTHS_ID[row.month - 1]} {row.year}
        </Typography.Text>
        {pct !== null && (
          <Typography.Text type="secondary" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
            Hadir {pct}%
          </Typography.Text>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
        {DAY_HEADERS.map((d) => (
          <Typography.Text
            key={d}
            type="secondary"
            style={{ fontSize: 10.5, textAlign: 'center', fontWeight: 600 }}
          >
            {d}
          </Typography.Text>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const status = row.days[String(day)] as AttendanceStatus | undefined
          const color = status ? STATUS_COLOR[status] : undefined
          const isActive = active === day
          return (
            <Tooltip key={day} title={status ? `${day} ${MONTHS_ID[row.month - 1]} · ${STATUS_LABEL[status]}` : undefined}>
              <span
                role={status ? 'button' : undefined}
                tabIndex={status ? 0 : undefined}
                onMouseEnter={() => status && setActive(day)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => status && setActive(day)}
                onBlur={() => setActive(null)}
                onClick={() => status && setActive((prev) => (prev === day ? null : day))}
                onKeyDown={(e) => {
                  if (status && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    setActive((prev) => (prev === day ? null : day))
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 36,
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontVariantNumeric: 'tabular-nums',
                  cursor: status ? 'pointer' : 'default',
                  background: color ? `${color}1f` : t.colorFillQuaternary,
                  border: isActive ? `1.5px solid ${color ?? 'transparent'}` : '1.5px solid transparent',
                  color: color ?? t.colorTextTertiary,
                  fontWeight: status ? 600 : 400,
                  outline: 'none',
                }}
              >
                {day}
              </span>
            </Tooltip>
          )
        })}
      </div>

      {/* Detail tanggal aktif: muncul via hover, tap, atau fokus keyboard */}
      <div style={{ minHeight: 20, marginTop: 8 }}>
        {active !== null && activeStatus ? (
          <Typography.Text style={{ fontSize: 12.5 }}>
            {active} {MONTHS_ID[row.month - 1]} · {STATUS_LABEL[activeStatus]}
          </Typography.Text>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(STATUS_COLOR) as AttendanceStatus[])
              .filter((k) => s[k] > 0)
              .map((k) => (
                <span key={k} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, color: t.colorTextSecondary }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: STATUS_COLOR[k] }} />
                  {STATUS_LABEL[k]} <span style={{ fontVariantNumeric: 'tabular-nums' }}>{s[k]}</span>
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
