import type { Schedule } from '../types'
import {
  DAY_NAMES,
  abbreviateSubject,
  buildGrid,
  buildSubjectColors,
  fmtTime,
  splitClass,
  type DayBlock,
  type SubjectColor,
} from './scheduleLayout'

export type PrintMeta = {
  /** mis. "JADWAL PELAJARAN SMP MUHAMMADIYAH 4 TANGGUL" */
  title: string
  /** mis. "SEMESTER GANJIL · TAHUN PELAJARAN 2026/2027" */
  subtitle?: string
}

const BLOCKS_PER_PAGE = 6 // 2 kolom × 3 baris, seperti PDF waka kurikulum

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
@page { size: A4 landscape; margin: 6mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
.page { position: relative; page-break-after: always; }
.page:last-child { page-break-after: auto; }
.head { text-align: center; line-height: 1.2; margin: 0 0 1mm; }
.head h1 { font-size: 11pt; margin: 0; letter-spacing: .02em; }
.head p { font-size: 8pt; margin: .5mm 0 0; color: #374151; }
.printed { position: absolute; right: 0; top: 0; font-size: 5.5pt; color: #6b7280; }
table.outer { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 4mm 3mm; }
table.outer > tbody > tr > td { vertical-align: top; padding: 0; }
.blk { break-inside: avoid; page-break-inside: avoid; }
.dt { background: #1f2937; color: #fff; font-weight: 700; font-size: 7pt; padding: .5mm 2mm; letter-spacing: .06em; }
table.g { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 6.6pt; }
.g th, .g td { border: .2mm solid #6b7280; padding: 0 .6mm; height: 3.45mm; line-height: 3.3mm; text-align: center; white-space: nowrap; overflow: hidden; }
.g thead th { background: #e5e7eb; height: 6mm; line-height: 1.1; }
.g thead th b { display: block; font-size: 7pt; }
.g thead th i { display: block; font-style: normal; font-size: 4.6pt; font-weight: 400; color: #4b5563; }
.g .t { width: 14.5mm; background: #f3f4f6; font-weight: 700; }
.g tr.fx td { background: #cbd5e1; font-weight: 700; font-size: 6pt; letter-spacing: .08em; text-transform: uppercase; }
.g tr.fx td.t { background: #f3f4f6; letter-spacing: 0; font-size: 6.6pt; text-transform: none; }
.lg td, .lg th { text-align: left; white-space: normal; height: auto; line-height: 1.2; padding: .3mm 1mm; font-size: 5.9pt; }
.lg thead th { height: auto; background: #e5e7eb; font-size: 6.2pt; }
`

function blockHtml(b: DayBlock, cols: { id: string; name: string }[], colors: Map<string, SubjectColor>): string {
  const head = cols
    .map((c) => {
      const { code, sub } = splitClass(c.name)
      return `<th><b>${esc(code)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</th>`
    })
    .join('')
  const rows = b.slots
    .map((slot) => {
      const time = `<td class="t">${fmtTime(slot.start)}–${fmtTime(slot.end)}</td>`
      if (slot.kind === 'fixed') {
        return `<tr class="fx">${time}<td colspan="${cols.length}">${esc(slot.label)}</td></tr>`
      }
      const tds = cols
        .map((c) => {
          const items = b.cells.get(`${slot.key}|${c.id}`) ?? []
          if (items.length === 0) return '<td></td>'
          const name = items[0].subjects?.name ?? '-'
          const bg = colors.get(name)?.bg ?? '#fff'
          return `<td style="background:${bg}">${esc(abbreviateSubject(name))}</td>`
        })
        .join('')
      return `<tr>${time}${tds}</tr>`
    })
    .join('')
  return `<div class="blk"><div class="dt">${esc(b.label.toUpperCase())}</div>
<table class="g"><thead><tr><th class="t">Waktu</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
}

/** Tabel pengampu: pengganti kolom guru di tiap sel + penjelasan singkatan mapel */
function legendHtml(schedules: Schedule[]): string {
  const byTeacher = new Map<string, Set<string>>()
  schedules.forEach((s) => {
    const t = s.teachers?.name
    const m = s.subjects?.name
    if (!t || !m) return
    byTeacher.set(t, (byTeacher.get(t) ?? new Set()).add(m))
  })
  if (byTeacher.size === 0) return ''
  const rows = [...byTeacher.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'id'))
    .map(([teacher, subjects]) => {
      const list = [...subjects]
        .sort((a, b) => a.localeCompare(b, 'id'))
        .map((n) => {
          const ab = abbreviateSubject(n)
          return ab === n ? esc(n) : `${esc(n)} (<b>${esc(ab)}</b>)`
        })
        .join(', ')
      return `<tr><td>${esc(teacher)}</td><td>${list}</td></tr>`
    })
    .join('')
  return `<div class="blk"><div class="dt">PENGAMPU MATA PELAJARAN</div>
<table class="g lg"><thead><tr><th style="width:34%">Nama Pengampu</th><th>Mata Pelajaran</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

function pageHtml(items: string[], meta: PrintMeta, printed: string): string {
  const trs: string[] = []
  for (let i = 0; i < items.length; i += 2) {
    trs.push(`<tr><td>${items[i]}</td><td>${items[i + 1] ?? ''}</td></tr>`)
  }
  return `<div class="page">
<div class="head"><h1>${esc(meta.title)}</h1>${meta.subtitle ? `<p>${esc(meta.subtitle)}</p>` : ''}</div>
<div class="printed">Dicetak ${esc(printed)}</div>
<table class="outer"><tbody>${trs.join('')}</tbody></table></div>`
}

/**
 * Susun dokumen HTML A4 landscape. Senin–Jumat + tabel pengampu muat 1 halaman;
 * bila ada Sabtu/Minggu, tabel pengampu pindah ke halaman 2.
 * `colorSource` = semua jadwal (supaya warna tetap sama walau sedang difilter).
 */
export function buildPrintHtml(schedules: Schedule[], meta: PrintMeta, colorSource: Schedule[] = schedules): string {
  const days = Object.entries(DAY_NAMES).map(([value, label]) => ({ value: Number(value), label }))
  const { classCols, blocks } = buildGrid(schedules, days)
  const colors = buildSubjectColors(colorSource)
  const items = blocks.map((b) => blockHtml(b, classCols, colors))
  const legend = legendHtml(schedules)

  const pages: string[][] = []
  for (let i = 0; i < items.length; i += BLOCKS_PER_PAGE) pages.push(items.slice(i, i + BLOCKS_PER_PAGE))
  if (pages.length === 0) pages.push([])
  if (legend) {
    const last = pages[pages.length - 1]
    if (last.length < BLOCKS_PER_PAGE) last.push(legend)
    else pages.push([legend])
  }

  const printed = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(meta.title)}</title>
<style>${CSS}</style></head><body>${pages.map((p) => pageHtml(p, meta, printed)).join('')}</body></html>`
}

/** Cetak lewat iframe tersembunyi: bebas dari layout/scroll aplikasi, tanpa popup. */
export function printScheduleSheet(schedules: Schedule[], meta: PrintMeta, colorSource?: Schedule[]): void {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const win = iframe.contentWindow
  if (!win) {
    iframe.remove()
    return
  }
  win.document.open()
  win.document.write(buildPrintHtml(schedules, meta, colorSource))
  win.document.close()
  const cleanup = () => iframe.remove()
  win.onafterprint = () => setTimeout(cleanup, 300)
  setTimeout(cleanup, 120_000) // jaga-jaga bila onafterprint tidak terpanggil
  setTimeout(() => {
    win.focus()
    win.print()
  }, 300)
}
