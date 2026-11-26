import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Grid,
  Input,
  Popconfirm,
  Progress,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  CheckOutlined,
  CopyOutlined,
  FilterOutlined,
  LoadingOutlined,
  PrinterOutlined,
  QuestionCircleOutlined,
  RedoOutlined,
  SaveOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import type { QueryKey } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/PageHeader'
import { usePermissions, useSession } from '../../shared/hooks/useProfile'
import { useDebounce } from '../../shared/hooks/useDebounce'
import { useShortcuts } from '../../shared/hooks/useShortcuts'
import { ShortcutsModal } from '../../shared/components/ShortcutsModal'
import { SetupBar } from './components/SetupBar'
import { ExtrasDrawer } from './components/ExtrasDrawer'
import { HafalanModal } from './components/HafalanModal'
import { EntryGrid } from './components/EntryGrid'
import { MobileEntry } from './components/MobileEntry'
import { BulkFillModal, type BulkFillValues } from './components/BulkFillModal'
import {
  BULANAN_MAX_SCORE,
  getCriteria,
  getScoreWithFallback,
  isComplete,
  isPracticalKey,
  MONTH_NAMES,
  periodKey,
  REPORT_CARD_TYPE_LABEL,
  SEMESTER_MAX_SCORE,
} from './constants'
import {
  useBehaviorForMonth,
  useMonthlyRows,
  useReportCardClasses,
  useReportCardStudents,
  useResetMonthlyPeriod,
  useResetSemesterPeriod,
  useSaveMonthly,
  useSaveSemester,
  useSemesterRows,
} from './hooks'
import { MONTHLY_SCORE_KEYS } from './savePayloads'
import { useEntryDrafts } from './useEntryDrafts'
import type {
  MonthlyDraft,
  ReportCardStudent,
  ReportCardType,
  SemesterDraft,
  SemesterType,
} from './types'

const REPORT_CARD_TYPES = Object.keys(REPORT_CARD_TYPE_LABEL) as ReportCardType[]

type FocusRequest = {
  studentId: string
  col: number
  nonce: number
}

type ScoreEdit = {
  studentId: string
  key: string
  prev: number | null
  next: number | null
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}

export function InputPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const singleRow = Boolean(screens.lg)
  const showPrimaryLabels = Boolean(screens.xl)
  const showAllLabels = Boolean(screens.xxl)
  const { classId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { canWrite, canDelete } = usePermissions()
  const sessionQuery = useSession()
  const isMobile = useIsMobile()

  const typeRaw = searchParams.get('type')
  const type: ReportCardType =
    typeRaw && (REPORT_CARD_TYPES as string[]).includes(typeRaw) ? (typeRaw as ReportCardType) : 'monthly'
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1
  const year = Number(searchParams.get('year')) || new Date().getFullYear()
  const semester = (searchParams.get('semester') === '2' ? 2 : 1) as 1 | 2
  const ay = searchParams.get('ay') ?? ''
  const musyrif = searchParams.get('musyrif') ?? ''

  const classesQuery = useReportCardClasses()
  const classRow = (classesQuery.data ?? []).find((c) => c.id === classId)
  const grade = classRow?.grade ?? null

  const studentsQuery = useReportCardStudents(classId || undefined)
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data])
  const studentIds = useMemo(() => students.map((s) => s.id), [students])

  const isMonthly = type === 'monthly'
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const studentCount = studentIds.length
  const firstStudentId = studentIds[0]
  const queryKey = useMemo<QueryKey>(
    () =>
      isMonthly
        ? ['report-cards', 'monthly', year, month, studentCount, firstStudentId]
        : ['report-cards', 'semester', type, semester, ay, studentCount, firstStudentId],
    [isMonthly, year, month, type, semester, ay, studentCount, firstStudentId],
  )

  const monthlyQuery = useMonthlyRows(isMonthly ? studentIds : [], month, year)
  const prevMonthlyQuery = useMonthlyRows(isMonthly ? studentIds : [], prevMonth, prevYear)
  const semesterQuery = useSemesterRows(
    isMonthly ? [] : studentIds,
    type as SemesterType,
    semester,
    ay || undefined,
  )

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}T23:59:59Z`
  const behaviorQuery = useBehaviorForMonth(isMonthly ? studentIds : [], monthStart, monthEnd)

  const [extrasStudent, setExtrasStudent] = useState<ReportCardStudent | null>(null)
  const [hafalanStudent, setHafalanStudent] = useState<ReportCardStudent | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [incompleteOnly, setIncompleteOnly] = useState(false)

  const saveMonthly = useSaveMonthly()
  const saveSemester = useSaveSemester()
  const resetMonthly = useResetMonthlyPeriod()
  const resetSemester = useResetSemesterPeriod()

  const savedMonthlyById = useMemo(
    () => new Map((monthlyQuery.data ?? []).map((r) => [r.student_id, r])),
    [monthlyQuery.data],
  )
  const savedSemesterById = useMemo(
    () => new Map((semesterQuery.data ?? []).map((r) => [r.student_id, r])),
    [semesterQuery.data],
  )
  const behaviorByStudent = useMemo(() => {
    const map = new Map<string, { negative: number; positive: number; items: string[] }>()
    for (const item of behaviorQuery.data ?? []) {
      const entry = map.get(item.student_id) ?? { negative: 0, positive: 0, items: [] }
      if (item.points < 0) {
        entry.negative += 1
        entry.items.push(`${item.rule_name ?? 'Pelanggaran'} (${item.points})`)
      } else {
        entry.positive += 1
        entry.items.push(`${item.rule_name ?? 'Prestasi'} (+${item.points})`)
      }
      map.set(item.student_id, entry)
    }
    return map
  }, [behaviorQuery.data])

  const criteria = useMemo(() => getCriteria(type, grade, classRow?.name), [type, grade, classRow?.name])
  const maxScore = isMonthly ? BULANAN_MAX_SCORE : SEMESTER_MAX_SCORE
  const musyrifName = musyrif || classRow?.homeroom_teacher?.name || null
  const updatedBy = sessionQuery.data?.user?.id ?? null

  const draftsEngine = useEntryDrafts({
    storageKey: `raport-draft:${periodKey(type, isMonthly ? { month, year } : { semester, academicYearId: ay })}:${classId}`,
    queryKey,
    isMonthly,
    type,
    students,
    month,
    year,
    semester,
    ay,
    musyrifName,
    updatedBy,
    savedMonthlyById,
    savedSemesterById,
    saveMonthly,
    saveSemester,
    message,
  })
  const {
    drafts,
    setDrafts,
    semesterDrafts,
    setSemesterDrafts,
    dirtyCount,
    saveState,
    scheduleAutosaveMany,
    saveAll,
    clearStudentDraft,
  } = draftsEngine

  // ---------------------------------------------------------------
  // Nilai efektif (draf ?? tersimpan) + progres
  // ---------------------------------------------------------------
  const getScore = useCallback(
    (studentId: string, key: string): number | null => {
      if (isMonthly) {
        const draft = drafts[studentId]
        if (draft && key in draft) return (draft as unknown as Record<string, number | null>)[key] ?? null
        const row = savedMonthlyById.get(studentId)
        return row ? ((row as unknown as Record<string, number | null>)[key] ?? null) : null
      }
      const draft = semesterDrafts[studentId]
      if (draft && key in draft.scores) return draft.scores[key] ?? null
      const saved = savedSemesterById.get(studentId)
      return saved ? getScoreWithFallback(saved.scores ?? {}, key) : null
    },
    [isMonthly, drafts, savedMonthlyById, semesterDrafts, savedSemesterById],
  )

  const getScoreRef = useRef(getScore)
  useEffect(() => {
    getScoreRef.current = getScore
  }, [getScore])

  const isStudentComplete = useCallback(
    (studentId: string) => {
      const scores: Record<string, number | null> = {}
      for (const criterion of criteria) scores[criterion.key] = getScore(studentId, criterion.key)
      return isComplete(type, scores, grade, classRow?.name)
    },
    [criteria, getScore, type, grade, classRow?.name],
  )

  const completeCount = useMemo(
    () => students.reduce((count, student) => (isStudentComplete(student.id) ? count + 1 : count), 0),
    [students, isStudentComplete],
  )
  const incompleteCount = students.length - completeCount

  const classAverage = useMemo(() => {
    let sum = 0
    let count = 0
    for (const student of students) {
      for (const criterion of criteria) {
        if (isPracticalKey(criterion.key)) continue
        const value = getScore(student.id, criterion.key)
        if (typeof value === 'number') {
          sum += value
          count += 1
        }
      }
    }
    return count > 0 ? Math.round((sum / count) * 100) / 100 : null
  }, [students, criteria, getScore])

  const undoRef = useRef<ScoreEdit[][]>([])
  const redoRef = useRef<ScoreEdit[][]>([])

  const clearHistory = useCallback(() => {
    undoRef.current = []
    redoRef.current = []
  }, [])

  useEffect(() => {
    clearHistory()
  }, [type, month, year, semester, ay, classId, clearHistory])

  const pushHistory = useCallback((batch: ScoreEdit[]) => {
    if (batch.length === 0) return
    undoRef.current.push(batch)
    if (undoRef.current.length > 50) undoRef.current.shift()
    redoRef.current = []
  }, [])

  const applyEdits = useCallback(
    (batch: ScoreEdit[], direction: 'prev' | 'next') => {
      if (batch.length === 0) return
      if (isMonthly) {
        setDrafts((prev) => {
          const next = { ...prev }
          for (const edit of batch) {
            next[edit.studentId] = {
              ...(next[edit.studentId] ?? {}),
              [edit.key]: edit[direction],
            }
          }
          return next
        })
      } else {
        setSemesterDrafts((prev) => {
          const next = { ...prev }
          for (const edit of batch) {
            const draft = next[edit.studentId] ?? { scores: {} }
            next[edit.studentId] = {
              ...draft,
              scores: { ...draft.scores, [edit.key]: edit[direction] },
            }
          }
          return next
        })
      }
      scheduleAutosaveMany([...new Set(batch.map((edit) => edit.studentId))])
    },
    [isMonthly, setDrafts, setSemesterDrafts, scheduleAutosaveMany],
  )

  const undo = useCallback(() => {
    const batch = undoRef.current.pop()
    if (!batch) return
    redoRef.current.push(batch)
    applyEdits(batch, 'prev')
  }, [applyEdits])

  const redo = useCallback(() => {
    const batch = redoRef.current.pop()
    if (!batch) return
    undoRef.current.push(batch)
    applyEdits(batch, 'next')
  }, [applyEdits])

  const resetMonthlyRef = useRef(resetMonthly)
  const resetSemesterRef = useRef(resetSemester)
  useEffect(() => {
    resetMonthlyRef.current = resetMonthly
    resetSemesterRef.current = resetSemester
  }, [resetMonthly, resetSemester])

  // ---------------------------------------------------------------
  // Aksi input & massal
  // ---------------------------------------------------------------
  const handleCommitScore = useCallback(
    (studentId: string, key: string, value: number | null) => {
      const prev = getScoreRef.current(studentId, key)
      const edit = { studentId, key, prev, next: value }
      if (prev !== value) pushHistory([edit])
      applyEdits([edit], 'next')
    },
    [applyEdits, pushHistory],
  )

  const handleResetRow = useCallback(
    (studentId: string) => {
      const onError = (err: Error) => message.error(err.message || 'Gagal menghapus')
      const onDone = () => {
        message.success('Data santri ini dihapus untuk periode ini')
        clearStudentDraft(studentId)
        clearHistory()
      }
      if (isMonthly) {
        resetMonthlyRef.current.mutate(
          { studentIds: [studentId], month, year },
          { onSuccess: onDone, onError },
        )
      } else {
        resetSemesterRef.current.mutate(
          { studentIds: [studentId], reportType: type as SemesterType, semester, academicYearId: ay },
          { onSuccess: onDone, onError },
        )
      }
    },
    [isMonthly, month, year, type, semester, ay, message, clearStudentDraft, clearHistory],
  )

  const handleResetPeriod = () => {
    const onError = (err: Error) => message.error(err.message || 'Gagal menghapus')
    const onDone = () => {
      message.success('Seluruh raport kelas untuk periode ini dihapus')
      draftsEngine.discardDrafts()
      clearHistory()
    }
    if (isMonthly) {
      resetMonthly.mutate({ studentIds, month, year }, { onSuccess: onDone, onError })
    } else {
      resetSemester.mutate(
        { studentIds, reportType: type as SemesterType, semester, academicYearId: ay },
        { onSuccess: onDone, onError },
      )
    }
  }

  const handleCopyPrevMonth = () => {
    const prevRows = prevMonthlyQuery.data ?? []
    if (prevRows.length === 0) {
      message.info(`Tidak ada data ${MONTH_NAMES[prevMonth - 1]} ${prevYear} untuk disalin`)
      return
    }
    const next = { ...drafts }
    const copiedIds: string[] = []
    for (const row of prevRows) {
      const saved = savedMonthlyById.get(row.student_id)
      const hasCurrent =
        MONTHLY_SCORE_KEYS.some((k) => typeof next[row.student_id]?.[k] === 'number') ||
        MONTHLY_SCORE_KEYS.some(
          (k) => typeof (saved as unknown as Record<string, number | null> | undefined)?.[k] === 'number',
        )
      if (hasCurrent) continue
      next[row.student_id] = {
        ...next[row.student_id],
        character_score: row.character_score,
        worship_score: row.worship_score,
        cleanliness_score: row.cleanliness_score,
        quran_score: row.quran_score,
        language_score: row.language_score,
      }
      copiedIds.push(row.student_id)
    }
    setDrafts(next)
    scheduleAutosaveMany(copiedIds)
    clearHistory()
    message.success(
      `Nilai ${MONTH_NAMES[prevMonth - 1]} disalin ke ${copiedIds.length} santri (hanya yang belum terisi)`,
    )
  }

  const handleBulkApply = (values: BulkFillValues) => {
    const touchedIds: string[] = []
    // Nilai efektif (draf ?? tersimpan) — isi massal tidak boleh menimpa yang sudah terisi
    const effective = (studentId: string): Record<string, unknown> => {
      if (isMonthly) {
        const saved = savedMonthlyById.get(studentId) as unknown as Record<string, unknown> | undefined
        const draft = drafts[studentId] as unknown as Record<string, unknown> | undefined
        return { ...(saved ?? {}), ...(draft ?? {}) }
      }
      const saved = savedSemesterById.get(studentId)
      const draft = semesterDrafts[studentId]
      return {
        ...(saved?.scores ?? {}),
        ...(saved?.extras ?? {}),
        ...(draft?.scores ?? {}),
        ...(draft ? ({ ...draft, scores: undefined } as unknown as Record<string, unknown>) : {}),
      }
    }

    if (isMonthly) {
      const next = { ...drafts }
      for (const student of students) {
        const cur = effective(student.id)
        const patch: Record<string, unknown> = {}
        for (const c of criteria) {
          const v = values.scores[c.key]
          if (typeof v === 'number' && typeof cur[c.key] !== 'number') patch[c.key] = v
        }
        for (const k of ['weight_kg', 'height_cm', 'ziyadah', 'murojaah', 'sholat', 'sick_days', 'excused_days', 'absent_days', 'early_leave_days', 'notes'] as const) {
          const v = values[k]
          if (v === null || v === undefined || v === '') continue
          if (cur[k] !== undefined && cur[k] !== null && cur[k] !== '') continue
          patch[k] = v
        }
        if (Object.keys(patch).length === 0) continue
        touchedIds.push(student.id)
        next[student.id] = { ...(drafts[student.id] ?? {}), ...patch } as MonthlyDraft
      }
      setDrafts(next)
    } else {
      const next = { ...semesterDrafts }
      for (const student of students) {
        const d = semesterDrafts[student.id] ?? { scores: {} as Record<string, number | null> }
        const cur = effective(student.id)
        const newScores: Record<string, number | null> = {}
        for (const c of criteria) {
          const v = values.scores[c.key]
          if (typeof v === 'number' && typeof cur[c.key] !== 'number') newScores[c.key] = v
        }
        const extrasPatch: Partial<SemesterDraft> = {}
        for (const k of ['weight_kg', 'height_cm', 'sholat', 'sick_days', 'excused_days', 'absent_days', 'early_leave_days', 'notes'] as const) {
          const v = values[k]
          if (v === null || v === undefined || v === '') continue
          if (cur[k] !== undefined && cur[k] !== null && cur[k] !== '') continue
          ;(extrasPatch as Record<string, unknown>)[k] = v
        }
        if (Object.keys(newScores).length === 0 && Object.keys(extrasPatch).length === 0) continue
        touchedIds.push(student.id)
        next[student.id] = { ...d, scores: { ...d.scores, ...newScores }, ...extrasPatch }
      }
      setSemesterDrafts(next)
    }
    if (touchedIds.length > 0) {
      scheduleAutosaveMany(touchedIds)
      clearHistory()
      message.success(
        `Isi massal diterapkan ke ${touchedIds.length} santri (sel kosong saja) dan akan tersimpan otomatis.`,
      )
    } else {
      message.info('Tidak ada sel kosong yang cocok dengan nilai yang diisi')
    }
  }

  // ---------------------------------------------------------------
  // Filter daftar santri
  // ---------------------------------------------------------------
  const visibleStudents = useMemo(() => {
    let rows = students
    const q = debouncedSearch.trim().toLowerCase()
    if (q) rows = rows.filter((s) => s.name.toLowerCase().includes(q) || s.registration_code.toLowerCase().includes(q))
    if (incompleteOnly) rows = rows.filter((s) => !isStudentComplete(s.id))
    return rows
  }, [students, debouncedSearch, incompleteOnly, isStudentComplete])

  const handlePasteScores = useCallback(
    (startStudentId: string, startCriterionKey: string, values: (number | null)[][]) => {
      const startRow = visibleStudents.findIndex((student) => student.id === startStudentId)
      const startCol = criteria.findIndex((criterion) => criterion.key === startCriterionKey)
      if (startRow < 0 || startCol < 0) return

      const batch: ScoreEdit[] = []
      for (let rowOffset = 0; rowOffset < values.length; rowOffset++) {
        const student = visibleStudents[startRow + rowOffset]
        if (!student) break
        for (let colOffset = 0; colOffset < values[rowOffset].length; colOffset++) {
          const criterion = criteria[startCol + colOffset]
          if (!criterion) break
          const value = values[rowOffset][colOffset]
          if (value === null) continue
          const prev = getScoreRef.current(student.id, criterion.key)
          if (prev === value) continue
          batch.push({ studentId: student.id, key: criterion.key, prev, next: value })
        }
      }

      if (batch.length === 0) {
        message.info('Tidak ada nilai baru yang ditempelkan')
        return
      }
      pushHistory(batch)
      applyEdits(batch, 'next')
      message.success(`${batch.length} nilai ditempelkan`)
    },
    [visibleStudents, criteria, pushHistory, applyEdits, message],
  )

  const shortcutsOpenRef = useRef<() => void>(() => {})
  const jumpNextRef = useRef<() => void>(() => {})

  const shortcuts = useShortcuts({
    items: [
      {
        keys: ['Ctrl', 'S'],
        label: 'Simpan Semua',
        description: 'Simpan seluruh draf nilai kelas ini',
        group: 'Aksi',
        icon: <SaveOutlined />,
        run: () => void saveAll(),
        when: canWrite,
      },
      {
        keys: ['Ctrl', 'Z'],
        label: 'Undo',
        description: 'Batalkan perubahan nilai terakhir',
        group: 'Aksi',
        icon: <UndoOutlined />,
        run: undo,
        when: canWrite,
      },
      {
        keys: ['Ctrl', 'Shift', 'Z'],
        label: 'Redo',
        description: 'Ulangi perubahan nilai yang dibatalkan',
        group: 'Aksi',
        icon: <RedoOutlined />,
        run: redo,
        when: canWrite,
      },
      {
        keys: ['Alt', 'ArrowDown'],
        label: 'Lompat ke belum lengkap',
        description: 'Fokus ke santri berikutnya yang nilainya belum lengkap',
        group: 'Navigasi',
        icon: <ArrowDownOutlined />,
        run: () => jumpNextRef.current(),
        when: canWrite,
      },
      {
        keys: ['?'],
        label: 'Bantuan shortcut',
        description: 'Buka daftar shortcut keyboard',
        group: 'Bantuan',
        icon: <QuestionCircleOutlined />,
        run: () => shortcutsOpenRef.current(),
      },
    ],
    isBlocked: bulkOpen || !!extrasStudent || !!hafalanStudent,
  })

  useEffect(() => {
    shortcutsOpenRef.current = shortcuts.toggle
  }, [shortcuts.toggle])

  // Guard: jangan tutup tab saat masih ada draf
  useEffect(() => {
    if (draftsEngine.dirtyCount === 0) return
    const fn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [draftsEngine.dirtyCount])

  const previewPath = useMemo(() => {
    const sp = new URLSearchParams(searchParams)
    return `/report-cards/preview/${classId}?${sp.toString()}`
  }, [searchParams, classId])

  const backPath = useMemo(() => {
    const sp = new URLSearchParams()
    if (isMonthly) {
      sp.set('mode', 'monthly')
      sp.set('month', String(month))
      sp.set('year', String(year))
    } else {
      sp.set('mode', 'semester')
      sp.set('semesterType', type)
      sp.set('semester', String(semester))
      if (ay) sp.set('ay', ay)
    }
    return `/report-cards?${sp.toString()}`
  }, [isMonthly, month, year, type, semester, ay])

  const handleLeave = useCallback(
    async (target: string) => {
      if (dirtyCount > 0) {
        const saved = await saveAll({ silent: true })
        if (!saved) return
      }
      navigate(target)
    },
    [dirtyCount, saveAll, navigate],
  )
  const pct = students.length > 0 ? Math.round((completeCount / students.length) * 100) : 0
  const saving = saveMonthly.isPending || saveSemester.isPending
  const activeDrafts = isMonthly ? drafts : semesterDrafts
  const dirtyIds = useMemo(() => new Set(Object.keys(activeDrafts)), [activeDrafts])
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const jumpCursor = useRef<string | null>(null)
  const focusNonce = useRef(0)

  const hasIncompleteVisible = useMemo(
    () => visibleStudents.some((student) => !isStudentComplete(student.id)),
    [visibleStudents, isStudentComplete],
  )

  const jumpToNextIncomplete = useCallback(() => {
    if (visibleStudents.length === 0) return
    const start = jumpCursor.current
      ? visibleStudents.findIndex((s) => s.id === jumpCursor.current) + 1
      : 0
    for (let i = 0; i < visibleStudents.length; i++) {
      const student = visibleStudents[(start + i) % visibleStudents.length]
      if (isStudentComplete(student.id)) continue
      const col = criteria.findIndex(
        (criterion) => typeof getScore(student.id, criterion.key) !== 'number',
      )
      jumpCursor.current = student.id
      focusNonce.current += 1
      setFocusRequest({ studentId: student.id, col: Math.max(col, 0), nonce: focusNonce.current })
      return
    }
    message.info('Semua santri pada daftar ini sudah lengkap')
  }, [visibleStudents, criteria, getScore, isStudentComplete, message])

  useEffect(() => {
    jumpNextRef.current = jumpToNextIncomplete
  }, [jumpToNextIncomplete])

  const clearFilters = useCallback(() => {
    setSearch('')
    setIncompleteOnly(false)
  }, [])

  const extrasMonthlyInitial = extrasStudent
    ? {
        ...(savedMonthlyById.get(extrasStudent.id) as MonthlyDraft | undefined),
        ...drafts[extrasStudent.id],
      }
    : undefined

  const extrasSemesterInitial = extrasStudent
    ? (() => {
        const saved = savedSemesterById.get(extrasStudent.id)
        const draft = semesterDrafts[extrasStudent.id]
        return {
          ...(saved?.extras as SemesterDraft | undefined),
          ...draft,
          scores: { ...(saved?.scores ?? {}), ...(draft?.scores ?? {}) },
        }
      })()
    : undefined

  // Catatan hafalan luar Juz 30-26 (draf ?? tersimpan) untuk tombol buku per baris.
  const hafalanById = useMemo(() => {
    const map = new Map<string, string>()
    if (type !== 'pondok_oral') return map
    for (const student of students) {
      const saved = savedSemesterById.get(student.id)?.extras?.hafalan_note ?? ''
      const draft = semesterDrafts[student.id]?.hafalan_note
      const value = (draft ?? saved).trim()
      if (value) map.set(student.id, value)
    }
    return map
  }, [type, students, savedSemesterById, semesterDrafts])

  const hafalanInitial = hafalanStudent
    ? (hafalanById.get(hafalanStudent.id) ?? '')
    : ''

  const handleSaveHafalan = (studentId: string, value: string) => {
    setSemesterDrafts((prev) => {
      const draft = prev[studentId] ?? { scores: {} }
      return { ...prev, [studentId]: { ...draft, hafalan_note: value } }
    })
    draftsEngine.scheduleAutosave(studentId)
  }

  return (
    <div>
      <PageHeader
        title={`Input ${REPORT_CARD_TYPE_LABEL[type]}`}
        subtitle={classRow ? `Kelas ${classRow.name}` : '...'}
        extra={
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => void handleLeave(backPath)}>
              Kembali
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => void handleLeave(previewPath)}>
              Preview & Cetak
            </Button>
            {canWrite && (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={dirtyCount === 0}
                onClick={() => void saveAll()}
              >
                Simpan Semua
              </Button>
            )}
            <Tooltip title="Shortcut keyboard (?)">
              <Button
                aria-label="Palet shortcut"
                icon={<QuestionCircleOutlined />}
                onClick={shortcuts.open}
              />
            </Tooltip>
          </Space>
        }
      />

      <SetupBar classId={classId} homeroomTeacherName={classRow?.homeroom_teacher?.name ?? null} />

      {!isMonthly && !ay && (
        <Alert
          type="info"
          showIcon
          message="Pilih tahun ajaran pada bar di atas untuk mulai mengisi raport semester."
          style={{ marginBottom: 16 }}
        />
      )}

      {draftsEngine.restoreBanner && draftsEngine.dirtyCount > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={draftsEngine.dismissRestore}
          message={
            <span>
              Ada draf dari sesi sebelumnya ({draftsEngine.dirtyCount} santri belum tersimpan).{' '}
              <Button
                type="link"
                size="small"
                danger
                style={{ padding: 0 }}
                onClick={() => {
                  draftsEngine.discardDrafts()
                  clearHistory()
                }}
              >
                Buang draf
              </Button>
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: singleRow ? 'nowrap' : 'wrap',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: token.colorTextQuaternary }} />}
            placeholder="Cari nama atau kode santri"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{
              flex: '1 1 180px',
              minWidth: 150,
              maxWidth: showPrimaryLabels ? 320 : 240,
            }}
            aria-label="Cari santri"
          />

          <Button
            type={incompleteOnly ? 'primary' : 'default'}
            icon={incompleteOnly ? <CheckOutlined /> : <FilterOutlined />}
            onClick={() => setIncompleteOnly((value) => !value)}
            aria-pressed={incompleteOnly}
            aria-label="Filter belum lengkap"
            title={showPrimaryLabels ? undefined : 'Tampilkan santri yang belum lengkap'}
            style={{ flexShrink: 0 }}
          >
            {showPrimaryLabels
              ? `Belum lengkap${incompleteCount > 0 ? ` · ${incompleteCount}` : ''}`
              : incompleteCount > 0
                ? incompleteCount
                : null}
          </Button>

          {!isMobile && (
            <Button
              icon={<ArrowDownOutlined />}
              onClick={jumpToNextIncomplete}
              disabled={!hasIncompleteVisible || students.length === 0}
              aria-label="Santri berikutnya yang belum lengkap"
              title="Santri berikutnya yang belum lengkap"
              style={{ flexShrink: 0 }}
            />
          )}

          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'wrap',
              gap: 8,
              flexShrink: singleRow ? 0 : 1,
            }}
          >
            <span
              title={`${completeCount} dari ${students.length} santri lengkap${
                classAverage !== null ? `, rata-rata ${classAverage}` : ''
              }`}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: 12.5,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {showPrimaryLabels ? 'Tuntas ' : ''}
                {completeCount}/{students.length}
              </Typography.Text>
              <Progress
                percent={pct}
                size="small"
                style={{ width: showPrimaryLabels ? 100 : 72, marginBottom: 0 }}
                showInfo={false}
              />
              <Typography.Text
                type="secondary"
                style={{
                  fontSize: 12.5,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                · {showPrimaryLabels ? 'Rata-rata ' : 'Rata '}
                {classAverage ?? '–'}
              </Typography.Text>
            </span>

            {saveState === 'saving' ? (
              <Typography.Text
                type="secondary"
                style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}
              >
                <LoadingOutlined /> Menyimpan...
              </Typography.Text>
            ) : saveState === 'saved' && draftsEngine.dirtyCount === 0 ? (
              <Typography.Text type="success" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                <CheckOutlined /> Tersimpan
              </Typography.Text>
            ) : saveState === 'error' ? (
              <Typography.Text type="danger" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                Gagal menyimpan
              </Typography.Text>
            ) : null}

            {draftsEngine.dirtyCount > 0 && (
              <Tag color="processing" style={{ marginInlineEnd: 0 }}>
                {draftsEngine.dirtyCount} draf
              </Tag>
            )}

            {canWrite && (
              <Tooltip title="Isi nilai yang sama ke sel kosong">
                <Button
                  icon={<ThunderboltOutlined />}
                  onClick={() => setBulkOpen(true)}
                  disabled={students.length === 0}
                  aria-label="Isi massal"
                  style={{ flexShrink: 0 }}
                >
                  {showPrimaryLabels ? 'Isi Massal' : null}
                </Button>
              </Tooltip>
            )}

            {isMonthly && canWrite && (
              <Tooltip
                title={`Salin nilai ${MONTH_NAMES[prevMonth - 1]} ${prevYear}. Hanya sel kosong yang diisi.`}
              >
                <Button
                  icon={<CopyOutlined />}
                  onClick={handleCopyPrevMonth}
                  disabled={students.length === 0}
                  aria-label={`Salin nilai ${MONTH_NAMES[prevMonth - 1]}`}
                  style={{ flexShrink: 0 }}
                >
                  {showAllLabels ? `Salin ${MONTH_NAMES[prevMonth - 1]}` : null}
                </Button>
              </Tooltip>
            )}

            {canDelete && students.length > 0 && (
              <Popconfirm
                title="Hapus raport seluruh kelas untuk periode ini?"
                description={`${students.length} baris raport akan dihapus permanen.`}
                okText="Ya, hapus"
                cancelText="Batal"
                onConfirm={handleResetPeriod}
              >
                <Button
                  danger
                  icon={<UndoOutlined />}
                  aria-label="Reset periode"
                  style={{ flexShrink: 0 }}
                >
                  {showAllLabels ? 'Reset' : null}
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>

        {studentsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Gagal memuat daftar santri"
            description={(studentsQuery.error as Error)?.message ?? 'Coba muat ulang halaman.'}
            action={
              <Button size="small" onClick={() => void studentsQuery.refetch()}>
                Coba lagi
              </Button>
            }
          />
        ) : studentsQuery.isPending ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : isMobile ? (
          <MobileEntry
            students={visibleStudents}
            criteria={criteria}
            type={type}
            maxScore={maxScore}
            canWrite={canWrite}
            behaviorByStudent={behaviorByStudent}
            hasClassStudents={students.length > 0}
            getScore={getScore}
            isRowComplete={isStudentComplete}
            hafalanById={hafalanById}
            onCommitScore={handleCommitScore}
            onOpenExtras={setExtrasStudent}
            onOpenHafalan={setHafalanStudent}
            onClearFilters={clearFilters}
          />
        ) : (
          <EntryGrid
            students={visibleStudents}
            criteria={criteria}
            type={type}
            maxScore={maxScore}
            showBehavior={isMonthly}
            canWrite={canWrite}
            canDelete={canDelete}
            behaviorByStudent={behaviorByStudent}
            dirtyIds={dirtyIds}
            focusRequest={focusRequest}
            hasClassStudents={students.length > 0}
            getScore={getScore}
            isRowComplete={isStudentComplete}
            hafalanById={hafalanById}
            onCommitScore={handleCommitScore}
            onOpenExtras={setExtrasStudent}
            onOpenHafalan={setHafalanStudent}
            onResetRow={handleResetRow}
            onClearFilters={clearFilters}
            onUndo={undo}
            onRedo={redo}
            onPasteScores={handlePasteScores}
          />
        )}

        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
          {isMobile
            ? 'Perubahan tersimpan otomatis beberapa saat setelah berhenti mengetik.'
            : 'Tips: Enter pindah sel, panah atas/bawah pindah santri, Alt+↓ lompat ke yang belum lengkap, Ctrl+Z/Ctrl+Shift+Z undo/redo, Ctrl+S simpan semua. Tempel blok dari Excel/Sheets ke sel untuk mengisi banyak nilai. Perubahan tersimpan otomatis beberapa saat setelah berhenti mengetik.'}
        </Typography.Paragraph>
      </Card>

      <ExtrasDrawer
        open={!!extrasStudent}
        student={extrasStudent}
        type={type}
        monthlyInitial={extrasMonthlyInitial}
        semesterInitial={extrasSemesterInitial}
        onClose={() => setExtrasStudent(null)}
        onSaveMonthly={(sid, draft) => {
          setDrafts((prev) => ({ ...prev, [sid]: { ...(prev[sid] ?? {}), ...draft } }))
          draftsEngine.scheduleAutosave(sid)
        }}
        onSaveSemester={(sid, draft) => {
          const { scores, ...rest } = draft
          setSemesterDrafts((prev) => {
            const d = prev[sid] ?? { scores: {} }
            return { ...prev, [sid]: { ...d, ...rest, scores: { ...d.scores, ...scores } } }
          })
          draftsEngine.scheduleAutosave(sid)
        }}
      />

      <BulkFillModal
        open={bulkOpen}
        type={type}
        criteria={criteria}
        maxScore={maxScore}
        onClose={() => setBulkOpen(false)}
        onApply={handleBulkApply}
      />

      <HafalanModal
        open={!!hafalanStudent}
        student={hafalanStudent}
        initialValue={hafalanInitial}
        onClose={() => setHafalanStudent(null)}
        onSave={handleSaveHafalan}
      />

      <ShortcutsModal open={shortcuts.isOpen} onClose={shortcuts.close} sections={shortcuts.sections} />
    </div>
  )
}
