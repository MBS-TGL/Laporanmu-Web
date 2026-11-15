import { useMemo } from 'react'
import { Card, Col, Empty, Row, Statistic, theme } from 'antd'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import dayjs from 'dayjs'
import { formatDisplayName } from '../../../shared/utils/displayName'
import { effectiveStatus } from '../permitUtils'
import type { LeavePermit } from '../types'

interface Props {
  permits: LeavePermit[]
}

interface ChartItem {
  name: string
  jumlah: number
}

/**
 * Panel insight bulan ini — dihitung penuh di memori dari daftar izin:
 * izin per kelas, top tujuan, rata-rata durasi, dan keterlambatan.
 */
export function PermitInsights({ permits }: Props) {
  const { token } = theme.useToken()

  const data = useMemo(() => {
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
    const month = permits.filter((p) => p.status !== 'cancelled' && p.leave_date >= monthStart)

    // Izin per kelas (top 8)
    const perClassMap = new Map<string, number>()
    for (const p of month) {
      const key = p.student?.classes?.name ?? 'Tanpa Kelas'
      perClassMap.set(key, (perClassMap.get(key) ?? 0) + 1)
    }
    const perClass: ChartItem[] = [...perClassMap.entries()]
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 8)

    // Top tujuan (top 5)
    const perDestMap = new Map<string, number>()
    for (const p of month) {
      const key = p.destination.trim() || '—'
      perDestMap.set(key, (perDestMap.get(key) ?? 0) + 1)
    }
    const topDest: ChartItem[] = [...perDestMap.entries()]
      .map(([name, jumlah]) => ({ name, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
      .slice(0, 5)
    const maxDest = topDest[0]?.jumlah ?? 1

    // Durasi rata-rata (keluar 00:00 → batas kembali)
    let durasiMs = 0
    let durasiCount = 0
    for (const p of month) {
      const start = dayjs(`${p.leave_date}T00:00:00`)
      const end = dayjs(p.return_deadline)
      if (end.isAfter(start)) {
        durasiMs += end.diff(start)
        durasiCount++
      }
    }
    const avgHours = durasiCount > 0 ? durasiMs / durasiCount / 3_600_000 : 0

    // Keterlambatan
    let stillOut = 0
    let lateOut = 0
    let lateReturn = 0
    let returned = 0
    for (const p of permits) {
      const eff = effectiveStatus(p)
      if (p.status === 'cancelled') continue
      if (eff === 'overdue') lateOut++
      if (p.status === 'departed') stillOut++
      if (p.status === 'overdue') lateReturn++
      if (p.status === 'returned') returned++
    }
    const latePct = returned + lateReturn > 0 ? Math.round((lateReturn / (returned + lateReturn)) * 100) : 0

    // Santri paling sering keluar bulan ini
    const perStudent = new Map<string, { name: string; count: number }>()
    for (const p of month) {
      if (!p.student?.name) continue
      const key = p.student_id
      const prev = perStudent.get(key)
      if (prev) prev.count++
      else perStudent.set(key, { name: p.student.name, count: 1 })
    }
    const topStudent = [...perStudent.values()].sort((a, b) => b.count - a.count)[0] ?? null

    return { monthCount: month.length, perClass, topDest, maxDest, avgHours, stillOut, lateOut, lateReturn, latePct, topStudent }
  }, [permits])

  const fmtDurasi = (h: number) => {
    if (h <= 0) return '—'
    if (h < 48) return `${h.toFixed(1).replace('.', ',')} jam`
    return `${(h / 24).toFixed(1).replace('.', ',')} hari`
  }

  return (
    <Card
      style={{ marginBottom: 16 }}
      title="Insight Izin Bulan Ini"
      styles={{ body: { paddingTop: 16 } }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Statistic title="Izin Bulan Ini" value={data.monthCount} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Masih di Luar" value={data.stillOut} valueStyle={{ color: data.stillOut > 0 ? '#d97706' : undefined }} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic
            title="Kembali Terlambat"
            value={data.lateReturn}
            suffix={data.latePct > 0 ? `(${data.latePct}%)` : undefined}
            valueStyle={{ color: data.lateReturn > 0 ? '#dc2626' : undefined }}
          />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Durasi Rata-rata" value={fmtDurasi(data.avgHours)} valueStyle={{ fontSize: 22 }} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Izin per Kelas</div>
          {data.perClass.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada izin bulan ini" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.perClass} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                <XAxis dataKey="name" fontSize={10.5} tickLine={false} interval={0} angle={-18} textAnchor="end" height={52} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="jumlah" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Tujuan Terpopuler</div>
          {data.topDest.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data" />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.topDest.map((d) => (
                <div key={d.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                      {d.name}
                    </span>
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{d.jumlah}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: token.colorFillSecondary }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.round((d.jumlah / data.maxDest) * 100)}%`,
                        borderRadius: 999,
                        background: '#0ea5e9',
                      }}
                    />
                  </div>
                </div>
              ))}
              {data.topStudent && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: token.colorTextSecondary }}>
                  Paling sering:{' '}
                  <strong style={{ color: token.colorText }}>
                    {formatDisplayName(data.topStudent.name)}
                  </strong>{' '}
                  ({data.topStudent.count}× bulan ini)
                </div>
              )}
            </div>
          )}
        </Col>
      </Row>
    </Card>
  )
}
