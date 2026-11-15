import Papa from 'papaparse'
import { MONTH_NAMES, STATUS_META, STATUS_ORDER } from './constants'
import { summarizeDays } from './api'
import type { AttendanceDays } from './types'

/**
 * Pembuat data export absensi (grid + rekap) ke XLSX dan CSV.
 * Pembentukan baris murni — I/O file hanya di exportAttendanceXlsx/Csv.
 */

export interface ExportStudentRow {
  name: string
  code: string
  days: AttendanceDays
}

export interface ExportContext {
  className: string
  year: number
  month: number
  daysInMonth: number
  weekdays: number
  students: ExportStudentRow[]
}

function safeFileName(s: string): string {
  return s.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'kelas'
}

export function exportFileName(ctx: Pick<ExportContext, 'className' | 'year' | 'month'>, ext: string): string {
  return `absensi-${safeFileName(ctx.className)}-${MONTH_NAMES[ctx.month - 1]}-${ctx.year}.${ext}`
}

/** Baris grid: No, Nama, Kode, 1..daysInMonth, H, S, I, A, P, % Hadir */
export function buildGridRows(ctx: ExportContext): { headers: string[]; rows: (string | number)[][] } {
  const dayHeaders = Array.from({ length: ctx.daysInMonth }, (_, i) => String(i + 1))
  const headers = ['No', 'Nama', 'Kode', ...dayHeaders, 'H', 'S', 'I', 'A', 'P', '% Hadir']

  const rows = ctx.students.map((s, i) => {
    const sum = summarizeDays(s.days)
    const pct = ctx.weekdays > 0 ? Math.round((sum.H / ctx.weekdays) * 100) : 0
    const dayCells = dayHeaders.map((_, di) => s.days[String(di + 1)] ?? '')
    return [i + 1, s.name, s.code, ...dayCells, sum.H, sum.S, sum.I, sum.A, sum.P, pct]
  })

  return { headers, rows }
}

/** Baris rekap: No, Nama, Kode, H, S, I, A, P, % Hadir, Perhatian */
export function buildRekapRows(ctx: ExportContext): { headers: string[]; rows: (string | number)[][] } {
  const headers = ['No', 'Nama', 'Kode', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Pulang Awal', '% Hadir', 'Perhatian']
  const rows = ctx.students.map((s, i) => {
    const sum = summarizeDays(s.days)
    const pct = ctx.weekdays > 0 ? Math.round((sum.H / ctx.weekdays) * 100) : 0
    const anyFilled = Object.keys(s.days).length > 0
    const alert = sum.A >= 3 || (anyFilled && pct < 75) ? 'Perlu perhatian' : 'Baik'
    return [i + 1, s.name, s.code, sum.H, sum.S, sum.I, sum.A, sum.P, pct, alert]
  })
  return { headers, rows }
}

const LEGEND = `Keterangan status: ${STATUS_ORDER.map((s) => `${s} = ${STATUS_META[s].label}`).join(', ')} · sel kosong = tidak diisi (dianggap hadir pada rekap rapor).`

export async function exportAttendanceXlsx(ctx: ExportContext): Promise<void> {
  const XLSX = await import('xlsx')
  const grid = buildGridRows(ctx)
  const rekap = buildRekapRows(ctx)

  const gridWs = XLSX.utils.aoa_to_sheet([
    [`Absensi ${ctx.className} — ${MONTH_NAMES[ctx.month - 1]} ${ctx.year}`],
    [LEGEND],
    [],
    grid.headers,
    ...grid.rows,
  ])
  gridWs['!cols'] = [
    { wch: 4 }, { wch: 28 }, { wch: 14 },
    ...Array.from({ length: ctx.daysInMonth }, () => ({ wch: 4.5 })),
    ...Array.from({ length: 6 }, () => ({ wch: 8 })),
  ]

  const rekapWs = XLSX.utils.aoa_to_sheet([
    [`Rekap ${ctx.className} — ${MONTH_NAMES[ctx.month - 1]} ${ctx.year}`],
    [`Hari kerja: ${ctx.weekdays} hari`],
    [],
    rekap.headers,
    ...rekap.rows,
  ])
  rekapWs['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, ...Array.from({ length: 7 }, () => ({ wch: 11 }))]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, gridWs, 'Absensi')
  XLSX.utils.book_append_sheet(wb, rekapWs, 'Rekap')
  XLSX.writeFile(wb, exportFileName(ctx, 'xlsx'))
}

export function exportAttendanceCsv(ctx: ExportContext): void {
  const { headers, rows } = buildGridRows(ctx)
  const csv = Papa.unparse({ fields: headers, data: rows })
  // Unduh langsung dengan koma + BOM via blob (bukan util `;` CSV master) agar
  // strukturnya identik dengan sheet Excel dan template impor.
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFileName(ctx, 'csv')
  link.click()
  URL.revokeObjectURL(url)
}
