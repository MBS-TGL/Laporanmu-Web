// ------------------------------------------------------------
// Logika murni Otomasi (AutomationPage) — runner pemeliharaan
// manual. Dipisah agar bisa dites Vitest tanpa Supabase maupun
// localStorage (pola students/wa.test.ts).
// ------------------------------------------------------------

export type AutomationId = 'sync_stats' | 'detach_refs' | 'rotate_logs'

export interface Automation {
  id: AutomationId
  label: string
  description: string
  destructive: boolean
}

export const AUTOMATIONS: Automation[] = [
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

/** Satu baris riwayat eksekusi otomasi (tabel task_runs). */
export interface AutomationRun {
  id: string
  automationId: AutomationId
  startedAt: string
  durationMs: number
  ok: boolean
  summary: string
}

// ------------------------------------------------------------
// Helper murni
// ------------------------------------------------------------

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

/** Potong riwayat run agar maksimal `max` entri terbaru. */
export function pruneRuns(runs: AutomationRun[], max = 100): AutomationRun[] {
  return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, max)
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
// Riwayat lama di localStorage. Sejak migrasi 0062 riwayat
// ditulis ke server, jadi entri lokal hanya dibaca sekali untuk
// diunggah lalu dibuang (lihat AutomationPage).
// ------------------------------------------------------------

const LEGACY_STORAGE_KEY = 'laporanmu_task_logs'

/** Bentuk entri localStorage lama: field `taskId`, belum `automationId`. */
interface LegacyRun {
  id: string
  taskId: AutomationId
  startedAt: string
  durationMs: number
  ok: boolean
  summary: string
}

export function loadLegacyRuns(): AutomationRun[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const legacy = JSON.parse(raw) as LegacyRun[]
    return pruneRuns(
      legacy.map((run) => ({
        id: run.id,
        automationId: run.taskId,
        startedAt: run.startedAt,
        durationMs: run.durationMs,
        ok: run.ok,
        summary: run.summary,
      })),
    )
  } catch {
    return []
  }
}

export function clearLegacyRuns(): void {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // storage penuh / tidak tersedia — abaikan
  }
}
