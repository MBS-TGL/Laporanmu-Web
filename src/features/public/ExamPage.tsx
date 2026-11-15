import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Alert,
  App,
  Button,
  Card,
  Drawer,
  Form,
  Grid,
  Input,
  Progress,
  Spin,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  AppstoreOutlined,
  CheckCircleFilled,
  ClearOutlined,
  ClockCircleOutlined,
  DisconnectOutlined,
  FileProtectOutlined,
  FlagFilled,
  FlagOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LeftOutlined,
  LoadingOutlined,
  RightOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../shared/components/AppModal'
import { ModalFooter } from '../../shared/components/ModalFooter'
import { PortalCard } from './PortalCard'
import { ResultScreen } from './ResultScreen'
import {
  rpcLeaderboard,
  rpcReportExamEvent,
  rpcReviewAnswers,
  rpcSaveExamAnswers,
  rpcStartExam,
  rpcSubmitExam,
} from '../cbt/api'
import { EXAM_TYPE_LABEL, type PublicExamQuestion, type StartExamResult } from '../cbt/types'
import { formatCountdown, remainingMs } from '../cbt/examUtil'
import { ExamQuestionBody as QuestionBody, hasAnswer } from './ExamQuestionBody'
import { EASE } from '../../shared/motion'

type Phase = 'entry' | 'exam' | 'result'

const AUTOSAVE_DELAY = 2000
const SESSION_KEY = 'laporanmu_cbt_session'
const FLAGS_KEY = 'laporanmu_cbt_flags'
const FONT_KEY = 'laporanmu_cbt_font'
const FONT_SIZES = [14, 16, 18, 20]
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type Flags = Record<string, boolean>

interface CbtSession {
  token: string
  code: string
}

/** Huruf tampil per posisi (urutan sudah di-shuffle server) — A, B, C, … */
const LETTERS = ['A', 'B', 'C', 'D', 'E']

/** Rapikan input token menjadi kelompok 4-4-4-4 huruf/angka, dipisah minus. */
function formatExamToken(raw: string): string {
  const alnum = String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16)
  return alnum.replace(/(.{4})(?=.)/g, '$1-')
}

/** Indikator kelengkapan token: satu segmen menyala per kelompok 4 karakter terisi. */
function TokenSegments({ value }: { value: string }) {
  const { token } = theme.useToken()
  const alnum = value.replace(/[^A-Z0-9]/g, '').slice(0, 16)
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 14 }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => {
        const filled = alnum.length >= (i + 1) * 4
        const partial = alnum.length > i * 4 && !filled
        return (
          <span
            key={i}
            style={{
              height: 4,
              width: 34,
              borderRadius: 999,
              background: filled ? token.colorPrimary : partial ? token.colorPrimaryBorder : token.colorFillTertiary,
              transition: 'background 0.15s ease',
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Halaman ujian santri (publik, tanpa akun): token diketik di /exam, TIDAK
 * pernah lewat URL. Sesi {token, code} disimpan di sessionStorage sehingga
 * refresh bisa resume, tapi tidak bisa dibagikan lewat tautan.
 * Deadline & penilaian diputuskan server; aktivitas mencurigakan (pindah
 * tab, blur, salin-tempel) dilaporkan ke server dan audit log.
 */
export function ExamPage() {
  const { message } = App.useApp()
  const { token: themeToken } = theme.useToken()

  const [phase, setPhase] = useState<Phase>('entry')
  const [booting, setBooting] = useState(() => Boolean(sessionStorage.getItem(SESSION_KEY)))
  const [error, setError] = useState<string | null>(null)

  const [exam, setExam] = useState<StartExamResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [current, setCurrent] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [saving, setSaving] = useState<SaveState>('idle')
  const [flags, setFlags] = useState<Flags>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(FLAGS_KEY) ?? '{}') as Flags
    } catch {
      return {}
    }
  })
  const [fontIdx, setFontIdx] = useState(() => {
    const raw = localStorage.getItem(FONT_KEY)
    if (raw === null) return 1
    const v = Number(raw)
    return Number.isInteger(v) && v >= 0 && v < FONT_SIZES.length ? v : 1
  })
  const [online, setOnline] = useState(() => navigator.onLine)
  const [isFs, setIsFs] = useState(() => Boolean(document.fullscreenElement))
  const [reviewOpen, setReviewOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [tokenValue, setTokenValue] = useState('')
  const screens = Grid.useBreakpoint()
  const isDesktop = Boolean(screens.lg)
  const mainRef = useRef<HTMLDivElement | null>(null)
  const warnedRef = useRef<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [answerReviewOpen, setAnswerReviewOpen] = useState(false)
  const [reviewData, setReviewData] = useState<{ review: { question: string; response: unknown; correct: unknown; explanation: string | null; points: number; essay_score: number | null }[] } | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [board, setBoard] = useState<{ initial: string; score: number }[] | null>(null)
  const [warnings, setWarnings] = useState(0)
  const [result, setResult] = useState<{
    score: number | null
    correct: number | null
    total: number | null
    submittedAt: string | null
  } | null>(null)

  const answersRef = useRef(answers)
  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedRef = useRef(false)
  const lastReportRef = useRef(0)
  const sessionRef = useRef<CbtSession | null>(null)
  const [fsEnabled] = useState(() => Boolean(document.fullscreenEnabled))
  const questions: PublicExamQuestion[] = useMemo(() => exam?.questions ?? [], [exam])
  const questionsRef = useRef(questions)
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])
  const deadline = exam?.status === 'in_progress' && exam.deadline_at ? exam.deadline_at : null
  const remaining = deadline ? remainingMs(deadline, now) : 0
  // Ujian valid = punya soal & deadline. Bila tidak (respons aneh dari server),
  // tampilkan error daripada membuka ruang kosong yang langsung ter-submit.
  const examValid = exam?.status === 'in_progress' && questions.length > 0 && deadline !== null

  // ── Mulai / resume ujian ──────────────────────────────────────────────────
  const startExam = useCallback(async (token: string, code: string) => {
    setBooting(true)
    setError(null)
    try {
      const res = (await rpcStartExam(token, code)) as StartExamResult
      sessionRef.current = { token, code }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, code }))
      if (res.status === 'submitted') {
        // Resume: pertahankan judul/tipe agar layar hasil tetap informatif.
        setExam({
          status: 'submitted',
          student_name: res.student_name,
          exam_title: res.exam_title,
          exam_type: res.exam_type,
        })
        setResult({
          score: res.score ?? null,
          correct: res.correct_count ?? null,
          total: null,
          submittedAt: res.submitted_at ?? null,
        })
        setPhase('result')
      } else {
        setExam(res)
        setAnswers(res.answers ?? {})
        setWarnings(Number(res.warnings ?? 0))
        setPhase('exam')
      }
    } catch (err) {
      sessionStorage.removeItem(SESSION_KEY)
      sessionRef.current = null
      setError((err as Error).message)
    } finally {
      setBooting(false)
    }
  }, [])

  // Auto-resume saat halaman dimuat ulang di tengah ujian (deferred agar tidak
  // memicu cascading render langsung dari effect)
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return
    let timer: ReturnType<typeof setTimeout> | null = null
    try {
      const s = JSON.parse(raw) as CbtSession
      if (s?.token && s?.code) timer = setTimeout(() => void startExam(s.token, s.code), 0)
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [startExam])

  // ── Tick hitung mundur (sumber waktu: deadline server) ───────────────────
  useEffect(() => {
    if (phase !== 'exam') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  const doSubmit = useCallback(async () => {
    if (submittedRef.current || !sessionRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    try {
      const res = await rpcSubmitExam(sessionRef.current.token, sessionRef.current.code, answersRef.current)
      setResult({
        score: res.score ?? null,
        correct: res.correct_count ?? null,
        total: questionsRef.current.length || null,
        submittedAt: new Date().toISOString(),
      })
      setPhase('result')
      setReviewOpen(false)
      setPaletteOpen(false)
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      message.success('Jawaban berhasil dikumpulkan')
    } catch (err) {
      submittedRef.current = false
      message.error((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [message])

  // Auto-submit saat waktu habis — hanya saat ujian valid (soal & deadline ada)
  useEffect(() => {
    if (phase !== 'exam' || !examValid || !deadline || remaining !== 0 || now === 0) return
    const timer = setTimeout(() => void doSubmit(), 0)
    return () => clearTimeout(timer)
  }, [phase, examValid, deadline, remaining, now, doSubmit])

  // ── Autosave jawaban (debounce 2 detik, retry otomatis bila gagal) ───────
  const flushSaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const flushSave = useCallback(async () => {
    if (!sessionRef.current || submittedRef.current) return
    setSaving('saving')
    try {
      await rpcSaveExamAnswers(sessionRef.current.token, sessionRef.current.code, answersRef.current)
      setSaving('saved')
    } catch {
      setSaving('error')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => void flushSaveRef.current?.(), 5000)
    }
  }, [])
  useEffect(() => {
    flushSaveRef.current = flushSave
  }, [flushSave])

  const setAnswer = useCallback(
    (qid: string, value: unknown) => {
      setAnswers((prev) => {
        const next = { ...prev }
        if (value === null || value === undefined) delete next[qid]
        else next[qid] = value
        return next
      })
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaving('saving')
      saveTimer.current = setTimeout(() => void flushSave(), AUTOSAVE_DELAY)
    },
    [flushSave],
  )

  const toggleFlag = useCallback((qid: string) => {
    setFlags((prev) => {
      const next = { ...prev }
      if (next[qid]) delete next[qid]
      else next[qid] = true
      return next
    })
  }, [])

  useEffect(() => {
    sessionStorage.setItem(FLAGS_KEY, JSON.stringify(flags))
  }, [flags])

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(fontIdx))
  }, [fontIdx])

  // ── Koneksi: sinkron ulang jawaban begitu internet kembali ───────────────
  useEffect(() => {
    const on = () => {
      setOnline(true)
      void flushSave()
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [flushSave])

  // ── Fullscreen state ──────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFs(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void document.documentElement.requestFullscreen().catch(() => {})
  }

  // ── Notifikasi sisa waktu: 10 / 5 / 1 menit ──────────────────────────────
  useEffect(() => {
    if (phase !== 'exam' || !examValid || remaining <= 0) return
    const hit = [1, 5, 10].find((m) => remaining <= m * 60_000)
    if (hit === undefined || warnedRef.current.has(hit)) return
    ;[1, 5, 10].filter((m) => m >= hit).forEach((m) => warnedRef.current.add(m))
    message.warning({ content: `Sisa waktu ${hit} menit lagi`, duration: 4 })
  }, [phase, examValid, remaining, message])

  // ── Scroll ke atas tiap pindah soal ──────────────────────────────────────
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [current])

  // ── Pintasan keyboard: A–E pilih · ←/→ pindah · F ragu-ragu ───────────────
  useEffect(() => {
    if (phase !== 'exam' || !examValid || reviewOpen || paletteOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag && /INPUT|TEXTAREA|SELECT/.test(tag)) return
      const qs = exam?.questions ?? []
      const cur = qs[current]
      if (!cur) return
      if (e.key === 'ArrowRight') setCurrent((i) => Math.min(qs.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setCurrent((i) => Math.max(0, i - 1))
      else if (e.key.toLowerCase() === 'f') toggleFlag(cur.id)
      else {
        const qType = cur.type ?? 'pg'
        const idx = LETTERS.indexOf(e.key.toUpperCase())
        if ((qType === 'pg' || qType === 'pg_multi') && idx >= 0 && cur.options[idx]) setAnswer(cur.id, cur.options[idx].key)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, examValid, reviewOpen, paletteOpen, current, exam, setAnswer, toggleFlag])

  // ── Anti-curang: pindah tab / blur / salin-tempel → lapor server+audit ───
  useEffect(() => {
    if (phase !== 'exam' || !examValid || !sessionRef.current) return
    const report = (event: string, meta?: Record<string, unknown>) => {
      const nowMs = Date.now()
      if (nowMs - lastReportRef.current < 1000) return // debounce dobel event
      lastReportRef.current = nowMs
      setWarnings((w) => w + 1)
      message.warning({ content: 'Aktivitas mencurigakan tercatat & dilaporkan ke pengawas', duration: 3 })
      void rpcReportExamEvent(sessionRef.current!.token, sessionRef.current!.code, event, meta).catch(() => {})
    }
    const onVisibility = () => {
      if (document.hidden) report('tab_hidden', { title: document.title })
    }
    const onBlur = () => report('window_blur')
    const blockClipboard = (e: Event) => {
      e.preventDefault()
      report('clipboard_blocked', { type: e.type })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('copy', blockClipboard)
    document.addEventListener('cut', blockClipboard)
    document.addEventListener('paste', blockClipboard)
    document.addEventListener('contextmenu', blockClipboard)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('copy', blockClipboard)
      document.removeEventListener('cut', blockClipboard)
      document.removeEventListener('paste', blockClipboard)
      document.removeEventListener('contextmenu', blockClipboard)
    }
  }, [phase, examValid, message])

  // ── Fase: entry (PortalCard) — error tampil inline ───────────────────────
  if (phase === 'entry') {
    return (
      <ExamShell>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <PortalCard
            tint="indigo"
            icon={<FileProtectOutlined />}
            title="Ujian CBT Santri"
            description="Masukkan token dari pengawas, lalu identitas santri untuk memulai ujian pilihan ganda."
            bullets={[
              'Waktu ujian dihitung sejak kamu masuk, bukan sejak membuka halaman',
              'Jawaban tersimpan otomatis saat diisi',
              'Meninggalkan tab atau menyalin jawaban tercatat sebagai peringatan',
            ]}
            footnote="Butuh bantuan? Hubungi pengawas di ruang ujian."
          >
            <Form
              layout="vertical"
              onValuesChange={(changed) => {
                if (changed.token !== undefined) setTokenValue(String(changed.token))
              }}
              onFinish={(v) =>
                startExam(
                  String(v.token ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
                  String(v.code ?? '').trim(),
                )
              }
            >
              <Form.Item
                name="token"
                label="Token Ujian"
                rules={[
                  { required: true, message: 'Token ujian wajib diisi' },
                  { min: 16, message: 'Token terdiri dari 16 karakter' },
                ]}
                normalize={formatExamToken}
                style={{ marginBottom: 10 }}
              >
                <Input size="large" placeholder="Contoh: ABCD-EFGH-JKLM-NPQR" autoFocus style={{ letterSpacing: '0.06em' }} />
              </Form.Item>
              <TokenSegments value={tokenValue} />
              <Form.Item
                name="code"
                label="NIS / NISN / Kode Registrasi"
                rules={[{ required: true, message: 'Identitas santri wajib diisi' }]}
              >
                <Input size="large" placeholder="Contoh: 2026-0001 atau kode registrasi" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={booting} icon={<SendOutlined />}>
                Masuk Ujian
              </Button>
              {error && (
                <Alert type="error" showIcon style={{ marginTop: 12 }} message={error} />
              )}
            </Form>
          </PortalCard>
        </div>
      </ExamShell>
    )
  }

  // ── Fase: hasil ───────────────────────────────────────────────────────────
  const resultPhase = phase === 'result' || Boolean(result)
  useEffect(() => {
    if (!resultPhase || !sessionRef.current || !exam?.show_leaderboard) return
    rpcLeaderboard(sessionRef.current.token)
      .then((r) => setBoard((r?.board as { initial: string; score: number }[] | undefined) ?? null))
      .catch(() => setBoard(null))
  }, [resultPhase, exam?.show_leaderboard, exam])

  const openReview = () => {
    if (!sessionRef.current) return
    setAnswerReviewOpen(true)
    setReviewLoading(true)
    rpcReviewAnswers(sessionRef.current.token, sessionRef.current.code)
      .then((r) => setReviewData(r as typeof reviewData))
      .catch((err: Error) => {
        setReviewData(null)
        message.error(err.message)
      })
      .finally(() => setReviewLoading(false))
  }

  if (resultPhase) {
    return (
      <>
      <ExamShell>
        <ResultScreen
          studentName={exam?.student_name ?? 'Santri'}
          examTitle={exam?.exam_title}
          typeLabel={exam?.exam_type ? EXAM_TYPE_LABEL[exam.exam_type] : undefined}
          result={result}
          onReview={exam?.show_explanations ? openReview : undefined}
          leaderboard={exam?.show_leaderboard ? board : null}
          onDone={() => {
            sessionStorage.removeItem(SESSION_KEY)
            sessionStorage.removeItem(FLAGS_KEY)
            sessionRef.current = null
            warnedRef.current = new Set()
            setFlags({})
            setReviewOpen(false)
            setSaving('idle')
            setPhase('entry')
            setExam(null)
            setAnswers({})
            setResult(null)
            submittedRef.current = false
          }}
        />
      </ExamShell>
      <AppModal
        open={answerReviewOpen}
        onCancel={() => setAnswerReviewOpen(false)}
        footer={null}
        width={720}
        title="Review Jawaban"
        subtitle="Bandingkan jawabanmu dengan kunci"
      >
        {reviewLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Spin size="large" />
          </div>
        ) : reviewData ? (
          <div style={{ display: 'grid', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
            {reviewData.review?.map((r, i) => {
              const ok = JSON.stringify(r.response ?? null) === JSON.stringify(r.correct ?? null)
              return (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${ok ? themeToken.colorSuccess : themeToken.colorError}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {i + 1}. {r.question}
                  </div>
                  <Typography.Text style={{ fontSize: 12.5 }}>
                    Jawabanmu: <b>{JSON.stringify(r.response ?? null)}</b> · Kunci:{' '}
                    <b>{JSON.stringify(r.correct ?? null)}</b>
                  </Typography.Text>
                  {r.explanation && (
                    <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0, marginTop: 4 }}>
                      Pembahasan: {r.explanation}
                    </Typography.Paragraph>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </AppModal>
      </>
    )
  }

  // ── Fase: booting / loading ───────────────────────────────────────────────
  if (!exam) {
    return (
      <ExamShell>
        <div style={{ textAlign: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      </ExamShell>
    )
  }

  if (!examValid) {
    return (
      <ExamShell>
        <Card style={{ maxWidth: 480, margin: '0 auto' }}>
          <Alert
            type="error"
            showIcon
            message="Ujian tidak dapat dimulai"
            description="Data ujian belum lengkap (soal atau waktu tidak tersedia). Hubungi pengawas, lalu coba masuk kembali."
          />
        </Card>
      </ExamShell>
    )
  }

  // ── Fase: mengerjakan (full page) ─────────────────────────────────────────
  const q = questions[current]
  const answeredCount = questions.filter((qq) => hasAnswer(answers[qq.id])).length
  const flaggedCount = questions.filter((qq) => flags[qq.id]).length
  const unansweredCount = questions.length - answeredCount
  const timeCritical = remaining < 5 * 60 * 1000
  // Proporsi waktu tersedia hanya bila durasi ujian diketahui dari server.
  const timerTotalMs = exam?.duration_minutes ? exam.duration_minutes * 60000 : 0
  const fontSize = FONT_SIZES[fontIdx]
  const isLast = current === questions.length - 1
  const pct = Math.round((answeredCount / questions.length) * 100)

  const submitButton = (
    <Button
      type="primary"
      size="large"
      block
      icon={<SendOutlined />}
      onClick={() => {
        setPaletteOpen(false)
        setReviewOpen(true)
      }}
    >
      Tinjau &amp; Kumpulkan
    </Button>
  )

  const legend = <PaletteLegend />
  const divider = `1px solid ${themeToken.colorBorderSecondary}`
  const contentMax = 820

  return (
    <div
      className="cbt-root"
      style={
        {
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: '#f1f5f9',
          userSelect: 'none',
          '--cbt-primary': themeToken.colorPrimary,
        } as React.CSSProperties
      }
    >
      <style>{CBT_CSS}</style>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        style={{
          background: themeToken.colorBgContainer,
          borderBottom: divider,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div
          style={
            isDesktop
              ? {
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 300px minmax(0, 1fr)',
                  alignItems: 'center',
                  gap: 24,
                  padding: '12px 24px',
                }
              : { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }
          }
        >
          {/* Kiri: identitas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: isDesktop ? undefined : 1 }}>
            <img src="/logo-icon.png" alt="Logo Laporanmu" width={isDesktop ? 38 : 28} height={isDesktop ? 38 : 28} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: isDesktop ? 16 : 14,
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {exam.exam_title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: themeToken.colorTextSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {exam.student_name}
                {isDesktop && exam.exam_type ? ` · ${EXAM_TYPE_LABEL[exam.exam_type]}` : ''} · {questions.length} soal
              </div>
            </div>
          </div>

          {/* Tengah: progress */}
          {isDesktop && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  color: themeToken.colorTextSecondary,
                  marginBottom: 4,
                }}
              >
                <span>
                  <b style={{ color: themeToken.colorText }}>{answeredCount}</b> / {questions.length} terjawab
                </span>
                <span>{pct}%</span>
              </div>
              <Progress
                percent={pct}
                showInfo={false}
                size={['100%', 8]}
                strokeColor={themeToken.colorSuccess}
                style={{ display: 'block', lineHeight: 0 }}
              />
            </div>
          )}

          {/* Kanan: status, alat, timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: isDesktop ? 12 : 8,
              flexShrink: 0,
            }}
          >
            <SaveStatus state={saving} compact={!isDesktop} />

            {warnings > 0 && (
              <Tooltip title="Aktivitas meninggalkan halaman / salin-tempel tercatat dan dilaporkan ke pengawas">
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: isDesktop ? 36 : 30,
                    padding: '0 10px',
                    borderRadius: 10,
                    background: themeToken.colorWarningBg,
                    border: `1px solid ${themeToken.colorWarningBorder}`,
                    color: themeToken.colorWarningText,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <WarningOutlined />
                  {warnings}
                  {isDesktop ? ' peringatan' : ''}
                </span>
              </Tooltip>
            )}

            {isDesktop && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 36,
                  border: `1px solid ${themeToken.colorBorder}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <Tooltip title="Perkecil teks">
                  <Button
                    type="text"
                    disabled={fontIdx === 0}
                    onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
                    style={{ width: 38, height: 34, borderRadius: 0, fontSize: 12.5, fontWeight: 700 }}
                  >
                    A-
                  </Button>
                </Tooltip>
                <span style={{ width: 1, height: 18, background: themeToken.colorBorderSecondary }} />
                <Tooltip title="Perbesar teks">
                  <Button
                    type="text"
                    disabled={fontIdx === FONT_SIZES.length - 1}
                    onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
                    style={{ width: 38, height: 34, borderRadius: 0, fontSize: 16, fontWeight: 700 }}
                  >
                    A+
                  </Button>
                </Tooltip>
                {fsEnabled && (
                  <>
                    <span style={{ width: 1, height: 18, background: themeToken.colorBorderSecondary }} />
                    <Tooltip title={isFs ? 'Keluar layar penuh' : 'Layar penuh'}>
                      <Button
                        type="text"
                        icon={isFs ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                        onClick={toggleFullscreen}
                        style={{ width: 38, height: 34, borderRadius: 0 }}
                      />
                    </Tooltip>
                  </>
                )}
              </div>
            )}

            <div
              className={timeCritical ? 'cbt-timer-critical' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: isDesktop ? 40 : 32,
                padding: isDesktop ? '0 14px' : '0 10px',
                borderRadius: 12,
                background: timeCritical ? themeToken.colorErrorBg : themeToken.colorPrimaryBg,
                color: timeCritical ? themeToken.colorError : themeToken.colorPrimary,
                fontWeight: 700,
                fontSize: isDesktop ? 18 : 15,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {/* Ring proporsi waktu: durasi diketahui → lingkaran sisa waktu, ikon jam saja bila tidak. */}
              {timerTotalMs > 0 ? (
                <Progress
                  type="circle"
                  percent={Math.min(100, Math.round((remaining / timerTotalMs) * 100))}
                  size={isDesktop ? 24 : 20}
                  strokeWidth={12}
                  showInfo={false}
                  strokeColor={timeCritical ? themeToken.colorError : themeToken.colorPrimary}
                  trailColor={timeCritical ? themeToken.colorErrorBorder : themeToken.colorFillSecondary}
                />
              ) : (
                <ClockCircleOutlined />
              )}
              {formatCountdown(remaining)}
            </div>
          </div>
        </div>
        {!isDesktop && (
          <Progress
            percent={pct}
            showInfo={false}
            size={['100%', 3]}
            strokeColor={themeToken.colorSuccess}
            style={{ display: 'block', lineHeight: 0 }}
          />
        )}
      </header>

      {!online && (
        <div
          style={{
            background: themeToken.colorError,
            color: '#fff',
            padding: '6px 16px',
            fontSize: 13,
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <DisconnectOutlined /> Koneksi terputus — tetap lanjutkan, jawaban akan tersimpan otomatis saat internet kembali.
        </div>
      )}

      {/* ── Body: soal + sidebar nomor ──────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div
          ref={mainRef}
          style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: isDesktop ? '32px 40px' : '14px 12px' }}
        >
          {q && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={q.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                transition={{ duration: 0.18, ease: EASE }}
                style={{ maxWidth: contentMax, margin: '0 auto' }}
              >
                <div
                  style={{
                    background: themeToken.colorBgContainer,
                    borderRadius: 16,
                    border: divider,
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                    padding: isDesktop ? '24px 28px 28px' : '16px 14px 20px',
                  }}
                >
                  {/* Baris atas kartu: nomor + aksi */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      paddingBottom: 16,
                      marginBottom: 20,
                      borderBottom: divider,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          minWidth: 38,
                          height: 38,
                          padding: '0 10px',
                          borderRadius: 10,
                          background: themeToken.colorPrimary,
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 700,
                          fontSize: 17,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {current + 1}
                      </div>
                      <span style={{ color: themeToken.colorTextSecondary, fontSize: 14 }}>
                        Soal {current + 1} dari {questions.length}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Tooltip title="Hapus jawaban">
                        <Button
                          aria-label="Hapus jawaban"
                          icon={<ClearOutlined />}
                          disabled={!answers[q.id]}
                          onClick={() => setAnswer(q.id, null)}
                          style={{ height: 38, width: 38 }}
                        />
                      </Tooltip>
                      <Button
                        icon={flags[q.id] ? <FlagFilled /> : <FlagOutlined />}
                        onClick={() => toggleFlag(q.id)}
                        style={{
                          height: 38,
                          fontWeight: 600,
                          ...(flags[q.id]
                            ? {
                                background: themeToken.colorWarningBg,
                                borderColor: themeToken.colorWarning,
                                color: themeToken.colorWarningText,
                              }
                            : {}),
                        }}
                      >
                        {isDesktop ? 'Ragu-ragu' : ''}
                      </Button>
                    </div>
                  </div>

                  {/* Teks soal */}
                  <div
                    style={{
                      fontSize: fontSize + 1,
                      lineHeight: 1.75,
                      whiteSpace: 'pre-wrap',
                      marginBottom: 24,
                      color: themeToken.colorText,
                    }}
                  >
                    {q.question}
                  </div>

                  <QuestionBody q={q} answers={answers} setAnswer={setAnswer} fontSize={fontSize} isDesktop={isDesktop} />
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Sidebar nomor soal (desktop) */}
        {isDesktop && (
          <aside
            style={{
              width: 320,
              flexShrink: 0,
              background: themeToken.colorBgContainer,
              borderLeft: divider,
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Navigasi Soal</span>
                <span style={{ fontSize: 12.5, color: themeToken.colorTextSecondary }}>
                  Soal {current + 1} / {questions.length}
                </span>
              </div>
              <PaletteGrid
                questions={questions}
                answers={answers}
                flags={flags}
                current={current}
                columns={5}
                onPick={setCurrent}
              />
            </div>

            <div style={{ padding: '18px 20px', marginTop: 18, borderTop: divider }}>{legend}</div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
                padding: '0 20px 20px',
              }}
            >
              <StatTile value={answeredCount} label="Dijawab" color={themeToken.colorSuccess} />
              <StatTile value={flaggedCount} label="Ragu-ragu" color={themeToken.colorWarning} />
              <StatTile value={unansweredCount} label="Kosong" color={themeToken.colorTextTertiary} />
            </div>

            <div
              style={{
                marginTop: 'auto',
                padding: '16px 20px',
                borderTop: divider,
                fontSize: 12.5,
                color: themeToken.colorTextSecondary,
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 600, color: themeToken.colorText }}>Pintasan keyboard</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pilih jawaban</span>
                <span>
                  <kbd className="cbt-kbd">A</kbd>–<kbd className="cbt-kbd">E</kbd>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pindah soal</span>
                <span>
                  <kbd className="cbt-kbd">←</kbd> <kbd className="cbt-kbd">→</kbd>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tandai ragu-ragu</span>
                <kbd className="cbt-kbd">F</kbd>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Footer navigasi — selebar layar, garisnya sejajar dengan sidebar */}
      <footer
        style={{
          flexShrink: 0,
          display: 'flex',
          background: themeToken.colorBgContainer,
          borderTop: divider,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: isDesktop ? '12px 40px' : '10px 12px max(10px, env(safe-area-inset-bottom))',
          }}
        >
          <div
            style={{
              maxWidth: contentMax,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <Button
              size="large"
              icon={<LeftOutlined />}
              disabled={current === 0}
              onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            >
              {isDesktop ? 'Sebelumnya' : ''}
            </Button>

            {!isDesktop && (
              <Button size="large" icon={<AppstoreOutlined />} onClick={() => setPaletteOpen(true)}>
                {current + 1}/{questions.length}
              </Button>
            )}

            {isLast ? (
              <Button
                type="primary"
                size="large"
                icon={<SendOutlined />}
                iconPosition="end"
                onClick={() => setReviewOpen(true)}
              >
                Tinjau &amp; Kumpulkan
              </Button>
            ) : (
              <Button
                type="primary"
                size="large"
                icon={<RightOutlined />}
                iconPosition="end"
                onClick={() => setCurrent((i) => Math.min(questions.length - 1, i + 1))}
              >
                Berikutnya
              </Button>
            )}
          </div>
        </div>
        {isDesktop && (
          <div style={{ width: 320, flexShrink: 0, borderLeft: divider, padding: '12px 20px' }}>{submitButton}</div>
        )}
      </footer>

      {/* Drawer nomor soal (mobile) */}
      <Drawer
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        placement="bottom"
        height="auto"
        title="Navigasi Soal"
        styles={{ body: { paddingBottom: 'max(16px, env(safe-area-inset-bottom))' } }}
      >
        <PaletteGrid
          questions={questions}
          answers={answers}
          flags={flags}
          current={current}
          columns={6}
          onPick={(i) => {
            setCurrent(i)
            setPaletteOpen(false)
          }}
        />
        <div style={{ margin: '16px 0' }}>{legend}</div>
        {submitButton}
      </Drawer>

      {/* Modal tinjau sebelum kumpulkan */}
      <AppModal
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        width={560}
        title="Tinjau Jawaban"
        subtitle={`${answeredCount} dari ${questions.length} soal terjawab`}
        icon={<FileProtectOutlined />}
        footer={
          <ModalFooter
            onCancel={() => setReviewOpen(false)}
            cancelText="Kembali Periksa"
            onOk={() => void doSubmit()}
            okText="Kumpulkan Sekarang"
            okIcon={<SendOutlined />}
            okLoading={submitting}
          />
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <StatTile value={answeredCount} label="Dijawab" color={themeToken.colorSuccess} />
          <StatTile value={flaggedCount} label="Ragu-ragu" color={themeToken.colorWarning} />
          <StatTile value={unansweredCount} label="Belum dijawab" color={themeToken.colorError} />
        </div>
        {unansweredCount > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 8 }}
            message={`${unansweredCount} soal belum dijawab`}
            description="Ketuk nomor soal di bawah untuk kembali mengerjakan."
          />
        )}
        {flaggedCount > 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 8 }} message={`${flaggedCount} soal masih ditandai ragu-ragu`} />
        )}
        <div style={{ margin: '12px 0' }}>
          <PaletteGrid
            questions={questions}
            answers={answers}
            flags={flags}
            current={current}
            columns={6}
            onPick={(i) => {
              setCurrent(i)
              setReviewOpen(false)
            }}
          />
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          Sisa waktu {formatCountdown(remaining)} · Jawaban tidak bisa diubah setelah dikumpulkan.
        </Typography.Text>
      </AppModal>
    </div>
  )
}

/* ── Komponen pendukung ───────────────────────────────────────────────────── */

const CBT_CSS = `
/* Pulse timer kritis: play-once 3x saat masuk kondisi (bukan loop tanpa henti, R-19) */
@keyframes cbtPulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
.cbt-timer-critical { animation: cbtPulse .8s ease-in-out 3; }
.cbt-opt { transition: border-color .15s, background .15s, transform .08s; }
.cbt-opt:not(.cbt-opt-selected):hover { border-color: var(--cbt-primary) !important; }
.cbt-opt:active { transform: scale(.995); }
.cbt-opt:focus-visible, .cbt-pal:focus-visible { outline: 2px solid var(--cbt-primary); outline-offset: 2px; }
.cbt-kbd { display: inline-block; min-width: 22px; padding: 1px 6px; border: 1px solid #cbd5e1; border-bottom-width: 2px; border-radius: 6px; background: #f8fafc; font-size: 11.5px; font-weight: 600; line-height: 1.5; font-family: inherit; text-align: center; color: #334155; }
.cbt-pal { transition: filter .12s, transform .08s; }
.cbt-pal:hover { filter: brightness(.95); }
.cbt-pal:active { transform: scale(.94); }
@media (prefers-reduced-motion: reduce) {
  .cbt-timer-critical { animation: none; }
  .cbt-opt, .cbt-pal { transition: none; }
}
`

function PaletteGrid({
  questions,
  answers,
  flags,
  current,
  columns,
  onPick,
}: {
  questions: PublicExamQuestion[]
  answers: Record<string, unknown>
  flags: Flags
  current: number
  columns: number
  onPick: (index: number) => void
}) {
  const { token } = theme.useToken()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
      {questions.map((qq, idx) => {
        const answered = hasAnswer(answers[qq.id])
        const flagged = Boolean(flags[qq.id])
        const active = idx === current
        let bg = token.colorBgContainer
        let color = token.colorText
        let border = token.colorBorder
        if (answered) {
          bg = token.colorSuccess
          color = '#fff'
          border = token.colorSuccess
        }
        if (flagged) {
          bg = token.colorWarning
          color = '#fff'
          border = token.colorWarning
        }
        return (
          <button
            key={qq.id}
            type="button"
            className="cbt-pal"
            onClick={() => onPick(idx)}
            aria-label={`Soal ${idx + 1}${answered ? ', dijawab' : ', belum dijawab'}${flagged ? ', ragu-ragu' : ''}`}
            aria-current={active ? 'step' : undefined}
            style={{
              position: 'relative',
              height: 40,
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: bg,
              color,
              fontWeight: 700,
              fontSize: 14,
              fontFamily: 'inherit',
              cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
              outline: active ? `2px solid ${token.colorPrimary}` : 'none',
              outlineOffset: 2,
            }}
          >
            {idx + 1}
            {flagged && answered && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: token.colorSuccess,
                  border: '2px solid #fff',
                }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

function PaletteLegend() {
  const { token } = theme.useToken()
  const items = [
    { label: 'Dijawab', bg: token.colorSuccess, border: token.colorSuccess },
    { label: 'Ragu-ragu', bg: token.colorWarning, border: token.colorWarning },
    { label: 'Belum dijawab', bg: token.colorBgContainer, border: token.colorBorder },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: 12.5, color: token.colorTextSecondary }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: it.bg, border: `1px solid ${it.border}` }} />
          {it.label}
        </span>
      ))}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 4,
            border: `1px solid ${token.colorBorder}`,
            outline: `2px solid ${token.colorPrimary}`,
            outlineOffset: 1,
          }}
        />
        Soal aktif
      </span>
    </div>
  )
}

function StatTile({ value, label, color }: { value: number; label: string; color: string }) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '10px 4px',
        borderRadius: 10,
        background: token.colorFillQuaternary,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SaveStatus({ state, compact }: { state: SaveState; compact: boolean }) {
  const { token } = theme.useToken()
  if (state === 'idle') return null
  const map = {
    saving: { icon: <LoadingOutlined />, text: 'Menyimpan…', color: token.colorTextTertiary },
    saved: { icon: <CheckCircleFilled />, text: 'Tersimpan', color: token.colorSuccess },
    error: { icon: <WarningOutlined />, text: 'Gagal menyimpan, mencoba lagi…', color: token.colorError },
  } as const
  const s = map[state]
  return (
    <Tooltip title={compact ? s.text : undefined}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: s.color, whiteSpace: 'nowrap' }}>
        {s.icon}
        {!compact && s.text}
      </span>
    </Tooltip>
  )
}

/** Shell minimal ala GuardianPage — tanpa nav, fokus ujian (fase entry & hasil). */
function ExamShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #eef2ff 0%, #f8fafc 45%, #f8fafc 100%)',
        padding: '24px 16px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ maxWidth: 720, margin: '0 auto' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/logo-icon.png" alt="Logo Laporanmu" width={44} height={44} style={{ marginBottom: 6 }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            Ujian CBT
          </Typography.Title>
          <Typography.Text type="secondary">Laporanmu</Typography.Text>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" style={{ fontSize: 12, color: '#64748b' }}>
            Laporanmu · Beranda
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
