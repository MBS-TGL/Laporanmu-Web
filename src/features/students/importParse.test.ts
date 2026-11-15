import { describe, expect, it } from 'vitest'
import {
  autoMatch,
  normalizeGender,
  normalizeName,
  normalizePhone,
  parseBirthDate,
  splitTags,
  validateRows,
  type ParsedRow,
} from './importParse'

const CLASSES = [
  { id: 'c1', name: '9A Boarding Putra' },
  { id: 'c2', name: '10B Reguler Putri' },
]
const DORMS = [{ id: 'd1', name: 'Mas Mansyor' }]

function row(overrides: Partial<ParsedRow>): ParsedRow {
  return { key: 1, ...overrides }
}

describe('autoMatch', () => {
  it('mencocokkan header dengan alias (WA → phone, CLASS → class_name)', () => {
    const mapping = autoMatch(['NAME', 'WA', 'CLASS', 'Kode Registrasi'])
    expect(mapping.name).toBe(0)
    expect(mapping.phone).toBe(1)
    expect(mapping.class_name).toBe(2)
    expect(mapping.registration_code).toBe(3)
  })

  it('tidak memetakan satu kolom ke dua field', () => {
    // header "Kode" cocok untuk registration_code; kolom kedua "kode reg" tidak dipakai ulang
    const mapping = autoMatch(['kode', 'kode reg'])
    expect(mapping.registration_code).toBe(0)
  })

  it('mengabaikan BOM dan spasi aneh', () => {
    const mapping = autoMatch(['\ufeff  Nama  Siswa '])
    expect(mapping.name).toBe(0)
  })
})

describe('normalizeGender', () => {
  it('memetakan alias umum', () => {
    expect(normalizeGender('laki-laki')).toBe('L')
    expect(normalizeGender('perempuan')).toBe('P')
    expect(normalizeGender('male')).toBe('L')
  })

  it('meneruskan L/P dan mengabaikan kosong', () => {
    expect(normalizeGender('L')).toBe('L')
    expect(normalizeGender('x')).toBe('X')
    expect(normalizeGender('')).toBeUndefined()
    expect(normalizeGender(undefined)).toBeUndefined()
  })
})

describe('normalizePhone', () => {
  it('menambah 0 depan untuk 8xx tanpa nol (Excel memangkasnya)', () => {
    expect(normalizePhone('812345678901')).toBe('0812345678901')
  })

  it('meneruskan nomor yang sudah benar dan membersihkan spasi/strip', () => {
    expect(normalizePhone('0812-3456 7890')).toBe('081234567890')
  })

  it('tidak menyentuh nilai aneh', () => {
    expect(normalizePhone('abc')).toBe('abc')
    expect(normalizePhone(undefined)).toBeUndefined()
  })
})

describe('splitTags', () => {
  it('memecah titik koma/koma dan dedupe', () => {
    expect(splitTags('Beasiswa; Yatim, Beasiswa')).toEqual(['Beasiswa', 'Yatim'])
  })

  it('menghasilkan undefined untuk kosong', () => {
    expect(splitTags('')).toBeUndefined()
    expect(splitTags(undefined)).toBeUndefined()
  })
})

describe('parseBirthDate', () => {
  it('menerima ISO dan DD/MM/YYYY', () => {
    expect(parseBirthDate('2011-05-17')).toBe('2011-05-17')
    expect(parseBirthDate('17/05/2011')).toBe('2011-05-17')
  })

  it('null untuk format salah atau tanggal mustahil', () => {
    expect(parseBirthDate('17.05.2011')).toBeNull()
    expect(parseBirthDate('31/02/2011')).toBeNull()
  })

  it('undefined untuk kosong', () => {
    expect(parseBirthDate('')).toBeUndefined()
  })
})

describe('validateRows', () => {
  it('lookup kelas/asrama case & spasi-insensitive', () => {
    const [r] = validateRows(
      [row({ name: 'Budi', registration_code: 'A1', class_name: '9a  boarding putra', dorm_name: 'mas mansyor' })],
      CLASSES,
      DORMS,
    )
    expect(r.error).toBeUndefined()
    expect(r.class_id).toBe('c1')
    expect(r.class_label).toBe('9A Boarding Putra')
    expect(r.dorm_id).toBe('d1')
  })

  it('kelas kosong tanpa default → error; dengan default → terisi', () => {
    const [tanpa] = validateRows([row({ name: 'Budi', registration_code: 'A1' })], CLASSES, DORMS)
    expect(tanpa.error).toBe('Kelas kosong (isi kolom kelas atau pilih kelas default)')
    const [dengan] = validateRows(
      [row({ name: 'Budi', registration_code: 'A1' })],
      CLASSES,
      DORMS,
      'c2',
    )
    expect(dengan.error).toBeUndefined()
    expect(dengan.class_id).toBe('c2')
  })

  it('duplikat kode di file ditandai (case-insensitive), baris pertama lolos', () => {
    const rows = validateRows(
      [
        row({ name: 'Budi', registration_code: 'A1', class_name: '9A Boarding Putra' }),
        row({ name: 'Budi', registration_code: 'a1', class_name: '9A Boarding Putra' }),
      ],
      CLASSES,
      DORMS,
    )
    expect(rows[0].error).toBeUndefined()
    expect(rows[1].error).toBe('Kode registrasi duplikat di file')
  })

  it('urutan error: nama diprioritaskan sebelum kelas', () => {
    const [r] = validateRows([row({ registration_code: 'A1' })], CLASSES, DORMS)
    expect(r.error).toBe('Nama kosong')
  })

  it('NISN non-angka dan URL foto non-http ditolak', () => {
    const [nisn] = validateRows(
      [row({ name: 'B', registration_code: 'A1', class_name: '9A Boarding Putra', nisn: '12a3' })],
      CLASSES,
      DORMS,
    )
    expect(nisn.error).toBe('NISN harus berupa angka')
    const [foto] = validateRows(
      [row({ name: 'B', registration_code: 'A1', class_name: '9A Boarding Putra', photo_url: 'ftp://x' })],
      CLASSES,
      DORMS,
    )
    expect(foto.error).toBe('URL foto harus diawali http:// atau https://')
  })

  it('tanggal lahir invalid ditandai; ISO tersimpan di birth_date_iso', () => {
    const [r] = validateRows(
      [row({ name: 'B', registration_code: 'A1', class_name: '9A Boarding Putra', birth_date: '17.05.2011' })],
      CLASSES,
      DORMS,
    )
    expect(r.error).toBe('Tanggal lahir tidak valid (pakai YYYY-MM-DD atau DD/MM/YYYY)')
    const [ok] = validateRows(
      [row({ name: 'B', registration_code: 'A1', class_name: '9A Boarding Putra', birth_date: '2011-05-17' })],
      CLASSES,
      DORMS,
    )
    expect(ok.birth_date_iso).toBe('2011-05-17')
  })
})

describe('normalizeName', () => {
  it('merapikan spasi & lowercase', () => {
    expect(normalizeName('  9A   Boarding Putra ')).toBe('9a boarding putra')
  })
})
