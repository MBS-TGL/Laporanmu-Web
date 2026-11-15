import { useEffect, useMemo, useRef, useState } from 'react'
import { App, Button } from 'antd'
import { useStudentDetail } from '../students/useStudentDetail'
import { MONTH_NAMES, NEXT_STATUS, STATUS_META } from '../attendance/constants'
import type { AttendanceStatus } from '../attendance/types'
import { useHalaqahAttendance, useHalaqahMembers, useSaveHalaqahAttendance } from './hooks'
import type { GridCursor, GridStudent } from '../../shared/components/AttendanceGrid'
import type { HalaqahAttendanceDays, HalaqahSession } from './types'

const EMPTY_DAYS: HalaqahAttendanceDays = {}
type HalaqahDrafts = Record<string, HalaqahAttendanceDays>
type NoteDrafts = Record<string, string>

interface UndoSnapshot {
  drafts: HalaqahDrafts
  notes: NoteDrafts
}

/**
 * Inti tab Presensi: data anggota & absensi (kini + bulan lalu), draf
 * perubahan yang belum disimpan, undo (maks 30 langkah), drag-to-fill,
 * operasi sel & massal, catatan, impor, dan simpan.
 *
 * Semua operasi mutasi lewat `drafts`/`noteDrafts` dengan `savedByStudent`
 * sebagai lapisan dasar — setiap mutator wajib memanggil `pushUndo` dulu.
 */
export function usePresensiGrid({
  activeGroupId,
  session,
  year,
  month,
  search,
  canWrite,
}: {
  activeGroupId: string | undefined
  session: HalaqahSession
  year: number
  month: number
  search: string
  /** Boleh tulis presensi: role-based ATAU musyrif pemegang kelompok (scope guru). */
  canWrite: boolean
}) {
  const { message } = App.useApp()
  const { open: openStudentDetail } = useStudentDetail()

  // Draf & catatan
  const [drafts, setDrafts] = useState<HalaqahDrafts>({})
  const [noteDrafts, setNoteDrafts] = useState<NoteDrafts>({})
  const [cursor, setCursor] = useState<GridCursor>(null)
  const [noteTarget, setNoteTarget] = useState<GridStudent | null>(null)

  // ── Query ────────────────────────────────────────────────────────────────
  const membersQuery = useHalaqahMembers(activeGroupId)
  const attendanceQuery = useHalaqahAttendance(activeGroupId, session, year, month)
  // Bulan lalu hanya untuk fitur "salin presensi bulan lalu"
  const prevQuery = useHalaqahAttendance(
    activeGroupId,
    session,
    month === 1 ? year - 1 : year,
    month === 1 ? 12 : month - 1,
  )
  const saveMutation = useSaveHalaqahAttendance()

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
      key: `undo-presensi-${undoToastSeq.current}`,
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
  const getDays = (studentId: string): HalaqahAttendanceDays =>
    drafts[studentId] ?? savedByStudent.get(studentId) ?? EMPTY_DAYS

  const daysById = useMemo(() => {
    const m = new Map<string, HalaqahAttendanceDays>()
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

  const fillAllWeekdays = (status: AttendanceStatus) => {
    if (!canWrite || students.length === 0) return
    const daysInMonth = new Date(year, month, 0).getDate()
    bulkWithUndoToast(() => {
      setDrafts((prev) => {
        const next = { ...prev }
        for (const s of students) {
          const base = prev[s.id] ?? savedByStudent.get(s.id) ?? {}
          const days = { ...base }
          for (let d = 1; d <= daysInMonth; d++) {
            const dow = new Date(year, month - 1, d).getDay()
            if (dow === 0 || dow === 6) continue
            days[String(d)] = status
          }
          next[s.id] = days
        }
        return next
      })
    }, `Semua hari kerja diisi ${STATUS_META[status].label}`)
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
    if (prevRows.length === 0) {
      message.info(`Tidak ada presensi ${MONTH_NAMES[month === 1 ? 12 : month - 1]} untuk disalin`)
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
    if (!activeGroupId || students.length === 0) return
    const payload = students.map((s) => ({
      group_id: activeGroupId,
      student_id: s.id,
      session,
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

  // ── Impor ────────────────────────────────────────────────────────────────
  const handleImportApply = (
    merges: { studentId: string; days: HalaqahAttendanceDays }[],
    overwrite: boolean,
  ) => {
    pushUndo()
    setDrafts((prev) => {
      const next = { ...prev }
      for (const m of merges) {
        const base = overwrite ? {} : (prev[m.studentId] ?? savedByStudent.get(m.studentId) ?? {})
        next[m.studentId] = { ...base, ...m.days }
      }
      return next
    })
    message.success(`${merges.length} baris digabung ke grid, periksa lalu klik Simpan`)
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
    fillAllWeekdays,
    clearAll,
    copyLastMonth,
    handleImportApply,
    handleSave,
    getDays,
    dropDrafts,
    refetchAttendance: () => attendanceQuery.refetch(),
  }
}
