import { describe, expect, it } from 'vitest'
import {
  FIELDS,
  SAMPLE_COLUMNS,
  TEMPLATE_COLUMNS,
  autoMatch,
  parseActivityTable,
  type Mapping,
} from './importParse'

const TEACHERS = [
  { id: 't1', name: 'Muhammad Misbahul Huda' },
  { id: 't2', name: 'Siti Aminah' },
]

const ctx = { existingNames: ['hizbul wathan'], teachers: TEACHERS }

/** Pemetaan seperti langkah Mapping: deteksi otomatis dari header tabel. */
const map = (table: string[][]): Mapping => autoMatch(table[0] ?? [])

describe('parseActivityTable', () => {
  it('throw bila file kosong', () => {
    expect(() => parseActivityTable([], {}, ctx)).toThrow('File kosong')
  })

  it('throw bila kolom nama tidak ditemukan', () => {
    const table = [['Jadwal', 'Tempat'], ['Senin', 'Aula']]
    expect(() => parseActivityTable(table, map(table), ctx)).toThrow(/Nama Kegiatan/)
  })

  it('parse baris lengkap dan cocokkan pembina case-insensitive', () => {
    const table = [
      ['Nama Kegiatan', 'Pembina', 'Jadwal', 'Tempat', 'Deskripsi'],
      ['Pramuka', 'siti aminah', 'Jumat', 'Lapangan', 'Wajib luar'],
    ]
    const { rows } = parseActivityTable(table, map(table), ctx)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: 'Pramuka',
      coachId: 't2',
      coachName: 'siti aminah',
      schedule: 'Jumat',
      place: 'Lapangan',
      description: 'Wajib luar',
      rowStatus: 'siap',
    })
  })

  it('pembina tidak dikenal = siap dengan peringatan, coachId null', () => {
    const table = [
      ['Nama Kegiatan', 'Pembina'],
      ['Futsal', 'Guru Fiktif'],
    ]
    const { rows } = parseActivityTable(table, map(table), ctx)
    expect(rows[0].rowStatus).toBe('siap')
    expect(rows[0].coachId).toBeNull()
    expect(rows[0].message).toContain('tidak ditemukan')
  })

  it('nama kosong = error', () => {
    const table = [
      ['Nama Kegiatan', 'Pembina'],
      ['', 'Siti Aminah'],
    ]
    const { rows } = parseActivityTable(table, map(table), ctx)
    expect(rows[0].rowStatus).toBe('error')
    expect(rows[0].message).toContain('wajib')
  })

  it('deteksi duplikat DB dan duplikat dalam file (case-insensitive)', () => {
    const table = [
      ['Nama Kegiatan'],
      ['Hizbul Wathan'],
      ['Pramuka'],
      ['pramuka'],
    ]
    const { rows } = parseActivityTable(table, map(table), ctx)
    expect(rows[0].rowStatus).toBe('duplikat')
    expect(rows[0].message).toContain('database')
    expect(rows[1].rowStatus).toBe('siap')
    expect(rows[2].rowStatus).toBe('duplikat')
    expect(rows[2].message).toContain('file')
  })

  it('kolom opsional boleh tidak ada di file', () => {
    const table = [['Nama Kegiatan'], ['Basket']]
    const { rows } = parseActivityTable(table, map(table), ctx)
    expect(rows[0]).toMatchObject({
      name: 'Basket',
      coachName: null,
      schedule: null,
      place: null,
      description: null,
      rowStatus: 'siap',
    })
  })

  it('baris kosong dilewati dan dihitung', () => {
    const table = [
      ['Nama Kegiatan'],
      ['Basket'],
      ['', ''],
      ['Renang'],
    ]
    const { rows, skippedRows } = parseActivityTable(table, map(table), ctx)
    expect(rows).toHaveLength(2)
    expect(skippedRows).toBe(1)
  })
})

describe('SAMPLE_COLUMNS', () => {
  it('memuat semua kolom wajib', () => {
    const requiredKeys = FIELDS.filter((f) => 'required' in f && f.required).map((f) => f.key)
    expect(requiredKeys.length).toBeGreaterThan(0)
    for (const key of requiredKeys) {
      expect(SAMPLE_COLUMNS.some((c) => c.key === key)).toBe(true)
    }
  })

  it('label = judul kolom template, key ikut TEMPLATE_COLUMNS, maksimal 7 kolom', () => {
    expect(SAMPLE_COLUMNS.length).toBeLessThanOrEqual(7)
    for (const col of SAMPLE_COLUMNS) {
      expect(TEMPLATE_COLUMNS).toContain(col.key)
      expect(FIELDS.find((f) => f.key === col.key)?.label).toBe(col.label)
    }
  })

  it('baris contoh ke-2 tidak kosong untuk kolom yang ditampilkan', () => {
    for (const col of SAMPLE_COLUMNS) {
      expect(col.values[1]).not.toBe('')
    }
  })
})
