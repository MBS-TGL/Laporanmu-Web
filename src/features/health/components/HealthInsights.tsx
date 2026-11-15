import { useMemo, useState } from 'react'
import { App, Button, Card, Empty, Segmented, Space, Spin, Tag, Tooltip, Typography, theme } from 'antd'
import { BulbOutlined, CaretRightOutlined, CopyOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { callAi } from '../../../shared/lib/ai'
import { RESTING_STATUSES } from '../constants'
import {
  computeMedicineUsage,
  countByClass,
  countTodayVisits,
  countVisitsPerDay,
  movingAverageDaily,
  pctDelta,
  shiftDate,
  topComplaintKeywords,
} from '../stats'
import type { HealthLog, HealthMedicine } from '../types'

interface HealthInsightsProps {
  logs: HealthLog[]
  medicines: HealthMedicine[]
  today: string
  /** Klik keluhan → isi pencarian rekam medis; klik kelas → filter kelas */
  onSearchComplaint?: (term: string) => void
  onFilterClass?: (className: string) => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Text strong style={{ fontSize: 12.5 }}>
      {children}
    </Typography.Text>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
      {children}
    </Typography.Text>
  )
}

/** Renderer mini jawaban AI: heading "## " dan bullet "- " (sama dengan InsightsPage). */
function InsightText({ text }: { text: string }) {
  const { token } = theme.useToken()
  const lines = text.split('\n')
  const blocks: React.ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={key} style={{ margin: '6px 0 6px', paddingLeft: 20 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            {b}
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line) {
      flushBullets(`ul-${index}`)
      return
    }
    if (line.startsWith('## ')) {
      flushBullets(`ul-${index}`)
      blocks.push(
        <Typography.Title level={5} key={`h-${index}`} style={{ marginTop: 14, marginBottom: 4 }}>
          {line.slice(3)}
        </Typography.Title>,
      )
      return
    }
    if (line.startsWith('- ')) {
      bullets.push(line.slice(2))
      return
    }
    flushBullets(`ul-${index}`)
    blocks.push(
      <p key={`p-${index}`} style={{ margin: '6px 0' }}>
        {line}
      </p>,
    )
  })
  flushBullets('ul-end')

  return <div style={{ color: token.colorText }}>{blocks}</div>
}

const AI_SYSTEM = `Kamu analis kesehatan sekolah pondok (poskestren/UKS). Analisis HANYA dari angka yang diberikan — dilarang mengarang data.
Format jawaban: Bahasa Indonesia, maksimal ~180 kata, gunakan heading "## " dan bullet "- ".
Struktur: ringkasan singkat, pola kunjungan, keluhan dominan, stok obat, lalu 2-3 rekomendasi konkret untuk pengelola UKS.`

function buildPrompt(logs: HealthLog[], medicines: HealthMedicine[], today: string): string {
  const cutoff30 = shiftDate(today, -29)
  const last30 = logs.filter((l) => l.date >= cutoff30 && l.date <= today)
  const trend = countVisitsPerDay(logs, 14, today)
  const total14 = trend.reduce((a, t) => a + t.count, 0)
  const peak = trend.reduce((a, t) => (t.count > a.count ? t : a), trend[0])
  const resting = logs.filter((l) => RESTING_STATUSES.includes(l.status))
  const lowStock = medicines.filter((m) => m.stock <= m.min_stock)
  const usage = computeMedicineUsage(logs, 30, today)
  const usageTop = medicines
    .map((m) => ({ name: m.name, used: usage.get(m.id) ?? 0 }))
    .filter((m) => m.used > 0)
    .sort((a, b) => b.used - a.used)
    .slice(0, 5)

  return [
    `Data kesehatan santri per ${today}:`,
    `- Total rekam medis (seluruh periode): ${logs.length}`,
    `- Kunjungan hari ini: ${countTodayVisits(logs, today)}`,
    `- Kunjungan 30 hari terakhir: ${last30.length}`,
    `- Kunjungan 14 hari terakhir: ${total14} (rata-rata ${(total14 / 14).toFixed(1)}/hari, puncak ${peak?.date ?? '-'} = ${peak?.count ?? 0} kunjungan)`,
    `- Sedang observasi (UKS/asrama): ${resting.length} (${resting.map((r) => `${r.student_name} [${r.status}]`).slice(0, 10).join(', ') || '-'})`,
    `- Keluhan tersering: ${topComplaintKeywords(last30.length > 0 ? last30 : logs, 6).map((k) => `${k.label} ${k.count}x`).join(', ') || '-'}`,
    `- Kunjungan per kelas: ${countByClass(last30).slice(0, 6).map((c) => `${c.label} ${c.count}`).join(', ') || '-'}`,
    `- Pemakaian obat 30 hari: ${usageTop.map((u) => `${u.name} ${u.used}x`).join(', ') || '-'}`,
    `- Stok kritis: ${lowStock.map((m) => `${m.name} (${m.stock}/${m.min_stock})`).join(', ') || 'tidak ada'}`,
    'Analisis data ini untuk pengelola UKS pondok.',
  ].join('\n')
}

/** Kartu insight kesehatan: KPI + tren + keluhan/kelas + ringkasan AI. Collapsible. */
export function HealthInsights({
  logs,
  medicines,
  today,
  onSearchComplaint,
  onFilterClass,
}: HealthInsightsProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()

  const [range, setRange] = useState<14 | 30>(14)
  const [aiText, setAiText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [insightOpen, setInsightOpen] = useState(false)

  const toggleInsight = () => setInsightOpen((v) => !v)

  const trend = useMemo(() => countVisitsPerDay(logs, range, today), [logs, range, today])
  const avgLine = useMemo(() => movingAverageDaily(trend, 7), [trend])
  const keywords = useMemo(() => topComplaintKeywords(logs, 5), [logs])
  const classes = useMemo(() => countByClass(logs).slice(0, 5), [logs])
  const maxClass = classes[0]?.count ?? 0
  const maxKeyword = keywords[0]?.count ?? 0

  const totalRange = trend.reduce((a, t) => a + t.count, 0)
  const peak = trend.reduce((a, t) => (t.count > a.count ? t : a), trend[0])
  const avgDaily = trend.length > 0 ? Math.round((totalRange / trend.length) * 10) / 10 : 0
  const noDataAtAll = logs.length === 0
  const windowEmpty = totalRange === 0

  // Baseline delta: total 7 hari SEBELUM hari ini
  const prev7Total = useMemo(() => {
    const start = shiftDate(today, -7)
    const end = shiftDate(today, -1)
    return logs.filter((l) => l.date >= start && l.date <= end).length
  }, [logs, today])
  const todayDelta = pctDelta(countTodayVisits(logs, today), Math.round((prev7Total / 7) * 10) / 10)

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const text = await callAi({ system: AI_SYSTEM, prompt: buildPrompt(logs, medicines, today), maxOutputTokens: 1024 })
      setAiText(text)
      if (text.startsWith('Maaf') || text.startsWith('Tidak bisa') || text.startsWith('API Key')) {
        message.warning('Jawaban AI tidak optimal, periksa koneksi atau API key')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal menghasilkan ringkasan')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiText)
      message.success('Ringkasan AI disalin')
    } catch {
      message.error('Gagal menyalin')
    }
  }

  const chartData = trend.map((t, i) => ({
    date: t.date,
    label: `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}`,
    weekday: new Date(`${t.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short' }),
    count: t.count,
    avg: avgLine[i],
  }))

  const panelStyle: React.CSSProperties = {
    flex: '0 1 320px',
    minWidth: 260,
    alignSelf: 'stretch',
    background: token.colorFillQuaternary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: 8,
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }

  const rowStyle = (clickable: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: clickable ? 'pointer' : 'default',
    borderRadius: 6,
    padding: '2px 4px',
    margin: '-2px -4px',
  })

  const barTrackStyle: React.CSSProperties = {
    flex: 1,
    height: 6,
    borderRadius: 3,
    background: token.colorFillSecondary,
    overflow: 'hidden',
  }

  return (
    <Card
      size="small"
      title={
        <Space size={6} style={{ cursor: 'pointer', userSelect: 'none' }} onClick={toggleInsight}>
          <BulbOutlined style={{ color: token.colorWarning }} />
          <span>Insight Kesehatan</span>
        </Space>
      }
      extra={
        <Space size={8} onClick={(e) => e.stopPropagation()}>
          {aiText && !generating && (
            <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy()}>
              Salin
            </Button>
          )}
          {noDataAtAll ? (
            <Tooltip title="Belum ada data untuk dianalisis">
              <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} disabled>
                Ringkasan AI
              </Button>
            </Tooltip>
          ) : (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              loading={generating}
              onClick={() => void handleGenerate()}
            >
              Ringkasan AI
            </Button>
          )}
          <Button
            type="text"
            size="small"
            aria-label={insightOpen ? 'Tutup insight' : 'Buka insight'}
            icon={<CaretRightOutlined rotate={insightOpen ? 90 : 0} />}
            onClick={toggleInsight}
          />
        </Space>
      }
      style={{ marginBottom: 16 }}
    >
      {insightOpen && (
        <>
          {noDataAtAll ? (
            /* Tier 1: belum ada rekam sama sekali — panduan singkat */
            <div style={{ padding: '12px 0 4px', textAlign: 'center' }}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical" size={4} style={{ maxWidth: 400 }}>
                    <Typography.Text strong>Belum ada rekam medis tercatat</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                      Tambahkan kunjungan pertama atau impor data Excel/CSV — tren kunjungan, keluhan
                      tersering, dan ringkasan AI akan terisi otomatis.
                    </Typography.Text>
                  </Space>
                }
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'stretch' }}>
              {/* Kiri: tren kunjungan */}
              <div style={{ flex: '1 1 340px', minWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                    Kunjungan {range} hari terakhir
                  </Typography.Text>
                  <Tag color="processing" style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '17px', borderRadius: 999 }}>
                    total {totalRange} · {avgDaily}/hari
                  </Tag>
                  {todayDelta !== null && (
                    <Tooltip title={`Hari ini vs rata-rata 7 hari sebelumnya (${(prev7Total / 7).toFixed(1)}/hari)`}>
                      <Tag
                        color={todayDelta > 0 ? 'red' : 'green'}
                        style={{ fontSize: 11, lineHeight: '16px', marginInlineEnd: 0, borderRadius: 999 }}
                      >
                        hari ini {todayDelta > 0 ? '▲' : '▼'} {Math.abs(todayDelta)}%
                      </Tag>
                    </Tooltip>
                  )}
                  {peak && peak.count > 0 && (
                    <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                      puncak {peak.date.slice(8, 10)}/{peak.date.slice(5, 7)} · {peak.count} kunjungan
                    </Typography.Text>
                  )}
                  <span style={{ flex: 1 }} />
                  <Segmented
                    size="small"
                    value={range}
                    onChange={(v) => setRange(v as 14 | 30)}
                    options={[
                      { value: 14, label: '14 hari' },
                      { value: 30, label: '30 hari' },
                    ]}
                  />
                </div>
                {windowEmpty ? (
                  /* Tier 2: ada data lama, tapi kosong di jendela terpilih */
                  <div
                    style={{
                      height: 160,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      border: `1px dashed ${token.colorBorderSecondary}`,
                      borderRadius: 8,
                    }}
                  >
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                          Tidak ada kunjungan dalam {range} hari terakhir
                        </Typography.Text>
                      }
                    />
                    {range === 14 && (
                      <Button size="small" onClick={() => setRange(30)}>
                        Lihat 30 hari
                      </Button>
                    )}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={token.colorBorderSecondary} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval={range === 14 ? 'preserveStartEnd' : 4}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <RTooltip
                        cursor={{ fill: token.colorFillTertiary }}
                        labelFormatter={(label) => {
                          const d = chartData.find((c) => c.label === label)
                          return d
                            ? `${d.weekday}, ${new Date(`${d.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`
                            : String(label)
                        }}
                        contentStyle={{ borderRadius: 8, fontSize: 12.5, border: `1px solid ${token.colorBorderSecondary}` }}
                      />
                      <Bar dataKey="count" name="Kunjungan" radius={[3, 3, 0, 0]} maxBarSize={range === 14 ? 18 : 10}>
                        {chartData.map((d) => (
                          <Cell
                            key={d.date}
                            fill={peak && d.date === peak.date && d.count > 0 ? token.colorPrimary : token.colorPrimaryBgHover}
                          />
                        ))}
                      </Bar>
                      <Line
                        type="monotone"
                        dataKey="avg"
                        name="Rata-rata 7 hari"
                        stroke={token.colorWarning}
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                        dot={false}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Kanan: sidebar interaktif */}
              <div style={panelStyle}>
                <div>
                  <SectionLabel>Keluhan tersering</SectionLabel>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keywords.length === 0 ? (
                      <EmptyHint>Belum ada data keluhan</EmptyHint>
                    ) : (
                      keywords.map((k) => (
                        <div
                          key={k.label}
                          title={onSearchComplaint ? `Filter rekam medis: "${k.label}"` : undefined}
                          onClick={() => onSearchComplaint?.(k.label)}
                          style={rowStyle(!!onSearchComplaint)}
                        >
                          <Typography.Text style={{ fontSize: 12.5, width: 96 }} ellipsis>
                            {k.label}
                          </Typography.Text>
                          <div style={barTrackStyle}>
                            <div
                              style={{
                                width: `${maxKeyword > 0 ? Math.max(6, (k.count / maxKeyword) * 100) : 0}%`,
                                height: '100%',
                                borderRadius: 3,
                                background: token.colorInfo,
                              }}
                            />
                          </div>
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 26, textAlign: 'right' }}
                          >
                            {k.count}×
                          </Typography.Text>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }} />

                <div>
                  <SectionLabel>Kunjungan per kelas</SectionLabel>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {classes.length === 0 ? (
                      <EmptyHint>Belum ada data</EmptyHint>
                    ) : (
                      classes.map((c) => (
                        <div
                          key={c.label}
                          title={onFilterClass ? `Filter kelas: ${c.label}` : undefined}
                          onClick={() => onFilterClass?.(c.label)}
                          style={rowStyle(!!onFilterClass)}
                        >
                          <Typography.Text style={{ fontSize: 12.5, width: 92 }} ellipsis>
                            {c.label}
                          </Typography.Text>
                          <div style={barTrackStyle}>
                            <div
                              style={{
                                width: `${maxClass > 0 ? Math.max(6, (c.count / maxClass) * 100) : 0}%`,
                                height: '100%',
                                borderRadius: 3,
                                background: token.colorPrimary,
                              }}
                            />
                          </div>
                          <Typography.Text
                            style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 20, textAlign: 'right' }}
                          >
                            {c.count}
                          </Typography.Text>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(generating || aiText) && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {generating ? <Spin tip="Menganalisis data kesehatan…" /> : <InsightText text={aiText} />}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
