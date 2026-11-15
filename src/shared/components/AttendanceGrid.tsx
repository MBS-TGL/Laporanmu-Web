import { useMemo, useRef } from 'react'
import { Button, Popover, Space, Table, Tag, Tooltip, theme, type TableColumnsType } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { summarizeDays } from '../../features/attendance/api'
import {
  STATUS_META,
  STATUS_ORDER,
  WEEKDAY_SHORT,
} from '../../features/attendance/constants'
import type { AttendanceStatus } from '../../features/attendance/types'
export type GridDays = Record<string, AttendanceStatus>

export interface GridStudent {
  id: string
  name: string
  registration_code: string
  className: string | null
}

export interface GridAlertThreshold {
  alpa: number
  hadirPct: number
}

export type GridCursor = { studentId: string; day: number } | null

interface AttendanceGridProps {
  students: GridStudent[]
  /** Hari → status per santri (gabungan tersimpan + draf) */
  daysById: Map<string, GridDays>
  notesById: Map<string, string>
  year: number
  month: number
  daysInMonth: number
  todayCol: number
  weekdays: number
  canWrite: boolean
  hideWeekend: boolean
  loading?: boolean
  cursor: GridCursor
  onCursorChange: (cursor: GridCursor) => void
  /** Mousedown sel: siklus status + mulai drag (state drag dikelola parent) */
  onCellMouseDown: (studentId: string, day: number) => void
  /** Mouseenter sel saat drag aktif — parent memutuskan isi/tidak */
  onDragPaint: (studentId: string, day: number) => void
  onSetCell: (studentId: string, day: number, status: AttendanceStatus | '') => void
  onFillColumn: (day: number, status: AttendanceStatus | '') => void
  onOpenNote: (studentId: string) => void
  onOpenStudent: (studentId: string) => void
  alertThreshold: GridAlertThreshold
}

const EMPTY_DAYS: GridDays = {}

/** Grid presensi bulanan: sel siklus + drag-to-fill + isi kolom + rekap per baris. */
export function AttendanceGrid({
  students,
  daysById,
  notesById,
  year,
  month,
  daysInMonth,
  todayCol,
  weekdays,
  canWrite,
  hideWeekend,
  loading,
  cursor,
  onCursorChange,
  onCellMouseDown,
  onDragPaint,
  onSetCell,
  onFillColumn,
  onOpenNote,
  onOpenStudent,
  alertThreshold,
}: AttendanceGridProps) {
  const { token } = theme.useToken()
  const gridBodyRef = useRef<HTMLDivElement | null>(null)

  const visibleDays = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(
        (d) => !(hideWeekend && isWeekendDay(year, month, d)),
      ),
    [daysInMonth, hideWeekend, year, month],
  )

  const summaries = useMemo(
    () => new Map(students.map((s) => [s.id, summarizeDays(daysById.get(s.id) ?? EMPTY_DAYS)])),
    [students, daysById],
  )

  // Total per hari (foot): hadir vs selain hadir
  const colSummary = useMemo(() => {
    const out = new Map<number, { h: number; x: number }>()
    for (const d of visibleDays) {
      let h = 0
      let x = 0
      for (const s of students) {
        const v = (daysById.get(s.id) ?? EMPTY_DAYS)[String(d)]
        if (v === 'H') h++
        else if (v) x++
      }
      out.set(d, { h, x })
    }
    return out
  }, [visibleDays, students, daysById])

  const statusTotals = useMemo(() => {
    const out: Record<AttendanceStatus, number> = { H: 0, S: 0, I: 0, A: 0, P: 0 }
    for (const s of students) {
      const sum = summaries.get(s.id)
      if (!sum) continue
      for (const st of STATUS_ORDER) out[st] += sum[st]
    }
    return out
  }, [students, summaries])

  const percentOf = (sum: { H: number }) =>
    weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0

  // ─── Navigasi keyboard (panah + tombol status) ────────────────────────────
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!canWrite || students.length === 0) return
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

    const key = e.key
    const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Home', 'End']
    const statusKeys = ['h', 's', 'i', 'a', 'p']
    const clearKeys = ['x', '0', 'Backspace', 'Delete']
    const lower = key.length === 1 ? key.toLowerCase() : key

    const rowIdx = cursor ? students.findIndex((s) => s.id === cursor.studentId) : -1
    const dayPos = cursor ? visibleDays.indexOf(cursor.day) : -1

    if (nav.includes(key)) {
      e.preventDefault()
      const startRow = rowIdx >= 0 ? rowIdx : 0
      const startPos = dayPos >= 0 ? dayPos : 0
      let r = startRow
      let p = startPos
      if (key === 'ArrowUp') r = Math.max(0, startRow - 1)
      else if (key === 'ArrowDown' || key === 'Enter') r = Math.min(students.length - 1, startRow + 1)
      else if (key === 'ArrowLeft') p = Math.max(0, startPos - 1)
      else if (key === 'ArrowRight') p = Math.min(visibleDays.length - 1, startPos + 1)
      else if (key === 'Home') p = 0
      else if (key === 'End') p = visibleDays.length - 1
      onCursorChange({ studentId: students[r].id, day: visibleDays[p] })
      return
    }

    if (!cursor || rowIdx < 0 || dayPos < 0) return

    if (statusKeys.includes(lower)) {
      e.preventDefault()
      onSetCell(cursor.studentId, cursor.day, lower.toUpperCase() as AttendanceStatus)
    } else if (clearKeys.includes(lower)) {
      e.preventDefault()
      onSetCell(cursor.studentId, cursor.day, '')
    }
  }

  // ─── Popover isi kolom (header hari) ──────────────────────────────────────
  const fillColumnContent = (day: number) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        Isi hari {day} untuk {students.length} anggota
      </div>
      <Space size={4} wrap>
        {STATUS_ORDER.map((st) => (
          <Tooltip key={st} title={STATUS_META[st].label}>
            <button
              onClick={() => onFillColumn(day, st)}
              style={{
                width: 30,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: STATUS_META[st].color,
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          </Tooltip>
        ))}
        <Button size="small" onClick={() => onFillColumn(day, '')}>
          Kosongkan
        </Button>
      </Space>
    </div>
  )

  // ─── Kolom ────────────────────────────────────────────────────────────────
  const columns: TableColumnsType<GridStudent> = [
    {
      title: 'Nama Anggota',
      key: 'name',
      fixed: 'left',
      width: 200,
      render: (_, s) => {
        const days = daysById.get(s.id) ?? EMPTY_DAYS
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const pct = percentOf(sum)
        const anyFilled = Object.keys(days).length > 0
        const alertAlpa = sum.A >= alertThreshold.alpa
        const alertHadir = anyFilled && pct < alertThreshold.hadirPct
        const note = notesById.get(s.id)
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                type="link"
                style={{ padding: 0, height: 'auto', fontWeight: 600, maxWidth: 140 }}
                onClick={() => onOpenStudent(s.id)}
              >
                <span
                  style={{
                    display: 'block',
                    maxWidth: 140,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {s.name}
                </span>
              </Button>
              <Tooltip title={note ? `Catatan: ${note}` : 'Tambah catatan'}>
                <Button
                  type="text"
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={() => onOpenNote(s.id)}
                  style={{ color: note ? '#f59e0b' : token.colorTextQuaternary }}
                />
              </Tooltip>
            </div>
            <div style={{ fontSize: 11, color: token.colorTextTertiary }}>
              {s.className ?? s.registration_code}
            </div>
            {alertAlpa && (
              <Tag color="red" style={{ marginTop: 2, fontSize: 11, lineHeight: '16px', paddingInline: 6 }}>
                Alpa {sum.A}×
              </Tag>
            )}
            {!alertAlpa && alertHadir && (
              <Tag color="orange" style={{ marginTop: 2, fontSize: 11, lineHeight: '16px', paddingInline: 6 }}>
                Hadir {pct}%
              </Tag>
            )}
          </div>
        )
      },
    },
    ...visibleDays.map((day) => {
      const isToday = day === todayCol
      const weekend = isWeekendDay(year, month, day)
      const headColor = isToday ? token.colorPrimary : weekend ? '#cbd5e1' : '#475569'
      return {
        title: canWrite ? (
          <Popover content={fillColumnContent(day)} trigger="click" placement="bottom">
            <div
              id={isToday ? 'presensi-today-col' : undefined}
              style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
              title="Klik: isi/kosongkan kolom ini"
            >
              <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: headColor }}>
                {day}
              </div>
              <div style={{ fontSize: 9, color: isToday ? token.colorPrimary : '#94a3b8' }}>
                {isToday ? 'HARI INI' : WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()]}
              </div>
            </div>
          </Popover>
        ) : (
          <div id={isToday ? 'presensi-today-col' : undefined} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: headColor }}>
              {day}
            </div>
            <div style={{ fontSize: 9, color: isToday ? token.colorPrimary : '#94a3b8' }}>
              {isToday ? 'HARI INI' : WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()]}
            </div>
          </div>
        ),
        key: `day-${day}`,
        width: isToday ? 46 : 38,
        onHeaderCell: () => ({
          style: {
            padding: '4px 2px',
            background: isToday ? 'rgba(99,102,241,0.07)' : weekend ? '#f8fafc' : undefined,
          },
        }),
        onCell: () => ({
          style: {
            padding: '2px',
            background: isToday ? 'rgba(99,102,241,0.06)' : weekend ? '#fbfcfe' : undefined,
          },
        }),
        render: (_: unknown, s: GridStudent) => {
          const status = (daysById.get(s.id) ?? EMPTY_DAYS)[String(day)] ?? ''
          const meta = status ? STATUS_META[status] : null
          const isCursor = cursor?.studentId === s.id && cursor?.day === day
          return (
            <Tooltip title={meta ? meta.label : `Klik isi hari ${day}`}>
              <div
                onMouseDown={
                  canWrite
                    ? (e) => {
                        if (e.button !== 0) return
                        onCellMouseDown(s.id, day)
                      }
                    : undefined
                }
                onMouseEnter={
                  canWrite
                    ? () => onDragPaint(s.id, day)
                    : undefined
                }
                onContextMenu={
                  canWrite
                    ? (e) => {
                        e.preventDefault()
                        onSetCell(s.id, day, '')
                      }
                    : undefined
                }
                style={{
                  width: 28,
                  height: 26,
                  margin: '0 auto',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canWrite ? 'pointer' : 'default',
                  fontSize: 12,
                  fontWeight: 700,
                  color: meta ? '#fff' : '#cbd5e1',
                  background: meta ? meta.color : '#f1f5f9',
                  outline: isCursor ? `2px solid ${token.colorPrimary}` : undefined,
                  outlineOffset: 1,
                  userSelect: 'none',
                }}
              >
                {status || '·'}
              </div>
            </Tooltip>
          )
        },
      }
    }),
    ...STATUS_ORDER.map((st) => ({
      title: (
        <Tooltip title={STATUS_META[st].label}>
          <span style={{ fontWeight: 700, fontSize: 12, color: STATUS_META[st].color }}>{st}</span>
        </Tooltip>
      ),
      key: `sum-${st}`,
      width: 34,
      onHeaderCell: () => ({ style: { borderLeft: '2px solid rgba(0,0,0,0.06)' } }),
      onCell: () => ({ style: { borderLeft: '2px solid rgba(0,0,0,0.06)' } }),
      render: (_: unknown, s: GridStudent) => {
        const total = summaries.get(s.id)?.[st] ?? 0
        return (
          <span
            style={{
              fontWeight: 700,
              fontSize: 12,
              color: STATUS_META[st].color,
              opacity: total === 0 ? 0.25 : 1,
            }}
          >
            {total}
          </span>
        )
      },
    })),
    {
      title: '%',
      key: 'pct',
      width: 52,
      render: (_, s) => {
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const pct = percentOf(sum)
        const anyFilled = Object.keys(daysById.get(s.id) ?? EMPTY_DAYS).length > 0
        const alert = sum.A >= alertThreshold.alpa || (anyFilled && pct < alertThreshold.hadirPct)
        return (
          <span
            style={{
              fontWeight: 700,
              fontSize: 12.5,
              fontVariantNumeric: 'tabular-nums',
              color: alert ? '#dc2626' : pct >= 80 ? '#059669' : pct > 0 ? '#d97706' : token.colorTextQuaternary,
            }}
          >
            {pct}%
          </span>
        )
      },
    },
  ]

  // ─── Footer total per hari ────────────────────────────────────────────────
  let summaryIndex = 0
  const nextSummaryIndex = () => summaryIndex++

  return (
    <div ref={gridBodyRef} tabIndex={0} onKeyDown={handleGridKeyDown} style={{ outline: 'none' }}>
      <Table<GridStudent>
        rowKey="id"
        columns={columns}
        dataSource={students}
        loading={loading}
        pagination={false}
        sticky
        size="small"
        scroll={{ x: 'max-content' }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={nextSummaryIndex()}>
                <span style={{ fontWeight: 700, fontSize: 11, color: token.colorTextSecondary }}>
                  Total / Hari
                </span>
              </Table.Summary.Cell>
              {visibleDays.map((day) => {
                const { h, x } = colSummary.get(day) ?? { h: 0, x: 0 }
                const weekend = isWeekendDay(year, month, day)
                return (
                  <Table.Summary.Cell key={day} index={nextSummaryIndex()} align="center">
                    <div style={{ lineHeight: 1.3, opacity: weekend ? 0.4 : 1 }}>
                      {h > 0 && (
                        <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#059669' }}>
                          {h}
                        </span>
                      )}
                      {x > 0 && (
                        <span style={{ display: 'block', fontSize: 9, fontWeight: 700, color: x >= alertThreshold.alpa ? '#dc2626' : '#f59e0b' }}>
                          {x}
                        </span>
                      )}
                    </div>
                  </Table.Summary.Cell>
                )
              })}
              {STATUS_ORDER.map((st) => (
                <Table.Summary.Cell key={st} index={nextSummaryIndex()} align="center">
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 11,
                      color: STATUS_META[st].color,
                      opacity: statusTotals[st] === 0 ? 0.25 : 1,
                    }}
                  >
                    {statusTotals[st]}
                  </span>
                </Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={nextSummaryIndex()} align="center">
                <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {percentOf(statusTotals)}%
                </span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  )
}

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay()
  return dow === 0 || dow === 6
}
