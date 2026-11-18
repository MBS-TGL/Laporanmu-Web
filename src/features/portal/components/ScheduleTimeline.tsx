import { useEffect, useState } from 'react'
import { Empty, Tag, Typography, theme } from 'antd'
import type { PortalScheduleItem } from '../api'

/**
 * Jadwal hari ini sebagai timeline vertikal: jam di kiri, garis + titik,
 * mapel di kanan. Pelajaran yang sedang berlangsung ditandai indigo
 * (status nyata dari jam perangkat, bukan dekorasi). Perbandingan pakai
 * menit-sejak-tengah-malam agar jadwal lintas tengah malam tetap benar.
 */
export function ScheduleTimeline({ items }: { items: PortalScheduleItem[] }) {
  const { token: t } = theme.useToken()
  const [now, setNow] = useState(() => dayjsTime())

  // Segarkan penanda "berlangsung" tiap menit (interval, bukan animasi loop)
  useEffect(() => {
    const id = window.setInterval(() => setNow(dayjsTime()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Tidak ada jadwal pelajaran untuk hari ini
          </Typography.Text>
        }
      />
    )
  }

  const nowMin = toMinutes(now)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((s, i) => {
        const start = s.start_time.slice(0, 5)
        const end = s.end_time.slice(0, 5)
        const startMin = toMinutes(s.start_time)
        const endMin = toMinutes(s.end_time)
        const crossesMidnight = endMin <= startMin
        const ongoing = crossesMidnight
          ? nowMin >= startMin || nowMin < endMin
          : nowMin >= startMin && nowMin < endMin
        const past = !ongoing && (crossesMidnight ? nowMin >= endMin && nowMin < startMin : nowMin >= endMin)
        const isLast = i === items.length - 1
        return (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            {/* Kolom jam */}
            <Typography.Text
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontSize: 12.5,
                width: 42,
                flexShrink: 0,
                textAlign: 'right',
                color: ongoing ? t.colorPrimary : t.colorTextSecondary,
                fontWeight: ongoing ? 600 : 400,
                paddingTop: 10,
              }}
            >
              {start}
            </Typography.Text>

            {/* Rail: titik + garis */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, flexShrink: 0 }}>
              <span
                style={{
                  width: ongoing ? 10 : 8,
                  height: ongoing ? 10 : 8,
                  borderRadius: 999,
                  marginTop: 13,
                  background: ongoing ? t.colorPrimary : past ? t.colorFillSecondary : t.colorBorder,
                  boxShadow: ongoing ? `0 0 0 3px ${t.colorPrimaryBg}` : undefined,
                  transition: 'background 0.15s',
                }}
              />
              {!isLast && <span style={{ width: 2, flex: 1, minHeight: 18, background: t.colorBorderSecondary }} />}
            </div>

            {/* Konten pelajaran */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 12px 10px',
                marginBottom: isLast ? 0 : 10,
                borderRadius: 10,
                border: `1px solid ${ongoing ? t.colorPrimaryBorder : t.colorBorderSecondary}`,
                background: ongoing ? t.colorPrimaryBg : past ? undefined : '#fff',
                opacity: past ? 0.62 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography.Text strong style={{ fontSize: 13.5 }}>
                  {s.subject ?? 'Tanpa mapel'}
                </Typography.Text>
                {ongoing && (
                  <Tag color="processing" style={{ borderRadius: 6, marginInlineEnd: 0, flexShrink: 0 }}>
                    Berlangsung
                  </Tag>
                )}
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                {end && `${start}–${end}`}
                {s.teacher ? ` · ${s.teacher}` : ''}
                {s.room ? ` · ${s.room}` : ''}
              </Typography.Text>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function dayjsTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
