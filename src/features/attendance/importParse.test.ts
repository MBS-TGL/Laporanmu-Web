import { describe, expect, it } from 'vitest'
import { detectFormat, parseAttendanceTable, parseDayValue } from './importParse'

const ctx = {
  year: 2026,
  month: 11,
  daysInMonth: 30,
  roster: [
    { id: 's1', name: 'Ahmad Fulan', registration_code: 'LPM-0001-001', nisn: '0051234567' },
    { id: 's2', name: 'Siti Aminah', registration_code: 'LPM-0001-002', nisn: null },
  ],
}

describe('detectFormat', () => {
  it('mengenali format grid dari kolom angka', () => {
    expect(detectFormat(['kode', 'nama', '1', '2', '3'])).toBe('grid')
    expect(detectFormat(['nama', 'h1', 'h2'])).toBe('grid')
  })

  it('mengenali format harian dari kolom tanggal+status', () => {
    expect(detectFormat(['kode', 'tanggal', 'status'])).toBe('harian')
    expect(detectFormat(['nama', 'tgl', 'ket'])).toBe('harian')
  })

  it('mengembalikan null untuk header asing', () => {
    expect(detectFormat(['a', 'b', 'c'])).toBe(null)
  })
})

describe('parseDayValue', () => {
  const c = { year: 2026, month: 11, daysInMonth: 30 }

  it('menerima nomor hari', () => {
    expect(parseDayValue('5', c)).toEqual({ day: 5 })
    expect(parseDayValue(' 30 ', c)).toEqual({ day: 30 })
  })

  it('menolak nomor hari di luar jangkauan', () => {
    expect(parseDayValue('31', c)).toHaveProperty('error')
    expect(parseDayValue('0', c)).toHaveProperty('error')
  })

  it('menerima ISO dan DD/MM/YYYY pada periode yang sama', () => {
    expect(parseDayValue('2026-11-07', c)).toEqual({ day: 7 })
    expect(parseDayValue('07/11/2026', c)).toEqual({ day: 7 })
    expect(parseDayValue('7-11-2026', c)).toEqual({ day: 7 })
  })

  it('menolak tanggal di luar periode terpilih', () => {
    expect(parseDayValue('2026-12-01', c)).toHaveProperty('error')
    expect(parseDayValue('01/12/2026', c)).toHaveProperty('error')
  })

  it('menolak format acak', () => {
    expect(parseDayValue('besok', c)).toHaveProperty('error')
  })
})

describe('parseAttendanceTable — format grid', () => {
  it('memetakan kode registrasi dan status per hari', () => {
    const result = parseAttendanceTable(
      [
        ['kode', 'nama', '1', '2', '3'],
        ['lpm-0001-001', 'Ahmad Fulan', 'H', 'H', 'S'],
        ['LPM-0001-002', '', 'hadir', '', 'alpa'],
      ],
      ctx,
    )
    expect(result.format).toBe('grid')
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      studentId: 's1',
      matchBy: 'kode',
      status: 'siap',
      days: { '1': 'H', '2': 'H', '3': 'S' },
    })
    expect(result.rows[1].days).toEqual({ '1': 'H', '3': 'A' })
  })

  it('match via nisn dan nama', () => {
    const result = parseAttendanceTable(
      [
        ['nisn', '1'],
        ['0051234567', 'H'],
      ],
      ctx,
    )
    expect(result.rows[0]).toMatchObject({ studentId: 's1', matchBy: 'nisn' })
  })

  it('menandai tak_dikenal untuk kode asing', () => {
    const result = parseAttendanceTable(
      [
        ['kode', '1'],
        ['XXX-9999-999', 'H'],
      ],
      ctx,
    )
    expect(result.rows[0].status).toBe('tak_dikenal')
    expect(result.rows[0].error).toContain('tidak ditemukan')
  })

  it('menandai error untuk status tidak dikenal', () => {
    const result = parseAttendanceTable(
      [
        ['kode', '1', '2'],
        ['LPM-0001-001', 'H', 'q'],
      ],
      ctx,
    )
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[0].error).toContain('hari 2')
  })

  it('melewati kolom hari di luar bulan ini (31 pada bulan 30 hari)', () => {
    const result = parseAttendanceTable(
      [
        ['kode', '30', '31'],
        ['LPM-0001-001', 'H', 'S'],
      ],
      ctx,
    )
    expect(result.rows[0].days).toEqual({ '30': 'H' })
  })
})

describe('parseAttendanceTable — format harian', () => {
  it('memetakan satu baris satu hari', () => {
    const result = parseAttendanceTable(
      [
        ['kode', 'tanggal', 'status'],
        ['LPM-0001-001', '2026-11-05', 'hadir'],
        ['LPM-0001-001', '06/11/2026', 'sakit'],
        ['LPM-0001-002', '5', 'i'],
      ],
      ctx,
    )
    expect(result.format).toBe('harian')
    expect(result.rows).toHaveLength(3)
    expect(result.rows[0].days).toEqual({ '5': 'H' })
    expect(result.rows[1].days).toEqual({ '6': 'S' })
    expect(result.rows[2].days).toEqual({ '5': 'I' })
  })

  it('menolak tanggal di luar periode', () => {
    const result = parseAttendanceTable(
      [
        ['kode', 'tanggal', 'status'],
        ['LPM-0001-001', '2026-12-25', 'H'],
      ],
      ctx,
    )
    expect(result.rows[0].status).toBe('error')
  })

  it('menolak status tak dikenal', () => {
    const result = parseAttendanceTable(
      [
        ['kode', 'tanggal', 'status'],
        ['LPM-0001-001', '5', 'mungkin'],
      ],
      ctx,
    )
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[0].error).toContain('Status tidak dikenal')
  })
})

describe('parseAttendanceTable — kegagalan struktural', () => {
  it('melempar error untuk header asing', () => {
    expect(() => parseAttendanceTable([['a', 'b'], ['x', 'y']], ctx)).toThrow(/Format tidak dikenali/)
  })

  it('melempar error tanpa kolom identifikasi', () => {
    expect(() => parseAttendanceTable([['1', '2'], ['H', 'S']], ctx)).toThrow(/identifikasi/)
  })

  it('melewati baris kosong', () => {
    const result = parseAttendanceTable(
      [
        ['kode', '1'],
        ['', ''],
        ['LPM-0001-001', 'H'],
      ],
      ctx,
    )
    expect(result.skippedRows).toBe(1)
    expect(result.rows).toHaveLength(1)
  })
})
