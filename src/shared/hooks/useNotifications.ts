// Sistem notifikasi terpusat — derive dari data aplikasi (bukan tabel notifikasi).
// Port dari sidebar legacy, diadaptasi ke schema & route Laporanmu-Web.
// - Semua query berjalan paralel (Promise.all) agar panel cepat terisi.
// - Polling 5 menit hanya saat tab terlihat (hemat kuota Supabase).
// - Dismiss persisten: ID yang ditutup disimpan di localStorage selama 24 jam.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface NotificationAction {
  label: string
  route: string
}

export interface AppNotification {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  body: string
  action?: NotificationAction
  /** 0 = paling penting */
  priority: number
}

const BULAN = [
  { id: 1, str: 'Januari' },
  { id: 2, str: 'Februari' },
  { id: 3, str: 'Maret' },
  { id: 4, str: 'April' },
  { id: 5, str: 'Mei' },
  { id: 6, str: 'Juni' },
  { id: 7, str: 'Juli' },
  { id: 8, str: 'Agustus' },
  { id: 9, str: 'September' },
  { id: 10, str: 'Oktober' },
  { id: 11, str: 'November' },
  { id: 12, str: 'Desember' },
]

const POLL_INTERVAL = 5 * 60 * 1000

// ─── Dismiss persisten (kedaluwarsa 24 jam) ─────────────────────────────────
const DISMISS_KEY = 'notifications-dismissed'
const DISMISS_TTL = 24 * 60 * 60 * 1000

type DismissRecord = Record<string, number>

function loadDismissed(): DismissRecord {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as DismissRecord
    const now = Date.now()
    const valid: DismissRecord = {}
    for (const [id, timestamp] of Object.entries(parsed)) {
      if (now - timestamp < DISMISS_TTL) valid[id] = timestamp
    }
    return valid
  } catch {
    return {}
  }
}

function saveDismissed(records: DismissRecord) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(records))
  } catch {
    /* ignore */
  }
}

// ─── Pemeriksa raport bulanan (kelas belum diisi bulan lalu, tgl 1–14) ──────
async function checkMonthlyRaport(
  month: number,
  year: number,
  label: string,
): Promise<AppNotification | null> {
  try {
    const { data: allStudents } = await supabase
      .from('students')
      .select('id, class_id')
      .is('deleted_at', null)
    if (!allStudents?.length) return null

    const studentIds = allStudents.map((s) => s.id)
    const { data: reports } = await supabase
      .from('student_monthly_reports')
      .select('student_id')
      .in('student_id', studentIds)
      .eq('month', month)
      .eq('year', year)

    const archivedIds = new Set((reports ?? []).map((r) => r.student_id))

    const byClass: Record<string, { total: number; archived: number }> = {}
    for (const student of allStudents) {
      if (!student.class_id) continue
      if (!byClass[student.class_id]) byClass[student.class_id] = { total: 0, archived: 0 }
      byClass[student.class_id].total++
      if (archivedIds.has(student.id)) byClass[student.class_id].archived++
    }

    const entries = Object.entries(byClass)
    const classesNotDone = entries.filter(([, v]) => v.archived === 0).length
    const partialClasses = entries.filter(([, v]) => v.archived > 0 && v.archived < v.total).length

    if (classesNotDone > 0) {
      return {
        id: 'raport-missing',
        type: 'warning',
        title: `Raport ${label} belum lengkap`,
        body: `${classesNotDone} kelas belum diisi sama sekali`,
        action: { label: 'Isi Sekarang', route: '/report-cards' },
        priority: 1,
      }
    }
    if (partialClasses > 0) {
      return {
        id: 'raport-partial',
        type: 'info',
        title: `Raport ${label} hampir selesai`,
        body: `${partialClasses} kelas baru sebagian terisi`,
        action: { label: 'Lihat', route: '/report-cards' },
        priority: 3,
      }
    }
    return null
  } catch {
    return null
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true) // hanya load pertama
  const [refreshing, setRefreshing] = useState(false) // refresh manual, notif lama tetap tampil
  const timerRef = useRef<number | null>(null)
  const dismissedRef = useRef<DismissRecord | null>(null)
  if (dismissedRef.current === null) dismissedRef.current = loadDismissed()

  const buildNotifications = useCallback(async () => {
    const now = new Date()
    const day = now.getDate()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const monthStr = BULAN.find((b) => b.id === month)?.str ?? ''
    const prevMonthStr = BULAN.find((b) => b.id === prevMonth)?.str ?? ''

    const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0]

    try {
      // Semua pemeriksaan berjalan paralel — saling independen
      const [raportNotif, noClassRes, activeYearsRes, noTeacherRes, violationRes, noPhoneRes] =
        await Promise.all([
          day <= 14
            ? checkMonthlyRaport(prevMonth, prevYear, prevMonthStr)
            : Promise.resolve(null),
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .is('class_id', null)
            .is('deleted_at', null),
          supabase
            .from('academic_years')
            .select('id, name, is_active')
            .eq('is_active', true)
            .is('deleted_at', null),
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .is('homeroom_teacher_id', null)
            .is('deleted_at', null),
          supabase
            .from('reports')
            .select('id', { count: 'exact', head: true })
            .gte('reported_at', startOfMonth)
            .lte('reported_at', `${endOfMonth}T23:59:59`),
          supabase
            .from('students')
            .select('id', { count: 'exact', head: true })
            .is('phone', null)
            .is('deleted_at', null),
        ])

      const items: AppNotification[] = []

      if (raportNotif) items.push(raportNotif)

      if (noClassRes.count && noClassRes.count > 0) {
        items.push({
          id: 'students-no-class',
          type: 'warning',
          title: 'Siswa belum punya kelas',
          body: `${noClassRes.count} siswa belum ditempatkan ke kelas`,
          action: { label: 'Data Siswa', route: '/master/students' },
          priority: 2,
        })
      }

      const activeYears = activeYearsRes.data ?? []
      if (!activeYears.length) {
        items.push({
          id: 'no-active-year',
          type: 'error',
          title: 'Tidak ada tahun ajaran aktif',
          body: 'Set tahun ajaran aktif agar semua fitur berjalan normal',
          action: { label: 'Atur Sekarang', route: '/master/academic-years' },
          priority: 0,
        })
      } else if (activeYears.length > 1) {
        items.push({
          id: 'multiple-active-years',
          type: 'warning',
          title: 'Ada lebih dari 1 tahun ajaran aktif',
          body: `${activeYears.length} tahun ajaran aktif sekaligus`,
          action: { label: 'Periksa', route: '/master/academic-years' },
          priority: 1,
        })
      }

      if (noTeacherRes.count && noTeacherRes.count > 0) {
        items.push({
          id: 'class-no-teacher',
          type: 'info',
          title: 'Kelas belum ada wali kelas',
          body: `${noTeacherRes.count} kelas belum memiliki wali kelas`,
          action: { label: 'Data Kelas', route: '/master/classes' },
          priority: 3,
        })
      }

      if (violationRes.count && violationRes.count > 0) {
        items.push({
          id: 'poin-this-month',
          type: 'info',
          title: `Pelanggaran bulan ${monthStr}`,
          body: `${violationRes.count} pelanggaran tercatat bulan ini`,
          action: { label: 'Lihat Catatan', route: '/points/reports' },
          priority: 4,
        })
      }

      if (noPhoneRes.count && noPhoneRes.count > 0) {
        items.push({
          id: 'students-no-phone',
          type: 'info',
          title: 'Siswa tanpa nomor WA',
          body: `${noPhoneRes.count} siswa tidak bisa menerima raport via WhatsApp`,
          action: { label: 'Data Siswa', route: '/master/students' },
          priority: 5,
        })
      }

      items.sort((a, b) => a.priority - b.priority)

      // Saring notifikasi yang pernah di-dismiss user (persisten 24 jam)
      const dismissed = dismissedRef.current ?? {}
      setNotifications(items.filter((n) => !(n.id in dismissed)))
    } catch (error) {
      console.error('useNotifications error:', error)
    }

    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    void buildNotifications()

    // Polling hanya saat tab terlihat; langsung refresh saat tab kembali aktif
    timerRef.current = window.setInterval(() => {
      if (!document.hidden) void buildNotifications()
    }, POLL_INTERVAL)
    const onVisibilityChange = () => {
      if (!document.hidden) void buildNotifications()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [buildNotifications])

  const dismiss = useCallback((id: string) => {
    if (dismissedRef.current === null) dismissedRef.current = {}
    dismissedRef.current[id] = Date.now()
    saveDismissed(dismissedRef.current)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    void buildNotifications()
  }, [buildNotifications])

  return { notifications, loading, refreshing, dismiss, refresh }
}
