import Papa from 'papaparse'
import { MONTH_NAMES_ID } from './recap'

/**
 * Export absensi guru & karyawan ke XLSX (3 sheet: Harian + Grid + Rekap) dan CSV.
 * Pembentukan baris murni — I/O file hanya di fungsi export.
 */

export interface ExportDailyRow {
  name: string
  nbm: string | null
  subject: string | null
  status: string | null // label Indonesia ('Hadir' | ...) atau kosong bila belum diisi
  note: string | null
}

export interface ExportRecapRow {
  name: string
  nbm: string | null
  subject: string | null
  hadir: number
  sakit: number
  izin: number
  tugasLuar: number
  recorded: number
  pct: number
}

export interface ExportGridRow {
  name: string
  nbm: string | null
  subject: string | null
  /** Satu entri per tanggal 1..akhir bulan; 'H' | 'S' | 'I' | 'T' | '' */
  cells: string[]
}

const DAILY_HEADERS = ['No', 'Nama Guru', 'NBM', 'Mapel', 'Status', 'Catatan']
const RECAP_HEADERS = ['No', 'Nama Guru', 'NBM', 'Mapel', 'Hadir', 'Sakit', 'Izin', 'Tugas Luar', 'Tercatat', '% Hadir']

const STATUS_LEGEND = 'Status: Hadir / Sakit / Izin / Tugas Luar. Guru tanpa baris data berarti belum dicatat pada tanggal tersebut.'

function safeFileName(s: string): string {
  return s.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'guru'
}

export function dailyFileName(date: string, ext: string): string {
  return `absensi-guru-karyawan-${safeFileName(date)}.${ext}`
}

export function recapFileName(year: number, month: number, ext: string): string {
  return `rekap-absensi-guru-karyawan-${safeFileName(MONTH_NAMES_ID[month - 1])}-${year}.${ext}`
}

export function gridFileName(year: number, month: number, ext: string): string {
  return `grid-absensi-guru-karyawan-${safeFileName(MONTH_NAMES_ID[month - 1])}-${year}.${ext}`
}

export function buildDailyRows(rows: ExportDailyRow[]): { headers: string[]; rows: (string | number)[][] } {
  return {
    headers: DAILY_HEADERS,
    rows: rows.map((r, i) => [i + 1, r.name, r.nbm ?? '', r.subject ?? '', r.status ?? 'Belum diisi', r.note ?? '']),
  }
}

export function buildRecapRows(rows: ExportRecapRow[]): { headers: string[]; rows: (string | number)[][] } {
  return {
    headers: RECAP_HEADERS,
    rows: rows.map((r, i) => [
      i + 1, r.name, r.nbm ?? '', r.subject ?? '',
      r.hadir, r.sakit, r.izin, r.tugasLuar, r.recorded, r.pct,
    ]),
  }
}

export function buildGridRows(
  rows: ExportGridRow[],
  days: number,
): { headers: string[]; rows: (string | number)[][] } {
  const headers = ['No', 'Nama Guru', 'NBM', 'Mapel', ...Array.from({ length: days }, (_, i) => String(i + 1))]
  return {
    headers,
    rows: rows.map((r, i) => [
      i + 1,
      r.name,
      r.nbm ?? '',
      r.subject ?? '',
      ...Array.from({ length: days }, (_, d) => r.cells[d] ?? ''),
    ]),
  }
}

export interface ExportTeacherXlsxOptions {
  date: string
  daily: ExportDailyRow[]
  recap: ExportRecapRow[]
  grid: ExportGridRow[]
  recapLabel: string
  gridLabel: string
  daysInMonth: number
}

export async function exportTeacherAttendanceXlsx({
  date,
  daily,
  recap,
  grid,
  recapLabel,
  gridLabel,
  daysInMonth,
}: ExportTeacherXlsxOptions): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const dailyData = buildDailyRows(daily)
  const dailyWs = XLSX.utils.aoa_to_sheet([
    [`Absensi Guru & Karyawan — ${date}`],
    [STATUS_LEGEND],
    [],
    dailyData.headers,
    ...dailyData.rows,
  ])
  dailyWs['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 40 }]

  const gridData = buildGridRows(grid, daysInMonth)
  const gridWs = XLSX.utils.aoa_to_sheet([
    [`Grid Absensi Guru & Karyawan — ${gridLabel}`],
    [STATUS_LEGEND],
    [],
    gridData.headers,
    ...gridData.rows,
  ])
  gridWs['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, ...Array.from({ length: daysInMonth }, () => ({ wch: 4.5 }))]

  const recapData = buildRecapRows(recap)
  const recapWs = XLSX.utils.aoa_to_sheet([
    [`Rekap Absensi Guru & Karyawan — ${recapLabel}`],
    [],
    recapData.headers,
    ...recapData.rows,
  ])
  recapWs['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 18 }, ...Array.from({ length: 6 }, () => ({ wch: 11 }))]

  XLSX.utils.book_append_sheet(wb, dailyWs, 'Harian')
  XLSX.utils.book_append_sheet(wb, gridWs, 'Grid')
  XLSX.utils.book_append_sheet(wb, recapWs, 'Rekap')
  XLSX.writeFile(wb, dailyFileName(date, 'xlsx'))
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csv = Papa.unparse({ fields: headers, data: rows })
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportTeacherAttendanceCsv(date: string, daily: ExportDailyRow[]): void {
  const { headers, rows } = buildDailyRows(daily)
  downloadCsv(dailyFileName(date, 'csv'), headers, rows)
}

export function exportTeacherRecapCsv(year: number, month: number, recap: ExportRecapRow[]): void {
  const { headers, rows } = buildRecapRows(recap)
  downloadCsv(recapFileName(year, month, 'csv'), headers, rows)
}

export function exportTeacherGridCsv(
  year: number,
  month: number,
  grid: ExportGridRow[],
  daysInMonth: number,
): void {
  const { headers, rows } = buildGridRows(grid, daysInMonth)
  downloadCsv(gridFileName(year, month, 'csv'), headers, rows)
}
