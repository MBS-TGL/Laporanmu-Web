import { useEffect, useMemo, useState } from 'react'
import { App, InputNumber, Typography } from 'antd'
import { CheckSquareOutlined } from '@ant-design/icons'
import { AppModal } from '../../../shared/components/AppModal'
import { useGradeEssays } from '../hooks'
import { maybeSendCbtWa } from '../waAuto'
import type { CbtAttempt, CbtQuestion } from '../types'

interface EssayGradingModalProps {
  open: boolean
  attempt: CbtAttempt | null
  /** Semua soal bank mapel ujian — difilter ke soal essay attempt. */
  questions: CbtQuestion[]
  onClose: () => void
}

/**
 * Nilai soal uraian: tampil jawaban santri per soal + skor (maks = poin).
 * Skor final difinalisasi otomatis server saat seluruh essay ternilai.
 */
export function EssayGradingModal({ open, attempt, questions, onClose }: EssayGradingModalProps) {
  const { message } = App.useApp()
  const gradeEssays = useGradeEssays()

  const essayItems = useMemo(() => {
    if (!attempt) return []
    const order = attempt.question_order ?? []
    return questions.filter((q) => order.includes(q.id) && (q.type ?? 'pg') === 'essay')
  }, [attempt, questions])

  const [scores, setScores] = useState<Record<string, number | undefined>>({})

  useEffect(() => {
    if (!open || !attempt) return
    setScores({ ...(attempt.essay_scores ?? {}) })
  }, [open, attempt])

  const pending = essayItems.filter((q) => scores[q.id] === undefined || scores[q.id] === null).length

  const handleOk = async () => {
    if (!attempt) return
    const payload: Record<string, number> = {}
    for (const q of essayItems) {
      const v = scores[q.id]
      if (v !== undefined && v !== null) payload[q.id] = v
    }
    if (Object.keys(payload).length === 0) {
      message.warning('Belum ada skor yang diisi')
      return
    }
    try {
      const final = await gradeEssays.mutateAsync({ attemptId: attempt.id, scores: payload })
      // skor final diketahui -> WA ke wali (fire-and-forget, toggle auto_cbt_wa)
      void maybeSendCbtWa(attempt, final)
      message.success(
        pending > 0
          ? `Skor tersimpan. Masih ada ${pending} essay belum dinilai.`
          : `Skor final: ${final}`,
      )
      onClose()
    } catch (err) {
      message.error((err as Error).message)
    }
  }

  return (
    <AppModal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Simpan Skor"
      okButtonProps={{ loading: gradeEssays.isPending }}
      title={`Nilai Essay · ${attempt?.student?.name ?? 'Santri'}`}
      subtitle={
        attempt
          ? `Skor sementara ${attempt.score ?? '—'} · dikumpulkan ${
              attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('id-ID') : '-'
            }`
          : undefined
      }
      icon={<CheckSquareOutlined />}
      width={680}
      destroyOnHidden
      maskClosable={false}
    >
      {essayItems.length === 0 ? (
        <Typography.Text type="secondary">Tidak ada soal uraian pada ujian ini.</Typography.Text>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {essayItems.map((q, i) => (
            <div
              key={q.id}
              style={{
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: 12,
                padding: '12px 14px',
                background: 'rgba(0,0,0,0.015)',
              }}
            >
              <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <span
                  style={{
                    minWidth: 26,
                    height: 26,
                    borderRadius: 8,
                    background: 'rgba(79,70,229,0.9)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <Typography.Text strong style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                  {q.question}
                </Typography.Text>
              </div>
              <div
                style={{
                  background: '#fff',
                  border: '1px dashed rgba(0,0,0,0.15)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 10,
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                {(attempt?.answers as Record<string, string> | null)?.[q.id]?.trim() || (
                  <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                    (tidak menjawab)
                  </Typography.Text>
                )}
              </div>
              {q.explanation && (
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
                  Rubrik: {q.explanation}
                </Typography.Paragraph>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Typography.Text style={{ fontSize: 13 }}>Skor (maks {q.points}):</Typography.Text>
                <InputNumber
                  min={0}
                  max={q.points}
                  step={0.5}
                  value={scores[q.id]}
                  onChange={(v) => setScores((prev) => ({ ...prev, [q.id]: v ?? undefined }))}
                  style={{ width: 110 }}
                />
              </div>
            </div>
          ))}
          {attempt && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Skor total difinalisasi otomatis setelah seluruh essay dinilai. Batas waktu santri:{' '}
            </Typography.Text>
          )}
        </div>
      )}
    </AppModal>
  )
}
