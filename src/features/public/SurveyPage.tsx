import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, App, Button, Card, Form, Input, Popconfirm, Progress, Radio, Select, Spin, Typography, theme } from 'antd'
import { FundProjectionScreenOutlined, SendOutlined } from '@ant-design/icons'
import { PortalCard } from './PortalCard'
import { rpcEvalStart, rpcEvalSubmit } from '../evaluation/api'
import type { EvalQuestion, SurveyClassmate, SurveyStartResult } from '../evaluation/types'

type Phase = 'entry' | 'isi' | 'done'

/**
 * Halaman isian angket santri (publik, tanpa akun): token dari guru +
 * NIS/kode registrasi. Isian sekali per angket; deadline oleh token.
 */
export function SurveyPage() {
  const { token: urlToken = '' } = useParams()
  const { message } = App.useApp()
  const { token: themeToken } = theme.useToken()

  const [phase, setPhase] = useState<Phase>('entry')
  const [booting, setBooting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<{ token: string; code: string } | null>(null)
  // Token bisa dari URL (/survey/:token dari guru) ATAU diketik di form (halaman /survey)
  const [survey, setSurvey] = useState<SurveyStartResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [submitting, setSubmitting] = useState(false)
  const classmates: SurveyClassmate[] = survey?.classmates ?? []
  const questions: EvalQuestion[] = survey?.questions ?? []
  const answeredCount = questions.filter((q) => {
    const v = answers[q.id]
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ''
  }).length

  const start = async (activeToken: string, code: string) => {
    setBooting(true)
    setError(null)
    try {
      const res = (await rpcEvalStart(activeToken, code)) as SurveyStartResult
      setSession({ token: activeToken, code })
      if (res.status === 'submitted') {
        setPhase('done')
      } else {
        setSurvey(res)
        setAnswers(res.answers ?? {})
        setPhase('isi')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBooting(false)
    }
  }

  const doSubmit = async () => {
    if (!session) return
    setSubmitting(true)
    try {
      await rpcEvalSubmit(session.token, session.code, answers)
      setPhase('done')
      message.success('Angket berhasil dikirim')
    } catch (err) {
      message.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Fase: entry ───────────────────────────────────────────────────────────
  if (phase === 'entry') {
    return (
      <SurveyShell>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <PortalCard
            tint="indigo"
            icon={<FundProjectionScreenOutlined />}
            title="Angket Evaluasi"
            description="Masukkan token dari guru, lalu identitas santri untuk mengisi angket."
            bullets={[
              'Jawabanmu bersifat rahasia dan hanya dilihat dalam rekap',
              'Isi dengan jujur sesuai kondisimu',
              'Satu angket hanya bisa diisi satu kali',
            ]}
            footnote="Butuh bantuan? Tanyakan pada guru pengawas."
          >
            <Form layout="vertical" onFinish={(v) => start(urlToken || String(v.token ?? '').trim(), String(v.code ?? '').trim())}>
              {urlToken ? null : (
                <Form.Item
                  name="token"
                  label="Token Angket"
                  rules={[{ required: true, message: 'Token wajib diisi' }]}
                >
                  <Input size="large" placeholder="Token dari guru" autoFocus />
                </Form.Item>
              )}
              <Form.Item
                name="code"
                label="NIS / NISN / Kode Registrasi"
                rules={[{ required: true, message: 'Identitas santri wajib diisi' }]}
              >
                <Input size="large" placeholder="Contoh: 2026-0001 atau kode registrasi" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={booting} icon={<SendOutlined />}>
                Mulai Mengisi
              </Button>
              {error && <Alert type="error" showIcon style={{ marginTop: 12 }} message={error} />}
            </Form>
          </PortalCard>
        </div>
      </SurveyShell>
    )
  }

  // ── Fase: selesai ─────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <SurveyShell>
        <SimpleCard>
          <CheckCircle />
          <Typography.Title level={4} style={{ marginTop: 12, marginBottom: 4 }}>
            Angket Terkirim
          </Typography.Title>
          <Typography.Text type="secondary">
            {survey?.student_name ?? 'Santri'} · {survey?.instrument_title}
          </Typography.Text>
          <div style={{ marginTop: 20 }}>
            <Button
              onClick={() => {
                setPhase('entry')
                setSurvey(null)
                setAnswers({})
                setSession(null)
                setError(null)
              }}
            >
              Selesai
            </Button>
          </div>
        </SimpleCard>
      </SurveyShell>
    )
  }

  // ── Fase: booting ─────────────────────────────────────────────────────────
  if (!survey) {
    return (
      <SurveyShell>
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      </SurveyShell>
    )
  }

  // ── Fase: mengisi ─────────────────────────────────────────────────────────
  const setAnswer = (qid: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  return (
    <SurveyShell wide>
      <div
        style={{
          background: themeToken.colorBgContainer,
          borderRadius: 14,
          border: `1px solid ${themeToken.colorBorderSecondary}`,
          padding: '16px 20px',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Typography.Text strong style={{ fontSize: 15, display: 'block' }}>
              {survey.instrument_title}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              {survey.student_name} · {questions.length} pertanyaan
            </Typography.Text>
          </div>
          <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>
            {answeredCount}/{questions.length} terisi
          </Typography.Text>
        </div>
        <Progress percent={Math.round((answeredCount / questions.length) * 100)} showInfo={false} size={['100%', 4]} strokeColor={themeToken.colorPrimary} />
      </div>

      <div style={{ display: 'grid', gap: 14, maxWidth: 820, margin: '0 auto' }}>
        {questions.map((q, idx) => (
          <Card key={q.id} styles={{ body: { padding: '14px 18px' } }}>
            <div style={{ marginBottom: 10 }}>
              <Typography.Text strong style={{ fontSize: 14.5, lineHeight: 1.6 }}>
                {idx + 1}. {q.text}
              </Typography.Text>
            </div>
            <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} classmates={classmates} />
          </Card>
        ))}
      </div>

      <div style={{ maxWidth: 820, margin: '18px auto 0', textAlign: 'right' }}>
        {answeredCount < questions.length ? (
          <Typography.Text type="secondary" style={{ marginRight: 12, fontSize: 12.5 }}>
            {questions.length - answeredCount} pertanyaan belum dijawab (boleh dikosongkan bila memang tidak yakin)
          </Typography.Text>
        ) : null}
        <Popconfirm
          title="Kirim angket sekarang?"
          description="Jawaban tidak bisa diubah setelah dikirim."
          okText="Ya, Kirim"
          cancelText="Periksa Lagi"
          okButtonProps={{ loading: submitting }}
          onConfirm={() => void doSubmit()}
        >
          <Button type="primary" size="large" icon={<SendOutlined />} loading={submitting}>
            Kirim Angket
          </Button>
        </Popconfirm>
      </div>
    </SurveyShell>
  )
}

function QuestionInput({
  q,
  value,
  onChange,
  classmates,
}: {
  q: EvalQuestion
  value: unknown
  onChange: (v: unknown) => void
  classmates: SurveyClassmate[]
}) {
  const max = q.max ?? 5

  if (q.type === 'skala') {
    return (
      <Radio.Group
        value={typeof value === 'number' ? value : undefined}
        onChange={(e) => onChange(e.target.value)}
        optionType="button"
        buttonStyle="solid"
        options={Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
      />
    )
  }

  if (q.type === 'pilihan') {
    return (
      <Radio.Group
        value={typeof value === 'string' ? value : undefined}
        onChange={(e) => onChange(e.target.value)}
        style={{ display: 'grid', gap: 6 }}
      >
        {(q.options ?? []).map((opt) => (
          <Radio key={opt.key} value={opt.key}>
            {opt.text}
          </Radio>
        ))}
      </Radio.Group>
    )
  }

  if (q.type === 'teman') {
    const maxChoices = q.maxChoices ?? 3
    const chosen = Array.isArray(value) ? (value as string[]) : []
    return (
      <div>
        <Select
          mode="multiple"
          style={{ width: '100%', maxWidth: 480 }}
          placeholder={`Pilih maksimal ${maxChoices} teman`}
          value={chosen}
          onChange={(v) => onChange(v.slice(-maxChoices))}
          options={classmates.map((c) => ({ value: c.key, label: c.text }))}
          optionFilterProp="label"
        />
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
          Maksimal {maxChoices} teman.
        </Typography.Text>
      </div>
    )
  }

  // teks
  return (
    <Input.TextArea
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      maxLength={1000}
      showCount
      placeholder="Tulis jawabanmu…"
    />
  )
}

function SimpleCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        textAlign: 'center',
        background: '#fff',
        borderRadius: 16,
        padding: '28px 24px',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {children}
    </div>
  )
}

function CheckCircle() {
  return (
    <div style={{ fontSize: 48, color: '#10b981', lineHeight: 1 }}>
      <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.2 14.5l-4-4 1.4-1.4 2.6 2.6 5.4-5.4 1.4 1.4-6.8 6.8z" />
      </svg>
    </div>
  )
}

/** Shell minimal ala GuardianPage — fokus isian angket. */
function SurveyShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: wide ? 820 : 720, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo-icon.png" alt="Logo Laporanmu" width={44} height={44} style={{ marginBottom: 6 }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Angket Evaluasi
          </Typography.Title>
          <Typography.Text type="secondary">Laporanmu</Typography.Text>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, color: '#64748b' }}>
            Laporanmu · Halaman khusus isian angket santri
          </Typography.Text>
        </div>
      </div>
    </div>
  )
}
