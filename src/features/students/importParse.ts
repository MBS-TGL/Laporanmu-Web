import Papa from 'papaparse'

/**
 * Parser & validasi impor siswa — dipisah dari components/ImportModal.tsx agar
 * murni (tanpa React/AntD) dan bisa dites vitest. Pola sama dengan
 * dorms/importParse.ts. Aturan error WAJIB dipertahankan persis:
 * nama kosong → kode kosong → duplikat di file → kelas kosong/tak ada default
 * → kelas tidak ditemukan → asrama tidak ditemukan → gender → status →
 * NISN/NIS/NIK angka → tanggal lahir → URL foto.
 */

export const VALID_STATUSES = ['active', 'graduated', 'transferred', 'left']

// ---------------------------------------------------------------------------
// Definisi kolom
// ---------------------------------------------------------------------------

export const FIELDS = [
  { key: 'name', label: 'Nama', required: true, aliases: ['nama', 'nama siswa', 'nama lengkap'] },
  {
    key: 'registration_code',
    label: 'Kode Registrasi',
    required: true,
    aliases: ['kode registrasi', 'kode reg', 'kode'],
  },
  { key: 'class_name', label: 'Kelas', required: true, aliases: ['kelas', 'nama kelas', 'class'] },
  { key: 'dorm_name', label: 'Asrama', aliases: ['asrama', 'nama asrama', 'dorm'] },
  { key: 'nisn', label: 'NISN', aliases: [] },
  { key: 'nis', label: 'NIS', aliases: [] },
  { key: 'nik', label: 'NIK', aliases: [] },
  { key: 'gender', label: 'Gender', aliases: ['jenis kelamin', 'jk', 'l p'] },
  { key: 'status', label: 'Status', aliases: [] },
  {
    key: 'phone',
    label: 'Telepon / WA',
    aliases: ['phone wa', 'wa', 'no hp', 'hp', 'telepon', 'no telepon', 'whatsapp', 'nomor hp'],
  },
  { key: 'photo_url', label: 'URL Foto', aliases: ['url foto', 'foto'] },
  { key: 'tags', label: 'Label', aliases: ['label', 'tag'] },
  { key: 'guardian_name', label: 'Nama Wali', aliases: ['nama wali', 'wali'] },
  {
    key: 'guardian_relation',
    label: 'Hubungan Wali',
    aliases: ['hubungan wali', 'hubungan'],
  },
  { key: 'birth_place', label: 'Tempat Lahir', aliases: ['tempat lahir'] },
  { key: 'birth_date', label: 'Tanggal Lahir', aliases: ['tanggal lahir', 'tgl lahir'] },
  { key: 'religion', label: 'Agama', aliases: ['agama'] },
  { key: 'address', label: 'Alamat', aliases: ['alamat'] },
] as const satisfies readonly {
  key: string
  label: string
  required?: boolean
  aliases: readonly string[]
}[]

export type FieldKey = (typeof FIELDS)[number]['key']
export type Mapping = Partial<Record<FieldKey, number>>

export interface ParsedRow {
  key: number
  name?: string
  registration_code?: string
  class_name?: string
  dorm_name?: string
  nisn?: string
  nis?: string
  nik?: string
  gender?: string
  status?: string
  phone?: string
  photo_url?: string
  tags?: string[]
  guardian_name?: string
  guardian_relation?: string
  birth_place?: string
  birth_date?: string
  religion?: string
  address?: string
  // diisi saat validasi
  class_id?: string
  class_label?: string
  dorm_id?: string
  dorm_label?: string
  birth_date_iso?: string
  error?: string
}

export interface NamedItem {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Template & unduhan
// ---------------------------------------------------------------------------

export const TEMPLATE_COLUMNS = FIELDS.map((f) => f.key)

const TEMPLATE_ROWS: Record<FieldKey, string>[] = [
  {
    name: 'Ahmad Fulan',
    registration_code: '2026001',
    class_name: '9A Boarding Putra',
    dorm_name: '',
    nisn: '0012345678',
    nis: '2026001',
    nik: '3509012345670001',
    gender: 'L',
    status: 'active',
    phone: '081234567890',
    photo_url: '',
    tags: 'Beasiswa;Yatim',
    guardian_name: 'Budi Fulan',
    guardian_relation: 'Ayah',
    birth_place: 'Jember',
    birth_date: '2011-05-17',
    religion: 'Islam',
    address: 'Jl. Mawar No. 1, Jember',
  },
  {
    name: 'Siti Fulanah',
    registration_code: '2026002',
    class_name: '9C Reguler Putra',
    dorm_name: '',
    nisn: '',
    nis: '',
    nik: '',
    gender: 'P',
    status: 'active',
    phone: '',
    photo_url: '',
    tags: '',
    guardian_name: '',
    guardian_relation: '',
    birth_place: '',
    birth_date: '',
    religion: '',
    address: '',
  },
]

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadTemplate() {
  // xlsx (bukan CSV) supaya kolom angka panjang bisa dikunci format Teks:
  // NISN/NIK/telepon tidak kehilangan angka 0 di depan atau berubah notasi ilmiah
  void import('xlsx').then((XLSX) => {
    const header = [...TEMPLATE_COLUMNS]
    const data = TEMPLATE_ROWS.map((row) => TEMPLATE_COLUMNS.map((col) => row[col]))
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])
    const textCols = new Set(['registration_code', 'nisn', 'nis', 'nik', 'phone'])
    for (let c = 0; c < header.length; c++) {
      if (!textCols.has(header[c])) continue
      for (let r = 1; r <= data.length; r++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        if (ws[addr]) ws[addr].z = '@'
      }
    }
    ws['!cols'] = header.map((h, c) => ({
      wch: Math.min(34, Math.max(h.length + 2, ...data.map((row) => row[c].length + 2))),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa')
    XLSX.writeFile(wb, 'Template-Impor-Siswa.xlsx')
  })
}

export function downloadInvalidRows(rows: ParsedRow[]) {
  const bad = rows.filter((r) => r.error)
  if (bad.length === 0) return
  downloadCsv(
    'baris-bermasalah.csv',
    Papa.unparse({
      fields: [...TEMPLATE_COLUMNS, 'error'],
      data: bad.map((r) => [
        ...TEMPLATE_COLUMNS.map((col) => {
          const v = r[col]
          return Array.isArray(v) ? v.join(';') : (v ?? '')
        }),
        r.error ?? '',
      ]),
    }),
  )
}

// ---------------------------------------------------------------------------
// Membaca file (CSV / XLSX)
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  return String(value).trim()
}

export async function readFileToTable(file: File): Promise<string[][]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    // dimuat hanya saat dibutuhkan agar bundle awal tetap kecil
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
      error: (err) => reject(err),
    })
  })
}

// ---------------------------------------------------------------------------
// Pemetaan kolom otomatis
// ---------------------------------------------------------------------------

export function normHeader(value: string) {
  return value
    .replace(/^\ufeff/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function autoMatch(headers: string[]): Mapping {
  const normalized = headers.map(normHeader)
  const used = new Set<number>()
  const mapping: Mapping = {}
  for (const field of FIELDS) {
    const names = new Set([field.key, ...field.aliases].map(normHeader))
    const index = normalized.findIndex((h, i) => !used.has(i) && names.has(h))
    if (index >= 0) {
      mapping[field.key] = index
      used.add(index)
    }
  }
  return mapping
}

export function columnLetter(index: number) {
  let n = index
  let letters = ''
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return letters
}

export function sampleValues(rows: string[][], index?: number) {
  if (index === undefined) return []
  const values: string[] = []
  for (const row of rows) {
    const v = row[index]?.trim()
    if (v) values.push(v)
    if (values.length === 2) break
  }
  return values
}

// ---------------------------------------------------------------------------
// Normalisasi & validasi nilai
// ---------------------------------------------------------------------------

const GENDER_ALIASES: Record<string, string> = {
  l: 'L',
  'laki-laki': 'L',
  'laki laki': 'L',
  pria: 'L',
  male: 'L',
  p: 'P',
  perempuan: 'P',
  wanita: 'P',
  female: 'P',
}

export function normalizeGender(value?: string) {
  const v = value?.trim()
  if (!v) return undefined
  return GENDER_ALIASES[v.toLowerCase()] ?? v.toUpperCase()
}

// Excel sering menghapus angka 0 di depan nomor HP (0812... -> 812...)
export function normalizePhone(value?: string) {
  if (!value) return undefined
  const v = value.replace(/[\s-]/g, '')
  return /^8\d{8,12}$/.test(v) ? `0${v}` : v
}

export function splitTags(value?: string) {
  const tags = (value ?? '')
    .split(/[;|,]/)
    .map((t) => t.trim())
    .filter(Boolean)
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined
}

// undefined = kosong, null = tidak valid, string = format ISO (YYYY-MM-DD)
export function parseBirthDate(value?: string): string | null | undefined {
  const v = value?.trim()
  if (!v) return undefined
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v)
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v)
  let y: number
  let m: number
  let d: number
  if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else if (dmy) {
    d = Number(dmy[1])
    m = Number(dmy[2])
    y = Number(dmy[3])
  } else {
    return null
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null
  }
  return `${y}-${pad(m)}-${pad(d)}`
}

// Samakan spasi & huruf besar/kecil supaya "9a  boarding putra" tetap cocok
export function normalizeName(value?: string) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function validateRows(
  rows: ParsedRow[],
  classes: NamedItem[],
  dorms: NamedItem[],
  defaultClassId?: string,
  defaultDormId?: string,
): ParsedRow[] {
  const classByName = new Map(classes.map((c) => [normalizeName(c.name), c]))
  const dormByName = new Map(dorms.map((d) => [normalizeName(d.name), d]))
  const seen = new Set<string>()

  return rows.map((row) => {
    const name = row.name?.trim()
    const code = row.registration_code?.trim()
    const rawClass = row.class_name?.trim()
    const rawDorm = row.dorm_name?.trim()
    let error: string | undefined

    // Kelas: dari class_name, kalau kosong pakai kelas default
    let classId: string | undefined
    let classLabel: string | undefined = rawClass
    if (rawClass) {
      const match = classByName.get(normalizeName(rawClass))
      if (match) {
        classId = match.id
        classLabel = match.name
      }
    } else if (defaultClassId) {
      classId = defaultClassId
      classLabel = classes.find((c) => c.id === defaultClassId)?.name
    }

    // Asrama: dari dorm_name, kalau kosong pakai asrama default (boleh tanpa asrama)
    let dormId: string | undefined
    let dormLabel: string | undefined = rawDorm
    if (rawDorm) {
      const match = dormByName.get(normalizeName(rawDorm))
      if (match) {
        dormId = match.id
        dormLabel = match.name
      }
    } else if (defaultDormId) {
      dormId = defaultDormId
      dormLabel = dorms.find((d) => d.id === defaultDormId)?.name
    }

    const birthDate = parseBirthDate(row.birth_date)

    if (!name) error = 'Nama kosong'
    else if (!code) error = 'Kode registrasi kosong'
    else if (seen.has(code.toLowerCase())) error = 'Kode registrasi duplikat di file'
    else if (!rawClass && !defaultClassId)
      error = 'Kelas kosong (isi kolom kelas atau pilih kelas default)'
    else if (rawClass && !classId) error = `Kelas "${rawClass}" tidak ditemukan`
    else if (rawDorm && !dormId) error = `Asrama "${rawDorm}" tidak ditemukan`
    else if (row.gender && !['L', 'P'].includes(row.gender)) error = 'Gender harus L atau P'
    else if (row.status && !VALID_STATUSES.includes(row.status)) error = 'Status tidak valid'
    else if (row.nisn && !/^\d+$/.test(row.nisn)) error = 'NISN harus berupa angka'
    else if (row.nis && !/^\d+$/.test(row.nis)) error = 'NIS harus berupa angka'
    else if (row.nik && !/^\d+$/.test(row.nik)) error = 'NIK harus berupa angka'
    else if (birthDate === null)
      error = 'Tanggal lahir tidak valid (pakai YYYY-MM-DD atau DD/MM/YYYY)'
    else if (row.photo_url && !/^https?:\/\//i.test(row.photo_url))
      error = 'URL foto harus diawali http:// atau https://'

    if (code) seen.add(code.toLowerCase())
    return {
      ...row,
      name,
      registration_code: code,
      class_id: classId,
      class_label: classLabel,
      dorm_id: dormId,
      dorm_label: dormLabel,
      birth_date_iso: birthDate ?? undefined,
      error,
    }
  })
}

// ---------------------------------------------------------------------------
// Ilustrasi struktur kolom (langkah Upload)
// ---------------------------------------------------------------------------

export const SAMPLE_COLUMNS = [
  { letter: 'A', label: 'NAME', values: ['Budi Santoso', 'Siti Maryam'] },
  { letter: 'B', label: 'GENDER', values: ['L', 'P'] },
  { letter: 'C', label: 'CLASS', values: ['10A Boarding Putra', '10B Boarding Putri'] },
  { letter: 'D', label: 'WA', values: ['08123…', '08567…'] },
  { letter: 'E', label: 'NIS', values: ['2024001', '2024002'] },
  { letter: 'F', label: 'WALI', values: ['Ahmad', 'Aminah'] },
]
