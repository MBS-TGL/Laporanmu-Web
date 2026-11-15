import { describe, expect, it } from 'vitest'
import { parseEkskulTable } from './importParse'

const TEACHERS = [
  { id: 't1', name: 'Muhammad Misbahul Huda' },
  { id: 't2', name: 'Siti Aminah' },
]

const ctx = { existingNames: ['hizbul wathan'], teachers: TEACHERS }

describe('parseEkskulTable', () => {
  it('throw bila file kosong', () => {
    expect(() => parseEkskulTable([], ctx)).toThrow('File kosong')
  })

  it('throw bila kolom nama tidak ditemukan', () => {
    expect(() => parseEkskulTable([['Jadwal', 'Tempat'], ['Senin', 'Aula']], ctx)).toThrow(
      /Nama Kegiatan/,
    )
  })

  it('parse baris lengkap dan cocokkan pembina case-insensitive', () => {
    const table = [
      ['Nama Kegiatan', 'Pembina', 'Jadwal', 'Tempat', 'Deskripsi'],
      ['Pramuka', 'siti aminah', 'Jumat', 'Lapangan', 'Wajib luar'],
    ]
    const { rows } = parseEkskulTable(table, ctx)
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
    const { rows } = parseEkskulTable(table, ctx)
    expect(rows[0].rowStatus).toBe('siap')
    expect(rows[0].coachId).toBeNull()
    expect(rows[0].message).toContain('tidak ditemukan')
  })

  it('nama kosong = error', () => {
    const table = [
      ['Nama Kegiatan', 'Pembina'],
      ['', 'Siti Aminah'],
    ]
    const { rows } = parseEkskulTable(table, ctx)
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
    const { rows } = parseEkskulTable(table, ctx)
    expect(rows[0].rowStatus).toBe('duplikat')
    expect(rows[0].message).toContain('database')
    expect(rows[1].rowStatus).toBe('siap')
    expect(rows[2].rowStatus).toBe('duplikat')
    expect(rows[2].message).toContain('file')
  })

  it('kolom opsional boleh tidak ada di file', () => {
    const table = [['Nama Kegiatan'], ['Basket']]
    const { rows } = parseEkskulTable(table, ctx)
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
    const { rows, skippedRows } = parseEkskulTable(table, ctx)
    expect(rows).toHaveLength(2)
    expect(skippedRows).toBe(1)
  })
})
