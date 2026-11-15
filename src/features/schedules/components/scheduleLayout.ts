import type { Schedule } from '../types'

/** Dipakai bersama oleh tampilan layar (GridView) dan lembar cetak (schedulePrint). */

export const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
}

type FixedRow = { start: string; end: string; label: string }

/**
 * Kegiatan umum (bukan per kelas) yang tampil sebagai baris selebar tabel,
 * seperti di PDF. Diambil dari Jadwal SMP 2026/2027. Sabtu (ekskul) belum
 * dimasukkan — isi sendiri bila perlu.
 */
const DAILY_BASE: FixedRow[] = [
  { start: '07:00', end: '07:30', label: 'Sholat Dhuha' },
  { start: '09:30', end: '09:45', label: 'Istirahat' },
  { start: '11:45', end: '12:45', label: 'Dhuhur + Istirahat' },
  { start: '14:05', end: '14:40', label: 'Tahfidz' },
  { start: '14:40', end: '15:30', label: 'Sholat Ashar' },
]

export const FIXED_ROWS: Record<number, FixedRow[]> = {
  1: [...DAILY_BASE, { start: '07:30', end: '08:10', label: 'Upacara / Apel' }],
  2: [...DAILY_BASE, { start: '07:30', end: '08:10', label: 'WAFA / BTA' }],
  3: [...DAILY_BASE, { start: '07:30', end: '08:10', label: 'WAFA / BTA' }],
  4: [...DAILY_BASE, { start: '07:30', end: '08:10', label: 'WAFA / BTA' }],
  5: [
    ...DAILY_BASE,
    { start: '07:30', end: '08:10', label: 'WAFA / BTA' },
    { start: '11:05', end: '11:45', label: 'Sholat Jumat' },
  ],
}

export const short = (t: string) => t.slice(0, 5)
export const fmtTime = (t: string) => t.replace(':', '.')

/** "7A Boarding Putra" → { code: "7A", sub: "Boarding Putra" } */
export function splitClass(name: string): { code: string; sub: string } {
  const i = name.indexOf(' ')
  return i < 0 ? { code: name, sub: '' } : { code: name.slice(0, i), sub: name.slice(i + 1) }
}

// ---------------------------------------------------------------- singkatan mapel
const ABBR: Record<string, string> = {
  'ilmu pengetahuan alam': 'IPA',
  'ilmu pendidikan alam': 'IPA',
  'ilmu pengetahuan sosial': 'IPS',
  matematika: 'MTK',
  informatika: 'TIK',
  'seni budaya dan keterampilan': 'SBdP',
  'seni budaya dan prakarya': 'SBdP',
  'seni budaya': 'SBdP',
  'pendidikan pancasila': 'Pend. Pancasila',
  'pendidikan pancasila dan kewarganegaraan': 'PPKn',
  'sejarah kebudayaan islam': 'Tarikh',
  'pendidikan jasmani olahraga dan kesehatan': 'PJOK',
  'pendidikan jasmani': 'PJOK',
  kemuhammadiyahan: 'Kemuh.',
}
const STOP = new Set(['dan', 'yang', 'di', 'ke', 'untuk', 'serta'])

/** Batas aman panjang teks di sel cetak (±20 mm pada 6,6 pt) */
const MAX_CHARS = 15

/** Singkatan untuk lembar cetak yang sempit; nama lengkap ada di tabel pengampu. */
export function abbreviateSubject(name: string): string {
  const full = name.trim()
  const key = full.toLowerCase()
  if (ABBR[key]) return ABBR[key]

  // "Bahasa Arab (Nahwu + Shorof)" → "B. Arab (N+S)"
  const paren = full.match(/^(.*?)\s*\((.*)\)\s*$/)
  if (paren && paren[1]) {
    const base = abbreviateSubject(paren[1])
    const parts = paren[2].split(/\s*\+\s*|\s+/).filter(Boolean)
    const inner = parts.length > 1 ? parts.map((w) => w[0].toUpperCase()).join('+') : parts[0] ?? ''
    const combined = inner ? `${base} (${inner})` : base
    return combined.length <= MAX_CHARS ? combined : base
  }

  const s = full.replace(/^Bahasa\s+/i, 'B. ')
  if (s.length <= MAX_CHARS) return s
  const words = full.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()))
  if (words.length > 1) return words.map((w) => w[0].toUpperCase()).join('')
  return s.slice(0, MAX_CHARS - 1) + '…'
}

// ---------------------------------------------------------------- warna mapel
export type SubjectColor = { bg: string; bar: string }

/**
 * Hue disebar rata (golden angle) menurut urutan abjad semua mapel, jadi dua mapel
 * tidak pernah tampak sama seperti pada pewarnaan hash. Beri `source` = semua jadwal
 * agar warna tidak berubah saat filter dipakai.
 */
export function buildSubjectColors(source: Schedule[]): Map<string, SubjectColor> {
  const names = [...new Set(source.map((s) => s.subjects?.name).filter((n): n is string => Boolean(n)))].sort(
    (a, b) => a.localeCompare(b, 'id'),
  )
  const map = new Map<string, SubjectColor>()
  names.forEach((n, i) => {
    const h = Math.round((i * 137.508) % 360)
    map.set(n, { bg: `hsl(${h} 70% 92%)`, bar: `hsl(${h} 55% 52%)` })
  })
  return map
}

// ---------------------------------------------------------------- bentuk grid
export type Slot =
  | { kind: 'lesson'; key: string; start: string; end: string }
  | { kind: 'fixed'; key: string; start: string; end: string; label: string }

export type DayBlock = {
  value: number
  label: string
  slots: Slot[]
  cells: Map<string, Schedule[]>
  count: number
}

export function buildGrid(schedules: Schedule[], days: { value: number; label: string }[]) {
  // Kolom kelas sama untuk semua hari supaya blok sejajar
  const colMap = new Map<string, string>()
  schedules.forEach((s) => colMap.set(s.class_id, s.classes?.name ?? '?'))
  const classCols = [...colMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }))

  const blocks: DayBlock[] = days
    .map((d) => {
      const list = schedules.filter((s) => s.day_of_week === d.value)
      const lessonSlots = new Map<string, Slot>()
      const cells = new Map<string, Schedule[]>()
      list.forEach((s) => {
        const key = `${short(s.start_time)}-${short(s.end_time)}`
        lessonSlots.set(key, { kind: 'lesson', key, start: short(s.start_time), end: short(s.end_time) })
        const ck = `${key}|${s.class_id}`
        cells.set(ck, [...(cells.get(ck) ?? []), s])
      })
      const fixed: Slot[] =
        list.length > 0
          ? (FIXED_ROWS[d.value] ?? [])
              .map((f) => ({
                kind: 'fixed' as const,
                key: `${f.start}-${f.end}`,
                start: f.start,
                end: f.end,
                label: f.label,
              }))
              .filter((f) => !lessonSlots.has(f.key))
          : []
      const slots = [...lessonSlots.values(), ...fixed].sort((a, b) => a.start.localeCompare(b.start))
      return { ...d, slots, cells, count: list.length }
    })
    .filter((b) => b.count > 0)

  return { classCols, blocks }
}
