import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Descriptions,
  Drawer,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckSquareOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  ExportOutlined,
  KeyOutlined,
  LinkOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { StatChip } from '../../../shared/components/StatChip'
import { ExportModal } from '../../../shared/export/ExportModal'
import { useStudentDetail } from '../../students/useStudentDetail'
import {
  useActivateExamToken,
  useCbtAttempts,
  useCbtQuestions,
  useForceSubmitAttempt,
  useRevokeExamToken,
} from '../hooks'
import { EXAM_TYPE_LABEL, type CbtAttempt, type CbtExam } from '../types'
import { formatCountdown, generateExamToken, remainingMs } from '../examUtil'
import { useSubjectOptions } from '../useSubjectOptions'
import { itemAnalysis, type ItemStat } from '../itemAnalysis'
import { maybeSendCbtWa } from '../waAuto'
import { supabase } from '../../../lib/supabase'
import { EssayGradingModal } from './EssayGradingModal'
import { RemedialModal } from './RemedialModal'

interface ExamDrawerProps {
  open: boolean
  exam: CbtExam | null
  onClose: () => void
}

/** Detail sesi ujian: info, token akses santri, dan monitoring attempt (polling 15s). */
export function ExamDrawer({ open, exam, onClose }: ExamDrawerProps) {
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { open: openStudent } = useStudentDetail()
  const csOptions = useSubjectOptions()

  const attemptsQuery = useCbtAttempts(open ? exam?.id : undefined)
  const questionsQuery = useCbtQuestions(open ? exam?.class_subject_id : undefined)
  const forceSubmit = useForceSubmitAttempt()
  const activateToken = useActivateExamToken()
  const revokeToken = useRevokeExamToken()

  const [tokenModal, setTokenModal] = useState<{ display: string; expiresAt: string } | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [gradingAttempt, setGradingAttempt] = useState<CbtAttempt | null>(null)
  const [remedialOpen, setRemedialOpen] = useState(false)

  // Realtime: refetch instan saat attempt berubah di DB (pendamping polling 15s)
  useEffect(() => {
    if (!open || !exam) return
    const channel = supabase
      .channel('cbt-attempts-' + exam.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cbt_attempts', filter: 'exam_id=eq.' + exam.id },
        () => void attemptsQuery.refetch(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [open, exam, attemptsQuery])

  const attempts = attemptsQuery.data ?? []
  const stats = useMemo(() => {
    const submitted = attempts.filter((a) => a.status === 'submitted')
    const grading = attempts.filter((a) => a.status === 'grading')
    const inProgress = attempts.filter((a) => a.status === 'in_progress')
    const scored = attempts.filter((a) => a.status !== 'in_progress')
    const scores = scored.map((a) => a.score ?? 0)
    return {
      started: attempts.length,
      inProgress: inProgress.length,
      grading: grading.length,
      submitted: submitted.length,
      avg: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : null,
    }
  }, [attempts])

  const analytics = useMemo(() => {
    if (!exam) return []
    return itemAnalysis(questionsQuery.data ?? [], attempts)
  }, [exam, questionsQuery.data, attempts])

  const analyticsColumns: ColumnsType<ItemStat> = [
    { title: 'Soal', render: (_, r) => (questionsQuery.data ?? []).find((q) => q.id === r.questionId)?.question?.slice(0, 60) ?? r.questionId },
    { title: 'Dijawab', width: 80, align: 'right', render: (_, r) => r.answered },
    { title: '% Benar', width: 90, align: 'right', render: (_, r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.pCorrect}%</span> },
    { title: 'Daya Beda', width: 90, align: 'right', render: (_, r) => (r.discrimination === null ? '-' : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.discrimination.toFixed(2)}</span>) },
    {
      title: 'Kesimpulan',
      width: 140,
      render: (_, r) => {
        const meta = {
          baik: { label: 'Baik', color: 'green' },
          mudah: { label: 'Terlalu Mudah', color: 'orange' },
          sulit: { label: 'Terlalu Sulit', color: 'red' },
          'beda-rendah': { label: 'Daya Beda Rendah', color: 'purple' },
        }[r.verdict]
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
  ]

  if (!exam) return null
  // "now" dari dataUpdatedAt (bukan Date.now() di render — purity lint)
  const nowMs = attemptsQuery.dataUpdatedAt
  const isPublished = Boolean(
    exam.is_published &&
      (!exam.token_expires_at || (nowMs > 0 && Date.parse(exam.token_expires_at) > nowMs) || nowMs === 0),
  )

  const handleActivate = async () => {
    if (!exam) return
    try {
      const tk = await generateExamToken()
      await activateToken.mutateAsync({
        examId: exam.id,
        assessment: exam.assessment_id
          ? null
          : { class_subject_id: exam.class_subject_id, type: exam.exam_type, title: exam.title },
        tokenHash: tk.hash,
        tokenPrefix: tk.prefix,
        tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      setTokenModal({ display: tk.display, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('id-ID') })
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  const columns: ColumnsType<CbtAttempt> = [
    {
      title: 'Santri',
      render: (_, a) =>
        a.student ? (
          <Button type="link" size="small" style={{ paddingInline: 0 }} onClick={() => openStudent(a.student!.id)}>
            {a.student.name}
          </Button>
        ) : (
          '-'
        ),
    },
    { title: 'Kelas', width: 130, render: (_, a) => a.student?.class?.name ?? '-' },
    {
      title: 'Status',
      width: 130,
      render: (_, a) =>
        a.status === 'submitted' ? (
          <Tag color="green">Mengumpulkan</Tag>
        ) : a.status === 'grading' ? (
          <Tag color="purple">Nilai Essay</Tag>
        ) : remainingMs(a.deadline_at, nowMs || undefined) > 0 ? (
          <Tag color="processing">Mengerjakan</Tag>
        ) : (
          <Tag color="orange">Waktu Habis</Tag>
        ),
    },
    {
      title: 'Sisa Waktu',
      width: 110,
      render: (_, a) =>
        a.status === 'in_progress' ? (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatCountdown(remainingMs(a.deadline_at, nowMs || undefined))}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Skor',
      width: 80,
      align: 'right',
      render: (_, a) =>
        a.score !== null && a.score !== undefined ? (
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{a.score}</span>
        ) : (
          '-'
        ),
    },
    {
      title: 'Peringatan',
      width: 100,
      render: (_, a) => {
        const count = Number((a.client_meta as { warnings?: number } | null)?.warnings ?? 0)
        if (!count) return <span style={{ color: token.colorTextTertiary }}>-</span>
        return (
          <Tooltip title="Pindah tab/blur/salin-tempel saat ujian — tercatat di audit log">
            <Tag color="orange" style={{ marginInlineEnd: 0 }}>
              {count}×
            </Tag>
          </Tooltip>
        )
      },
    },
    { title: 'Benar', width: 70, align: 'right', render: (_, a) => a.correct_count ?? '-' },
    {
      title: '',
      key: 'aksi',
      width: 90,
      render: (_, a) =>
        a.status === 'grading' ? (
          <Button
            type="link"
            size="small"
            icon={<CheckSquareOutlined />}
            onClick={() => setGradingAttempt(a)}
          >
            Nilai
          </Button>
        ) : a.status === 'in_progress' ? (
          <Popconfirm
            title="Selesaikan paksa ujian santri ini?"
            description="Jawaban tersimpan akan dinilai apa adanya."
            okText="Ya, Selesaikan"
            cancelText="Batal"
            okButtonProps={{ loading: forceSubmit.isPending }}
            onConfirm={async () => {
              try {
                const score = await forceSubmit.mutateAsync(a.id)
                message.success('Ujian santri diselesaikan')
                void maybeSendCbtWa(a, score)
              } catch (err) {
                message.error((err as Error).message)
              }
            }}
          >
            <Button type="text" size="small" icon={<StopOutlined />} title="Selesaikan paksa" />
          </Popconfirm>
        ) : null,
    },
  ]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      // Lebar mengikuti tabel pemantauan (±8 kolom) tanpa scroll horizontal:
      // maksimum 1100px, menyesuaikan viewport kecil.
      width="min(1100px, 92vw)"
      destroyOnHidden
      title={
        <div>
          <div style={{ fontWeight: 600 }}>{exam.title}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400 }}>
            {csOptions.labelOf(exam.class_subject_id)} · {EXAM_TYPE_LABEL[exam.exam_type]} · {exam.duration_minutes} menit
          </Typography.Text>
        </div>
      }
    >
      <Descriptions
        size="small"
        column={2}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'status', label: 'Status', children: isPublished ? <Tag color="green">Terbit</Tag> : <Tag>Draft</Tag> },
          {
            key: 'token',
            label: 'Token',
            children: isPublished ? (
              <Tag icon={<KeyOutlined />} color="indigo">
                {exam.token_prefix}…
              </Tag>
            ) : (
              '-'
            ),
          },
          {
            key: 'expires',
            label: 'Token berlaku s.d.',
            children: exam.token_expires_at ? new Date(exam.token_expires_at).toLocaleString('id-ID') : '-',
          },
          {
            key: 'nilai',
            label: 'Masuk nilai',
            children: exam.assessment_id ? 'Ya (leger & rapor)' : 'Belum (aktivasi token)',
          },
        ]}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <StatChip icon={<LinkOutlined />} label="Mulai" value={stats.started} color="indigo" loading={attemptsQuery.isPending} />
        <StatChip icon={<ReloadOutlined />} label="Mengerjakan" value={stats.inProgress} color="amber" hideIfZero />
        <StatChip icon={<ExportOutlined />} label="Mengumpulkan" value={stats.submitted} color="emerald" />
        <StatChip icon={<CheckSquareOutlined />} label="Nilai Essay" value={stats.grading} color="purple" hideIfZero />
        {stats.avg !== null && (
          <StatChip icon={<ExportOutlined />} label="Rata-rata Skor" value={stats.avg} color="sky" />
        )}
      </div>

      <Space size={8} wrap style={{ marginBottom: 16 }}>
        {isPublished ? (
          <>
            <Popconfirm
              title="Perbarui token ujian?"
              description="Token lama langsung tidak berlaku. Bagikan token baru ke pengawas."
              okText="Ya, Perbarui"
              cancelText="Batal"
              okButtonProps={{ loading: activateToken.isPending }}
              onConfirm={handleActivate}
            >
              <Button icon={<ReloadOutlined />}>Perbarui Token</Button>
            </Popconfirm>
            <Popconfirm
              title="Cabut token & arsipkan ujian?"
              description="Santri tidak bisa lagi masuk ujian ini."
              okText="Ya, Cabut"
              cancelText="Batal"
              okButtonProps={{ loading: revokeToken.isPending }}
              onConfirm={async () => {
                try {
                  await revokeToken.mutateAsync(exam.id)
                  message.success('Token dicabut')
                } catch (err) {
                  message.error((err as Error).message)
                }
              }}
            >
              <Button danger icon={<StopOutlined />}>Cabut Token</Button>
            </Popconfirm>
          </>
        ) : (
          <Button type="primary" icon={<KeyOutlined />} onClick={handleActivate} loading={activateToken.isPending}>
            Terbitkan & Aktifkan Token
          </Button>
        )}
        <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>
          Ekspor Rekap
        </Button>
        {isPublished && (
          <Button icon={<ThunderboltOutlined />} onClick={() => setRemedialOpen(true)}>
            Terbitkan Remedial
          </Button>
        )}
      </Space>

      {!isPublished && (
        <Typography.Paragraph type="secondary" style={{ fontSize: 12.5, marginBottom: 16 }}>
          Menerbitkan ujian membuat entri penilaian ({EXAM_TYPE_LABEL[exam.exam_type]}) dan token akses santri berlaku 7 hari.
        </Typography.Paragraph>
      )}

      <Typography.Title level={5} style={{ marginBottom: 8 }}>
        Pemantauan Santri
      </Typography.Title>
      <Table<CbtAttempt>
        rowKey="id"
        size="small"
        loading={attemptsQuery.isPending}
        columns={columns}
        dataSource={attempts}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Belum ada santri yang mulai ujian ini' }}
      />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Daftar diperbarui otomatis setiap 15 detik. Halaman ujian santri: <code>/exam</code> (masukkan token lalu NIS).
      </Typography.Text>

      <EssayGradingModal
        open={gradingAttempt !== null}
        attempt={gradingAttempt}
        questions={questionsQuery.data ?? []}
        onClose={() => setGradingAttempt(null)}
      />

      {analytics.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginBottom: 8 }}>
            Analitik Butir Soal
          </Typography.Title>
          <Table
            rowKey="questionId"
            size="small"
            columns={analyticsColumns}
            dataSource={analytics}
            pagination={false}
            style={{ marginBottom: 16 }}
            scroll={{ x: 'max-content' }}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
            Daya beda &gt; 0,3 = soal membedakan dengan baik. Soal "Terlalu Mudah/Sulit" dipertimbangkan untuk direvisi.
          </Typography.Text>
        </>
      )}

      <RemedialModal
        open={remedialOpen}
        exam={exam}
        attempts={attempts}
        onClose={() => setRemedialOpen(false)}
        onCreated={(newExam: { display: string; expiresAt: string }) => {
          setRemedialOpen(false)
          setTokenModal({ display: newExam.display, expiresAt: newExam.expiresAt })
        }}
      />

      <AppModal
        open={tokenModal !== null}        onCancel={() => setTokenModal(null)}
        footer={null}
        title="Token Ujian Aktif"
        subtitle="Tampilkan sekali ini — token lengkap tidak disimpan dan tidak bisa dilihat lagi"
        icon={<KeyOutlined />}
        width={480}
      >
        {tokenModal && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>
              Santri buka halaman <b>/exam</b>, masukkan token ini, lalu NIS atau kode registrasi mereka.
            </Typography.Text>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontVariantNumeric: 'tabular-nums',
                color: token.colorPrimary,
                background: token.colorFillQuaternary,
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 12,
              }}
            >
              {tokenModal.display}
            </div>
            <Space size={8} wrap style={{ justifyContent: 'center' }}>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={async () => {
                  await navigator.clipboard.writeText(tokenModal.display.replace(/-/g, ''))
                  message.success('Token disalin')
                }}
              >
                Salin Token
              </Button>
              <Button onClick={() => setTokenModal(null)}>Selesai</Button>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
              Berlaku sampai {tokenModal.expiresAt}
            </Typography.Text>
          </div>
        )}
      </AppModal>

      <ExportModal<CbtAttempt>
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Rekap Ujian"
        filename={`rekap-cbt-${exam.title.toLowerCase().replace(/\s+/g, '-')}`}
        auditTable="cbt_attempts"
        scopes={[
          {
            key: 'all',
            label: 'Seluruh attempt',
            description: `${attempts.length} baris`,
            count: attempts.length,
            getRows: async () => attempts,
          },
        ]}
        columns={[
          { header: 'Santri', value: (a) => a.student?.name ?? '' },
          { header: 'Kelas', value: (a) => a.student?.class?.name ?? '' },
          { header: 'Status', value: (a) => (a.status === 'submitted' ? 'Mengumpulkan' : 'Mengerjakan') },
          { header: 'Skor', value: (a) => a.score ?? '' },
          { header: 'Peringatan', value: (a) => Number((a.client_meta as { warnings?: number } | null)?.warnings ?? 0) },
          { header: 'Benar', value: (a) => a.correct_count ?? '' },
          { header: 'Mulai', value: (a) => new Date(a.started_at).toLocaleString('id-ID') },
          { header: 'Mengumpulkan', value: (a) => (a.submitted_at ? new Date(a.submitted_at).toLocaleString('id-ID') : '') },
        ]}
      />
    </Drawer>
  )
}
