import type { AttendanceStatus } from './types'

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

export const WEEKDAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

// Urutan siklus saat sel diklik: '' → H → S → I → A → P → ''
export const STATUS_CYCLE: (AttendanceStatus | '')[] = ['', 'H', 'S', 'I', 'A', 'P']

export const STATUS_META: Record<AttendanceStatus, { label: string; color: string }> = {
  H: { label: 'Hadir', color: '#059669' },
  S: { label: 'Sakit', color: '#d97706' },
  I: { label: 'Izin', color: '#2563eb' },
  A: { label: 'Alpa', color: '#dc2626' },
  P: { label: 'Pulang Awal', color: '#7c3aed' },
}

export const STATUS_ORDER: AttendanceStatus[] = ['H', 'S', 'I', 'A', 'P']

export const NEXT_STATUS: Record<string, AttendanceStatus | ''> = Object.fromEntries(
  STATUS_CYCLE.map((cur, i) => [cur, STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]]),
)

/**
 * Normalisasi teks status dari impor/scan manual menjadi kode singkat.
 * '' = kosongkan sel, null = tidak dikenal (baris error).
 */
export function normalizeStatusInput(raw: string): AttendanceStatus | '' | null {
  const v = raw.trim().toLowerCase()
  if (v === '' || v === '-' || v === '_' || v === '0' || v === 'x' || v === 'kosong') return ''
  if (['h', 'hadir', 'present', 'masuk'].includes(v)) return 'H'
  if (['s', 'sakit', 'sick'].includes(v)) return 'S'
  if (['i', 'izin', 'excused', 'permission'].includes(v)) return 'I'
  if (['a', 'alpa', 'absen', 'tanpa keterangan', 'tanpa_keterangan', 'absent'].includes(v)) return 'A'
  if (['p', 'pulang', 'pulang awal', 'pulang_awal', 'early'].includes(v)) return 'P'
  return null
}

/**
 * Normalisasi kode registrasi / NISN agar pencocokan scan & impor toleran
 * terhadap format tampilan (STU-2024-0001 vs stu20240001).
 */
export function normalizeCode(raw: string): string {
  return raw.trim().replace(/[-\s]/g, '').toUpperCase()
}
