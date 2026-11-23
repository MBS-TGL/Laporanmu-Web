import { describe, expect, it } from 'vitest'
import { getClassRowMessage, getClassRowStatus, parseClassTable } from './importParse'

const teachers = [
  { id: 't-1', name: 'Ust. Ahmad' },
  { id: 't-2', name: 'Ustzh. Siti' },
]
const years = [
  { id: 'y-1', name: '2026/2027' },
  { id: 'y-2', name: '2025/2026' },
]

const HEADERS = ['Nama Kelas', 'Tingkat', 'Jurusan', 'Wali Kelas', 'Tahun Ajaran']

describe('parseClassTable', () => {
  it('memetakan kolom dan me-resolve wali serta tahun ajaran', () => {
    const rows = parseClassTable(
      [HEADERS, ['7A', '7', 'Reguler', 'Ust. Ahmad', '2026/2027']],
      { teachers, years, existingKeys: new Set() },
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: '7A',
      grade: '7',
      major: 'Reguler',
      teacher: 'Ust. Ahmad',
      academicYearId: 'y-1',
      homeroomTeacherId: 't-1',
      duplicate: false,
    })
    expect(getClassRowStatus(rows[0])).toBe('siap')
  })

  it('menerima alias header dan melewati baris kosong', () => {
    const rows = parseClassTable(
      [['Nama', 'Tingkat', 'Wali', 'Tahun'], ['8B', '8', 'Ustzh. Siti', '2025/2026'], ['', '', '', '']],
      { teachers, years, existingKeys: new Set() },
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].academicYearId).toBe('y-2')
    expect(rows[0].homeroomTeacherId).toBe('t-2')
  })

  it('mengosongkan id yang tidak dikenal tetapi baris tetap siap dengan pesan', () => {
    const rows = parseClassTable(
      [HEADERS, ['9C', '9', 'Reguler', 'Guru Baru', '2099/2100']],
      { teachers, years, existingKeys: new Set() },
    )
    expect(rows[0].academicYearId).toBeNull()
    expect(rows[0].homeroomTeacherId).toBeNull()
    expect(getClassRowStatus(rows[0])).toBe('siap')
    expect(getClassRowMessage(rows[0])).toContain('Tahun ajaran')
    expect(getClassRowMessage(rows[0])).toContain('Wali')
  })

  it('menandai nama kosong sebagai error', () => {
    const rows = parseClassTable([HEADERS, ['', '7', 'Reguler', '', '']], {
      teachers,
      years,
      existingKeys: new Set(),
    })
    expect(getClassRowStatus(rows[0])).toBe('error')
    expect(getClassRowMessage(rows[0])).toContain('Nama kelas wajib diisi')
  })

  it('menandai duplikat di dalam file', () => {
    const rows = parseClassTable(
      [HEADERS, ['7A', '7', '', '', '2026/2027'], ['7a', '7', '', '', '2026/2027']],
      { teachers, years, existingKeys: new Set() },
    )
    expect(rows[0].duplicate).toBe(false)
    expect(rows[1].duplicate).toBe(true)
    expect(getClassRowStatus(rows[1])).toBe('duplikat')
  })

  it('menandai duplikat terhadap database dengan tahun yang sama', () => {
    const rows = parseClassTable([HEADERS, ['7A', '7', '', '', '2026/2027']], {
      teachers,
      years,
      existingKeys: new Set(['7a|y-1']),
    })
    expect(rows[0].duplicate).toBe(true)
  })

  it('melempar error bila kolom nama tidak ada', () => {
    expect(() =>
      parseClassTable([['Tingkat', 'Jurusan'], ['7', 'Reguler']], {
        teachers,
        years,
        existingKeys: new Set(),
      }),
    ).toThrow(/Nama Kelas/)
  })

  it('mengembalikan array kosong untuk tabel kosong', () => {
    expect(parseClassTable([], { teachers, years, existingKeys: new Set() })).toEqual([])
  })
})
