import { Input, Select, theme } from 'antd'
import { motion } from 'motion/react'
import { CheckCircleFilled } from '@ant-design/icons'
import { EASE } from '../../shared/motion'
import type { PublicExamQuestion, QuestionType } from '../cbt/types'

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function hasAnswer(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'object') return Object.keys(v).length > 0
  return true
}

interface QuestionBodyProps {
  q: PublicExamQuestion
  answers: Record<string, unknown>
  setAnswer: (qid: string, value: unknown) => void
  fontSize: number
  isDesktop: boolean
}

/** Badan jawaban per tipe soal: PG, PG kompleks, benar-salah, menjodohkan, uraian. */
export function ExamQuestionBody({ q, answers, setAnswer, fontSize, isDesktop }: QuestionBodyProps) {
  const { token: themeToken } = theme.useToken()
  const type: QuestionType = q.type ?? 'pg'

  if (type === 'true_false') {
    const opts = [
      { key: 'B', text: 'Benar' },
      { key: 'S', text: 'Salah' },
    ]
    return (
      <div role="radiogroup" aria-label="Pilihan jawaban" style={{ display: 'grid', gap: 10 }}>
        {opts.map((opt) => (
          <OptionButton
            key={opt.key}
            opt={opt}
            label={opt.key}
            selected={answers[q.id] === opt.key}
            onClick={() => setAnswer(q.id, opt.key)}
            fontSize={fontSize}
            isDesktop={isDesktop}
          />
        ))}
      </div>
    )
  }

  if (type === 'essay') {
    return (
      <Input.TextArea
        value={(answers[q.id] as string) ?? ''}
        onChange={(e) => setAnswer(q.id, e.target.value)}
        rows={8}
        placeholder="Tulis jawabanmu di sini"
        showCount
        maxLength={5000}
        style={{ fontSize, lineHeight: 1.7 }}
      />
    )
  }

  if (type === 'matching') {
    const rights = q.pairs?.rights ?? []
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {q.options.map((left, idx) => {
          const resp = (answers[q.id] as Record<string, string> | undefined) ?? {}
          const value = resp[String(idx + 1)]
          return (
            <div
              key={left.key}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 12,
                border: `1.5px solid ${value ? themeToken.colorPrimary : themeToken.colorBorder}`,
                background: value ? themeToken.colorPrimaryBg : themeToken.colorBgContainer,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <span
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  flexShrink: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  background: themeToken.colorFillTertiary,
                  color: themeToken.colorTextSecondary,
                }}
              >
                {idx + 1}
              </span>
              <span style={{ flex: 1, minWidth: 160, fontSize, lineHeight: 1.5 }}>{left.text}</span>
              <Select
                placeholder="Pasangkan"
                style={{ width: isDesktop ? 280 : '100%', minWidth: 180 }}
                value={value}
                onChange={(v) => setAnswer(q.id, { ...resp, [String(idx + 1)]: v })}
                options={rights.map((r, i) => ({ value: r.key, label: `R${i + 1}. ${r.text}` }))}
                size="large"
              />
            </div>
          )
        })}
        <div style={{ fontSize: 12, color: themeToken.colorTextTertiary }}>
          Pilih pasangan yang tepat untuk setiap item.
        </div>
      </div>
    )
  }

  // PG & PG kompleks (multi pilih)
  const multi = type === 'pg_multi'
  const selectedSet = multi ? ((answers[q.id] as string[]) ?? []) : undefined
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label="Pilihan jawaban" style={{ display: 'grid', gap: 10 }}>
      {q.options.map((opt, idx) => {
        const selected = multi ? (selectedSet?.includes(opt.key) ?? false) : answers[q.id] === opt.key
        const toggleMulti = () => {
          const cur = new Set(selectedSet ?? [])
          if (cur.has(opt.key)) cur.delete(opt.key)
          else cur.add(opt.key)
          setAnswer(q.id, [...cur].sort())
        }
        return (
          <OptionButton
            key={opt.key}
            opt={opt}
            label={LETTERS[idx]}
            selected={selected}
            onClick={multi ? toggleMulti : () => setAnswer(q.id, opt.key)}
            fontSize={fontSize}
            isDesktop={isDesktop}
          />
        )
      })}
      {multi && (
        <div style={{ fontSize: 12, color: themeToken.colorTextTertiary }}>Boleh pilih lebih dari satu jawaban.</div>
      )}
    </div>
  )
}

/** Tombol opsi seragam (dipakai PG, PG kompleks, benar-salah). */
export function OptionButton({
  opt,
  label,
  selected,
  onClick,
  fontSize,
  isDesktop,
}: {
  opt: { key: string; text: string }
  label: string
  selected: boolean
  onClick: () => void
  fontSize: number
  isDesktop: boolean
}) {
  const { token: themeToken } = theme.useToken()
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`cbt-opt${selected ? ' cbt-opt-selected' : ''}`}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        minHeight: 58,
        textAlign: 'left',
        padding: isDesktop ? '10px 18px 10px 12px' : '10px 12px 10px 10px',
        borderRadius: 12,
        border: `1.5px solid ${selected ? themeToken.colorPrimary : themeToken.colorBorder}`,
        background: selected ? themeToken.colorPrimaryBg : themeToken.colorBgContainer,
        cursor: 'pointer',
        fontSize,
        lineHeight: 1.55,
        color: themeToken.colorText,
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 700,
          background: selected ? themeToken.colorPrimary : themeToken.colorFillTertiary,
          color: selected ? '#fff' : themeToken.colorTextSecondary,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{opt.text}</span>
      {selected && (
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15, ease: EASE }}
          style={{ display: 'inline-flex' }}
        >
          <CheckCircleFilled style={{ fontSize: 20, color: themeToken.colorPrimary }} />
        </motion.span>
      )}
    </button>
  )
}
