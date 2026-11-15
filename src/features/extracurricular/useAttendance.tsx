import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Button } from 'antd'
import { useStudentDetail } from '../students/useStudentDetail'
import { usePermissions } from '../../shared/hooks/useProfile'
import { MONTH_NAMES, NEXT_STATUS, STATUS_META } from '../attendance/constants'
import type { AttendanceStatus } from '../attendance/types'
import type { GridCursor, GridStudent } from '../../shared/components/AttendanceGrid'
import { useActivityAttendance, useActivityMembers, useSaveActivityAttendance } from './hooks'
import type { ActivityAttendanceDays } from './types'

const EMPTY_DAYS: ActivityAttendanceDays = {}
type Drafts = Record<string, ActivityAttendanceDays>
type NoteDrafts = Record<string, string>

interface UndoSnapshot {
  drafts: Drafts
  notes: NoteDrafts
}

/**
 * Inti tab Presensi activity (adaptasi usePresensiGrid halaqah, tanpa session/
 * threshold/impor): data anggota & absensi (kini + bulan lalu), draf perubahan,
 * undo (maks 30 langkah), drag-to-fill, operasi sel & massal, catatan, simpan.
 *
 * Semua operasi mutasi lewat `drafts`/`noteDrafts` dengan `savedByStudent`
 * sebagai lapisan dasar — setiap mutator wajib memanggil `pushUndo` dulu.
 */
export function useAttendance({
  activeActivityId,
  year,
  month,
  search,
}: {
  activeActivityId: string | undefined
  year: number
  month: number
  search: string
}) {
  const { message } = App.useApp()
  const { canWrite } = usePermissions()
  const { open: openStudentDetail } = useStudentDetail()

  // Draf & catatan
  const [drafts, setDrafts] = useState<Drafts>({})
  const [noteDrafts, setNoteDrafts] = useState<NoteDrafts>({})
  const [cursor, setCursor] = useState<GridCursor>(null)
  const [noteTarget, setNoteTarget] = useState<GridStudent | null>(null)

  // ── Query ────────────────────────────────────────────────────────────────
  const membersQuery = useActivityMembers(activeActivityId)
  const attendanceQuery = useActivityAttendance(activeActivityId, year, month)
  // Bulan lalu hanya untuk fitur "salin presensi bulan lalu"
  const prevQuery = useActivityAttendance(
    activeActivityId,
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
  )
  const saveMutation = useSaveActivityAttendance()

  const students = useMemo<GridStudent[]>(
    () =>
      (membersQuery.data ?? []).map((m) => ({
        id: m.student_id,
        name: m.students?.name ?? '(tanpa nama)',
        registration_code: m.students?.registration_code ?? '',
        className: m.students?.classes?.name ?? null,
      })),
    [membersQuery.data],
  )

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.registration_code.toLowerCase().includes(q.replace(/-/g, '')),
    )
  }, [students, search])

  const savedByStudent = useMemo(
    () => new Map((attendanceQuery.data ?? []).map((r) => [r.student_id, r.days ?? {}])),
    [attendanceQuery.data],
  )
  const savedNotes = useMemo(
    () =>
      new Map(
        (attendanceQuery.data ?? [])
          .filter((r) => r.notes)
          .map((r) => [r.student_id, r.notes as string]),
      ),
    [attendanceQuery.data],
  )

  // ── Undo (snapshot sebelum operasi, maks 30 langkah) ──────────────────────
  const undoStack = useRef<UndoSnapshot[]>([])
  const undoToastSeq = useRef(0)
  const [undoDepth, setUndoDepth] = useState(0)

  // Status drag-to-fill aktif ('' = tidak sedang menyeret)
  const dragStatusRef = useRef<AttendanceStatus | ''>('')

  const pushUndo = () => {
    undoStack.current.push({ drafts: { ...drafts }, notes: { ...noteDrafts } })
    if (undoStack.current.length > 30) undoStack.current.shift()
    setUndoDepth(undoStack.current.length)
  }

  const clearUndo = () => {
    undoStack.current = []
    setUndoDepth(0)
  }

  const undo = () => {
    const prev = undoStack.current.pop()
    if (!prev) {
      message.info('Tidak ada perubahan untuk dibatalkan')
      return
    }
    setDrafts(prev.drafts)
    setNoteDrafts(prev.notes)
    setUndoDepth(undoStack.current.length)
  }

  /** Operasi massal + toast dengan tombol Batalkan (pola AttendancePage). */
  const bulkWithUndoToast = (fn: () => void, label: string) => {
    pushUndo()
    fn()
    undoToastSeq.current += 1
    message.open({
      key: `undo-presensi-activity-${undoToastSeq.current}`,
      type: 'success',
      duration: 6,
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{label}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              undo()
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  // ── Data gabungan tersimpan + draf ───────────────────────────────────────
  const getDays = (studentId: string): ActivityAttendanceDays =>
    drafts[studentId] ?? savedByStudent.get(studentId) ?? EMPTY_DAYS

  const daysById = useMemo(() => {
    const m = new Map<string, ActivityAttendanceDays>()
    for (const s of students) m.set(s.id, drafts[s.id] ?? savedByStudent.get(s.id) ?? EMPTY_DAYS)
    return m
  }, [students, drafts, savedByStudent])

  const notesById = useMemo(() => {
    const m = new Map(savedNotes)
    for (const [sid, v] of Object.entries(noteDrafts)) {
      if (v) m.set(sid, v)
      else m.delete(sid)
    }
    return m
  }, [savedNotes, noteDrafts])

  const dirtyNotes = useMemo(
    () =>
      Object.entries(noteDrafts).filter(([sid, v]) => (savedNotes.get(sid) ?? '') !== v).length,
    [noteDrafts, savedNotes],
  )
  const dirtyCount = Object.keys(drafts).length + dirtyNotes

  /** Buang semua draf (dipakai guard navigasi & aksi kosongkan). */
  const dropDrafts = () => {
    setDrafts({})
    setNoteDrafts({})
    clearUndo()
  }

  // Akhiri drag di mana pun mouse dilepas
  useEffect(() => {
    const stop = () => {
      dragStatusRef.current = ''
    }
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
    }
  }, [])

  // ── Operasi sel & massal ─────────────────────────────────────────────────
  const setCell = (studentId: string, day: number, status: AttendanceStatus | '') => {
    if (!canWrite) return
    setDrafts((prev) => {
      const base = prev[studentId] ?? savedByStudent.get(studentId) ?? {}
      if (status === '' && !(String(day) in base)) return prev
      const days = { ...base }
      if (status === '') delete days[String(day)]
      else days[String(day)] = status
      return { ...prev, [studentId]: days }
    })
  }

  /** Mousedown sel: siklus status + mulai drag (status drag disimpan di ref). */
  const handleCellMouseDown = (studentId: string, day: number): void => {
    if (!canWrite) return
    pushUndo()
    setCursor({ studentId, day })
    const current = getDays(studentId)[String(day)] ?? ''
    const next = NEXT_STATUS[current] ?? ''
    setCell(studentId, day, next)
    dragStatusRef.current = next
  }

  /** Mouseenter sel saat drag aktif: cat sel dengan status drag. */
  const handleDragPaint = (studentId: string, day: number): void => {
    if (!dragStatusRef.current) return
    setCell(studentId, day, dragStatusRef.current)
  }

  const fillColumn = (day: number, status: AttendanceStatus | '') => {
    if (!canWrite || students.length === 0) return
    pushUndo()
    setDrafts((prev) => {
      const next = { ...prev }
      for (const s of students) {
        const base = prev[s.id] ?? savedByStudent.get(s.id) ?? {}
        if (status === '' && !(String(day) in base)) continue
        const days = { ...base }
        if (status === '') delete days[String(day)]
        else days[String(day)] = status
        next[s.id] = days
      }
      return next
    })
    message.success(
      status === ''
        ? `Hari ${day} dikosongkan`
        : `Hari ${day} diisi ${STATUS_META[status].label} untuk semua anggota`,
    )
  }

  const clearAll = () => {
    const hasAnyData = students.some((s) => Object.keys(getDays(s.id)).length > 0)
    if (!hasAnyData && dirtyNotes === 0) {
      message.info('Grid sudah bersih')
      return
    }
    bulkWithUndoToast(dropDrafts, 'Grid & catatan dikosongkan')
  }

  const copyLastMonth = () => {
    const prevRows = prevQuery.data ?? []
    const prevMonth = month === 1 ? 12 : month - 1
    if (prevRows.length === 0) {
      message.info(`Tidak ada presensi ${MONTH_NAMES[prevMonth - 1]} untuk disalin`)
      return
    }
    let copied = 0
    bulkWithUndoToast(() => {
      setDrafts((prev) => {
        const next = { ...prev }
        for (const row of prevRows) {
          if (Object.keys(next[row.student_id] ?? {}).length > 0) continue
          if (Object.keys(row.days ?? {}).length === 0) continue
          next[row.student_id] = { ...(row.days ?? {}) }
          copied += 1
        }
        return next
      })
    }, `Presensi bulan lalu disalin untuk ${copied} anggota`)
  }

  // ── Catatan ──────────────────────────────────────────────────────────────
  const openNote = (studentId: string) => {
    const s = students.find((x) => x.id === studentId)
    if (!s) return
    setNoteTarget(s)
  }

  const saveNote = (text: string) => {
    if (!noteTarget) return
    pushUndo()
    const trimmed = text.trim()
    setNoteDrafts((prev) => {
      const next = { ...prev }
      if (trimmed) next[noteTarget.id] = trimmed
      else delete next[noteTarget.id]
      return next
    })
    setNoteTarget(null)
    message.success(
      trimmed
        ? 'Catatan ditambahkan ke draf, klik Simpan untuk menyimpan'
        : 'Catatan dihapus dari draf',
    )
  }

  // ── Simpan ───────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!activeActivityId || students.length === 0) return
    const payload = students.map((s) => ({
      ekskul_id: activeActivityId,
      student_id: s.id,
      year,
      month,
      days: getDays(s.id),
      notes: notesById.get(s.id) ?? null,
      updated_by: null,
    }))
    saveMutation.mutate(payload, {
      onSuccess: () => {
        message.success(`Presensi ${MONTH_NAMES[month - 1]} ${year} tersimpan`)
        setDrafts({})
        setNoteDrafts({})
        clearUndo()
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan presensi'),
    })
  }

  return {
    // queries & flags
    membersQuery,
    attendanceQuery,
    saveMutation,
    canWrite,
    openStudentDetail,
    // data
    students,
    filteredStudents,
    daysById,
    notesById,
    dirtyCount,
    undoDepth,
    // interaksi grid
    cursor,
    setCursor,
    noteTarget,
    setNoteTarget,
    openNote,
    saveNote,
    undo,
    setCell,
    handleCellMouseDown,
    handleDragPaint,
    fillColumn,
    clearAll,
    copyLastMonth,
    handleSave,
    getDays,
    dropDrafts,
    refetchAttendance: () => attendanceQuery.refetch(),
  }
}
