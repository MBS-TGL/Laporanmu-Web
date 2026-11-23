import { useCallback, useEffect, useRef, useState } from 'react'
import type { MessageInstance } from 'antd/es/message/interface'
import type { QueryKey, UseMutationResult } from '@tanstack/react-query'
import {
  buildMonthlyPayload,
  buildSemesterPayload,
  MONTHLY_SCORE_KEYS,
} from './savePayloads'
import type {
  MonthlyDraft,
  MonthlyReport,
  MonthlyReportPayload,
  ReportCardStudent,
  ReportCardType,
  SemesterDraft,
  SemesterReport,
  SemesterReportPayload,
  SemesterType,
} from './types'

const AUTOSAVE_MS = 1500

const omitKeys = <T,>(obj: Record<string, T>, keys: string[]): Record<string, T> => {
  const next = { ...obj }
  for (const k of keys) delete next[k]
  return next
}

function loadDraft(storageKey: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(storageKey)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null
  } catch {
    // draf korup: buang, jangan blokir halaman
    window.localStorage.removeItem(storageKey)
    return null
  }
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type SaveVars<P> = {
  payloads: P[]
  silent?: boolean
  queryKey?: QueryKey
}

type SaveMutation<P> = UseMutationResult<void, Error, SaveVars<P>, unknown>

interface EntryDraftsArgs {
  storageKey: string
  queryKey: QueryKey
  isMonthly: boolean
  type: ReportCardType
  students: ReportCardStudent[]
  month: number
  year: number
  semester: 1 | 2
  ay: string
  musyrifName: string | null
  updatedBy: string | null
  savedMonthlyById: Map<string, MonthlyReport>
  savedSemesterById: Map<string, SemesterReport>
  saveMonthly: SaveMutation<MonthlyReportPayload>
  saveSemester: SaveMutation<SemesterReportPayload>
  message: MessageInstance
}

/**
 * Seluruh mesin draf input raport: state draf per santri, pulihkan dari
 * localStorage per periode, autosave per baris (debounce), Simpan Semua, dan
 * pembersihan draf yang aman terhadap ketikan yang masuk saat proses simpan.
 */
export function useEntryDrafts(args: EntryDraftsArgs) {
  const {
    storageKey, queryKey, isMonthly, type, students, month, year, semester, ay,
    musyrifName, updatedBy, savedMonthlyById, savedSemesterById,
    saveMonthly, saveSemester, message,
  } = args

  const [drafts, setDrafts] = useState<Record<string, MonthlyDraft>>({})
  const [semesterDrafts, setSemesterDrafts] = useState<Record<string, SemesterDraft>>({})
  const [restoreBanner, setRestoreBanner] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [loadedSaveKey, setLoadedSaveKey] = useState(storageKey)
  if (loadedSaveKey !== storageKey) {
    setLoadedSaveKey(storageKey)
    setSaveState('idle')
  }

  // Pulihkan draf saat periode/kelas berganti — pola "adjust state during render"
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey)
    const parsed = loadDraft(storageKey)
    if (parsed && Object.keys(parsed).length > 0) {
      setDrafts(isMonthly ? (parsed as Record<string, MonthlyDraft>) : {})
      setSemesterDrafts(isMonthly ? {} : (parsed as Record<string, SemesterDraft>))
      setRestoreBanner(true)
    } else {
      setDrafts({})
      setSemesterDrafts({})
      setRestoreBanner(false)
    }
  }

  // Persist draf (debounce 500ms) — draf kosong menghapus key
  useEffect(() => {
    const t = setTimeout(() => {
      const data = isMonthly ? drafts : semesterDrafts
      try {
        if (Object.keys(data).length === 0) window.localStorage.removeItem(storageKey)
        else window.localStorage.setItem(storageKey, JSON.stringify(data))
      } catch {
        // kuota penuh / mode privat: abaikan, draf tetap di memori
      }
    }, 500)
    return () => clearTimeout(t)
  }, [drafts, semesterDrafts, isMonthly, storageKey])

  // Mirror refs (disinkron via effect, tidak boleh diakses saat render)
  const draftsRef = useRef(drafts)
  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])
  const semesterDraftsRef = useRef(semesterDrafts)
  useEffect(() => {
    semesterDraftsRef.current = semesterDrafts
  }, [semesterDrafts])
  const savedMonthlyRef = useRef(savedMonthlyById)
  useEffect(() => {
    savedMonthlyRef.current = savedMonthlyById
  }, [savedMonthlyById])
  const savedSemesterRef = useRef(savedSemesterById)
  useEffect(() => {
    savedSemesterRef.current = savedSemesterById
  }, [savedSemesterById])

  const dirtyIds = useRef(new Set<string>())
  useEffect(() => {
    const active = isMonthly ? drafts : semesterDrafts
    dirtyIds.current = new Set(Object.keys(active).filter((id) => students.some((s) => s.id === id)))
  }, [isMonthly, drafts, semesterDrafts, students])
  const dirtyCount = (isMonthly ? Object.keys(drafts).length : Object.keys(semesterDrafts).length) || 0

  const buildPayload = useCallback(
    (studentId: string): MonthlyReportPayload | SemesterReportPayload | null => {
      if (isMonthly) {
        return buildMonthlyPayload({
          studentId,
          draft: draftsRef.current[studentId],
          saved: savedMonthlyRef.current.get(studentId),
          month,
          year,
          musyrifName,
          updatedBy,
        })
      }
      if (!ay) return null
      return buildSemesterPayload({
        studentId,
        draft: semesterDraftsRef.current[studentId],
        saved: savedSemesterRef.current.get(studentId),
        reportType: type as SemesterType,
        semester,
        academicYearId: ay,
        musyrifName,
        updatedBy,
      })
    },
    [isMonthly, month, year, musyrifName, updatedBy, ay, type, semester],
  )

  // Bersihkan draf santri hanya bila tidak ada ketikan baru sejak payload dibangun
  const clearDraftIfUnchanged = useCallback(
    (studentId: string, snapshot: MonthlyDraft | SemesterDraft | undefined) => {
      if (isMonthly) {
        if (draftsRef.current[studentId] === snapshot) setDrafts((prev) => omitKeys(prev, [studentId]))
      } else {
        if (semesterDraftsRef.current[studentId] === snapshot) setSemesterDrafts((prev) => omitKeys(prev, [studentId]))
      }
    },
    [isMonthly],
  )

  const pendingIds = useRef(new Set<string>())
  const autosaveTimer = useRef<number | null>(null)

  const flushAutosave = useCallback(async () => {
    if (pendingIds.current.size === 0) return
    const ids = [...pendingIds.current]
    pendingIds.current.clear()

    const monthlyPayloads: MonthlyReportPayload[] = []
    const semesterPayloads: SemesterReportPayload[] = []
    const snapshots: { studentId: string; snapshot: MonthlyDraft | SemesterDraft | undefined }[] = []

    for (const studentId of ids) {
      const snapshot = isMonthly ? draftsRef.current[studentId] : semesterDraftsRef.current[studentId]
      if (!snapshot) continue
      const payload = buildPayload(studentId)
      if (!payload) continue
      if (isMonthly) monthlyPayloads.push(payload as MonthlyReportPayload)
      else semesterPayloads.push(payload as SemesterReportPayload)
      snapshots.push({ studentId, snapshot })
    }

    if (monthlyPayloads.length === 0 && semesterPayloads.length === 0) return
    setSaveState('saving')
    try {
      if (isMonthly) await saveMonthly.mutateAsync({ payloads: monthlyPayloads, silent: true, queryKey })
      else await saveSemester.mutateAsync({ payloads: semesterPayloads, silent: true, queryKey })
      for (const { studentId, snapshot } of snapshots) clearDraftIfUnchanged(studentId, snapshot)
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      message.warning(`Simpan otomatis gagal: ${(err as Error).message}. Draf tetap aman.`)
    }
  }, [
    buildPayload,
    clearDraftIfUnchanged,
    isMonthly,
    message,
    queryKey,
    saveMonthly,
    saveSemester,
  ])

  const scheduleAutosaveMany = useCallback(
    (studentIds: string[]) => {
      for (const studentId of studentIds) pendingIds.current.add(studentId)
      if (studentIds.length === 0) return
      setSaveState('idle')
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = window.setTimeout(() => {
        autosaveTimer.current = null
        void flushAutosave()
      }, AUTOSAVE_MS)
    },
    [flushAutosave],
  )

  const scheduleAutosave = useCallback(
    (studentId: string) => scheduleAutosaveMany([studentId]),
    [scheduleAutosaveMany],
  )

  // Bersihkan antrean saat pindah periode/kelas agar tidak menyimpan ke periode salah
  useEffect(() => {
    const pending = pendingIds.current
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
      pending.clear()
    }
  }, [storageKey])

  const saveAll = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (saveMonthly.isPending || saveSemester.isPending) {
      message.info('Sedang menyimpan, coba lagi sebentar.')
      return false
    }
    // Simpan manual mengambil alih antrean autosave yang belum sempat flush
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
    pendingIds.current.clear()
    const monthlyPayloads: MonthlyReportPayload[] = []
    const semesterPayloads: SemesterReportPayload[] = []
    const snapshots: { studentId: string; snapshot: MonthlyDraft | SemesterDraft | undefined }[] = []
    for (const student of students) {
      const snapshot = isMonthly ? draftsRef.current[student.id] : semesterDraftsRef.current[student.id]
      if (!snapshot) continue
      const payload = buildPayload(student.id)
      if (!payload) continue
      if (isMonthly) monthlyPayloads.push(payload as MonthlyReportPayload)
      else semesterPayloads.push(payload as SemesterReportPayload)
      snapshots.push({ studentId: student.id, snapshot })
    }
    const payloads = isMonthly ? monthlyPayloads : semesterPayloads
    if (payloads.length === 0) {
      if (!silent) message.info('Tidak ada perubahan untuk disimpan')
      return true
    }
    setSaveState('saving')
    try {
      if (isMonthly) await saveMonthly.mutateAsync({ payloads: monthlyPayloads, silent: false, queryKey })
      else await saveSemester.mutateAsync({ payloads: semesterPayloads, silent: false, queryKey })
      const incomplete = monthlyPayloads.filter(
        (p) => !MONTHLY_SCORE_KEYS.every((k) => typeof p[k] === 'number'),
      ).length
      if (incomplete > 0) {
        if (!silent) {
          message.warning(`${incomplete} santri belum lengkap. Data yang terisi saja yang tersimpan.`, 4)
        }
      } else if (!silent) {
        message.success(`${payloads.length} raport tersimpan`)
      }
      for (const { studentId, snapshot } of snapshots) clearDraftIfUnchanged(studentId, snapshot)
      setSaveState('saved')
      return true
    } catch (err) {
      setSaveState('error')
      message.error((err as Error).message || 'Gagal menyimpan')
      return false
    }
  }, [students, isMonthly, buildPayload, saveMonthly, saveSemester, message, clearDraftIfUnchanged, queryKey])

  const discardDrafts = useCallback(() => {
    pendingIds.current.clear()
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = null
    setSaveState('idle')
    setDrafts({})
    setSemesterDrafts({})
    setRestoreBanner(false)
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      // abaikan
    }
  }, [storageKey])

  const clearStudentDraft = useCallback(
    (studentId: string) => {
      if (isMonthly) setDrafts((prev) => omitKeys(prev, [studentId]))
      else setSemesterDrafts((prev) => omitKeys(prev, [studentId]))
    },
    [isMonthly],
  )

  return {
    drafts,
    setDrafts,
    semesterDrafts,
    setSemesterDrafts,
    restoreBanner,
    dismissRestore: () => setRestoreBanner(false),
    discardDrafts,
    dirtyCount,
    saveState,
    scheduleAutosave,
    scheduleAutosaveMany,
    saveAll,
    clearStudentDraft,
  }
}
