import type { HealthLog, HealthLogFilters, HealthPeriod } from './types'

/**
 * Statistik murni (tanpa efek samping) untuk kartu insight, sheet ringkasan
 * export, prompt AI, dan filter halaman. Semua tanggal dalam format YYYY-MM-DD
 * — perbandingan string leksikografis, bebas timezone.
 */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Tanggal (YYYY-MM-DD) hasil mundur `offsetDays` hari dari `today`. */
export function shiftDate(today: string, offsetDays: number): string {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

/** Apakah tanggal log masuk rentang periode terpilih? */
export function matchesPeriod(dateISO: string, period: HealthPeriod, today: string): boolean {
  if (period === 'all') return true
  if (period === 'today') return dateISO === today
  const days = period === '7d' ? 7 : 30
  const cutoff = shiftDate(today, -(days - 1))
  return dateISO >= cutoff && dateISO <= today
}

/** Filter gabungan pencarian + periode + status + kelas (semua client-side). */
export function filterHealthLogs(
  logs: HealthLog[],
  filters: HealthLogFilters,
  today: string,
): HealthLog[] {
  const term = filters.search.trim().toLowerCase()
  return logs.filter((l) => {
    if (!matchesPeriod(l.date, filters.period, today)) return false
    if (filters.status !== 'all' && l.status !== filters.status) return false
    if (filters.className !== 'all' && (l.class_name ?? '') !== filters.className) return false
    if (term) {
      const hay = [l.student_name, l.class_name, l.complaint, l.diagnosis, l.treatment, l.medicine_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(term)) return false
    }
    return true
  })
}

export interface DayCount {
  date: string
  count: number
}

/** Kunjungan per hari selama `days` terakhir, diurut naik, hari kosong diisi 0. */
export function countVisitsPerDay(logs: HealthLog[], days: number, today: string): DayCount[] {
  const counts = new Map<string, number>()
  for (const l of logs) {
    if (!matchesPeriod(l.date, '30d', today)) continue
    counts.set(l.date, (counts.get(l.date) ?? 0) + 1)
  }
  const result: DayCount[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDate(today, -i)
    result.push({ date, count: counts.get(date) ?? 0 })
  }
  return result
}

/** Total kunjungan pada hari `today`. */
export function countTodayVisits(logs: HealthLog[], today: string): number {
  return logs.filter((l) => l.date === today).length
}

const COMPLAINT_STOPWORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'pada', 'yang', 'untuk', 'dengan', 'saat', 'setelah',
  'sebelum', 'sudah', 'ada', 'tidak', 'juga', 'atau', 'masih', 'sdh', 'tdk', 'utk',
  'dgn', 'krn', 'karena', 'yg', 'aja', 'lagi', 'rasa', 'merasa', 'mengeluh',
  'keluhan', 'sih', 'nya', 'sejak', 'tiba', 'milik',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !COMPLAINT_STOPWORDS.has(w))
}

export interface KeywordCount {
  label: string
  count: number
}

/** Frekuensi kata kunci keluhan (stopword Indonesia dibuang) — top `limit`. */
export function topComplaintKeywords(logs: HealthLog[], limit: number): KeywordCount[] {
  const freq = new Map<string, number>()
  for (const l of logs) {
    for (const w of tokenize(l.complaint)) {
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

/** Keluhan utuh (dinormalisasi) yang muncul ≥2 kali — untuk sheet ringkasan. */
export function topComplaintPhrases(logs: HealthLog[], limit: number): KeywordCount[] {
  const freq = new Map<string, number>()
  for (const l of logs) {
    const key = l.complaint.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!key) continue
    freq.set(key, (freq.get(key) ?? 0) + 1)
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
}

export interface GroupCount {
  label: string
  count: number
}

/** Kunjungan per kelas (nama snapshot), diurut menurun. */
export function countByClass(logs: HealthLog[]): GroupCount[] {
  const freq = new Map<string, number>()
  for (const l of logs) {
    const key = l.class_name ?? 'Tanpa Kelas'
    freq.set(key, (freq.get(key) ?? 0) + 1)
  }
  return [...freq.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export interface StatusCount {
  status: HealthLog['status']
  count: number
}

export function countByStatus(logs: HealthLog[]): StatusCount[] {
  const freq = new Map<string, number>()
  for (const l of logs) freq.set(l.status, (freq.get(l.status) ?? 0) + 1)
  return [...freq.entries()].map(([status, count]) => ({ status: status as HealthLog['status'], count }))
}

/**
 * Pemakaian obat (jumlah unit) per medicine_id dalam `days` terakhir.
 * Log tanpa medicine_id / qty 0 diabaikan.
 */
export function computeMedicineUsage(logs: HealthLog[], days: number, today: string): Map<string, number> {
  const cutoff = shiftDate(today, -(days - 1))
  const usage = new Map<string, number>()
  for (const l of logs) {
    if (!l.medicine_id || l.medicine_qty <= 0) continue
    if (l.date < cutoff || l.date > today) continue
    usage.set(l.medicine_id, (usage.get(l.medicine_id) ?? 0) + l.medicine_qty)
  }
  return usage
}

/**
 * Rata-rata bergerak harian (window) dari deret harian countVisitsPerDay.
 * Nilai null untuk indeks awal yang belum memenuhi window (garis line dimulai belakangan).
 */
export function movingAverageDaily(counts: DayCount[], window: number): (number | null)[] {
  if (window <= 1) return counts.map((c) => c.count)
  return counts.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    for (let j = i - window + 1; j <= i; j++) sum += counts[j].count
    return Math.round((sum / window) * 10) / 10
  })
}

/**
 * Persen perubahan current vs baseline (dibulatkan ke integer).
 * Null bila baseline 0 — persen tanpa makna saat pembandingnya nol.
 */
export function pctDelta(current: number, baseline: number): number | null {
  if (baseline <= 0) return null
  return Math.round(((current - baseline) / baseline) * 100)
}
