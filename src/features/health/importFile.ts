import Papa from 'papaparse'
import { downloadCsvBlob } from '../../shared/import/readFile'
import { MEDICINE_CATEGORY_OPTIONS } from './constants'

/**
 * Template impor kesehatan. I/O file (baca xlsx/csv, unduh CSV, error CSV)
 * diseragamkan lewat shared/import/readFile — logika parsing murni ada di
 * importParse.ts.
 */

export { cellToString, downloadCsvBlob, downloadErrorCsv, readSheet as readFileRows, type ErrorCsvRow } from '../../shared/import/readFile'

const LOG_HEADERS = ['kode', 'nama', 'tanggal', 'jam', 'keluhan', 'diagnosis', 'penanganan', 'obat', 'jumlah', 'status']
const MED_HEADERS = ['nama', 'kategori', 'stok', 'satuan', 'min', 'keterangan']

function saveXlsx(filename: string, sheetName: string, aoa: (string | number)[][], colWidths: { wch: number }[]): void {
  void import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, filename)
  })
}

/** Template impor rekam medis (kolom tanggal kosong = hari ini saat impor). */
export function downloadLogTemplateXlsx(today: string): void {
  const aoa: (string | number)[][] = [
    LOG_HEADERS,
    ['LPM-0001-001', 'Ahmad Fulan', today, '08:30', 'Demam tinggi sejak pagi', 'Demam biasa', 'Kompres + istirahat', 'Paracetamol 500mg', '2', 'UKS'],
    ['LPM-0001-002', 'Siti Aminah', today, '09:00', 'Sakit perut', '', 'Istirahat di asrama', '', '', 'asrama'],
    ['', '', '', '', 'Flu & pilek', '', 'Minum vitamin', '', '', 'kembali'],
  ]
  saveXlsx('template-impor-rekam-medis.xlsx', 'Log', aoa, [
    { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 30 }, { wch: 20 }, { wch: 26 }, { wch: 22 }, { wch: 8 }, { wch: 10 },
  ])
}

export function downloadLogTemplateCsv(today: string): void {
  const csv = Papa.unparse({
    fields: LOG_HEADERS,
    data: [
      ['LPM-0001-001', 'Ahmad Fulan', today, '08:30', 'Demam tinggi sejak pagi', 'Demam biasa', 'Kompres + istirahat', 'Paracetamol 500mg', '2', 'UKS'],
      ['LPM-0001-002', 'Siti Aminah', today, '09:00', 'Sakit perut', '', 'Istirahat di asrama', '', '', 'asrama'],
    ],
  })
  downloadCsvBlob('template-impor-rekam-medis.csv', csv)
}

/** Template impor stok obat — nama yang sudah ada di stok akan diperbarui. */
export function downloadMedicineTemplateXlsx(): void {
  const aoa: (string | number)[][] = [
    MED_HEADERS,
    ['Paracetamol 500mg', MEDICINE_CATEGORY_OPTIONS[0].value, '100', 'tablet', '20', 'Untuk demam & sakit kepala'],
    ['OBH Combi', 'Obat Flu & Batuk', '12', 'botol', '5', ''],
  ]
  saveXlsx('template-impor-stok-obat.xlsx', 'Obat', aoa, [
    { wch: 26 }, { wch: 22 }, { wch: 8 }, { wch: 9 }, { wch: 7 }, { wch: 32 },
  ])
}

export function downloadMedicineTemplateCsv(): void {
  const csv = Papa.unparse({
    fields: MED_HEADERS,
    data: [
      ['Paracetamol 500mg', MEDICINE_CATEGORY_OPTIONS[0].value, '100', 'tablet', '20', 'Untuk demam & sakit kepala'],
      ['OBH Combi', 'Obat Flu & Batuk', '12', 'botol', '5', ''],
    ],
  })
  downloadCsvBlob('template-impor-stok-obat.csv', csv)
}
