import { useRef, useState } from 'react'
import { Button, Empty, Popover, Space, Table, Tag, Tooltip, theme, type TableColumnsType } from 'antd'
import type { Teacher } from '../../types'
import {
  TEACHER_STATUS_OPTIONS,
  daysInMonth,
  getGridNote,
  getGridStatus,
  isWeekendDay,
  nextGridStatus,
  type GridCellStatus,
  type SavedTeacherGrid,
  type TeacherGridDrafts,
} from '../grid'

interface AttendanceGridProps {
  teachers: Teacher[]
  year: number
  month: number
  saved: SavedTeacherGrid
  drafts: TeacherGridDrafts
  loading?: boolean
  canWrite: boolean
  canDelete: boolean
  onSetCell: (teacherId: string, day: number, status: GridCellStatus) => void
  onFillColumn: (day: number, status: GridCellStatus) => void
}

const DAYS = (year: number, month: number) =>
  Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)

const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export function AttendanceGrid({
  teachers,
  year,
  month,
  saved,
  drafts,
  loading,
  canWrite,
  canDelete,
  onSetCell,
  onFillColumn,
}: AttendanceGridProps) {
  const { token } = theme.useToken()
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [cursor, setCursor] = useState<{ teacherId: string; day: number } | null>(null)
  const now = new Date()
  const today = now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : 0
  const dayCount = daysInMonth(year, month)

  const moveCursor = (teacherDelta: number, dayDelta: number) => {
    if (!cursor) return
    const index = teachers.findIndex((t) => t.id === cursor.teacherId)
    if (index === -1) return
    const nextIndex = Math.min(Math.max(index + teacherDelta, 0), teachers.length - 1)
    const nextDay = Math.min(Math.max(cursor.day + dayDelta, 1), dayCount)
    setCursor({ teacherId: teachers[nextIndex].id, day: nextDay })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!cursor || !canWrite) return
    const key = e.key

    if (key === 'ArrowUp') {
      e.preventDefault()
      moveCursor(-1, 0)
      return
    }
    if (key === 'ArrowDown' || key === 'Enter') {
      e.preventDefault()
      moveCursor(1, 0)
      return
    }
    if (key === 'ArrowLeft') {
      e.preventDefault()
      moveCursor(0, -1)
      return
    }
    if (key === 'ArrowRight') {
      e.preventDefault()
      moveCursor(0, 1)
      return
    }

    const option = TEACHER_STATUS_OPTIONS.find((o) => o.short.toLowerCase() === key.toLowerCase())
    if (option) {
      e.preventDefault()
      onSetCell(cursor.teacherId, cursor.day, option.value)
      return
    }

    if ((key === 'x' || key === 'X' || key === 'Backspace' || key === 'Delete') && canDelete) {
      e.preventDefault()
      onSetCell(cursor.teacherId, cursor.day, null)
    }
  }

  const fillColumnContent = (day: number) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        Isi hari {day} untuk semua guru & karyawan
      </div>
      <Space size={4} wrap>
        {TEACHER_STATUS_OPTIONS.map((opt) => (
          <Tooltip key={opt.value} title={opt.label}>
            <button
              onClick={() => onFillColumn(day, opt.value)}
              style={{
                width: 30,
                height: 28,
                borderRadius: 6,
                border: 'none',
                background: opt.color,
                color: '#fff',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {opt.short}
            </button>
          </Tooltip>
        ))}
        {canDelete && (
          <Button size="small" onClick={() => onFillColumn(day, null)}>
            Kosongkan
          </Button>
        )}
      </Space>
    </div>
  )

  const columns: TableColumnsType<Teacher> = [
    {
      title: 'Guru & Karyawan',
      key: 'name',
      fixed: 'left',
      width: 180,
      render: (_, t) => (
        <div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
          <div style={{ fontSize: 11, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>
            {t.nbm ? `NBM: ${t.nbm}` : ''} {t.subject ? `· ${t.subject}` : ''}
          </div>
        </div>
      ),
    },
    ...DAYS(year, month).map((day) => {
      const isToday = day === today
      const weekend = isWeekendDay(year, month, day)
      return {
        title: canWrite ? (
          <Popover content={fillColumnContent(day)} trigger="click" placement="bottom">
            <div
              style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
              title="Klik: isi/kosongkan kolom ini"
            >
              <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? token.colorPrimary : weekend ? '#cbd5e1' : '#475569' }}>
                {day}
              </div>
              <div style={{ fontSize: 9, color: isToday ? token.colorPrimary : '#94a3b8' }}>
                {isToday ? 'HARI INI' : WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()]}
              </div>
            </div>
          </Popover>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? token.colorPrimary : weekend ? '#cbd5e1' : '#475569' }}>
              {day}
            </div>
            <div style={{ fontSize: 9, color: isToday ? token.colorPrimary : '#94a3b8' }}>
              {isToday ? 'HARI INI' : WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()]}
            </div>
          </div>
        ),
        key: `day-${day}`,
        width: isToday ? 46 : 40,
        onHeaderCell: () => ({
          style: {
            padding: '4px 2px',
            background: isToday ? 'rgba(99,102,241,0.07)' : weekend ? '#f8fafc' : undefined,
          },
        }),
        onCell: () => ({
          style: {
            padding: 2,
            background: isToday ? 'rgba(99,102,241,0.06)' : weekend ? '#fbfcfe' : undefined,
          },
        }),
        render: (_: unknown, t: Teacher) => {
          const status = getGridStatus(saved, drafts, t.id, day)
          const meta = status ? TEACHER_STATUS_OPTIONS.find((o) => o.value === status) : null
          const note = getGridNote(saved, t.id, day)
          const isCursor = cursor?.teacherId === t.id && cursor?.day === day
          const tooltip = [meta?.label ?? `Hari ${day}: belum tercatat`, note].filter(Boolean).join(' · ')

          return (
            <Tooltip title={tooltip}>
              <div
                onClick={() => {
                  if (!canWrite) return
                  setCursor({ teacherId: t.id, day })
                  gridRef.current?.focus()
                  onSetCell(t.id, day, nextGridStatus(status))
                }}
                onContextMenu={(e) => {
                  if (!canDelete) return
                  e.preventDefault()
                  onSetCell(t.id, day, null)
                }}
                style={{
                  width: 28,
                  height: 26,
                  margin: '0 auto',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: meta ? meta.color : 'transparent',
                  border: meta ? 'none' : `1px dashed ${token.colorBorder}`,
                  color: meta ? '#fff' : token.colorTextTertiary,
                  cursor: canWrite ? 'pointer' : 'default',
                  opacity: canWrite ? 1 : 0.6,
                  outline: isCursor ? `2px solid ${token.colorPrimary}` : 'none',
                  outlineOffset: 1,
                }}
              >
                {meta?.short ?? ''}
              </div>
            </Tooltip>
          )
        },
      }
    }),
  ]

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {TEACHER_STATUS_OPTIONS.map((opt) => (
          <Tag key={opt.value} color={opt.color} style={{ margin: 0, fontWeight: 600 }}>
            {opt.short} · {opt.label}
          </Tag>
        ))}
      </div>
      <Tooltip
        title={
          <div style={{ lineHeight: 2 }}>
            <div><b>Klik sel</b> — Hadir → Sakit → Izin → Tugas Luar → kosong</div>
            <div><b>Klik kanan sel</b> — kosongkan status</div>
            <div><b>Klik tanggal di header</b> — isi hari itu untuk semua guru & karyawan</div>
            <div style={{ marginTop: 4, fontSize: 11, color: token.colorTextTertiary }}>
              Keyboard: <b>panah</b> pindah sel · <b>Enter</b> ke bawah · <b>H / S / I / T</b> isi status · <b>X</b> kosongkan
            </div>
          </div>
        }
        overlayStyle={{ maxWidth: 520 }}
        overlayInnerStyle={{ width: 'max-content', maxWidth: 520, padding: '10px 14px', fontSize: 12.5 }}
      >
        <div
          style={{
            marginBottom: 10,
            fontSize: 12.5,
            color: token.colorTextSecondary,
            cursor: 'help',
            width: 'fit-content',
          }}
        >
          Klik sel untuk mengisi • hari kerja Senin–Jumat • akhir pekan tetap bisa diisi
        </div>
      </Tooltip>
      <div ref={gridRef} tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: 'none', borderRadius: 8 }}>
        <Table<Teacher>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={teachers}
          loading={loading}
          pagination={false}
          sticky
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Belum ada data guru/karyawan aktif"
              />
            ),
          }}
        />
      </div>
    </div>
  )
}
