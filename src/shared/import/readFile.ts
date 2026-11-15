import Papa from 'papaparse'

/**
 * I/O file untuk seluruh impor aplikasi (lihat SKILLS.md §Skill 3):
 * baca .xlsx/.xls/.csv menjadi matriks string, plus util unduh CSV.
 * Parsing domain murni tetap di file feature (xImportParse.ts + test).
 */

/** Sel Excel → teks; objek Date (cellDates) → YYYY-MM-DD. */
export function cellToString(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(val).trim()
}

/**
 * Baca file impor (xlsx/xls/csv) → matriks string (sheet pertama,
 * baris kosong dibuang). CSV diparse dengan papaparse.
 */
export async function readSheet(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    })
    return data.map((row) => row.map(cellToString))
  }
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (res) => resolve(res.data.map((row) => row.map(cellToString))),
      error: (err) => reject(err),
    })
  })
}

/** Unduh string CSV sebagai file (BOM UTF-8 agar rapi di Excel Indonesia). */
export function downloadCsvBlob(filename: string, csv: string): void {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Unparse baris → CSV lalu unduh (template impor / baris error). */
export function downloadCsvRows(filename: string, fields: string[], rows: (string | number)[][]): void {
  downloadCsvBlob(filename, Papa.unparse({ fields, data: rows }))
}

export interface ErrorCsvRow {
  baris: number
  identitas: string
  detail: string
  alasan: string
}

/** Unduh CSV berisi baris-baris yang gagal impor (format standar laporan). */
export function downloadErrorCsv(baseName: string, fileName: string, rows: ErrorCsvRow[]): void {
  if (rows.length === 0) return
  downloadCsvRows(`${baseName}-${fileName || 'file'}.csv`, ['baris', 'identitas', 'detail', 'alasan'], rows.map((r) => [r.baris, r.identitas, r.detail, r.alasan]))
}
