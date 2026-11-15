import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Progress,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  MailOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { StatChip } from '../../../shared/components/StatChip'
import { usePermissions } from '../../../shared/hooks/useProfile'
import { useTeachers } from '../hooks'
import {
  useSaveTeacherAttendance,
  useSaveAttendanceGrid,
  useTeacherAttendance,
  useTeacherAttendanceRange,
} from './hooks'
import {
  TEACHER_ATTENDANCE_STATUS_META,
  type TeacherAttendanceStatus,
} from './types'
import { LogModal } from './LogModal'
import { buildTeacherRecap, MONTH_NAMES_ID, monthRange } from './recap'
import {
  exportTeacherAttendanceCsv,
  exportTeacherAttendanceXlsx,
  exportTeacherGridCsv,
  exportTeacherRecapCsv,
} from './export'
import { logAudit } from '../../../shared/utils/auditLogger'
import {
  TEACHER_STATUS_OPTIONS,
  buildSavedGrid,
  computeGridChanges,
  daysInMonth,
  getGridStatus,
  gridToRecapRows,
  isWeekendDay,
  setGridCell,
  summarizeGrid,
  type GridCellStatus,
  type TeacherGridDrafts,
} from './grid'
import { AttendanceGrid } from './components/AttendanceGrid'

type Draft = { status: TeacherAttendanceStatus; note?: string }
type Drafts = Record<string, Draft>
type Mode = 'grid' | 'harian' | 'rekap'

// Chip status berwarna — konsisten dengan tab Harian santri
const STATUS_OPTIONS = TEACHER_STATUS_OPTIONS

export function AttendancePage() {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite, canDelete } = usePermissions()

  const [mode, setMode] = useState<Mode>('grid')

  // ─── Harian ───
  const [date, setDate] = useState<Dayjs>(dayjs())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [importOpen, setImportOpen] = useState(false)
  const dateStr = date.format('YYYY-MM-DD')

  const teachersQuery = useTeachers({ page: 1, pageSize: 1000 })
  const allTeachers = useMemo(
    () => (teachersQuery.data?.data ?? []).filter((t) => t.status === 'active'),
    [teachersQuery.data],
  )

  const attendanceQuery = useTeacherAttendance(dateStr)
  const saveMutation = useSaveTeacherAttendance()
  const gridSaveMutation = useSaveAttendanceGrid()

  const [drafts, setDrafts] = useState<Drafts>({})
  const [gridDrafts, setGridDrafts] = useState<TeacherGridDrafts>({})

  const savedMap = useMemo(() => {
    const map = new Map<string, Draft>()
    for (const item of attendanceQuery.data ?? []) {
      map.set(item.teacher_id, { status: item.status, note: item.note ?? undefined })
    }
    return map
  }, [attendanceQuery.data])

  const handleStatusChange = (teacherId: string, status: TeacherAttendanceStatus) => {
    setDrafts((prev) => ({
      ...prev,
      [teacherId]: {
        ...(prev[teacherId] ?? savedMap.get(teacherId) ?? {}),
        status,
      },
    }))
  }

  const handleNoteChange = (teacherId: string, note: string) => {
    setDrafts((prev) => ({
      ...prev,
      [teacherId]: {
        ...(prev[teacherId] ?? savedMap.get(teacherId) ?? { status: 'hadir' }),
        note,
      },
    }))
  }

  const pendingChanges = useMemo(() => {
    const list: { teacher_id: string; date: string; status: TeacherAttendanceStatus; note?: string | null }[] = []
    for (const [teacherId, draft] of Object.entries(drafts)) {
      const saved = savedMap.get(teacherId)
      if (!saved || saved.status !== draft.status || saved.note !== draft.note) {
        list.push({
          teacher_id: teacherId,
          date: dateStr,
          status: draft.status,
          note: draft.note || null,
        })
      }
    }
    return list
  }, [drafts, savedMap, dateStr])

  const dirtyCount = pendingChanges.length

  // ─── Undo (pola Absensi Santri) ───
  const undoStack = useRef<Drafts[]>([])
  const undoToastSeq = useRef(0)
  const [undoDepth, setUndoDepth] = useState(0)

  const pushUndo = () => {
    undoStack.current.push(JSON.parse(JSON.stringify(drafts)) as Drafts)
    if (undoStack.current.length > 20) undoStack.current.shift()
    setUndoDepth(undoStack.current.length)
  }

  const clearUndo = () => {
    undoStack.current = []
    setUndoDepth(0)
  }

  const undo = () => {
    const prev = undoStack.current.pop()
    if (!prev) {
      message.info('Tidak ada perubahan massal untuk dibatalkan')
      return
    }
    setDrafts(prev)
    setUndoDepth(undoStack.current.length)
  }

  const bulkWithUndoToast = (fn: () => void, label: string) => {
    pushUndo()
    fn()
    undoToastSeq.current += 1
    const key = `undo-guru-${undoToastSeq.current}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      // AntD v6: message.open tidak punya `btn` — tombol ikut di content
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{label}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              undo()
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const gridUndoStack = useRef<TeacherGridDrafts[]>([])
  const gridUndoToastSeq = useRef(0)
  const [gridUndoDepth, setGridUndoDepth] = useState(0)

  const pushGridUndo = () => {
    gridUndoStack.current.push(JSON.parse(JSON.stringify(gridDrafts)) as TeacherGridDrafts)
    if (gridUndoStack.current.length > 20) gridUndoStack.current.shift()
    setGridUndoDepth(gridUndoStack.current.length)
  }

  const clearGridUndo = () => {
    gridUndoStack.current = []
    setGridUndoDepth(0)
  }

  const undoGrid = () => {
    const prev = gridUndoStack.current.pop()
    if (!prev) {
      message.info('Tidak ada perubahan massal untuk dibatalkan')
      return
    }
    setGridDrafts(prev)
    setGridUndoDepth(gridUndoStack.current.length)
  }

  const bulkGridWithUndoToast = (fn: () => void, label: string) => {
    pushGridUndo()
    fn()
    gridUndoToastSeq.current += 1
    const key = `undo-guru-grid-${gridUndoToastSeq.current}`
    message.open({
      key,
      type: 'success',
      duration: 6,
      content: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{label}</span>
          <Button
            size="small"
            type="primary"
            onClick={() => {
              message.destroy(key)
              undoGrid()
            }}
          >
            Batalkan
          </Button>
        </div>
      ),
    })
  }

  const handleSetAllHadir = () => {
    const next: Drafts = { ...drafts }
    let filled = 0
    for (const t of allTeachers) {
      if (!savedMap.has(t.id) && !next[t.id]) {
        next[t.id] = { status: 'hadir' }
        filled += 1
      }
    }
    if (filled === 0) {
      message.info('Semua guru & karyawan sudah memiliki status')
      return
    }
    bulkWithUndoToast(() => setDrafts(next), `${filled} guru & karyawan ditandai Hadir`)
  }

  // ─── Guard draf: ganti tanggal & tutup tab ───
  const guarded = (next: () => void) => {
    if (dirtyCount === 0) {
      next()
      return
    }
    modal.confirm({
      title: 'Buang draft absensi?',
      content: `${dirtyCount} guru & karyawan punya perubahan yang belum disimpan untuk ${date.format('DD/MM/YYYY')}. Mengganti tanggal akan membuang draft tersebut.`,
      okText: 'Buang & Lanjut',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: () => {
        setDrafts({})
        clearUndo()
        next()
      },
    })
  }

  const changeDate = (d: Dayjs) => {
    if (d.isSame(date, 'day')) return
    guarded(() => {
      setDate(d)
      setDrafts({})
      clearUndo()
    })
  }

  useEffect(() => {
    if (dirtyCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyCount])

  const handleSaveAll = () => {
    if (pendingChanges.length === 0) return
    saveMutation.mutate(pendingChanges, {
      onSuccess: () => {
        message.success(`${pendingChanges.length} data absensi guru & karyawan tersimpan`)
        setDrafts({})
        clearUndo()
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan absensi'),
    })
  }

  // ─── Filter & baris harian ───
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTeachers
      .filter((t) => {
        if (q) {
          const hit =
            t.name.toLowerCase().includes(q) ||
            (t.nbm && t.nbm.toLowerCase().includes(q)) ||
            (t.subject && t.subject.toLowerCase().includes(q))
          if (!hit) return false
        }
        const status = drafts[t.id]?.status ?? savedMap.get(t.id)?.status
        if (statusFilter === 'all') return true
        if (statusFilter === 'unrecorded') return !status
        return status === statusFilter
      })
      .map((t) => {
        const d = drafts[t.id]
        const s = savedMap.get(t.id)
        return {
          id: t.id,
          name: t.name,
          nbm: t.nbm,
          subject: t.subject,
          currentStatus: d?.status ?? s?.status,
          currentNote: d?.note ?? s?.note,
        }
      })
  }, [allTeachers, search, statusFilter, drafts, savedMap])

  const stats = useMemo(() => {
    let hadir = 0
    let sakit = 0
    let izin = 0
    let tugas = 0
    let unrecorded = 0
    for (const t of allTeachers) {
      const st = drafts[t.id]?.status ?? savedMap.get(t.id)?.status
      if (st === 'hadir') hadir++
      else if (st === 'sakit') sakit++
      else if (st === 'izin') izin++
      else if (st === 'tugas_luar') tugas++
      else unrecorded++
    }
    return { hadir, sakit, izin, tugas, unrecorded, total: allTeachers.length }
  }, [allTeachers, drafts, savedMap])

  // ─── Grid & rekap bulanan ───
  const [recapMonth, setRecapMonth] = useState<Dayjs>(dayjs().startOf('month'))
  const { from, to } = useMemo(() => monthRange(recapMonth.year(), recapMonth.month() + 1), [recapMonth])
  const rangeQuery = useTeacherAttendanceRange(from, to)
  const savedGrid = useMemo(() => buildSavedGrid(rangeQuery.data ?? []), [rangeQuery.data])

  const recap = useMemo(
    () => buildTeacherRecap(gridToRecapRows(savedGrid, gridDrafts, recapMonth.year(), recapMonth.month() + 1)),
    [savedGrid, gridDrafts, recapMonth],
  )
  const recapTotal = recap.totals.hadir + recap.totals.sakit + recap.totals.izin + recap.totals.tugasLuar
  const gridDayCount = daysInMonth(recapMonth.year(), recapMonth.month() + 1)
  const gridDirty = useMemo(
    () => computeGridChanges(gridDrafts, savedGrid, recapMonth.year(), recapMonth.month() + 1),
    [gridDrafts, savedGrid, recapMonth],
  )
  const gridStats = useMemo(
    () => summarizeGrid(allTeachers.map((t) => t.id), savedGrid, gridDrafts, recapMonth.year(), recapMonth.month() + 1),
    [allTeachers, savedGrid, gridDrafts, recapMonth],
  )

  const gridTeachers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allTeachers
    return allTeachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.nbm && t.nbm.toLowerCase().includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q)),
    )
  }, [allTeachers, search])

  const prevMonth = useMemo(() => recapMonth.subtract(1, 'month'), [recapMonth])
  const prevRange = useMemo(() => monthRange(prevMonth.year(), prevMonth.month() + 1), [prevMonth])
  const prevRangeQuery = useTeacherAttendanceRange(prevRange.from, prevRange.to, mode === 'grid')
  const prevSavedGrid = useMemo(() => buildSavedGrid(prevRangeQuery.data ?? []), [prevRangeQuery.data])

  const setCell = (teacherId: string, day: number, status: GridCellStatus) => {
    if (!canWrite) return
    setGridDrafts((prev) => setGridCell(prev, savedGrid, teacherId, day, status))
  }

  const fillGridColumn = (day: number, status: GridCellStatus) => {
    if (!canWrite) return
    pushGridUndo()
    setGridDrafts((prev) => {
      let next = prev
      for (const t of allTeachers) next = setGridCell(next, savedGrid, t.id, day, status)
      return next
    })
    const label = status ? STATUS_OPTIONS.find((o) => o.value === status)?.label : null
    message.success(label ? `Hari ${day} diisi ${label} untuk semua guru & karyawan` : `Hari ${day} dikosongkan`)
  }

  const fillGridAllHadir = () => {
    if (!canWrite || allTeachers.length === 0) return
    bulkGridWithUndoToast(() => {
      setGridDrafts((prev) => {
        let next = prev
        for (const t of allTeachers) {
          for (let day = 1; day <= gridDayCount; day++) {
            if (isWeekendDay(recapMonth.year(), recapMonth.month() + 1, day)) continue
            next = setGridCell(next, savedGrid, t.id, day, 'hadir')
          }
        }
        return next
      })
    }, 'Semua guru & karyawan ditandai Hadir (hari kerja)')
  }

  const resetGrid = () => {
    if (Object.keys(gridDrafts).length === 0) {
      message.info('Grid sudah bersih')
      return
    }
    bulkGridWithUndoToast(() => setGridDrafts({}), 'Draf grid dikosongkan')
  }

  const copyGridLastMonth = () => {
    if (!prevRangeQuery.data || prevRangeQuery.data.length === 0) {
      message.info(`Tidak ada data absensi ${MONTH_NAMES_ID[prevMonth.month()]} untuk disalin`)
      return
    }
    let next = gridDrafts
    let copied = 0
    for (const t of allTeachers) {
      for (let day = 1; day <= gridDayCount; day++) {
        const hasDraft = next[t.id] ? day in next[t.id] : false
        const hasSaved = savedGrid.status.get(t.id)?.has(day) ?? false
        if (hasDraft || hasSaved) continue
        const prevStatus = getGridStatus(prevSavedGrid, {}, t.id, day)
        if (!prevStatus) continue
        next = setGridCell(next, savedGrid, t.id, day, prevStatus)
        copied += 1
      }
    }
    if (copied === 0) {
      message.info('Semua sel sudah terisi atau bulan lalu tidak punya data')
      return
    }
    bulkGridWithUndoToast(() => setGridDrafts(next), `${copied} sel disalin dari bulan lalu`)
  }

  const handleSaveGrid = () => {
    if (gridDirty.dirtyCount === 0) return
    gridSaveMutation.mutate(
      { upserts: gridDirty.upserts, deletes: gridDirty.deletes },
      {
        onSuccess: () => {
          message.success(`Absensi ${MONTH_NAMES_ID[recapMonth.month()]} ${recapMonth.year()} tersimpan`)
          setGridDrafts({})
          clearGridUndo()
        },
        onError: (err: Error) => message.error(err.message || 'Gagal menyimpan absensi'),
      },
    )
  }

  const changeGridMonth = (d: Dayjs) => {
    if (d.isSame(recapMonth, 'month')) return
    const apply = () => {
      setRecapMonth(d.startOf('month'))
      setGridDrafts({})
      clearGridUndo()
    }
    if (gridDirty.dirtyCount === 0) {
      apply()
      return
    }
    modal.confirm({
      title: 'Buang draft grid?',
      content: `${gridDirty.dirtyCount} sel grid belum disimpan untuk ${MONTH_NAMES_ID[recapMonth.month()]} ${recapMonth.year()}. Mengganti bulan akan membuang draft tersebut.`,
      okText: 'Buang & Lanjut',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: apply,
    })
  }

  const recapRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTeachers
      .filter((t) => {
        if (!q) return true
        return (
          t.name.toLowerCase().includes(q) ||
          (t.nbm && t.nbm.toLowerCase().includes(q)) ||
          (t.subject && t.subject.toLowerCase().includes(q))
        )
      })
      .map((t) => ({ teacher: t, entry: recap.entries.get(t.id) }))
  }, [allTeachers, search, recap])

  // ─── Export ───
  const buildDailyExport = () =>
    allTeachers.map((t) => {
      const st = drafts[t.id]?.status ?? savedMap.get(t.id)?.status
      return {
        name: t.name,
        nbm: t.nbm,
        subject: t.subject,
        status: st ? TEACHER_ATTENDANCE_STATUS_META[st].label : null,
        note: drafts[t.id]?.note ?? savedMap.get(t.id)?.note ?? null,
      }
    })

  const buildRecapExport = () =>
    allTeachers.map((t) => {
      const e = recap.entries.get(t.id)
      return {
        name: t.name,
        nbm: t.nbm,
        subject: t.subject,
        hadir: e?.hadir ?? 0,
        sakit: e?.sakit ?? 0,
        izin: e?.izin ?? 0,
        tugasLuar: e?.tugasLuar ?? 0,
        recorded: e?.recorded ?? 0,
        pct: e?.pct ?? 0,
      }
    })

  const buildGridExport = () =>
    allTeachers.map((t) => ({
      name: t.name,
      nbm: t.nbm,
      subject: t.subject,
      cells: Array.from({ length: gridDayCount }, (_, i) => {
        const status = getGridStatus(savedGrid, gridDrafts, t.id, i + 1)
        return status ? STATUS_OPTIONS.find((o) => o.value === status)?.short ?? '' : ''
      }),
    }))

  const handleExportXlsx = async () => {
    try {
      await exportTeacherAttendanceXlsx({
        date: dateStr,
        daily: buildDailyExport(),
        recap: buildRecapExport(),
        grid: buildGridExport(),
        recapLabel: `${MONTH_NAMES_ID[recapMonth.month()]} ${recapMonth.year()}`,
        gridLabel: `${MONTH_NAMES_ID[recapMonth.month()]} ${recapMonth.year()}`,
        daysInMonth: gridDayCount,
      })
      void logAudit({
        action: 'EXPORT',
        source: 'MASTER',
        tableName: 'teacher_attendance',
        newData: { format: 'xlsx', date: dateStr, teachers: allTeachers.length },
      })
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membuat file Excel')
    }
  }

  const handleExportCsv = () => {
    if (mode === 'harian') {
      exportTeacherAttendanceCsv(dateStr, buildDailyExport())
    } else if (mode === 'grid') {
      exportTeacherGridCsv(recapMonth.year(), recapMonth.month() + 1, buildGridExport(), gridDayCount)
    } else {
      exportTeacherRecapCsv(recapMonth.year(), recapMonth.month() + 1, buildRecapExport())
    }
    void logAudit({
      action: 'EXPORT',
      source: 'MASTER',
      tableName: 'teacher_attendance',
      newData: { format: 'csv', mode, date: mode === 'harian' ? dateStr : from, teachers: allTeachers.length },
    })
  }

  // ─── Kolom harian ───
  const columns: TableColumnsType<(typeof rows)[number]> = [
    {
      title: 'Guru & Karyawan',
      key: 'name',
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.name}</span>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {r.nbm ? `NBM: ${r.nbm}` : ''} {r.subject ? `· Mapel: ${r.subject}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Status Kehadiran',
      key: 'status',
      width: 240,
      render: (_, r) => {
        const active = r.currentStatus
        return (
          <Space size={5}>
            {STATUS_OPTIONS.map((opt) => {
              const isActive = active === opt.value
              return (
                <Tooltip key={opt.value} title={opt.label}>
                  <button
                    onClick={() => handleStatusChange(r.id, opt.value)}
                    disabled={!canWrite}
                    style={{
                      width: 36,
                      height: 30,
                      borderRadius: 7,
                      border: `1px solid ${isActive ? opt.color : token.colorBorder}`,
                      background: isActive ? opt.color : 'transparent',
                      color: isActive ? '#fff' : opt.color,
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: canWrite ? 'pointer' : 'default',
                      opacity: canWrite || isActive ? 1 : 0.55,
                    }}
                  >
                    {opt.short}
                  </button>
                </Tooltip>
              )
            })}
            {active && (
              <Tag style={{ marginInlineStart: 4, marginInlineEnd: 0 }} color={TEACHER_ATTENDANCE_STATUS_META[active].color}>
                {TEACHER_ATTENDANCE_STATUS_META[active].label}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      title: 'Keterangan / Catatan',
      key: 'note',
      render: (_, r) => (
        <Input
          size="small"
          placeholder="Opsional (misal: dinas luar kota)"
          value={r.currentNote}
          disabled={!canWrite}
          onChange={(e) => handleNoteChange(r.id, e.target.value)}
        />
      ),
    },
  ]

  // ─── Kolom rekap ───
  const recapColumns: TableColumnsType<(typeof recapRows)[number]> = [
    {
      title: 'Guru & Karyawan',
      key: 'name',
      fixed: 'left',
      sorter: (a, b) => a.teacher.name.localeCompare(b.teacher.name),
      render: (_, r) => (
        <div>
          <span style={{ fontWeight: 600 }}>{r.teacher.name}</span>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>
            {r.teacher.nbm ? `NBM: ${r.teacher.nbm}` : ''} {r.teacher.subject ? `· Mapel: ${r.teacher.subject}` : ''}
          </div>
        </div>
      ),
    },
    ...STATUS_OPTIONS.map((opt) => ({
      title: opt.label,
      key: opt.value,
      width: 96,
      sorter: (a: (typeof recapRows)[number], b: (typeof recapRows)[number]) => {
        const get = (r: (typeof recapRows)[number]) => {
          const e = r.entry
          if (!e) return 0
          if (opt.value === 'hadir') return e.hadir
          if (opt.value === 'sakit') return e.sakit
          if (opt.value === 'izin') return e.izin
          return e.tugasLuar
        }
        return get(a) - get(b)
      },
      render: (r: (typeof recapRows)[number]) => {
        const e = r.entry
        const val = e
          ? opt.value === 'hadir'
            ? e.hadir
            : opt.value === 'sakit'
              ? e.sakit
              : opt.value === 'izin'
                ? e.izin
                : e.tugasLuar
          : 0
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums', color: val > 0 ? opt.color : token.colorTextTertiary, fontWeight: val > 0 ? 600 : 400 }}>
            {val}
          </span>
        )
      },
    })),
    {
      title: 'Tercatat',
      key: 'recorded',
      width: 92,
      sorter: (a: (typeof recapRows)[number], b: (typeof recapRows)[number]) => (a.entry?.recorded ?? 0) - (b.entry?.recorded ?? 0),
      render: (r: (typeof recapRows)[number]) => r.entry?.recorded ?? 0,
    },
    {
      title: '% Hadir',
      key: 'pct',
      width: 150,
      sorter: (a: (typeof recapRows)[number], b: (typeof recapRows)[number]) => (a.entry?.pct ?? 0) - (b.entry?.pct ?? 0),
      render: (r: (typeof recapRows)[number]) => {
        const e = r.entry
        if (!e || e.recorded === 0) return <span style={{ color: token.colorTextTertiary }}>—</span>
        const attention = e.sakit + e.izin >= 3
        return (
          <Space size={8}>
            <Progress
              percent={e.pct}
              size="small"
              showInfo={false}
              style={{ width: 62, marginBottom: 0 }}
              strokeColor={attention ? '#ef4444' : e.pct >= 90 ? '#10b981' : '#6366f1'}
            />
            <span style={{ fontSize: 12.5, color: attention ? '#dc2626' : undefined }}>{e.pct}%</span>
          </Space>
        )
      },
    },
    {
      title: 'Perhatian',
      key: 'alert',
      width: 140,
      responsive: ['md'],
      render: (r: (typeof recapRows)[number]) => {
        const e = r.entry
        if (!e || e.recorded === 0) return <Tag>Belum tercatat</Tag>
        if (e.sakit + e.izin >= 3) return <Tag color="red">Sakit/Izin ≥ 3 hari</Tag>
        return <Tag color="green">Baik</Tag>
      },
    },
  ]

  const exportMenu = (
    <Dropdown
      menu={{
        items: [
          { key: 'xlsx', label: 'Excel (.xlsx) — Harian + Grid + Rekap', icon: <FileExcelOutlined /> },
          {
            key: 'csv',
            label:
              mode === 'harian'
                ? 'CSV (.csv) — Harian'
                : mode === 'grid'
                  ? 'CSV (.csv) — Grid'
                  : 'CSV (.csv) — Rekap',
            icon: <FileTextOutlined />,
          },
        ],
        onClick: ({ key }) => (key === 'xlsx' ? void handleExportXlsx() : handleExportCsv()),
      }}
    >
      <Tooltip title="Ekspor presensi guru & karyawan">
        <Button icon={<DownloadOutlined />} disabled={allTeachers.length === 0} />
      </Tooltip>
    </Dropdown>
  )

  return (
    <div>
      <div style={{ position: 'sticky', top: 56, zIndex: 15, marginBottom: 16 }}>
        <Card styles={{ body: { padding: '12px 16px' } }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v as Mode)}
              options={[
                { label: 'Grid', value: 'grid' },
                { label: 'Harian', value: 'harian' },
                { label: 'Rekap', value: 'rekap' },
              ]}
            />
            {mode === 'harian' ? (
              <>
                <DatePicker
                  value={date}
                  onChange={(d) => d && changeDate(d)}
                  format="DD/MM/YYYY"
                  allowClear={false}
                />
                <Button
                  icon={<CalendarOutlined />}
                  disabled={date.isSame(dayjs(), 'day')}
                  onClick={() => changeDate(dayjs())}
                >
                  Hari Ini
                </Button>
              </>
            ) : (
              <DatePicker
                picker="month"
                value={recapMonth}
                onChange={(d) => d && changeGridMonth(d)}
                allowClear={false}
              />
            )}
            <Tooltip title="Muat Ulang">
              <Button
                icon={
                  <ReloadOutlined
                    spin={mode === 'harian' ? attendanceQuery.isFetching : rangeQuery.isFetching}
                  />
                }
                onClick={() =>
                  mode === 'harian' ? void attendanceQuery.refetch() : void rangeQuery.refetch()
                }
              />
            </Tooltip>
            {canWrite && mode !== 'rekap' && (
              <>
                <Tooltip title="Impor presensi dari mesin Fingerspot">
                  <Button icon={<FileExcelOutlined />} onClick={() => setImportOpen(true)} />
                </Tooltip>
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={mode === 'harian' ? handleSetAllHadir : fillGridAllHadir}
                  disabled={allTeachers.length === 0}
                >
                  Set Semua Hadir
                </Button>
              </>
            )}
            {exportMenu}
            {mode === 'grid' && canWrite && (
              <>
                <Tooltip title="Salin status bulan lalu ke sel yang masih kosong">
                  <Button
                    icon={<CopyOutlined />}
                    onClick={copyGridLastMonth}
                    disabled={allTeachers.length === 0 || prevRangeQuery.isPending}
                  />
                </Tooltip>
                <Tooltip title="Batalkan operasi massal terakhir">
                  <Button icon={<UndoOutlined />} onClick={undoGrid} disabled={gridUndoDepth === 0} />
                </Tooltip>
                <Tooltip title="Reset draf grid">
                  <Button
                    icon={<ClearOutlined />}
                    onClick={resetGrid}
                    disabled={Object.keys(gridDrafts).length === 0}
                  />
                </Tooltip>
              </>
            )}
            {mode === 'harian' && canWrite && (
              <Tooltip title="Batalkan operasi massal terakhir">
                <Button icon={<UndoOutlined />} onClick={undo} disabled={undoDepth === 0} />
              </Tooltip>
            )}
            {mode === 'harian' && canWrite && dirtyCount > 0 && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveMutation.isPending}
                onClick={handleSaveAll}
                style={{ marginLeft: 'auto' }}
              >
                Simpan ({dirtyCount})
              </Button>
            )}
            {mode === 'grid' && canWrite && gridDirty.dirtyCount > 0 && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={gridSaveMutation.isPending}
                onClick={handleSaveGrid}
                style={{ marginLeft: 'auto' }}
              >
                Simpan ({gridDirty.dirtyCount})
              </Button>
            )}
          </div>
          {mode !== 'harian' && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: token.colorTextSecondary }}>
              {MONTH_NAMES_ID[recapMonth.month()]} {recapMonth.year()} · {allTeachers.length} guru &
              karyawan · {gridDayCount} hari ·{' '}
              {mode === 'grid' ? 'grid bulanan' : 'rekap bulanan'}
            </div>
          )}
        </Card>
      </div>

      {(teachersQuery.isError || (mode !== 'harian' && rangeQuery.isError)) && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data absensi"
          description={
            (teachersQuery.error as Error | null)?.message ||
            (rangeQuery.error as Error | null)?.message ||
            'Periksa koneksi lalu coba lagi.'
          }
          action={
            <Button
              size="small"
              onClick={() => {
                void teachersQuery.refetch()
                void attendanceQuery.refetch()
                void rangeQuery.refetch()
              }}
            >
              Coba lagi
            </Button>
          }
        />
      )}

      {mode === 'harian' ? (
        <>
          {/* Monev Mini Dashboard */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <StatChip icon={<CheckCircleOutlined />} label="Hadir" value={stats.hadir} color="emerald" loading={attendanceQuery.isPending} />
            <StatChip icon={<ClockCircleOutlined />} label="Sakit" value={stats.sakit} color={stats.sakit > 0 ? 'amber' : 'slate'} loading={attendanceQuery.isPending} />
            <StatChip icon={<MailOutlined />} label="Izin" value={stats.izin} color={stats.izin > 0 ? 'sky' : 'slate'} loading={attendanceQuery.isPending} />
            <StatChip icon={<UserOutlined />} label="Tugas Luar" value={stats.tugas} color="indigo" loading={attendanceQuery.isPending} />
            <StatChip icon={<QuestionCircleOutlined />} label="Belum Diisi" value={stats.unrecorded} color={stats.unrecorded > 0 ? 'rose' : 'slate'} loading={attendanceQuery.isPending} />
          </div>

          <Card>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <Space wrap size="small">
                <Segmented
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as string)}
                  options={[
                    { label: 'Semua', value: 'all' },
                    { label: 'Belum diisi', value: 'unrecorded' },
                    ...STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
                  ]}
                />
              </Space>
              <Input
                placeholder="Cari nama guru/karyawan, NBM, atau mapel..."
                prefix={<SearchOutlined />}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 300 }}
              />
            </div>

            <Table
              rowKey="id"
              size="middle"
              columns={columns}
              dataSource={rows}
              loading={teachersQuery.isPending || attendanceQuery.isPending}
              pagination={{ pageSize: 25, showTotal: (t) => `Total ${t} orang` }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={search || statusFilter !== 'all' ? 'Tidak ada guru/karyawan yang cocok' : 'Belum ada data guru/karyawan aktif'}
                  />
                ),
              }}
            />
          </Card>
        </>
      ) : mode === 'grid' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <StatChip icon={<CheckCircleOutlined />} label="Hadir" value={gridStats.hadir} color="emerald" loading={rangeQuery.isPending} />
            <StatChip icon={<ClockCircleOutlined />} label="Sakit" value={gridStats.sakit} color={gridStats.sakit > 0 ? 'amber' : 'slate'} loading={rangeQuery.isPending} />
            <StatChip icon={<MailOutlined />} label="Izin" value={gridStats.izin} color={gridStats.izin > 0 ? 'sky' : 'slate'} loading={rangeQuery.isPending} />
            <StatChip icon={<UserOutlined />} label="Tugas Luar" value={gridStats.tugasLuar} color="indigo" loading={rangeQuery.isPending} />
            <StatChip icon={<QuestionCircleOutlined />} label="Belum Tercatat" value={gridStats.unrecorded} color={gridStats.unrecorded > 0 ? 'rose' : 'slate'} loading={rangeQuery.isPending} />
          </div>

          <Card>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                {canDelete
                  ? 'Klik sel untuk mengisi · klik kanan untuk mengosongkan'
                  : 'Klik sel untuk mengisi · pengosongan sel membutuhkan izin hapus'}
              </span>
              <Input
                placeholder="Cari nama guru/karyawan, NBM, atau mapel..."
                prefix={<SearchOutlined />}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 300 }}
              />
            </div>

            <AttendanceGrid
              teachers={gridTeachers}
              year={recapMonth.year()}
              month={recapMonth.month() + 1}
              saved={savedGrid}
              drafts={gridDrafts}
              loading={teachersQuery.isPending || rangeQuery.isPending}
              canWrite={canWrite}
              canDelete={canDelete}
              onSetCell={setCell}
              onFillColumn={fillGridColumn}
            />
          </Card>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <StatChip icon={<CheckCircleOutlined />} label="Hadir" value={recap.totals.hadir} color="emerald" loading={rangeQuery.isPending} />
            <StatChip icon={<ClockCircleOutlined />} label="Sakit" value={recap.totals.sakit} color={recap.totals.sakit > 0 ? 'amber' : 'slate'} loading={rangeQuery.isPending} />
            <StatChip icon={<MailOutlined />} label="Izin" value={recap.totals.izin} color={recap.totals.izin > 0 ? 'sky' : 'slate'} loading={rangeQuery.isPending} />
            <StatChip icon={<UserOutlined />} label="Tugas Luar" value={recap.totals.tugasLuar} color="indigo" loading={rangeQuery.isPending} />
            <StatChip icon={<CalendarOutlined />} label="Hari Tercatat" value={recap.totals.recorded} color="slate" loading={rangeQuery.isPending} />
          </div>

          {recapTotal > 0 && (
            <Card styles={{ body: { padding: '4px 14px 14px' } }} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  height: 28,
                  borderRadius: 9,
                  overflow: 'hidden',
                  background: token.colorFillQuaternary,
                }}
              >
                {STATUS_OPTIONS.map((opt, i) => {
                  const val =
                    opt.value === 'hadir'
                      ? recap.totals.hadir
                      : opt.value === 'sakit'
                        ? recap.totals.sakit
                        : opt.value === 'izin'
                          ? recap.totals.izin
                          : recap.totals.tugasLuar
                  if (val === 0) return null
                  const pct = Math.round((val / recapTotal) * 100)
                  const showCount = pct >= 16
                  return (
                    <Tooltip key={opt.value} title={`${opt.label}: ${val} hari (${pct}%)`}>
                      <div
                        style={{
                          width: `${pct}%`,
                          minWidth: 12,
                          background: opt.color,
                          borderLeft: i > 0 ? '2px solid rgba(255,255,255,0.55)' : undefined,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pct >= 8 && (
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 800,
                              color: '#fff',
                              textShadow: '0 1px 2px rgba(0,0,0,0.18)',
                              paddingInline: 4,
                            }}
                          >
                            {showCount ? `${opt.short} ${val}` : opt.short}
                          </span>
                        )}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                {recap.minDate
                  ? `Data ${dayjs(recap.minDate).format('DD/MM')} – ${dayjs(recap.maxDate).format('DD/MM/YYYY')}`
                  : 'Belum ada catatan pada bulan ini'}
              </span>
              <Input
                placeholder="Cari nama guru/karyawan, NBM, atau mapel..."
                prefix={<SearchOutlined />}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 300 }}
              />
            </div>

            <Table
              rowKey={(r) => r.teacher.id}
              size="middle"
              columns={recapColumns}
              dataSource={recapRows}
              loading={teachersQuery.isPending || rangeQuery.isPending}
              pagination={{ pageSize: 25, showTotal: (t) => `Total ${t} orang` }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={search ? 'Tidak ada guru/karyawan yang cocok' : 'Belum ada catatan absensi bulan ini'}
                  />
                ),
              }}
            />
          </Card>
        </>
      )}

      <LogModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          void attendanceQuery.refetch()
          void rangeQuery.refetch()
          setGridDrafts({})
          clearGridUndo()
        }}
      />
    </div>
  )
}
