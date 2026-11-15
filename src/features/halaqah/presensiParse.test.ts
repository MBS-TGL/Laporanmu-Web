import { describe, expect, it } from 'vitest'
import { parsePresensiTable, type PresensiParseContext } from './presensiParse'

const roster = [
  { id: 's1', name: 'Ahmad Fauzan', registration_code: 'STU-2024-0001' },
  { id: 's2', name: 'Umar Abdullah', registration_code: 'STU-2024-0002' },
]

const ctx: PresensiParseContext = { daysInMonth: 30, roster }

describe('parsePresensiTable', () => {
  it('parse format grid dengan pencocokan kode registrasi', () => {
    const table = [
      ['Kode Registrasi', 'Nama', '1', '2', '3'],
      ['STU-2024-0001', 'Ahmad Fauzan', 'H', 'S', 'A'],
      ['stu20240002', 'Umar Abdullah', 'H', '', 'P'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.skippedRows).toBe(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      studentId: 's1',
      matchBy: 'kode',
      status: 'siap',
      days: { '1': 'H', '2': 'S', '3': 'A' },
    })
    // kolom kosong tidak masuk days
    expect(result.rows[1].days).toEqual({ '1': 'H', '3': 'P' })
  })

  it('parse dengan pencocokan nama eksak saat kode tidak ada', () => {
    const table = [
      ['Nama', 'H1', 'H2'],
      ['  ahmad fauzan ', 'hadir', 'izin'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.rows[0]).toMatchObject({
      studentId: 's1',
      matchBy: 'nama',
      days: { '1': 'H', '2': 'I' },
    })
  })

  it('normalisasi status teks panjang (hadir, pulang awal, kosong)', () => {
    const table = [
      ['Nama', '1', '2', '3', '4'],
      ['Ahmad Fauzan', 'hadir', 'pulang awal', 'x', 'alpa'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.rows[0].days).toEqual({ '1': 'H', '2': 'P', '4': 'A' })
  })

  it('baris dengan nama tak dikenal berstatus tak_dikenal', () => {
    const table = [
      ['Nama', '1'],
      ['Bukan Anggota', 'H'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.rows[0].status).toBe('tak_dikenal')
    expect(result.rows[0].error).toContain('tidak ditemukan')
  })

  it('status tak dikenal pada sel hari = error baris', () => {
    const table = [
      ['Nama', '5'],
      ['Ahmad Fauzan', 'terlambat'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[0].error).toContain('Status tidak dikenal di hari 5')
  })

  it('kolom hari di luar daysInMonth diabaikan', () => {
    const table = [
      ['Nama', '30', '31'],
      ['Ahmad Fauzan', 'H', 'S'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.rows[0].days).toEqual({ '30': 'H' })
  })

  it('baris kosong dilewati, baris tanpa identitas = error', () => {
    const table = [
      ['Nama', '1'],
      ['', ''],
      ['', 'H'],
      ['Ahmad Fauzan', 'H'],
    ]
    const result = parsePresensiTable(table, ctx)
    expect(result.skippedRows).toBe(1)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].status).toBe('error')
    expect(result.rows[1].status).toBe('siap')
  })

  it('tolak file tanpa kolom identifikasi', () => {
    expect(() => parsePresensiTable([['1', '2'], ['H', 'S']], ctx)).toThrow(/identifikasi/)
  })

  it('tolak file kosong', () => {
    expect(() => parsePresensiTable([], ctx)).toThrow(/kosong/)
  })
})
