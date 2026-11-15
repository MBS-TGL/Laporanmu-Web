import Papa from 'papaparse'
import { STATUS_LABEL } from './constants'
import {
  computeMedicineUsage,
  countByClass,
  countByStatus,
  countVisitsPerDay,
  topComplaintPhrases,
} from './stats'
import type { HealthLog, HealthMedicine } from './types'

/**
 * Pembuat data export kesehatan (rekam medis + stok obat) ke XLSX dan CSV.
 * Pembentukan baris murni — I/O file hanya di export*Xlsx/Csv.
 */

type Cell = string | number

export function rekamFileName(today: string, ext: string): string {
  return `rekam-medis-${today}.${ext}`
}

export function stokFileName(today: string, ext: string): string {
  return `stok-obat-${today}.${ext}`
}

/** Baris detail rekam medis: No, Tanggal, Jam, Santri, Kelas, … */
export function buildLogRows(logs: HealthLog[]): { headers: string[]; rows: Cell[][] } {
  const headers = ['No', 'Tanggal', 'Jam', 'Santri', 'Kelas', 'Keluhan', 'Diagnosis', 'Penanganan', 'Obat', 'Jumlah', 'Status']
  const rows = logs.map((l, i) => [
    i + 1,
    l.date,
    l.time,
    l.student_name,
    l.class_name ?? '',
    l.complaint,
    l.diagnosis ?? '',
    l.treatment ?? '',
    l.medicine_name ?? '',
    l.medicine_qty > 0 ? l.medicine_qty : '',
    STATUS_LABEL[l.status] ?? l.status,
  ])
  return { headers, rows }
}

/** Baris stok obat + pemakaian 30 hari + penanda kritis. */
export function buildMedicineRows(
  medicines: HealthMedicine[],
  usage: Map<string, number>,
): { headers: string[]; rows: Cell[][] } {
  const headers = ['No', 'Nama Obat', 'Kategori', 'Stok', 'Satuan', 'Stok Min.', 'Terpakai 30 Hari', 'Status', 'Keterangan']
  const rows = medicines.map((m, i) => [
    i + 1,
    m.name,
    m.category ?? '',
    m.stock,
    m.unit,
    m.min_stock,
    usage.get(m.id) ?? 0,
    m.stock <= m.min_stock ? 'KRITIS' : 'Aman',
    m.description ?? '',
  ])
  return { headers, rows }
}

/**
 * Sheet ringkasan (AOA dengan judul seksi): rekap status, per kelas,
 * keluhan tersering, pemakaian obat, stok kritis, tren 14 hari.
 */
export function buildSummarySections(
  logs: HealthLog[],
  medicines: HealthMedicine[],
  today: string,
): { title: string; lines: (string | number)[][] }[] {
  const sections: { title: string; lines: (string | number)[][] }[] = []

  sections.push({
    title: 'Rekap Status',
    lines: countByStatus(logs).map((s) => [STATUS_LABEL[s.status] ?? s.status, s.count]),
  })
  sections.push({
    title: 'Kunjungan per Kelas',
    lines: countByClass(logs).map((c) => [c.label, c.count]),
  })

  const phrases = topComplaintPhrases(logs, 10)
  sections.push({
    title: 'Keluhan Tersering (muncul ≥2 kali)',
    lines: phrases.length > 0 ? phrases.map((p) => [p.label, p.count]) : [['(belum ada pola keluhan berulang)', '']],
  })

  const usage = computeMedicineUsage(logs, 30, today)
  const medUsage = medicines
    .map((m) => ({ name: m.name, unit: m.unit, used: usage.get(m.id) ?? 0, stock: m.stock }))
    .filter((m) => m.used > 0)
    .sort((a, b) => b.used - a.used)
  sections.push({
    title: 'Pemakaian Obat 30 Hari Terakhir',
    lines: medUsage.length > 0 ? medUsage.map((m) => [m.name, `${m.used} ${m.unit}`, `sisa ${m.stock}`]) : [['(belum ada pemakaian tercatat)', '']],
  })

  const critical = medicines.filter((m) => m.stock <= m.min_stock)
  sections.push({
    title: 'Stok Obat Kritis',
    lines: critical.length > 0 ? critical.map((m) => [m.name, `${m.stock} ${m.unit}`, `min. ${m.min_stock}`]) : [['(semua stok aman)', '']],
  })

  const trend = countVisitsPerDay(logs, 14, today)
  sections.push({
    title: 'Kunjungan 14 Hari Terakhir',
    lines: trend.map((t) => [t.date, t.count]),
  })

  return sections
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const LOG_HEADERS = ['No', 'Tanggal', 'Jam', 'Santri', 'Kelas', 'Keluhan', 'Diagnosis', 'Penanganan', 'Obat', 'Jumlah', 'Status']
const MED_HEADERS = ['No', 'Nama Obat', 'Kategori', 'Stok', 'Satuan', 'Stok Min.', 'Terpakai 30 Hari', 'Status', 'Keterangan']

export async function exportRekamXlsx(logs: HealthLog[], medicines: HealthMedicine[], today: string): Promise<void> {
  const XLSX = await import('xlsx')
  const detail = buildLogRows(logs)
  const sections = buildSummarySections(logs, medicines, today)

  const detailWs = XLSX.utils.aoa_to_sheet([detail.headers, ...detail.rows])
  detailWs['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 7 }, { wch: 26 }, { wch: 9 },
    { wch: 32 }, { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 8 }, { wch: 15 },
  ]

  const summaryAoA: (string | number)[][] = [[`Ringkasan Kesehatan — per ${today}`], []]
  for (const s of sections) {
    summaryAoA.push([s.title])
    summaryAoA.push(...s.lines)
    summaryAoA.push([])
  }
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoA)
  summaryWs['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, detailWs, 'Rekam Medis')
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan')
  XLSX.writeFile(wb, rekamFileName(today, 'xlsx'))
}

export function exportRekamCsv(logs: HealthLog[], today: string): void {
  const { rows } = buildLogRows(logs)
  const csv = Papa.unparse({ fields: LOG_HEADERS, data: rows })
  downloadBlob(rekamFileName(today, 'csv'), new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
}

export async function exportStokXlsx(medicines: HealthMedicine[], usage: Map<string, number>, today: string): Promise<void> {
  const XLSX = await import('xlsx')
  const { headers, rows } = buildMedicineRows(medicines, usage)
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = [
    { wch: 5 }, { wch: 30 }, { wch: 22 }, { wch: 8 }, { wch: 9 }, { wch: 10 }, { wch: 16 }, { wch: 9 }, { wch: 34 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Obat')
  XLSX.writeFile(wb, stokFileName(today, 'xlsx'))
}

export function exportStokCsv(medicines: HealthMedicine[], usage: Map<string, number>): void {
  const { rows } = buildMedicineRows(medicines, usage)
  const csv = Papa.unparse({ fields: MED_HEADERS, data: rows })
  downloadBlob('stok-obat.csv', new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
}

// ------------------------------------------------------------
// Cetak jurnal medis (PDF / kertas via dialog print browser)
// ------------------------------------------------------------

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Buka jurnal medis sebagai dokumen cetak (A4 landscape) — user bisa simpan sebagai PDF. */
export function printRekamJournal(logs: HealthLog[], today: string): void {
  const rowsHtml = logs
    .map(
      (l, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td class="c">${esc(l.date)}</td>
        <td class="c">${esc(l.time)}</td>
        <td>${esc(l.student_name)}</td>
        <td>${esc(l.class_name ?? '-')}</td>
        <td>${esc(l.complaint)}</td>
        <td>${esc(l.diagnosis ?? '-')}</td>
        <td>${esc(l.treatment ?? '-')}</td>
        <td>${esc(l.medicine_name ?? '-')}</td>
        <td>${esc(STATUS_LABEL[l.status] ?? l.status)}</td>
      </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Jurnal Medis — ${today}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { font-size: 11px; color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eef; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; }
  td.c { text-align: center; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #f7f7fb; }
  tfoot td { font-weight: 600; background: #f0f0f5; }
</style>
</head>
<body>
  <h1>Jurnal Medis — Poskestren</h1>
  <div class="sub">Dicetak: ${esc(today)} · ${logs.length} kunjungan</div>
  <table>
    <thead>
      <tr>
        <th style="width:28px">No</th>
        <th style="width:64px">Tanggal</th>
        <th style="width:44px">Jam</th>
        <th>Santri</th>
        <th style="width:70px">Kelas</th>
        <th>Keluhan</th>
        <th>Diagnosis</th>
        <th>Penanganan</th>
        <th>Obat</th>
        <th style="width:80px">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr><td colspan="9">Total</td><td class="c">${logs.length}</td></tr>
    </tfoot>
  </table>
</body>
</html>`

  const win = window.open('', '_blank', 'width=980,height=720')
  if (!win) {
    throw new Error('Popup diblokir browser — izinkan popup untuk mencetak')
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  window.setTimeout(() => win.print(), 250)
}
