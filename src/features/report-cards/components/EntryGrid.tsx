import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { Badge, Button, Empty, Popconfirm, Space, Tooltip, Typography, theme } from 'antd'
import { BookOutlined, CheckCircleFilled, DeleteOutlined, FormOutlined } from '@ant-design/icons'
import { isPracticalKey, isTahfidzKey, type Criterion } from '../constants'
import { parseScoreBlock } from '../pasteParse'
import type { ReportCardStudent, ReportCardType } from '../types'

type Token = ReturnType<typeof theme.useToken>['token']

interface BehaviorInfo {
  negative: number
  positive: number
  items: string[]
}

export interface GridFocusRequest {
  studentId: string
  col: number
  nonce: number
}

interface EntryGridProps {
  students: ReportCardStudent[]
  criteria: Criterion[]
  type: ReportCardType
  maxScore: number
  showBehavior: boolean
  canWrite: boolean
  canDelete: boolean
  behaviorByStudent: Map<string, BehaviorInfo>
  dirtyIds: Set<string>
  focusRequest: GridFocusRequest | null
  hasClassStudents: boolean
  getScore: (studentId: string, key: string) => number | null
  isRowComplete: (studentId: string) => boolean
  hafalanById: Map<string, string>
  onCommitScore: (studentId: string, key: string, value: number | null) => void
  onOpenExtras: (student: ReportCardStudent) => void
  onOpenHafalan: (student: ReportCardStudent) => void
  onResetRow: (studentId: string) => void
  onClearFilters: () => void
  onUndo: () => void
  onRedo: () => void
  onPasteScores: (studentId: string, criterionKey: string, values: (number | null)[][]) => void
}

const fmtValue = (value: number | null) => (value === null ? '' : String(value))

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

function valueOf(text: string, max: number): number | null {
  const parsed = Number.parseFloat(text.replace(',', '.'))
  if (Number.isNaN(parsed)) return null
  return Math.min(max, Math.max(0, parsed))
}

/** Kelompok kolom ujian lisan: Materi | Tahfidz | Praktik (null = tanpa kelompok). */
function groupOf(type: ReportCardType, criterion: Criterion): string | null {
  if (type !== 'pondok_oral') return null
  if (isTahfidzKey(criterion.key)) return 'Tahfidz'
  if (isPracticalKey(criterion.key)) return 'Praktik'
  return 'Materi'
}

/** Garis pemisah antar kelompok kolom (bukan antar kolom dalam kelompok sama). */
function startsGroup(criteria: Criterion[], col: number, type: ReportCardType): boolean {
  if (col === 0) return false
  const prev = groupOf(type, criteria[col - 1])
  const curr = groupOf(type, criteria[col])
  return curr !== null && prev !== curr
}

/** Sel nilai: input teks dengan sanitasi desimal + tint predikat.
 * Nilai lokal berupa string agar ketikan menengah ("8.") tidak melompat. */
function ScoreCell({
  value,
  max,
  type,
  disabled,
  label,
  cellId,
  onCommit,
  onKeyDown,
  onPasteBlock,
}: {
  value: number | null
  max: number
  type: ReportCardType
  disabled: boolean
  label: string
  cellId: string
  onCommit: (value: number | null) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onPasteBlock: (text: string) => void
}) {
  const { token } = theme.useToken()
  const [text, setText] = useState(() => fmtValue(value))
  const [syncedValue, setSyncedValue] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const [focused, setFocused] = useState(false)

  // Sinkronkan ketika nilai berubah dari luar (salin bulan lalu, isi massal, reset)
  if (syncedValue !== value) {
    setSyncedValue(value)
    setText(fmtValue(value))
  }

  const handleChange = (raw: string) => {
    // sanitasi: angka + satu pemisah desimal, maksimal 1 angka desimal
    const normalized = raw.replace(',', '.')
    if (normalized !== '' && !/^\d*\.?\d{0,1}$/.test(normalized)) return
    setText(normalized)
    if (normalized === '') {
      setInvalid(false)
      onCommit(null)
      return
    }
    const parsed = Number.parseFloat(normalized)
    if (Number.isNaN(parsed)) {
      setInvalid(true)
      return
    }
    const clamped = Math.min(max, Math.max(0, parsed))
    setInvalid(false)
    onCommit(Math.round(clamped * 10) / 10)
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
      data-cell={cellId}
      value={text}
      disabled={disabled}
      inputMode="decimal"
      placeholder="–"
      aria-label={label}
      onChange={(event) => handleChange(event.target.value)}
      onKeyDown={onKeyDown}
      onPaste={(event) => {
        const text = event.clipboardData.getData('text')
        if (!text.includes('\t') && !text.includes('\n')) return
        event.preventDefault()
        onPasteBlock(text)
      }}
      onFocus={(event) => {
        setFocused(true)
        event.currentTarget.select()
      }}
      onBlur={handleBlur}
      style={{
        width: 64,
        height: 32,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        borderRadius: token.borderRadius,
        border: invalid
          ? `2px solid ${token.colorError}`
          : `1px solid ${focused ? token.colorPrimary : token.colorBorder}`,
        background: tintFor(token, type, valueOf(text, max)),
        boxShadow: focused ? `0 0 0 2px ${token.colorPrimaryBorder}` : undefined,
        outline: 'none',
        padding: '0 6px',
        color: token.colorText,
      }}
    />
  )
}

interface ScoreRowProps {
  student: ReportCardStudent
  rowIndex: number
  scores: (number | null)[]
  criteria: Criterion[]
  type: ReportCardType
  maxScore: number
  showBehavior: boolean
  canWrite: boolean
  canDelete: boolean
  behavior: BehaviorInfo | undefined
  dirty: boolean
  complete: boolean
  hafalanNote: string
  onCommitScore: (studentId: string, key: string, value: number | null) => void
  onOpenExtras: (student: ReportCardStudent) => void
  onOpenHafalan: (student: ReportCardStudent) => void
  onResetRow: (studentId: string) => void
  focusCell: (row: number, col: number) => void
  onJumpNextIncomplete: (row: number) => void
  onUndo: () => void
  onRedo: () => void
  onPasteBlock: (row: number, col: number, text: string) => void
}

const ScoreRow = memo(function ScoreRow({
  student,
  rowIndex,
  scores,
  criteria,
  type,
  maxScore,
  showBehavior,
  canWrite,
  canDelete,
  behavior,
  dirty,
  complete,
  hafalanNote,
  onCommitScore,
  onOpenExtras,
  onOpenHafalan,
  onResetRow,
  focusCell,
  onJumpNextIncomplete,
  onUndo,
  onRedo,
  onPasteBlock,
}: ScoreRowProps) {
  const { token } = theme.useToken()
  const filled = scores.filter((value) => typeof value === 'number').length

  const handleKeyDown = (col: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    const modifier = event.ctrlKey || event.metaKey
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) onRedo()
      else onUndo()
      return
    }
    if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      onRedo()
      return
    }
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      onJumpNextIncomplete(rowIndex)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const nextCol = col + 1
      if (nextCol >= criteria.length) focusCell(rowIndex + 1, 0)
      else focusCell(rowIndex, nextCol)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusCell(rowIndex + 1, col)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusCell(rowIndex - 1, col)
    }
    // Tab/Shift+Tab biarkan default browser: urutan DOM sudah row-major
  }

  return (
    <tr style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      {/* Kolom santri — sticky kiri */}
      <td
        style={{
          position: 'sticky',
          left: 0,
          background: token.colorBgContainer,
          zIndex: 1,
          padding: '8px 12px',
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {student.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 150,
                color: token.colorText,
              }}
            >
              {student.name}
            </div>
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
              {filled}/{criteria.length} terisi{dirty ? ' · draf' : ''}
            </div>
          </div>
          {complete && (
            <CheckCircleFilled
              style={{ color: token.colorSuccess, fontSize: 14, flexShrink: 0 }}
              aria-label="Lengkap"
            />
          )}
        </div>
      </td>

      {/* Sel nilai per kriteria */}
      {criteria.map((criterion, col) => (
        <td
          key={criterion.key}
          style={{
            padding: '6px 4px',
            textAlign: 'center',
            borderLeft: startsGroup(criteria, col, type)
              ? `2px solid ${token.colorBorder}`
              : undefined,
          }}
        >
          <ScoreCell
            value={scores[col]}
            max={maxScore}
            type={type}
            disabled={!canWrite}
            label={`${student.name} ${criterion.label}`}
            cellId={`${rowIndex}-${col}`}
            onCommit={(value) => onCommitScore(student.id, criterion.key, value)}
            onKeyDown={handleKeyDown(col)}
            onPasteBlock={(text) => onPasteBlock(rowIndex, col, text)}
          />
        </td>
      ))}

      {/* Rata-rata */}
      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
        <RowAverage scores={scores} criteria={criteria} />
      </td>

      {/* Status */}
      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
        {dirty ? (
          <Typography.Text style={{ fontSize: 12, color: token.colorInfo, fontWeight: 600 }}>
            Draf
          </Typography.Text>
        ) : complete ? (
          <Typography.Text style={{ fontSize: 12, color: token.colorSuccess, fontWeight: 600 }}>
            Lengkap
          </Typography.Text>
        ) : filled === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Kosong
          </Typography.Text>
        ) : (
          <Typography.Text style={{ fontSize: 12, color: token.colorWarning, fontWeight: 600 }}>
            Sebagian
          </Typography.Text>
        )}
      </td>

      {/* Poin perilaku bulan ini (hanya raport bulanan) */}
      {showBehavior && (
        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
          {behavior && (behavior.negative > 0 || behavior.positive > 0) ? (
            <Tooltip
              title={
                <div>
                  {behavior.items.map((item, index) => (
                    <div key={index}>{item}</div>
                  ))}
                </div>
              }
            >
              <Space size={4}>
                {behavior.negative > 0 && (
                  <Badge count={behavior.negative} color={token.colorError} title="Pelanggaran" />
                )}
                {behavior.positive > 0 && (
                  <Badge count={behavior.positive} color={token.colorSuccess} title="Prestasi" />
                )}
              </Space>
            </Tooltip>
          ) : (
            <span style={{ color: token.colorTextQuaternary }}>–</span>
          )}
        </td>
      )}

      {/* Aksi — sticky kanan */}
      <td
        style={{
          position: 'sticky',
          right: 0,
          background: token.colorBgContainer,
          zIndex: 1,
          padding: '6px 8px',
          textAlign: 'center',
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Space size={2}>
          {type === 'pondok_oral' ? (
            <Tooltip title={hafalanNote ? `Hafalan: ${hafalanNote}` : 'Hafalan di luar Juz 30–26'}>
              <Button
                type="text"
                size="small"
                icon={<BookOutlined />}
                disabled={!canWrite}
                onClick={() => onOpenHafalan(student)}
                aria-label={`Hafalan ${student.name}`}
                style={hafalanNote ? { color: token.colorPrimary } : undefined}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Data pendukung (fisik, kehadiran, catatan)">
              <Button
                type="text"
                size="small"
                icon={<FormOutlined />}
                disabled={!canWrite}
                onClick={() => onOpenExtras(student)}
                aria-label={`Data pendukung ${student.name}`}
              />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Hapus data raport siswa ini?"
              description="Baris raport periode ini akan dihapus permanen."
              okText="Ya, hapus"
              cancelText="Batal"
              onConfirm={() => onResetRow(student.id)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={`Hapus raport ${student.name}`}
              />
            </Popconfirm>
          )}
        </Space>
      </td>
    </tr>
  )
}, areRowPropsEqual)

function areRowPropsEqual(prev: ScoreRowProps, next: ScoreRowProps) {
  if (
    prev.student !== next.student ||
    prev.rowIndex !== next.rowIndex ||
    prev.criteria !== next.criteria ||
    prev.type !== next.type ||
    prev.maxScore !== next.maxScore ||
    prev.showBehavior !== next.showBehavior ||
    prev.canWrite !== next.canWrite ||
    prev.canDelete !== next.canDelete ||
    prev.behavior !== next.behavior ||
    prev.dirty !== next.dirty ||
    prev.complete !== next.complete ||
    prev.hafalanNote !== next.hafalanNote ||
    prev.onCommitScore !== next.onCommitScore ||
    prev.onOpenExtras !== next.onOpenExtras ||
    prev.onOpenHafalan !== next.onOpenHafalan ||
    prev.onResetRow !== next.onResetRow ||
    prev.focusCell !== next.focusCell ||
    prev.onJumpNextIncomplete !== next.onJumpNextIncomplete ||
    prev.onUndo !== next.onUndo ||
    prev.onRedo !== next.onRedo ||
    prev.onPasteBlock !== next.onPasteBlock
  ) {
    return false
  }
  if (prev.scores.length !== next.scores.length) return false
  for (let index = 0; index < prev.scores.length; index++) {
    if (prev.scores[index] !== next.scores[index]) return false
  }
  return true
}

export function EntryGrid({
  students,
  criteria,
  type,
  maxScore,
  showBehavior,
  canWrite,
  canDelete,
  behaviorByStudent,
  dirtyIds,
  focusRequest,
  hasClassStudents,
  getScore,
  isRowComplete,
  hafalanById,
  onCommitScore,
  onOpenExtras,
  onOpenHafalan,
  onResetRow,
  onClearFilters,
  onUndo,
  onRedo,
  onPasteScores,
}: EntryGridProps) {
  const { token } = theme.useToken()
  const gridRef = useRef<HTMLDivElement>(null)

  const focusCell = useCallback((row: number, col: number) => {
    if (row < 0 || col < 0) return
    const input = gridRef.current?.querySelector<HTMLInputElement>(`[data-cell="${row}-${col}"]`)
    input?.focus()
  }, [])

  const handlePasteBlock = useCallback(
    (row: number, col: number, text: string) => {
      const student = students[row]
      const criterion = criteria[col]
      if (!student || !criterion) return
      const values = parseScoreBlock(text, maxScore)
      if (values.length === 0) return
      onPasteScores(student.id, criterion.key, values)
    },
    [students, criteria, maxScore, onPasteScores],
  )

  const incompleteRows = useMemo(
    () =>
      students.reduce<number[]>((rows, student, index) => {
        if (!isRowComplete(student.id)) rows.push(index)
        return rows
      }, []),
    [students, isRowComplete],
  )
  const incompleteRowsRef = useRef(incompleteRows)
  useEffect(() => {
    incompleteRowsRef.current = incompleteRows
  }, [incompleteRows])

  const jumpNextIncomplete = useCallback(
    (row: number) => {
      const rows = incompleteRowsRef.current
      if (rows.length === 0) return
      const target = rows.find((candidate) => candidate > row) ?? rows[0]
      focusCell(target, 0)
    },
    [focusCell],
  )

  const lastFocusNonce = useRef(0)
  useEffect(() => {
    if (!focusRequest || focusRequest.nonce === lastFocusNonce.current) return
    lastFocusNonce.current = focusRequest.nonce
    const row = students.findIndex((student) => student.id === focusRequest.studentId)
    if (row >= 0) focusCell(row, focusRequest.col)
  }, [focusRequest, students, focusCell])

  const colWidths = useMemo(() => {
    const behavior = showBehavior ? 96 : 0
    // 220 santri + criteria*76 + 76 rata + 92 status + behavior + 96 aksi
    return 220 + criteria.length * 76 + 76 + 92 + behavior + 96
  }, [criteria.length, showBehavior])

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

  const headerCell: CSSProperties = {
    position: 'sticky',
    top: 0,
    background: token.colorBgLayout,
    zIndex: 2,
    borderBottom: `1px solid ${token.colorBorder}`,
    padding: '8px 4px',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: token.colorTextSecondary,
    textAlign: 'center',
  }

  return (
    <div
      ref={gridRef}
      style={{
        overflowX: 'auto',
        borderRadius: token.borderRadius,
        border: `1px solid ${token.colorBorder}`,
      }}
    >
      <table
        style={{
          borderCollapse: 'separate',
          borderSpacing: 0,
          minWidth: colWidths,
          width: '100%',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                ...headerCell,
                left: 0,
                zIndex: 3,
                textAlign: 'left',
                padding: '8px 12px',
                minWidth: 220,
              }}
            >
              Santri
            </th>
            {criteria.map((criterion, col) => (
              <th
                key={criterion.key}
                style={{
                  ...headerCell,
                  minWidth: 76,
                  borderLeft: startsGroup(criteria, col, type)
                    ? `2px solid ${token.colorBorder}`
                    : undefined,
                }}
              >
                <Tooltip
                  title={
                    criterion.desc
                      ? `${criterion.label} · ${criterion.desc} (0-${maxScore})`
                      : `Skala 0-${maxScore}`
                  }
                >
                  <span style={{ cursor: 'help' }}>{criterion.label}</span>
                </Tooltip>
              </th>
            ))}
            <th style={{ ...headerCell, minWidth: 76 }}>Rata</th>
            <th style={{ ...headerCell, minWidth: 92 }}>Status</th>
            {showBehavior && <th style={{ ...headerCell, minWidth: 96 }}>Poin</th>}
            <th
              style={{
                ...headerCell,
                right: 0,
                zIndex: 3,
                minWidth: 96,
                padding: '8px 8px',
                borderLeft: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, row) => (
            <ScoreRow
              key={student.id}
              student={student}
              rowIndex={row}
              scores={criteria.map((criterion) => getScore(student.id, criterion.key))}
              criteria={criteria}
              type={type}
              maxScore={maxScore}
              showBehavior={showBehavior}
              canWrite={canWrite}
              canDelete={canDelete}
              behavior={behaviorByStudent.get(student.id)}
              dirty={dirtyIds.has(student.id)}
              complete={isRowComplete(student.id)}
              hafalanNote={hafalanById.get(student.id) ?? ''}
              onCommitScore={onCommitScore}
              onOpenExtras={onOpenExtras}
              onOpenHafalan={onOpenHafalan}
              onResetRow={onResetRow}
              focusCell={focusCell}
              onJumpNextIncomplete={jumpNextIncomplete}
              onUndo={onUndo}
              onRedo={onRedo}
              onPasteBlock={handlePasteBlock}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Rata-rata baris dari nilai efektif; materi praktik dikecualikan (mengikuti V1). */
function RowAverage({ scores, criteria }: { scores: (number | null)[]; criteria: Criterion[] }) {
  const { token } = theme.useToken()
  const values = scores.filter(
    (value, index) => typeof value === 'number' && !isPracticalKey(criteria[index]?.key ?? ''),
  ) as number[]
  const average =
    values.length === 0
      ? null
      : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
  return (
    <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', color: token.colorText }}>
      {average ?? '–'}
    </Typography.Text>
  )
}
