import Papa from 'papaparse'

export async function downloadScheduleTemplateXlsx(sampleClasses: string[], sampleSubjects: string[], sampleTeachers: string[]): Promise<void> {
  const XLSX = await import('xlsx')
  
  const templateData = [
    {
      Hari: 'Senin',
      Mulai: '07:30',
      Selesai: '08:50',
      Kelas: sampleClasses[0] || '7A',
      'Mata Pelajaran': sampleSubjects[0] || 'Matematika',
      Pengajar: sampleTeachers[0] || 'Ustadz Ahmad',
      Ruang: 'Kelas 7A',
      Keterangan: 'Jam KBM reguler',
    },
    {
      Hari: 'Senin',
      Mulai: '09:05',
      Selesai: '10:25',
      Kelas: sampleClasses[1] || '8A',
      'Mata Pelajaran': sampleSubjects[1] || 'Bahasa Arab',
      Pengajar: sampleTeachers[1] || 'Ustadzah Fatimah',
      Ruang: 'Lab Bahasa',
      Keterangan: '',
    },
    {
      Hari: 'Selasa',
      Mulai: '07:30',
      Selesai: '08:50',
      Kelas: sampleClasses[2] || '10 IPA',
      'Mata Pelajaran': sampleSubjects[2] || 'Fisika',
      Pengajar: sampleTeachers[2] || 'Ustadz Ridwan',
      Ruang: 'Lab IPA',
      Keterangan: '',
    },
  ]

  const sheet = XLSX.utils.json_to_sheet(templateData)
  
  // Set lebar kolom agar rapi
  sheet['!cols'] = [
    { wch: 10 }, // Hari
    { wch: 8 },  // Mulai
    { wch: 8 },  // Selesai
    { wch: 16 }, // Kelas
    { wch: 22 }, // Mata Pelajaran
    { wch: 24 }, // Pengajar
    { wch: 14 }, // Ruang
    { wch: 24 }, // Keterangan
  ]

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Template Jadwal')
  XLSX.writeFile(book, 'template-jadwal-kbm.xlsx')
}

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

export async function readFileToTable(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
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
      complete: (result) => resolve(result.data.map((row) => row.map(cellToString))),
      error: (err: Error) => reject(err),
    })
  })
}

export function extractGSheetsIdAndGid(url: string): { id: string; gid: string } | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!idMatch) return null
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/)
  return {
    id: idMatch[1],
    gid: gidMatch ? gidMatch[1] : '0',
  }
}

export async function fetchGSheetsData(url: string): Promise<string[][]> {
  const parsed = extractGSheetsIdAndGid(url)
  if (!parsed) throw new Error('Tautan Google Sheets tidak valid. Pastikan tautan lengkap dengan format https://docs.google.com/spreadsheets/d/...')

  const csvUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv&gid=${parsed.gid}`
  const res = await fetch(csvUrl)
  if (!res.ok) {
    throw new Error('Gagal mengakses Google Sheets. Pastikan akses sheet disetel ke "Siapa saja yang memiliki link" (Public/Pelihat).')
  }

  const text = await res.text()
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text, {
      skipEmptyLines: true,
      complete: (result) => resolve(result.data.map((row) => row.map(cellToString))),
      error: (err: Error) => reject(err),
    })
  })
}
