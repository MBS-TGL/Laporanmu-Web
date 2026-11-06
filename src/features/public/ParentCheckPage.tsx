import { useState } from 'react'
import { Alert, Button, Card, Col, Empty, Form, Input, Row, Space, Statistic, Tabs, Tag, Typography } from 'antd'
import { KeyOutlined, NumberOutlined, SearchOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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
  raports: {
    month: number
    year: number
    nilai_akhlak: number | null
    nilai_ibadah: number | null
    nilai_kebersihan: number | null
    nilai_quran: number | null
    nilai_bahasa: number | null
    catatan: string | null
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

function avgOf(r: CheckStudentResult['raports'][number]): number | null {
  const values = [r.nilai_akhlak, r.nilai_ibadah, r.nilai_kebersihan, r.nilai_quran, r.nilai_bahasa].filter(
    (v): v is number => typeof v === 'number',
  )
  if (values.length === 0) return null
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
}

export function ParentCheckPage() {
  const [searchParams] = useSearchParams()
  const [form] = Form.useForm<{ code: string; pin: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckStudentResult | null>(null)

  const deepCode = searchParams.get('code') ?? ''
  const deepPin = searchParams.get('pin') ?? ''

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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/favicon.svg" alt="Logo" width={48} height={48} style={{ marginBottom: 8 }} />
          <Typography.Title level={3} style={{ margin: 0, letterSpacing: '-0.02em' }}>
            Cek Wali Santri
          </Typography.Title>
          <Typography.Text type="secondary">
            Pantau poin perilaku & raport bulanan anak Anda
          </Typography.Text>
        </div>

        {result ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {result.student.name}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {result.student.class_name ?? '—'} · {result.student.registration_code}
                  </Typography.Text>
                </div>
                <Button onClick={() => setResult(null)}>Cek Santri Lain</Button>
              </div>
              <Row gutter={[12, 12]} style={{ marginTop: 16 }}>
                <Col xs={12} sm={8}>
                  <Statistic
                    title="Total Poin"
                    value={result.student.total_points}
                    valueStyle={{ color: result.student.total_points < 0 ? '#dc2626' : '#16a34a' }}
                  />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title="Pelanggaran" value={violations.length} />
                </Col>
                <Col xs={12} sm={8}>
                  <Statistic title="Prestasi" value={achievements.length} />
                </Col>
              </Row>
            </Card>

            <Card>
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
                    key: 'raport',
                    label: 'Raport Bulanan',
                    children: (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {result.raports.length === 0 && (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada raport bulanan" />
                        )}
                        {result.raports.map((r, i) => {
                          const avg = avgOf(r)
                          return (
                            <Card key={`${r.year}-${r.month}-${i}`} size="small">
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
                                    ['Akhlak', r.nilai_akhlak],
                                    ['Ibadah', r.nilai_ibadah],
                                    ['Kebersihan', r.nilai_kebersihan],
                                    ["Al-Qur'an", r.nilai_quran],
                                    ['Bahasa', r.nilai_bahasa],
                                  ] as const
                                ).map(([label, v]) => (
                                  <Typography.Text key={label} style={{ fontSize: 12.5 }}>
                                    {label}: <b>{v ?? '—'}</b>
                                  </Typography.Text>
                                ))}
                              </div>
                              {r.catatan && (
                                <Typography.Paragraph
                                  type="secondary"
                                  style={{ fontSize: 12, margin: '8px 0 0', fontStyle: 'italic' }}
                                >
                                  “{r.catatan}”
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

            <Alert
              type="warning"
              showIcon
              message="Tautan halaman ini mengandung PIN pribadi. Jangan sebarkan ke orang lain."
            />
          </Space>
        ) : (
          <Card style={{ maxWidth: 460, margin: '0 auto' }}>
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{ code: deepCode, pin: deepPin }}
            >
              <Form.Item
                name="code"
                label="Kode Registrasi"
                rules={[{ required: true, message: 'Kode registrasi wajib diisi' }]}
                extra="Tertera pada kartu santri / informasi penerimaan"
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
                extra="4 digit angka — tanyakan pada musyrif / pengasuhan"
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
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Laporanmu · Portal Wali Santri
          </Typography.Text>
        </div>
      </div>
    </div>
  )
}
