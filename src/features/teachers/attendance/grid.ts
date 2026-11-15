import type { TeacherRecapInput } from './recap'
import type {
  TeacherAttendance,
  TeacherAttendanceDeleteTarget,
  TeacherAttendancePayload,
  TeacherAttendanceStatus,
} from './types'

export type GridCellStatus = TeacherAttendanceStatus | null

/** Draf grid: guru → tanggal (1..31) → status atau null (hapus catatan) */
export type TeacherGridDrafts = Record<string, Record<number, GridCellStatus>>

export interface SavedTeacherGrid {
  status: Map<string, Map<number, TeacherAttendanceStatus>>
  note: Map<string, Map<number, string | null>>
}

export interface TeacherGridChangeSet {
  upserts: TeacherAttendancePayload[]
  deletes: TeacherAttendanceDeleteTarget[]
  dirtyCount: number
}

export interface TeacherGridSummary {
  hadir: number
  sakit: number
  izin: number
  tugasLuar: number
  recorded: number
  unrecorded: number
}

export const TEACHER_STATUS_OPTIONS: {
  value: TeacherAttendanceStatus
  short: string
  label: string
  color: string
}[] = [
  { value: 'hadir', short: 'H', label: 'Hadir', color: '#10b981' },
  { value: 'sakit', short: 'S', label: 'Sakit', color: '#f59e0b' },
  { value: 'izin', short: 'I', label: 'Izin', color: '#0ea5e9' },
  { value: 'tugas_luar', short: 'T', label: 'Tugas Luar', color: '#7c3aed' },
]

export function dayOfDate(date: string): number {
  return Number(date.slice(8, 10))
}

export function formatGridDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function isWeekendDay(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay()
  return dow === 0 || dow === 6
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function buildSavedGrid(rows: TeacherAttendance[]): SavedTeacherGrid {
  const status = new Map<string, Map<number, TeacherAttendanceStatus>>()
  const note = new Map<string, Map<number, string | null>>()

  for (const row of rows) {
    const day = dayOfDate(row.date)
    if (!Number.isFinite(day) || day < 1) continue

    let statusByDay = status.get(row.teacher_id)
    if (!statusByDay) {
      statusByDay = new Map()
      status.set(row.teacher_id, statusByDay)
    }
    statusByDay.set(day, row.status)

    let noteByDay = note.get(row.teacher_id)
    if (!noteByDay) {
      noteByDay = new Map()
      note.set(row.teacher_id, noteByDay)
    }
    noteByDay.set(day, row.note ?? null)
  }

  return { status, note }
}

export function getGridStatus(
  saved: SavedTeacherGrid,
  drafts: TeacherGridDrafts,
  teacherId: string,
  day: number,
): TeacherAttendanceStatus | undefined {
  const draftDays = drafts[teacherId]
  if (draftDays && day in draftDays) return draftDays[day] ?? undefined
  return saved.status.get(teacherId)?.get(day)
}

export function getGridNote(
  saved: SavedTeacherGrid,
  teacherId: string,
  day: number,
): string | null | undefined {
  return saved.note.get(teacherId)?.get(day)
}

/**
 * Ubah satu sel draf. Bila hasilnya sama dengan data tersimpan, entri draf
 * dihapus agar `dirtyCount` tetap akurat. `null` menandai penghapusan.
 */
export function setGridCell(
  drafts: TeacherGridDrafts,
  saved: SavedTeacherGrid,
  teacherId: string,
  day: number,
  status: GridCellStatus,
): TeacherGridDrafts {
  const savedStatus = saved.status.get(teacherId)?.get(day)
  const next: TeacherGridDrafts = { ...drafts }
  const currentDays = drafts[teacherId]
  const days: Record<number, GridCellStatus> = currentDays ? { ...currentDays } : {}

  if (status === null) {
    if (savedStatus) days[day] = null
    else delete days[day]
  } else if (status === savedStatus) {
    delete days[day]
  } else {
    days[day] = status
  }

  if (Object.keys(days).length === 0) delete next[teacherId]
  else next[teacherId] = days

  return next
}

/** Siklus klik: kosong → H → S → I → T → kosong */
export function nextGridStatus(current: TeacherAttendanceStatus | undefined): GridCellStatus {
  switch (current) {
    case undefined:
      return 'hadir'
    case 'hadir':
      return 'sakit'
    case 'sakit':
      return 'izin'
    case 'izin':
      return 'tugas_luar'
    default:
      return null
  }
}

export function computeGridChanges(
  drafts: TeacherGridDrafts,
  saved: SavedTeacherGrid,
  year: number,
  month: number,
): TeacherGridChangeSet {
  const upserts: TeacherAttendancePayload[] = []
  const deletes: TeacherAttendanceDeleteTarget[] = []
  let dirtyCount = 0

  for (const [teacherId, days] of Object.entries(drafts)) {
    for (const [dayStr, cell] of Object.entries(days)) {
      const day = Number(dayStr)
      const savedStatus = saved.status.get(teacherId)?.get(day)
      if (cell === null) {
        if (savedStatus) {
          deletes.push({ teacher_id: teacherId, date: formatGridDate(year, month, day) })
          dirtyCount += 1
        }
        continue
      }
      if (cell === savedStatus) continue
      upserts.push({
        teacher_id: teacherId,
        date: formatGridDate(year, month, day),
        status: cell,
        note: saved.note.get(teacherId)?.get(day) ?? null,
      })
      dirtyCount += 1
    }
  }

  return { upserts, deletes, dirtyCount }
}

export function summarizeGrid(
  teacherIds: string[],
  saved: SavedTeacherGrid,
  drafts: TeacherGridDrafts,
  year: number,
  month: number,
): TeacherGridSummary {
  const summary: TeacherGridSummary = {
    hadir: 0,
    sakit: 0,
    izin: 0,
    tugasLuar: 0,
    recorded: 0,
    unrecorded: 0,
  }
  const ids = new Set<string>([
    ...teacherIds,
    ...saved.status.keys(),
    ...Object.keys(drafts),
  ])

  for (let day = 1; day <= daysInMonth(year, month); day++) {
    const weekday = !isWeekendDay(year, month, day)
    for (const teacherId of ids) {
      const status = getGridStatus(saved, drafts, teacherId, day)
      if (status === 'hadir') summary.hadir += 1
      else if (status === 'sakit') summary.sakit += 1
      else if (status === 'izin') summary.izin += 1
      else if (status === 'tugas_luar') summary.tugasLuar += 1

      if (status) summary.recorded += 1
      else if (weekday) summary.unrecorded += 1
    }
  }

  return summary
}

/** Baris minimal untuk `buildTeacherRecap`, sudah menggabungkan draf grid. */
export function gridToRecapRows(
  saved: SavedTeacherGrid,
  drafts: TeacherGridDrafts,
  year: number,
  month: number,
): TeacherRecapInput[] {
  const rows: TeacherRecapInput[] = []
  const teacherIds = new Set<string>([
    ...saved.status.keys(),
    ...Object.keys(drafts),
  ])

  for (const teacherId of teacherIds) {
    const days = new Set<number>([
      ...(saved.status.get(teacherId)?.keys() ?? []),
      ...Object.keys(drafts[teacherId] ?? {}).map(Number),
    ])
    for (const day of days) {
      const status = getGridStatus(saved, drafts, teacherId, day)
      if (!status) continue
      rows.push({
        teacher_id: teacherId,
        date: formatGridDate(year, month, day),
        status,
      })
    }
  }

  return rows
}
