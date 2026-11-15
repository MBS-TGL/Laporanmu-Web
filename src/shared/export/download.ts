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

export { downloadCsv } from '../../shared/utils/csv'
