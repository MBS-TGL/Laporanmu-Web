export type ExportCell = string | number | null | undefined

/**
 * Unduh tabel sebagai .xlsx — satu baris AOA per baris data.
 * Nama file otomatis diberi tanggal hari ini bila belum memilikinya.
 */
export async function downloadXlsx(filename: string, sheetName: string, headers: string[], rows: ExportCell[][]): Promise<void> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31))
  const dated = /\d{4}-\d{2}-\d{2}/.test(filename) ? filename : `${filename}-${new Date().toISOString().slice(0, 10)}`
  XLSX.writeFile(book, `${dated}.xlsx`)
}

/**
 * Unduh tabel sebagai .pdf (jsPDF + autoTable, lazy import agar bundle utama
 * ringan). Orientasi landscape otomatis saat kolom > 4. Judul, tanggal cetak,
 * dan jumlah baris ditempatkan di kepala dokumen.
 */
export async function downloadPdf(filename: string, sheetName: string, headers: string[], rows: ExportCell[][]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({
    orientation: headers.length > 4 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  doc.setFontSize(13)
  doc.text(sheetName, 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    `${rows.length.toLocaleString('id')} baris · dicetak ${new Date().toLocaleDateString('id-ID')}`,
    40,
    56,
  )

  autoTable(doc, {
    startY: 72,
    head: [headers],
    body: rows.map((r) => r.map((c) => (c == null ? '' : String(c)))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 8.5 },
    alternateRowStyles: { fillColor: [244, 244, 248] },
  })
  doc.save(`${filename}.pdf`)
}

export { downloadCsv } from '../../shared/utils/csv'
