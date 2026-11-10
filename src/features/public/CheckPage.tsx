import { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  KeyOutlined,
  NotificationOutlined,
  NumberOutlined,
  QuestionCircleOutlined,
  SafetyOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePublicAnnouncements } from '../announcements/hooks'
import { CATEGORY_COLORS } from '../announcements/types'
import { PublicShell } from './PublicShell'
import { PortalCard } from './PortalCard'

// Struktur respons RPC check_student
interface CheckStudentResult {
  student: {
    id: string
    name: string
    registration_code: string
    nisn: string | null
    gender: 'L' | 'P' | null
    status: string
    total_points: number
    class_name: string | null
    dorm_name: string | null
  }
  reports: {
    id: string
    points: number
    notes: string | null
    reported_at: string
    rule_name: string | null
  }[]
  report_cards: {
    month: number
    year: number
    character_score: number | null
    worship_score: number | null
    cleanliness_score: number | null
    quran_score: number | null
    language_score: number | null
    notes: string | null
  }[]
  attendance: {
    year: number
    month: number
    hadir: number
    sakit: number
    izin: number
    alpa: number
    pulang: number
  }[]
  suspensions: {
    id: string
    level: 'SMP' | 'SMA'
    start_date: string
    end_date: string
    status: 'active' | 'completed' | 'cancelled'
  }[]
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const RATE_MAX = 5
const RATE_COOLDOWN_MS = 30_000

function formatCode(raw: string): string {
  const clean = raw.replace(/-/g, '').toUpperCase().slice(0, 11)
  const parts = [clean.slice(0, 3), clean.slice(3, 7), clean.slice(7, 11)].filter(Boolean)
  return parts.join('-')
}

function avgOf(r: CheckStudentResult['report_cards'][number]): number | null {
  const values = [r.character_score, r.worship_score, r.cleanliness_score, r.quran_score, r.language_score].filter(
    (v): v is number => typeof v === 'number',
  )
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

const SUSPENSION_STATUS_LABEL: Record<CheckStudentResult['suspensions'][number]['status'], string> = {
  active: 'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

function formatDateID(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 16px', height: '100%' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  )
}

export function CheckPage() {
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm<{ code: string; pin: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckStudentResult | null>(null)

  useEffect(() => {
    document.title = 'Cek Wali Santri · Laporanmu'
  }, [])

  // Pengumuman publik — cache 5 menit; gagal fetch diperlakukan non-kritis
  const { data: announcements = [] } = usePublicAnnouncements()

  const deepCode = searchParams.get('code') ?? ''
  const deepPin = searchParams.get('pin') ?? ''
  const hasDeepLink = Boolean(deepCode || deepPin)

  const [rateLimited, setRateLimited] = useState(false)

  // dibaca hanya dari event handler (bukan saat render)
  const readAttempts = (): { count: number; until: number } => {
    try {
      const raw = sessionStorage.getItem('laporanmu_check_attempts')
      return raw ? (JSON.parse(raw) as { count: number; until: number }) : { count: 0, until: 0 }
    } catch {
      return { count: 0, until: 0 }
    }
  }

  const doCheck = async (code: string, pin: string) => {
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('check_student', {
      p_code: code,
      p_pin: pin,
    })
    setLoading(false)

    const res = data as unknown as CheckStudentResult | { error: string } | null
    if (rpcError || !res || 'error' in res) {
      // catat percobaan gagal
      const attempts = readAttempts()
      const next =
        Date.now() > attempts.until || attempts.count + 1 >= RATE_MAX
          ? { count: attempts.count + 1, until: Date.now() + RATE_COOLDOWN_MS }
          : { count: attempts.count + 1, until: attempts.until }
      sessionStorage.setItem('laporanmu_check_attempts', JSON.stringify(next))
      setError(
        res && 'error' in res
          ? res.error
          : rpcError?.message || 'Gagal memeriksa data. Coba beberapa saat lagi.',
      )
      return
    }
    sessionStorage.removeItem('laporanmu_check_attempts')
    setResult(res)
  }

  const handleSubmit = async (values: { code: string; pin: string }) => {
    if (Date.now() < readAttempts().until) {
      setRateLimited(true)
      return
    }
    await doCheck(values.code, values.pin)
  }

  const violations = result?.reports.filter((r) => r.points < 0) ?? []
  const achievements = result?.reports.filter((r) => r.points >= 0) ?? []

  return (
    <PublicShell tint="indigo" footerLabel="Portal Wali Santri">
      {result ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card style={{ borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar
                  size={44}
                  style={{ background: '#4f46e5', fontSize: 16, fontWeight: 600, flexShrink: 0 }}
                >
                  {getInitials(result.student.name)}
                </Avatar>
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {result.student.name}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {result.student.class_name ?? '—'} · {result.student.registration_code}
                  </Typography.Text>
                </div>
              </div>
              <Button onClick={() => setResult(null)}>Cek Santri Lain</Button>
            </div>
            <Row gutter={[12, 12]} style={{ marginTop: 18 }}>
              <Col xs={12} sm={8}>
                <StatBox
                  label="Total Poin"
                  value={result.student.total_points}
                  color={result.student.total_points < 0 ? '#dc2626' : '#16a34a'}
                />
              </Col>
              <Col xs={12} sm={8}>
                <StatBox label="Pelanggaran" value={violations.length} color="#0f172a" />
              </Col>
              <Col xs={12} sm={8}>
                <StatBox label="Prestasi" value={achievements.length} color="#16a34a" />
              </Col>
            </Row>
          </Card>

          {result.suspensions.some((s) => s.status === 'active') && (
            <Alert
              type="error"
              showIcon
              message="Santri sedang menjalani skorsing"
              description="Silakan hubungi pihak pondok/sekolah untuk informasi lebih lanjut."
              style={{ marginBottom: 16 }}
            />
          )}

          <Card style={{ borderRadius: 16 }}>
            <Tabs
              items={[
                {
                  key: 'perilaku',
                  label: 'Perilaku',
                  children: (
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {result.reports.length === 0 && (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada catatan perilaku" />
                      )}
                      {result.reports.slice(0, 30).map((r) => (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: r.points < 0 ? '#fff1f0' : '#f0fdf4',
                          }}
                        >
                          <div>
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {r.rule_name ?? '—'}
                            </Typography.Text>
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {new Date(r.reported_at).toLocaleDateString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                                {r.notes ? ` · ${r.notes}` : ''}
                              </Typography.Text>
                            </div>
                          </div>
                          <Tag color={r.points < 0 ? 'red' : 'green'} style={{ height: 'fit-content' }}>
                            {r.points > 0 ? `+${r.points}` : r.points}
                          </Tag>
                        </div>
                      ))}
                    </Space>
                  ),
                },
                {
                  key: 'report-card',
                  label: 'Raport Bulanan',
                  children: (
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      {result.report_cards.length === 0 && (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada raport bulanan" />
                      )}
                      {result.report_cards.map((r, i) => {
                        const avg = avgOf(r)
                        return (
                          <Card key={`${r.year}-${r.month}-${i}`} size="small" style={{ borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography.Text strong>
                                {MONTH_NAMES[r.month - 1]} {r.year}
                              </Typography.Text>
                              {avg !== null && <Tag color="blue">Rata-rata {avg}</Tag>}
                              {i === 0 && <Tag color="green">Terbaru</Tag>}
                            </div>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                              {(
                                [
                                  ['Akhlak', r.character_score],
                                  ['Ibadah', r.worship_score],
                                  ['Kebersihan', r.cleanliness_score],
                                  ["Al-Qur'an", r.quran_score],
                                  ['Bahasa', r.language_score],
                                ] as const
                              ).map(([label, v]) => (
                                <Typography.Text key={label} style={{ fontSize: 12.5 }}>
                                  {label}: <b>{v ?? '—'}</b>
                                </Typography.Text>
                              ))}
                            </div>
                            {r.notes && (
                              <Typography.Paragraph
                                type="secondary"
                                style={{ fontSize: 12, margin: '8px 0 0', fontStyle: 'italic' }}
                              >
                                “{r.notes}”
                              </Typography.Paragraph>
                            )}
                          </Card>
                        )
                      })}
                    </Space>
                  ),
                },
                {
                  key: 'kehadiran',
                  label: 'Kehadiran',
                  children:
                    result.attendance.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada data kehadiran" />
                    ) : (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {result.attendance.map((a) => (
                          <Card key={`${a.year}-${a.month}`} size="small" style={{ borderRadius: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography.Text strong>
                                {MONTH_NAMES[a.month - 1]} {a.year}
                              </Typography.Text>
                              {a.alpa > 0 && <Tag color="red">{a.alpa} alpa</Tag>}
                            </div>
                            <Row gutter={[8, 8]} style={{ marginTop: 10 }}>
                              <Col xs={12} sm={8} md={4}>
                                <StatBox label="Hadir" value={a.hadir} color="#16a34a" />
                              </Col>
                              <Col xs={12} sm={8} md={4}>
                                <StatBox label="Sakit" value={a.sakit} color="#f59e0b" />
                              </Col>
                              <Col xs={12} sm={8} md={4}>
                                <StatBox label="Izin" value={a.izin} color="#3b82f6" />
                              </Col>
                              <Col xs={12} sm={8} md={4}>
                                <StatBox label="Alpa" value={a.alpa} color="#dc2626" />
                              </Col>
                              <Col xs={12} sm={8} md={4}>
                                <StatBox label="Pulang Awal" value={a.pulang} color="#8b5cf6" />
                              </Col>
                            </Row>
                          </Card>
                        ))}
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Rekap 3 bulan terakhir
                        </Typography.Text>
                      </Space>
                    ),
                },
                {
                  key: 'skorsing',
                  label: 'Skorsing',
                  children:
                    result.suspensions.length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tidak ada riwayat skorsing" />
                    ) : (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {result.suspensions.map((s) => {
                          const active = s.status === 'active'
                          return (
                            <Card
                              key={s.id}
                              size="small"
                              style={{ borderRadius: 12, borderColor: active ? '#fca5a5' : undefined }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Typography.Text strong style={{ fontSize: 13 }}>
                                  Skorsing {s.level}
                                </Typography.Text>
                                <Tag color={active ? 'red' : s.status === 'completed' ? 'green' : 'default'}>
                                  {SUSPENSION_STATUS_LABEL[s.status]}
                                </Tag>
                              </div>
                              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                {formatDateID(s.start_date)} – {formatDateID(s.end_date)}
                              </Typography.Text>
                              {active && (
                                <Typography.Paragraph
                                  type="danger"
                                  style={{ fontSize: 12, margin: '8px 0 0' }}
                                >
                                  Santri sedang menjalani skorsing. Detail tugas dikirim melalui tautan
                                  khusus di WhatsApp.
                                </Typography.Paragraph>
                              )}
                            </Card>
                          )
                        })}
                      </Space>
                    ),
                },
              ]}
            />
          </Card>

          {hasDeepLink && (
            <Alert
              type="warning"
              showIcon
              message="Tautan halaman ini mengandung PIN pribadi. Jangan sebarkan ke orang lain."
            />
          )}
        </Space>
      ) : (
        <PortalCard
          tint="indigo"
          icon={<UserOutlined />}
          title="Portal Wali Santri"
          description="Pantau pembinaan putra/putri Anda kapan saja — tanpa perlu membuat akun."
          bullets={[
            'Poin pelanggaran & prestasi terkini',
            'Raport bulanan & catatan musyrif',
            'Data hanya bisa dibuka dengan PIN santri',
          ]}
          footnote="Kode registrasi & PIN diberikan oleh pihak sekolah."
        >
          <Typography.Title level={4} style={{ margin: 0, letterSpacing: '-0.02em' }}>
            Cek Data Santri
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
            Masukkan kode registrasi dan PIN rahasia santri.
          </Typography.Paragraph>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ code: deepCode, pin: deepPin }}
            style={{ marginTop: 18 }}
          >
            <Form.Item
              name="code"
              label="Kode Registrasi"
              rules={[{ required: true, message: 'Kode registrasi wajib diisi' }]}
            >
              <Input
                prefix={<NumberOutlined />}
                placeholder="SPR-2026-001"
                onChange={(e) => {
                  const formatted = formatCode(e.target.value)
                  form.setFieldValue('code', formatted)
                }}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="pin"
              label="PIN Rahasia"
              rules={[
                { required: true, message: 'PIN wajib diisi' },
                { len: 4, message: 'PIN harus 4 digit' },
              ]}
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="****"
                inputMode="numeric"
                maxLength={4}
                size="large"
              />
            </Form.Item>

            {error && (
              <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
            )}
            {rateLimited && (
              <Alert
                type="warning"
                showIcon
                message="Terlalu banyak percobaan gagal. Tunggu 30 detik lalu coba lagi."
                style={{ marginBottom: 16 }}
              />
            )}

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              icon={<SearchOutlined />}
              loading={loading}
              disabled={rateLimited}
            >
              Lihat Data Santri
            </Button>
          </Form>
        </PortalCard>
      )}

      {/* Bantuan singkat — hanya pada tampilan form */}
      {!result && (
        <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{ borderRadius: 14, border: '1px solid #eef2f7', height: '100%' }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#fff7ed',
                    color: '#ea580c',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  <QuestionCircleOutlined />
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: 13.5 }}>
                    Lupa PIN?
                  </Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ fontSize: 12.5, marginTop: 2, marginBottom: 0, lineHeight: 1.6 }}
                  >
                    PIN hanya diketahui wali dan pihak sekolah. Hubungi musyrif / pengasuhan
                    melalui kontak resmi untuk mengatur ulang PIN.
                  </Typography.Paragraph>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              size="small"
              style={{ borderRadius: 14, border: '1px solid #eef2f7', height: '100%' }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#eef2ff',
                    color: '#4f46e5',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  <SafetyOutlined />
                </div>
                <div>
                  <Typography.Text strong style={{ fontSize: 13.5 }}>
                    Keamanan Data
                  </Typography.Text>
                  <Typography.Paragraph
                    type="secondary"
                    style={{ fontSize: 12.5, marginTop: 2, marginBottom: 0, lineHeight: 1.6 }}
                  >
                    Data hanya terbuka dengan kode registrasi + PIN pribadi, dan percobaan
                    gagal dibatasi otomatis oleh sistem.
                  </Typography.Paragraph>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {announcements.length > 0 && (
        <Card style={{ marginTop: 20, borderRadius: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <NotificationOutlined style={{ color: '#4f46e5' }} />
            Pengumuman
          </div>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {announcements.map((a) => (
              <div key={a.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Typography.Text strong style={{ fontSize: 13.5 }}>
                    {a.title}
                  </Typography.Text>
                  <Tag color={CATEGORY_COLORS[a.category as keyof typeof CATEGORY_COLORS] ?? 'default'}>
                    {a.category}
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(a.published_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Typography.Text>
                </div>
                <Typography.Paragraph
                  style={{ whiteSpace: 'pre-line', fontSize: 13, marginBottom: 0, marginTop: 4 }}
                >
                  {a.body}
                </Typography.Paragraph>
              </div>
            ))}
          </Space>
        </Card>
      )}
    </PublicShell>
  )
}
