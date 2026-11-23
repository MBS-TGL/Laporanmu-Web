import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Dropdown,
  Empty,
  Input,
  Popover,
  Progress,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  theme,
  type TableColumnsType,
} from 'antd'
import {
  ClearOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  ImportOutlined,
  LeftOutlined,
  MoreOutlined,
  RightOutlined,
  SaveOutlined,
  ScanOutlined,
  SearchOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  MailOutlined,
  MedicineBoxOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShellItem, ShellStagger } from '../../shared/components/ShellMotion'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { StatChip, type StatChipColor } from '../../shared/components/StatChip'
import { useShortcuts, type ShortcutItem } from '../../shared/hooks/useShortcuts'
import { usePermissions } from '../../shared/hooks/useProfile'
import { useFlag } from '../../shared/hooks/useFeatureFlags'
import { logAudit } from '../../shared/utils/auditLogger'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useReportCardClasses, useReportCardStudents } from '../report-cards/hooks'
import { useStudentDetail } from '../students/useStudentDetail'
import type { ReportCardStudent } from '../report-cards/types'
import { useAttendanceRows, useSaveAttendance, useSyncAttendance } from './hooks'
import { countWeekdays, summarizeDays } from './api'
import { exportAttendanceCsv, exportAttendanceXlsx } from './export'
import { AttendancePage as MachineAttendancePage } from './machines/AttendancePage'
import { AttendancePage as TeacherAttendancePage } from '../teachers/attendance/AttendancePage'
import { SubjectsTab } from './SubjectsTab'
import { useUrlTab } from '../../shared/hooks/useUrlTab'
import {
  MONTH_NAMES,
  NEXT_STATUS,
  STATUS_META,
  STATUS_ORDER,
  WEEKDAY_SHORT,
} from './constants'
import type { AttendanceDays, AttendanceStatus } from './types'
import { ImportModal } from './components/ImportModal'
import { ScanModal } from './components/ScanModal'

type TabKey = 'grid' | 'harian' | 'rekap'

// Chip statistik Rekap (pola StatChip) per status absensi
const STATUS_CHIP: Record<AttendanceStatus, { icon: ReactNode; color: StatChipColor }> = {
  H: { icon: <CheckCircleOutlined />, color: 'emerald' },
  S: { icon: <MedicineBoxOutlined />, color: 'amber' },
  I: { icon: <MailOutlined />, color: 'sky' },
  A: { icon: <CloseCircleOutlined />, color: 'rose' },
  P: { icon: <LogoutOutlined />, color: 'purple' },
}

function AttendanceSantriTab({ active = true }: { active?: boolean }) {
  const { message, modal } = App.useApp()
  const { token } = theme.useToken()
  const { canWrite } = usePermissions()
  const { open: openStudentDetail } = useStudentDetail()
  const now = new Date()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [classId, setClassId] = useState<string | undefined>(searchParams.get('class') ?? undefined)
  const [month, setMonth] = useState(Number(searchParams.get('month')) || now.getMonth() + 1)
  const [year, setYear] = useState(Number(searchParams.get('year')) || now.getFullYear())
  const [view, setView] = useState<TabKey>('grid')
  const [scanOpen, setScanOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  // pilihan periode tersimpan di URL agar bisa di-deep-link (pola raport)
  const syncParams = (next: { class?: string; month?: number; year?: number }) => {
    const sp = new URLSearchParams(searchParams)
    const klass = next.class ?? classId
    const b = next.month ?? month
    const t = next.year ?? year
    if (klass) sp.set('class', klass)
    else sp.delete('class')
    sp.set('month', String(b))
    sp.set('year', String(t))
    sp.set('tab', 'students')
    setSearchParams(sp, { replace: true })
  }

  const studentsQuery = useReportCardStudents(classId)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const classesQuery = useReportCardClasses()
  const className = useMemo(
    () => (classesQuery.data ?? []).find((c) => c.id === classId)?.name ?? 'Kelas',
    [classesQuery.data, classId],
  )

  const rowsQuery = useAttendanceRows(classId, year, month)
  const prevQuery = useAttendanceRows(classId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1)

  const [drafts, setDrafts] = useState<Record<string, AttendanceDays>>({})
  const saveMutation = useSaveAttendance()
  const syncMutation = useSyncAttendance()

  // -------------------------------------------------------------------------
  // Undo — snapshot draf sebelum operasi massal (maks 30 langkah)
  // -------------------------------------------------------------------------

  const undoStack = useRef<Record<string, AttendanceDays>[]>([])
  const undoToastSeq = useRef(0)
  const [undoDepth, setUndoDepth] = useState(0)

  const pushUndo = () => {
    undoStack.current.push(JSON.parse(JSON.stringify(drafts)) as Record<string, AttendanceDays>)
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
      message.info('Tidak ada perubahan massal untuk dibatalkan')
      return
    }
    setDrafts(prev)
    setUndoDepth(undoStack.current.length)
  }

  /** Operasi massal + toast dengan tombol Batalkan (pola AlumniPage) */
  const bulkWithUndoToast = (fn: () => void, label: string) => {
    pushUndo()
    fn()
    undoToastSeq.current += 1
    const key = `undo-att-${undoToastSeq.current}`
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

  // -------------------------------------------------------------------------
  // Sel & draf
  // -------------------------------------------------------------------------

  const savedByStudent = useMemo(
    () => new Map((rowsQuery.data ?? []).map((r) => [r.student_id, r.days ?? {}])),
    [rowsQuery.data],
  )
  const prevByStudent = useMemo(
    () => new Map((prevQuery.data ?? []).map((r) => [r.student_id, r.days ?? {}])),
    [prevQuery.data],
  )

  const getDays = (studentId: string): AttendanceDays =>
    drafts[studentId] ?? savedByStudent.get(studentId) ?? {}

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

  const [cursor, setCursor] = useState<{ studentId: string; day: number } | null>(null)

  const cycleCell = (studentId: string, day: number) => {
    if (!canWrite) return
    setCursor({ studentId, day })
    const current = getDays(studentId)[String(day)] ?? ''
    setCell(studentId, day, NEXT_STATUS[current] ?? '')
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const isWeekend = (d: number) => {
    const dow = new Date(year, month - 1, d).getDay()
    return dow === 0 || dow === 6
  }
  const weekdays = countWeekdays(year, month)
  const isCurrentPeriod = now.getFullYear() === year && now.getMonth() + 1 === month
  const todayCol = isCurrentPeriod ? now.getDate() : 0

  // -------------------------------------------------------------------------
  // Operasi massal
  // -------------------------------------------------------------------------

  const fillAll = (status: AttendanceStatus) => {
    if (!canWrite || students.length === 0) return
    bulkWithUndoToast(() => {
      setDrafts(() => {
        const next: Record<string, AttendanceDays> = {}
        for (const s of students) {
          const days: AttendanceDays = { ...(drafts[s.id] ?? savedByStudent.get(s.id) ?? {}) }
          for (let d = 1; d <= daysInMonth; d++) {
            if (isWeekend(d)) continue
            days[String(d)] = status
          }
          next[s.id] = days
        }
        return next
      })
    }, `Semua santri diisi ${STATUS_META[status].label} (hari kerja)`)
  }

  const fillColumn = (day: number, status: AttendanceStatus | '') => {
    if (!canWrite) return
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
        : `Hari ${day} diisi ${STATUS_META[status].label} untuk semua santri`,
    )
  }

  const resetGrid = () => {
    if (Object.keys(drafts).length === 0) {
      message.info('Grid sudah bersih')
      return
    }
    bulkWithUndoToast(() => setDrafts({}), 'Draf grid dikosongkan')
  }

  const copyLastMonth = () => {
    const prevRows = prevQuery.data ?? []
    if (prevRows.length === 0) {
      message.info(`Tidak ada data absensi ${MONTH_NAMES[month === 1 ? 12 : month - 1]} untuk disalin`)
      return
    }
    const next: Record<string, AttendanceDays> = { ...drafts }
    let copied = 0
    for (const row of prevRows) {
      if (Object.keys(next[row.student_id] ?? {}).length > 0) continue
      if (Object.keys(row.days ?? {}).length === 0) continue
      next[row.student_id] = { ...(row.days ?? {}) }
      copied += 1
    }
    if (copied === 0) {
      message.info('Semua santri sudah memiliki absensi terisi')
      return
    }
    bulkWithUndoToast(() => setDrafts(next), `Absensi bulan lalu disalin untuk ${copied} santri`)
  }

  // -------------------------------------------------------------------------
  // Simpan & sinkron
  // -------------------------------------------------------------------------

  const dirtyCount = Object.keys(drafts).length

  const handleSave = async () => {
    if (!classId || students.length === 0) return
    const { data: userData } = await supabase.auth.getUser()
    const payload = students.map((s) => ({
      student_id: s.id,
      class_id: classId,
      year: year,
      month: month,
      days: getDays(s.id),
      updated_by: userData.user?.id ?? null,
    }))
    saveMutation.mutate(payload, {
      onSuccess: () => {
        message.success(`Absensi ${MONTH_NAMES[month - 1]} ${year} tersimpan`)
        setDrafts({})
        clearUndo()
        void logAudit({
          action: 'UPDATE',
          source: 'OPERATIONAL',
          tableName: 'student_attendance',
          newData: { class_id: classId, year: year, month: month, students: payload.length },
        })
      },
      onError: (err: Error) => message.error(err.message || 'Gagal menyimpan absensi'),
    })
  }

  const handleSync = () => {
    if (!classId) return
    const rows = students
      .map((s) => ({ student_id: s.id, days: getDays(s.id) }))
      .filter((r) => Object.keys(r.days).length > 0)
    if (rows.length === 0) {
      message.info('Belum ada absensi terisi untuk disinkronkan')
      return
    }
    syncMutation.mutate(
      { rows, classId, year: year, month: month, updatedBy: null },
      {
        onSuccess: async () => {
          const { data: userData } = await supabase.auth.getUser()
          void logAudit({
            action: 'SYNC',
            source: 'OPERATIONAL',
            tableName: 'student_monthly_reports',
            newData: { year: year, month: month, students: rows.length },
          })
          void userData
          message.success(`Rekap absensi tersinkron ke rapor ${MONTH_NAMES[month - 1]} (${rows.length} santri)`)
        },
        onError: (err: Error) => message.error(err.message || 'Gagal sinkron ke rapor'),
      },
    )
  }

  const confirmSync = () => {
    if (!classId) return
    modal.confirm({
      title: 'Sinkron ke rapor bulanan?',
      content: 'Rekap absensi bulan ini akan menimpa data rekap absensi pada rapor bulanan. Lanjutkan?',
      okText: 'Sinkronkan',
      cancelText: 'Batal',
      onOk: handleSync,
    })
  }

  // -------------------------------------------------------------------------
  // Guard draf belum disimpan: ganti periode & tutup tab
  // -------------------------------------------------------------------------

  const guarded = (next: () => void) => {
    if (dirtyCount === 0) {
      next()
      return
    }
    modal.confirm({
      title: 'Buang draf absensi?',
      content: `${dirtyCount} santri punya perubahan yang belum disimpan. Mengganti kelas/periode akan membuang draf tersebut.`,
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

  useEffect(() => {
    if (dirtyCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirtyCount])

  // -------------------------------------------------------------------------
  // Search santri
  // -------------------------------------------------------------------------

  const [search, setSearch] = useState('')
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.registration_code.toLowerCase().includes(q.replace(/-/g, '')),
    )
  }, [students, search])

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  const buildExportCtx = () => ({
    className,
    year,
    month,
    daysInMonth,
    weekdays,
    students: students.map((s) => ({ name: s.name, code: s.registration_code, days: getDays(s.id) })),
  })

  const handleExportXlsx = async () => {
    if (!classId || students.length === 0) return
    try {
      await exportAttendanceXlsx(buildExportCtx())
      void logAudit({
        action: 'EXPORT',
        source: 'OPERATIONAL',
        tableName: 'student_attendance',
        newData: { format: 'xlsx', class_id: classId, year, month, students: students.length },
      })
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Gagal membuat file Excel')
    }
  }

  const handleExportCsv = () => {
    if (!classId || students.length === 0) return
    exportAttendanceCsv(buildExportCtx())
    void logAudit({
      action: 'EXPORT',
      source: 'OPERATIONAL',
      tableName: 'student_attendance',
      newData: { format: 'csv', class_id: classId, year, month, students: students.length },
    })
  }

  // -------------------------------------------------------------------------
  // Rekap & ringkasan
  // -------------------------------------------------------------------------

  const summaries = useMemo(
    () => new Map(students.map((s) => [s.id, summarizeDays(getDays(s.id))])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, drafts, rowsQuery.data],
  )

  const distData = STATUS_ORDER.map((s) => ({
    code: s,
    label: STATUS_META[s].label,
    total: students.reduce((acc, st) => acc + (summaries.get(st.id)?.[s] ?? 0), 0),
  }))
  const distTotal = distData.reduce((acc, d) => acc + d.total, 0)

  const rekapColumns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'Santri',
      key: 'name',
      fixed: 'left',
      sorter: (a: ReportCardStudent, b: ReportCardStudent) => a.name.localeCompare(b.name),
      render: (_, s) => (
        <div>
          <Typography.Link style={{ fontWeight: 600 }} onClick={() => openStudentDetail(s.id)}>
            {s.name}
          </Typography.Link>
          <div style={{ fontSize: 12, color: '#888' }}>{s.registration_code}</div>
        </div>
      ),
    },
    ...STATUS_ORDER.map((st) => ({
      title: STATUS_META[st].label,
      key: st,
      width: 82,
      sorter: (a: ReportCardStudent, b: ReportCardStudent) =>
        (summaries.get(a.id)?.[st] ?? 0) - (summaries.get(b.id)?.[st] ?? 0),
      render: (_: unknown, s: ReportCardStudent) => summaries.get(s.id)?.[st] ?? 0,
    })),
    {
      title: '% Hadir',
      key: 'pct',
      width: 150,
      sorter: (a: ReportCardStudent, b: ReportCardStudent) => {
        const pct = (s: ReportCardStudent) => {
          const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
          return weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0
        }
        return pct(a) - pct(b)
      },
      render: (_: unknown, s: ReportCardStudent) => {
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const pct = weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0
        const anyFilled = Object.keys(getDays(s.id)).length > 0
        const alert = sum.A >= 3 || (anyFilled && pct < 75)
        return (
          <Space size={8}>
            <Progress
              percent={pct}
              size="small"
              showInfo={false}
              style={{ width: 64, marginBottom: 0 }}
              strokeColor={alert ? '#ef4444' : pct >= 90 ? '#10b981' : '#6366f1'}
            />
            <Typography.Text style={{ fontSize: 12.5, color: alert ? '#dc2626' : undefined }}>
              {pct}%
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      title: 'Δ Hadir',
      key: 'delta',
      width: 90,
      responsive: ['lg'],
      sorter: (a: ReportCardStudent, b: ReportCardStudent) => {
        const delta = (s: ReportCardStudent) => {
          const prevSum = summarizeDays(prevByStudent.get(s.id) ?? {})
          return (summaries.get(s.id)?.H ?? 0) - (prevSum.H ?? 0)
        }
        return delta(a) - delta(b)
      },
      render: (_: unknown, s: ReportCardStudent) => {
        const prevSum = summarizeDays(prevByStudent.get(s.id) ?? {})
        const cur = summaries.get(s.id)?.H ?? 0
        const delta = cur - (prevSum.H ?? 0)
        if (Object.keys(prevByStudent.get(s.id) ?? {}).length === 0) return '-'
        return (
          <Typography.Text style={{ color: delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : undefined }}>
            {delta > 0 ? `+${delta}` : delta}
          </Typography.Text>
        )
      },
    },
    {
      title: 'Perhatian',
      key: 'alert',
      width: 150,
      responsive: ['md'],
      render: (_: unknown, s: ReportCardStudent) => {
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const anyFilled = Object.keys(getDays(s.id)).length > 0
        const pct = weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0
        if (sum.A >= 3) return <Tag color="red">Alpa ≥ 3 hari</Tag>
        if (anyFilled && pct < 75) return <Tag color="orange">Hadir &lt; 75%</Tag>
        return <Tag color="green">Baik</Tag>
      },
    },
    {
      title: 'Tindak Lanjut',
      key: 'followup',
      width: 120,
      render: (_: unknown, s: ReportCardStudent) => {
        const sum = summaries.get(s.id) ?? { H: 0, S: 0, I: 0, A: 0, P: 0 }
        const anyFilled = Object.keys(getDays(s.id)).length > 0
        const pct = weekdays > 0 ? Math.round((sum.H / weekdays) * 100) : 0
        const needsFollowUp = sum.A >= 3 || (anyFilled && pct < 75)
        if (!needsFollowUp) return null
        const complaint = `Tindak lanjut ketidakhadiran ${MONTH_NAMES[month - 1]} ${year}: ${sum.A} hari alpa, kehadiran ${pct}%.`
        const href = (tab: 'sesi' | 'surat-resmi') =>
          `/counseling?tab=${tab}&new=1&studentId=${s.id}&studentName=${encodeURIComponent(s.name)}&complaint=${encodeURIComponent(complaint)}`
        return (
          <Dropdown
            menu={{
              items: [
                { key: 'bk', label: 'Buat sesi BK' },
                { key: 'letter', label: 'Buat surat panggilan' },
              ],
              onClick: ({ key }) => navigate(href(key === 'letter' ? 'surat-resmi' : 'sesi')),
            }}
            trigger={['click']}
          >
            <Button size="small" type="link">
              Tindak lanjut
            </Button>
          </Dropdown>
        )
      },
    },
  ]

  // -------------------------------------------------------------------------
  // Popover isi kolom (header hari)
  // -------------------------------------------------------------------------

  const fillColumnContent = (day: number) => (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        Isi hari {day} untuk semua santri
      </div>
      <Space size={4} wrap>
        {STATUS_ORDER.map((st) => (
          <Tooltip key={st} title={STATUS_META[st].label}>
            <button
              onClick={() => fillColumn(day, st)}
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
        <Button size="small" onClick={() => fillColumn(day, '')}>
          Kosongkan
        </Button>
      </Space>
    </div>
  )

  // -------------------------------------------------------------------------
  // Grid + navigasi keyboard
  // -------------------------------------------------------------------------

  const gridBodyRef = useRef<HTMLDivElement | null>(null)

  const gridColumns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'Nama Santri',
      key: 'name',
      fixed: 'left',
      width: 170,
      render: (_: unknown, s: ReportCardStudent) => (
        <Tooltip title={`${s.name} · ${s.registration_code}`}>
          <Typography.Link
            onClick={() => openStudentDetail(s.id)}
            style={{
              fontWeight: 600,
              fontSize: 13,
              display: 'block',
              maxWidth: 150,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.name}
          </Typography.Link>
        </Tooltip>
      ),
    },
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
      const isToday = day === todayCol
      const headColor = isToday
        ? token.colorPrimary
        : isWeekend(day)
          ? '#cbd5e1'
          : '#475569'
      return {
        title: canWrite ? (
          <Popover content={fillColumnContent(day)} trigger="click" placement="bottom">
            <div style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} title="Klik: isi/kosongkan kolom ini">
              <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: headColor }}>
                {day}
              </div>
              <div style={{ fontSize: 9, color: isToday ? token.colorPrimary : '#94a3b8' }}>
                {isToday ? 'HARI INI' : WEEKDAY_SHORT[new Date(year, month - 1, day).getDay()]}
              </div>
            </div>
          </Popover>
        ) : (
          <div style={{ textAlign: 'center' }}>
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
            background: isToday ? 'rgba(99,102,241,0.07)' : isWeekend(day) ? '#f8fafc' : undefined,
          },
        }),
        onCell: () => ({
          style: {
            padding: '2px',
            background: isToday ? 'rgba(99,102,241,0.06)' : isWeekend(day) ? '#fbfcfe' : undefined,
          },
        }),
        render: (_: unknown, s: ReportCardStudent) => {
          const status = getDays(s.id)[String(day)] ?? ''
          const meta = status ? STATUS_META[status] : null
          const isCursor = cursor?.studentId === s.id && cursor?.day === day
          return (
            <Tooltip title={meta ? meta.label : `Klik isi hari ${day}`}>
              <div
                onClick={() => cycleCell(s.id, day)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setCell(s.id, day, '')
                }}
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
    {
      title: 'H',
      key: 'sum-h',
      width: 44,
      render: (_: unknown, s: ReportCardStudent) => (
        <Typography.Text strong style={{ fontSize: 12.5 }}>
          {summaries.get(s.id)?.H ?? 0}
        </Typography.Text>
      ),
    },
  ]

  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (!canWrite || filteredStudents.length === 0) return
    const key = e.key
    const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Home', 'End']
    const statusKeys = ['h', 's', 'i', 'a', 'p']
    const clearKeys = ['x', '0', 'Backspace', 'Delete']
    const lower = key.length === 1 ? key.toLowerCase() : key

    const rowIdx = cursor ? filteredStudents.findIndex((s) => s.id === cursor.studentId) : -1

    if (nav.includes(key)) {
      e.preventDefault()
      const startRow = rowIdx >= 0 ? rowIdx : 0
      const startDay = cursor?.day ?? 1
      let r = startRow
      let d = startDay
      if (key === 'ArrowUp') r = Math.max(0, startRow - 1)
      else if (key === 'ArrowDown' || key === 'Enter') r = Math.min(filteredStudents.length - 1, startRow + 1)
      else if (key === 'ArrowLeft') d = Math.max(1, startDay - 1)
      else if (key === 'ArrowRight') d = Math.min(daysInMonth, startDay + 1)
      else if (key === 'Home') d = 1
      else if (key === 'End') d = daysInMonth
      setCursor({ studentId: filteredStudents[r].id, day: d })
      return
    }

    if (!cursor || rowIdx < 0) return

    if (statusKeys.includes(lower)) {
      e.preventDefault()
      setCell(cursor.studentId, cursor.day, lower.toUpperCase() as AttendanceStatus)
    } else if (clearKeys.includes(lower)) {
      e.preventDefault()
      setCell(cursor.studentId, cursor.day, '')
    }
  }

  // -------------------------------------------------------------------------
  // Tab Harian
  // -------------------------------------------------------------------------

  const [dailyDayState, setDailyDayState] = useState<number | null>(null)
  const dailyDay = dailyDayState ?? (isCurrentPeriod ? now.getDate() : 1)
  const filledToday = students.filter((s) => getDays(s.id)[String(dailyDay)]).length

  const setDailyDay = (d: number) => setDailyDayState(Math.min(Math.max(1, d), daysInMonth))

  const harianColumns: TableColumnsType<ReportCardStudent> = [
    {
      title: 'Santri',
      key: 'name',
      render: (_, s) => (
        <div>
          <Typography.Link style={{ fontWeight: 600 }} onClick={() => openStudentDetail(s.id)}>
            {s.name}
          </Typography.Link>
          <div style={{ fontSize: 12, color: '#888' }}>{s.registration_code}</div>
        </div>
      ),
    },
    {
      title: 'Status Hari Ini',
      key: 'status',
      width: 260,
      render: (_, s) => {
        const current = getDays(s.id)[String(dailyDay)] ?? ''
        return (
          <Space size={5} wrap>
            {STATUS_ORDER.map((st) => {
              const active = current === st
              const meta = STATUS_META[st]
              return (
                <Tooltip key={st} title={meta.label}>
                  <button
                    onClick={() => setCell(s.id, dailyDay, st)}
                    style={{
                      width: 34,
                      height: 30,
                      borderRadius: 7,
                      border: `1px solid ${active ? meta.color : token.colorBorder}`,
                      background: active ? meta.color : 'transparent',
                      color: active ? '#fff' : meta.color,
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: canWrite ? 'pointer' : 'default',
                      opacity: canWrite || active ? 1 : 0.5,
                    }}
                  >
                    {st}
                  </button>
                </Tooltip>
              )
            })}
            <Tooltip title="Kosongkan">
              <button
                onClick={() => setCell(s.id, dailyDay, '')}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  border: `1px dashed ${current ? token.colorBorder : token.colorBorderSecondary}`,
                  background: 'transparent',
                  color: token.colorTextTertiary,
                  fontSize: 13,
                  cursor: canWrite ? 'pointer' : 'default',
                }}
              >
                ×
              </button>
            </Tooltip>
          </Space>
        )
      },
    },
    {
      title: 'Catatan',
      key: 'note',
      width: 170,
      responsive: ['md'] as const,
      render: (_, s) => {
        const current = getDays(s.id)[String(dailyDay)] ?? ''
        if (!current) return <Tag>Belum diisi</Tag>
        return <Tag color={STATUS_META[current].color}>{STATUS_META[current].label}</Tag>
      },
    },
  ]

  // -------------------------------------------------------------------------
  // Shortcut keyboard (juga menjadi isi palet "?")
  // -------------------------------------------------------------------------

  // Shortcut juga diblok saat tab ini tidak aktif (shell mem-mount semua pane Tabs)
  const isBlocked = !active || scanOpen || importOpen

  const scanDisabled = !classId || students.length === 0 || !canWrite

  const shortcutItems: ShortcutItem[] = [
    {
      keys: ['Ctrl', 'S'],
      label: 'Simpan absensi',
      group: 'Aksi',
      icon: <SaveOutlined />,
      when: canWrite && !!classId,
      run: () => void handleSave(),
    },
    {
      keys: ['K'],
      label: 'Scan kartu pelajar via kamera',
      group: 'Aksi',
      icon: <ScanOutlined />,
      when: !scanDisabled,
      run: () => setScanOpen(true),
    },
    {
      keys: ['Ctrl', 'I'],
      label: 'Import absensi (Excel/CSV)',
      group: 'Aksi',
      icon: <ImportOutlined />,
      when: canWrite && !!classId,
      run: () => setImportOpen(true),
    },
    {
      keys: ['Ctrl', 'E'],
      label: 'Export Excel (.xlsx)',
      group: 'Aksi',
      icon: <FileExcelOutlined />,
      when: !!classId && students.length > 0,
      run: () => void handleExportXlsx(),
    },
    {
      keys: ['Ctrl', 'Z'],
      label: 'Batalkan operasi massal terakhir',
      group: 'Aksi',
      icon: <UndoOutlined />,
      when: canWrite,
      run: undo,
    },
    { keys: ['1'], label: 'Ke tampilan Grid', group: 'Navigasi', run: () => setView('grid') },
    { keys: ['2'], label: 'Ke tampilan Harian', group: 'Navigasi', run: () => setView('harian') },
    { keys: ['3'], label: 'Ke tampilan Rekap', group: 'Navigasi', run: () => setView('rekap') },
    {
      keys: ['?'],
      label: 'Toggle palet shortcut',
      group: 'Tampilan',
      icon: <ThunderboltOutlined />,
      run: () => shortcuts.toggle(),
    },
  ]

  const shortcuts = useShortcuts({ items: shortcutItems, isBlocked })

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const hasClass = !!classId

  return (
    <div>
      <div style={{ position: 'sticky', top: 56, zIndex: 15, marginBottom: 16 }}>
        <Card styles={{ body: { padding: '12px 16px' } }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <Space wrap size="middle">
              <Space size={6}>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  Kelas
                </Typography.Text>
                <Select
                  placeholder="Pilih kelas"
                  style={{ minWidth: 170 }}
                  value={classId}
                  onChange={(v) =>
                    guarded(() => {
                      setClassId(v as string)
                      setCursor(null)
                      syncParams({ class: v as string })
                    })
                  }
                  options={(classesQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                />
              </Space>
              <Space size={6}>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  Bulan
                </Typography.Text>
                <Select
                  style={{ minWidth: 120 }}
                  value={month}
                  onChange={(v) =>
                    guarded(() => {
                      setMonth(v as number)
                      setDailyDayState(null)
                      setCursor(null)
                      syncParams({ month: v as number })
                    })
                  }
                  options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
                />
              </Space>
              <Space size={6}>
                <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                  Tahun
                </Typography.Text>
                <Select
                  style={{ minWidth: 90 }}
                  value={year}
                  onChange={(v) =>
                    guarded(() => {
                      setYear(v as number)
                      setDailyDayState(null)
                      setCursor(null)
                      syncParams({ year: v as number })
                    })
                  }
                  options={[year - 1, year, year + 1].map((y) => ({ value: y, label: String(y) }))}
                />
              </Space>
            </Space>

            <Segmented
              value={view}
              onChange={(v) => setView(v as TabKey)}
              options={[
                { label: 'Grid', value: 'grid' },
                { label: 'Harian', value: 'harian' },
                { label: 'Rekap', value: 'rekap' },
              ]}
            />

            <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              {dirtyCount > 0 && (
                <Tag color="processing" style={{ margin: 0 }}>
                  {dirtyCount} draf belum disimpan
                </Tag>
              )}
              {canWrite && hasClass && (
                <Tooltip title="Batalkan operasi massal terakhir (Ctrl+Z)">
                  <Button icon={<UndoOutlined />} onClick={undo} disabled={undoDepth === 0} />
                </Tooltip>
              )}
              {canWrite && hasClass && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={() => void handleSave()}
                  loading={saveMutation.isPending}
                  disabled={dirtyCount === 0}
                >
                  Simpan Absensi
                </Button>
              )}
            </div>
          </div>
          {hasClass && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: token.colorTextSecondary }}>
              {className} · {students.length} santri · {weekdays} hari kerja ·{' '}
              {view === 'grid' ? 'grid bulanan' : view === 'harian' ? 'presensi harian' : 'rekap bulanan'}
            </div>
          )}
        </Card>
      </div>

      {(studentsQuery.isError || rowsQuery.isError) && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Gagal memuat data absensi"
          description={
            (studentsQuery.error as Error | null)?.message ||
            (rowsQuery.error as Error | null)?.message ||
            'Periksa koneksi lalu coba lagi.'
          }
          action={
            <Button
              size="small"
              onClick={() => {
                void studentsQuery.refetch()
                void rowsQuery.refetch()
              }}
            >
              Coba lagi
            </Button>
          }
        />
      )}

      {!hasClass ? (
        <Card>
          <Empty description="Pilih kelas untuk mulai mengisi absensi" />
        </Card>
      ) : (
        <Tabs
          activeKey={view}
          onChange={(k) => setView(k as TabKey)}
          renderTabBar={() => <></>}
          items={[
            {
              key: 'grid',
              label: 'Grid Absensi',
              children: (
                <Card>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <Space wrap size="small">
                      {canWrite && (
                        <>
                          <Button
                            type="primary"
                            ghost
                            icon={<ScanOutlined />}
                            onClick={() => setScanOpen(true)}
                            disabled={students.length === 0}
                          >
                            Scan Kartu
                          </Button>
                          <Tooltip title="Impor absensi (Excel/CSV)">
                            <Button
                              icon={<ImportOutlined />}
                              onClick={() => setImportOpen(true)}
                              disabled={students.length === 0}
                            />
                          </Tooltip>
                          <Dropdown
                            trigger={['click']}
                            placement="bottomLeft"
                            overlayStyle={{ minWidth: 300 }}
                            menu={{
                              items: [
                                {
                                  key: 'fill',
                                  icon: <ThunderboltOutlined />,
                                  disabled: students.length === 0,
                                  label: (
                                    <div>
                                      <div style={{ fontWeight: 600 }}>Isi Semua Hadir</div>
                                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                                        Tandai seluruh hari kerja bulan ini sebagai Hadir
                                      </div>
                                    </div>
                                  ),
                                },
                                {
                                  key: 'copy',
                                  icon: <CopyOutlined />,
                                  disabled: students.length === 0,
                                  label: (
                                    <div>
                                      <div style={{ fontWeight: 600 }}>Salin Bulan Lalu</div>
                                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                                        Isi dari absensi bulan sebelumnya untuk santri kosong
                                      </div>
                                    </div>
                                  ),
                                },
                                {
                                  key: 'sync',
                                  icon: <SyncOutlined />,
                                  disabled: syncMutation.isPending,
                                  label: (
                                    <div>
                                      <div style={{ fontWeight: 600 }}>Sinkron ke Rapor</div>
                                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                                        Salin rekap Sakit/Izin/Alpa/Pulang ke rapor bulanan
                                      </div>
                                    </div>
                                  ),
                                },
                                { type: 'divider' as const },
                                {
                                  key: 'reset',
                                  icon: <ClearOutlined />,
                                  danger: true,
                                  disabled: dirtyCount === 0,
                                  label: (
                                    <div>
                                      <div style={{ fontWeight: 600 }}>Reset Draf</div>
                                      <div style={{ fontSize: 12, opacity: 0.65 }}>
                                        Kosongkan semua perubahan yang belum disimpan
                                      </div>
                                    </div>
                                  ),
                                },
                              ],
                              onClick: ({ key }) => {
                                if (key === 'fill') fillAll('H')
                                if (key === 'copy') copyLastMonth()
                                if (key === 'sync') confirmSync()
                                if (key === 'reset') resetGrid()
                              },
                            }}
                          >
                            <Button icon={<MoreOutlined />}>Aksi Massal</Button>
                          </Dropdown>
                        </>
                      )}
                    </Space>
                    <Space wrap size="small">
                      <Input
                        allowClear
                        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                        placeholder="Cari santri…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 190 }}
                      />
                      <Dropdown
                        menu={{
                          items: [
                            { key: 'xlsx', label: 'Excel (.xlsx) — grid + rekap', icon: <FileExcelOutlined /> },
                            { key: 'csv', label: 'CSV (.csv)', icon: <FileTextOutlined /> },
                          ],
                          onClick: ({ key }) => (key === 'xlsx' ? void handleExportXlsx() : handleExportCsv()),
                        }}
                      >
                        <Tooltip title="Ekspor absensi (Excel/CSV)">
                          <Button icon={<DownloadOutlined />} disabled={students.length === 0} />
                        </Tooltip>
                      </Dropdown>
                    </Space>
                  </div>
                  <Tooltip
                    title={
                      <div style={{ lineHeight: 2 }}>
                        <div><b>Klik kotak tanggal</b> — status berganti: Hadir → Sakit → Izin → Alpa → Pulang Awal → kosong</div>
                        <div><b>Klik kanan kotak</b> — hapus statusnya</div>
                        <div><b>Klik angka tanggal di atas</b> — isi hari itu untuk semua santri sekaligus</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: token.colorTextTertiary }}>Bisa juga pakai keyboard — klik dulu salah satu kotak, lalu:</div>
                        <div style={{ paddingLeft: 8 }}>
                          <span style={{ color: token.colorTextTertiary, marginRight: 7 }}>•</span>
                          <b>Panah</b> pindah kotak · <b>Enter</b> ke bawah · <b>H / S / I / A / P</b> isi status · <b>X</b> kosongkan
                        </div>
                        <div><b>Tekan ?</b> — lihat semua shortcut</div>
                      </div>
                    }
                    overlayStyle={{ maxWidth: 560 }}
                    overlayInnerStyle={{ width: 'max-content', maxWidth: 560, padding: '10px 14px', fontSize: 12.5 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        marginBottom: 12,
                        fontSize: 12.5,
                        color: token.colorTextSecondary,
                        cursor: 'help',
                        width: 'fit-content',
                      }}
                    >
                      <InfoCircleOutlined style={{ color: token.colorPrimary }} />
                      <span>
                        Cara isi: klik kotak tanggal — arahkan ke sini untuk panduan lengkap ·{' '}
                        <Typography.Text code>?</Typography.Text> semua shortcut · hari kerja: {weekdays}
                      </span>
                    </div>
                  </Tooltip>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {STATUS_ORDER.map((st) => (
                      <Tag key={st} color={STATUS_META[st].color} style={{ margin: 0, fontWeight: 600 }}>
                        {st} · {STATUS_META[st].label}
                      </Tag>
                    ))}
                  </div>
                  <div
                    ref={gridBodyRef}
                    tabIndex={0}
                    onKeyDown={handleGridKeyDown}
                    style={{ outline: 'none', borderRadius: 8 }}
                  >
                    <Table<ReportCardStudent>
                      rowKey="id"
                      columns={gridColumns}
                      dataSource={filteredStudents}
                      loading={studentsQuery.isLoading || rowsQuery.isLoading}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={search ? 'Tidak ada santri yang cocok' : 'Kelas ini belum punya siswa'}
                          />
                        ),
                      }}
                      pagination={false}
                      sticky
                      scroll={{ x: `max-content` }}
                      size="small"
                    />
                  </div>
                </Card>
              ),
            },
            {
              key: 'harian',
              label: 'Harian',
              children: (
                <Card>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <Space size="small">
                      <Button icon={<LeftOutlined />} onClick={() => setDailyDay(dailyDay - 1)} disabled={dailyDay <= 1 || !canWrite} />
                      <Select
                        value={dailyDay}
                        onChange={(v) => setDailyDay(v as number)}
                        style={{ width: 170 }}
                        options={Array.from({ length: daysInMonth }, (_, i) => ({
                          value: i + 1,
                          label: `Hari ${i + 1} · ${WEEKDAY_SHORT[new Date(year, month - 1, i + 1).getDay()]}`,
                        }))}
                      />
                      <Button
                        icon={<RightOutlined />}
                        onClick={() => setDailyDay(dailyDay + 1)}
                        disabled={dailyDay >= daysInMonth || !canWrite}
                      />
                      {isCurrentPeriod && (
                        <Button onClick={() => setDailyDay(now.getDate())} disabled={!canWrite}>
                          Hari Ini
                        </Button>
                      )}
                      {isWeekend(dailyDay) && <Tag color="orange">Akhir pekan</Tag>}
                    </Space>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: token.colorTextSecondary }}>
                        {filledToday}/{students.length} terisi
                      </span>
                      {canWrite && (
                        <Button
                          icon={<ThunderboltOutlined />}
                          onClick={() => fillColumn(dailyDay, 'H')}
                          disabled={students.length === 0}
                        >
                          Semua Hadir (Hari {dailyDay})
                        </Button>
                      )}
                      <Input
                        allowClear
                        prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                        placeholder="Cari santri…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 190 }}
                      />
                    </div>
                  </div>
                  <Table<ReportCardStudent>
                    rowKey="id"
                    columns={harianColumns}
                    dataSource={filteredStudents}
                    loading={studentsQuery.isLoading || rowsQuery.isLoading}
                    locale={{
                      emptyText: (
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={search ? 'Tidak ada santri yang cocok' : 'Kelas ini belum punya siswa'}
                        />
                      ),
                    }}
                    pagination={false}
                    size="middle"
                  />
                </Card>
              ),
            },
            {
              key: 'rekap',
              label: 'Rekap',
              children: (
                <>
                  <Space wrap size={10} style={{ marginBottom: 12 }}>
                    <StatChip
                      icon={<TeamOutlined />}
                      label="Santri"
                      value={students.length}
                      color="indigo"
                      loading={studentsQuery.isLoading || rowsQuery.isLoading}
                    />
                    <StatChip
                      icon={<CalendarOutlined />}
                      label={`Hari Kerja / ${daysInMonth}`}
                      value={weekdays}
                      color="sky"
                      loading={studentsQuery.isLoading || rowsQuery.isLoading}
                    />
                    {distData.map((d) => (
                      <StatChip
                        key={d.code}
                        icon={STATUS_CHIP[d.code as AttendanceStatus].icon}
                        label={STATUS_META[d.code as AttendanceStatus].label}
                        value={d.total}
                        color={STATUS_CHIP[d.code as AttendanceStatus].color}
                        loading={studentsQuery.isLoading || rowsQuery.isLoading}
                      />
                    ))}
                  </Space>

                  {distData.some((d) => d.total > 0) && (
                    <Card
                      style={{ marginBottom: 16 }}
                      title={<span style={{ fontSize: 13.5, fontWeight: 700 }}>Distribusi Status Bulan Ini</span>}
                      styles={{ body: { padding: '4px 14px 14px' } }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          height: 28,
                          borderRadius: 9,
                          overflow: 'hidden',
                          background: token.colorFillQuaternary,
                        }}
                      >
                        {distData
                          .filter((d) => d.total > 0)
                          .map((d, i) => {
                            const pct = Math.round((d.total / distTotal) * 100)
                            const showCount = pct >= 16
                            return (
                              <Tooltip
                                key={d.code}
                                title={`${STATUS_META[d.code as AttendanceStatus].label}: ${d.total} hari (${pct}%)`}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    minWidth: 12,
                                    background: STATUS_META[d.code as AttendanceStatus].color,
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
                                      {showCount ? `${d.code} ${d.total}` : d.code}
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
                    <Table<ReportCardStudent>
                      rowKey="id"
                      columns={rekapColumns}
                      dataSource={filteredStudents}
                      loading={studentsQuery.isLoading || rowsQuery.isLoading}
                      pagination={false}
                      scroll={{ x: true }}
                    />
                  </Card>
                </>
              ),
            },
          ]}
        />
      )}

      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        students={students}
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        initialDay={isCurrentPeriod ? now.getDate() : 1}
        getCurrent={(studentId, day) => getDays(studentId)[String(day)] ?? ''}
        onMark={(studentId, day, status) => setCell(studentId, day, status)}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        students={students}
        onApply={(merges, overwrite) => {
          pushUndo()
          setDrafts((prev) => {
            const next = { ...prev }
            for (const m of merges) {
              const base = overwrite ? {} : { ...(prev[m.studentId] ?? savedByStudent.get(m.studentId) ?? {}) }
              next[m.studentId] = { ...base, ...m.days }
            }
            return next
          })
        }}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}

// ─── Shell: satu halaman Absensi bertab (pola ?tab= — SKILLS.md §Skill 2) ──
type AttendanceTabKey = 'students' | 'subjects' | 'teachers' | 'machines'

const ATTENDANCE_TAB_KEYS: readonly AttendanceTabKey[] = ['students', 'subjects', 'teachers', 'machines']

const ATTENDANCE_TAB_ITEMS: { key: AttendanceTabKey; label: string; subtitle: string }[] = [
  {
    key: 'students',
    label: 'Santri',
    subtitle: 'Kehadiran harian santri per kelas',
  },
  {
    key: 'subjects',
    label: 'Mapel',
    subtitle: 'Kehadiran per jam pelajaran',
  },
  {
    key: 'teachers',
    label: 'Guru',
    subtitle: 'Kehadiran guru dan tenaga kependidikan',
  },
  {
    key: 'machines',
    label: 'Mesin',
    subtitle: 'Mesin presensi dan sinkronisasi absensi',
  },
]

const isAttendanceTabKey = (key: string): key is AttendanceTabKey =>
  (ATTENDANCE_TAB_KEYS as readonly string[]).includes(key)

/** Halaman Absensi: santri, guru & karyawan, dan mesin presensi dalam satu route (?tab=). */
export function AttendancePage() {
  // Semua tab — termasuk default — memakai ?tab= agar bisa di-deep-link.
  const { tab: rawTab, setTab } = useUrlTab('students', { writeDefault: true })
  const tab = isAttendanceTabKey(rawTab) ? rawTab : 'students'

  useEffect(() => {
    if (tab !== rawTab) setTab(tab)
  }, [tab, rawTab, setTab])

  // Tab mesin mengikuti feature flag yang sama dengan tombol di tab santri.
  // Fallback true (fail-open): flag yang belum di-seed tidak boleh menyembunyikan fitur.
  const machineEnabled = useFlag('attendance.student_machines', true)
  // Tab Mapel = modul absensi per jam pelajaran (P2)
  const subjectsEnabled = useFlag('module.subject_attendance', true)
  useEffect(() => {
    if ((tab === 'machines' && !machineEnabled) || (tab === 'subjects' && !subjectsEnabled)) setTab('students')
  }, [tab, machineEnabled, subjectsEnabled, setTab])
  const items = ATTENDANCE_TAB_ITEMS.filter(
    (t) => (t.key !== 'machines' || machineEnabled) && (t.key !== 'subjects' || subjectsEnabled),
  )
  const activeKey = items.some((t) => t.key === tab) ? tab : items[0].key
  const active = items.find((t) => t.key === activeKey) ?? items[0]

  return (
    <div>
      <ShellStagger>
        <ShellItem>
          <PageHeader title="Absensi" subtitle={active.subtitle} />
        </ShellItem>
        <ShellItem>
          <Tabs
            activeKey={activeKey}
            onChange={setTab}
            items={items.map((t) => ({
              key: t.key,
              label: t.label,
              children:
                t.key === 'teachers' ? (
                  <TeacherAttendancePage />
                ) : t.key === 'machines' ? (
                  <MachineAttendancePage />
                ) : t.key === 'subjects' ? (
                  <SubjectsTab active={activeKey === 'subjects'} />
                ) : (
                  <AttendanceSantriTab active={activeKey === 'students'} />
                ),
            }))}
          />
        </ShellItem>
      </ShellStagger>
    </div>
  )
}
