// ------------------------------------------------------------
// Logika murni task runner Otomasi — dipisah agar bisa dites
// Vitest tanpa Supabase/localStorage (pola students/wa.test.ts).
// ------------------------------------------------------------

export type TaskId = 'sync_stats' | 'detach_refs' | 'rotate_logs'

export interface TaskDef {
  id: TaskId
  label: string
  description: string
  destructive: boolean
}

export const TASKS: TaskDef[] = [
  {
    id: 'sync_stats',
    label: 'Sinkronisasi Statistik',
    description: 'Hitung ulang jumlah santri aktif, catatan poin, kelas, dan absensi. Aman, tanpa perubahan data.',
    destructive: false,
  },
  {
    id: 'detach_refs',
    label: 'Pembersihan Referensi Mati',
    description:
      'Lepas class_id/dorm_id santri aktif yang masih menunjuk kelas atau asrama yang sudah diarsipkan.',
    destructive: true,
  },
  {
    id: 'rotate_logs',
    label: 'Rotasi Audit Log',
    description: 'Hapus permanen audit log yang lebih lama dari batas hari yang dipilih.',
    destructive: true,
  },
]

export interface TaskRunLog {
  id: string
  taskId: TaskId
  startedAt: string
  durationMs: number
  ok: boolean
  summary: string
}

// ------------------------------------------------------------
// Helper murni
// ------------------------------------------------------------

/** Pecah array jadi chunk berukuran maksimal `size` (untuk .in() ber-urut). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Ukuran chunk harus > 0')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

/**
 * ID anak yang menunjuk parent yang tidak ada di `validParentIds`.
 * Null/undefined diabaikan, hasil unik dan mengikuti urutan kemunculan.
 */
export function findOrphanIds(
  childIds: (string | null | undefined)[],
  validParentIds: Set<string>,
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of childIds) {
    if (!id || validParentIds.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/** ISO cutoff `days` hari sebelum `now` (default: sekarang). */
export function cutoffIso(days: number, now: Date = new Date()): string {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  return cutoff.toISOString()
}

/** Potong riwayat run agar maksimal `max` entri terbaru. */
export function pruneLogs(logs: TaskRunLog[], max = 100): TaskRunLog[] {
  return [...logs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, max)
}

/** Durasi ringkas: 850 ms → "850 ms", 65000 ms → "1 mnt 5 dtk". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds} dtk`
  if (seconds === 0) return `${minutes} mnt`
  return `${minutes} mnt ${seconds} dtk`
}

// ------------------------------------------------------------
// Riwayat eksekusi (localStorage) — try/catch agar aman di
// mode privasi / storage penuh.
// ------------------------------------------------------------

const STORAGE_KEY = 'laporanmu_task_logs'

export function loadTaskLogs(): TaskRunLog[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return pruneLogs(JSON.parse(raw) as TaskRunLog[])
  } catch {
    return []
  }
}

export function saveTaskLog(log: TaskRunLog): TaskRunLog[] {
  const next = pruneLogs([log, ...loadTaskLogs()])
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage penuh / tidak tersedia — riwayat hilang saja
  }
  return next
}

export function clearTaskLogs(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // abaikan
  }
}
