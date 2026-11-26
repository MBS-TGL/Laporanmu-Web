import { useState, type KeyboardEvent } from 'react'
import { Badge, Button, Empty, Select, Typography, theme } from 'antd'
import {
  ArrowDownOutlined,
  BookOutlined,
  CheckCircleFilled,
  FormOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons'
import { isPracticalKey, type Criterion } from '../constants'
import type { ReportCardStudent, ReportCardType } from '../types'

type Token = ReturnType<typeof theme.useToken>['token']

interface BehaviorInfo {
  negative: number
  positive: number
  items: string[]
}

interface MobileEntryProps {
  students: ReportCardStudent[]
  criteria: Criterion[]
  type: ReportCardType
  maxScore: number
  canWrite: boolean
  behaviorByStudent: Map<string, BehaviorInfo>
  hasClassStudents: boolean
  getScore: (studentId: string, key: string) => number | null
  isRowComplete: (studentId: string) => boolean
  hafalanById: Map<string, string>
  onCommitScore: (studentId: string, key: string, value: number | null) => void
  onOpenExtras: (student: ReportCardStudent) => void
  onOpenHafalan: (student: ReportCardStudent) => void
  onClearFilters: () => void
}

function tintFor(token: Token, type: ReportCardType, value: number | null): string {
  if (value === null) return token.colorBgContainer
  if (type === 'monthly') {
    if (value >= 8) return token.colorSuccessBg
    if (value >= 6) return token.colorWarningBg
    if (value >= 4) return token.colorWarningBgHover
    return token.colorErrorBg
  }
  if (value >= 80) return token.colorSuccessBg
  if (value >= 50) return token.colorWarningBg
  return token.colorErrorBg
}

/** Mode input ponsel: satu santri per layar, tombol besar, tanpa overflow horizontal. */
export function MobileEntry({
  students,
  criteria,
  type,
  maxScore,
  canWrite,
  behaviorByStudent,
  hasClassStudents,
  getScore,
  isRowComplete,
  hafalanById,
  onCommitScore,
  onOpenExtras,
  onOpenHafalan,
  onClearFilters,
}: MobileEntryProps) {
  const { token } = theme.useToken()
  const [index, setIndex] = useState(0)

  if (students.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          hasClassStudents
            ? 'Tidak ada santri yang cocok dengan pencarian/filter'
            : 'Kelas ini belum memiliki santri'
        }
        style={{ padding: '40px 0' }}
      >
        {hasClassStudents ? <Button onClick={onClearFilters}>Bersihkan filter</Button> : null}
      </Empty>
    )
  }

  const clamped = Math.min(index, students.length - 1)
  const student = students[clamped]
  const behavior = behaviorByStudent.get(student.id)
  const values = criteria.map((criterion) => getScore(student.id, criterion.key))
  const filled = values.filter((value) => typeof value === 'number').length
  const averageValues = values.filter(
    (value, position) =>
      typeof value === 'number' && !isPracticalKey(criteria[position]?.key ?? ''),
  ) as number[]
  const average = averageValues.length
    ? Math.round((averageValues.reduce((sum, value) => sum + value, 0) / averageValues.length) * 100) / 100
    : null
  const complete = isRowComplete(student.id)
  const hafalanNote = hafalanById.get(student.id) ?? ''

  let nextIncomplete: number | null = null
  for (let offset = 1; offset < students.length; offset++) {
    const candidate = (clamped + offset) % students.length
    if (!isRowComplete(students[candidate].id)) {
      nextIncomplete = candidate
      break
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Navigasi santri */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button
          icon={<LeftOutlined />}
          disabled={clamped === 0}
          onClick={() => setIndex(clamped - 1)}
          aria-label="Santri sebelumnya"
          style={{ flexShrink: 0 }}
        />
        <Select
          style={{ flex: 1 }}
          value={student.id}
          onChange={(id) => setIndex(students.findIndex((item) => item.id === id))}
          options={students.map((item, position) => ({ value: item.id, label: `${position + 1}. ${item.name}` }))}
          showSearch
          optionFilterProp="label"
        />
        <Button
          icon={<RightOutlined />}
          disabled={clamped >= students.length - 1}
          onClick={() => setIndex(clamped + 1)}
          aria-label="Santri berikutnya"
          style={{ flexShrink: 0 }}
        />
      </div>

      {/* Kartu santri */}
      <div
        style={{
          border: `1px solid ${token.colorBorder}`,
          borderRadius: token.borderRadiusLG,
          background: token.colorBgContainer,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>{student.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {clamped + 1}/{students.length}
          </Typography.Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
            {filled}/{criteria.length} terisi · rata-rata {average ?? '–'}
          </Typography.Text>
          {complete && (
            <CheckCircleFilled style={{ color: token.colorSuccess }} aria-label="Lengkap" />
          )}
          {behavior && behavior.negative > 0 && (
            <Badge count={behavior.negative} color={token.colorError} title="Pelanggaran" />
          )}
          {behavior && behavior.positive > 0 && (
            <Badge count={behavior.positive} color={token.colorSuccess} title="Prestasi" />
          )}
        </div>

        {/* Nilai per kriteria */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {criteria.map((criterion, position) => (
            <div key={criterion.key}>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
              >
                {criterion.label}
              </Typography.Text>
              <ScoreMobileCell
                value={values[position] ?? null}
                max={maxScore}
                type={type}
                disabled={!canWrite}
                label={`${criterion.label} ${student.name}`}
                onCommit={(value) => onCommitScore(student.id, criterion.key, value)}
              />
            </div>
          ))}
        </div>

        {type === 'pondok_oral' ? (
          <Button
            block
            icon={<BookOutlined />}
            disabled={!canWrite}
            onClick={() => onOpenHafalan(student)}
            style={{ marginTop: 14 }}
          >
            {hafalanNote ? `Hafalan: ${hafalanNote}` : 'Hafalan di luar Juz 30–26'}
          </Button>
        ) : (
          <Button
            block
            icon={<FormOutlined />}
            disabled={!canWrite}
            onClick={() => onOpenExtras(student)}
            style={{ marginTop: 14 }}
          >
            Data Pendukung (fisik, kehadiran, catatan)
          </Button>
        )}
      </div>

      <Button
        block
        icon={<ArrowDownOutlined />}
        disabled={nextIncomplete === null}
        onClick={() => {
          if (nextIncomplete !== null) setIndex(nextIncomplete)
        }}
      >
        Santri berikutnya yang belum lengkap
      </Button>
    </div>
  )
}

/** Sel input besar untuk sentuhan (target 44px) dengan tint predikat yang sama. */
function ScoreMobileCell({
  value,
  max,
  type,
  disabled,
  label,
  onCommit,
}: {
  value: number | null
  max: number
  type: ReportCardType
  disabled: boolean
  label: string
  onCommit: (value: number | null) => void
}) {
  const { token } = theme.useToken()
  const [text, setText] = useState(() => (value === null ? '' : String(value)))
  const [syncedValue, setSyncedValue] = useState(value)
  const [focused, setFocused] = useState(false)

  if (syncedValue !== value) {
    setSyncedValue(value)
    setText(value === null ? '' : String(value))
  }

  const handleChange = (raw: string) => {
    const normalized = raw.replace(',', '.')
    if (normalized !== '' && !/^\d*\.?\d{0,1}$/.test(normalized)) return
    setText(normalized)
    if (normalized === '') {
      onCommit(null)
      return
    }
    const parsed = Number.parseFloat(normalized)
    if (Number.isNaN(parsed)) return
    onCommit(Math.round(Math.min(max, Math.max(0, parsed)) * 10) / 10)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur()
  }

  const handleBlur = () => {
    setFocused(false)
    if (!text.endsWith('.')) return
    const next = text.slice(0, -1)
    setText(next)
    if (next === '') onCommit(null)
  }

  return (
    <input
      value={text}
      disabled={disabled}
      inputMode="decimal"
      placeholder="–"
      aria-label={label}
      onChange={(event) => handleChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        setFocused(true)
        event.currentTarget.select()
      }}
      onBlur={handleBlur}
      style={{
        width: '100%',
        height: 44,
        marginTop: 4,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        borderRadius: token.borderRadius,
        border: `1px solid ${focused ? token.colorPrimary : token.colorBorder}`,
        background: tintFor(token, type, value),
        boxShadow: focused ? `0 0 0 2px ${token.colorPrimaryBorder}` : undefined,
        outline: 'none',
        padding: '0 10px',
        color: token.colorText,
      }}
    />
  )
}
