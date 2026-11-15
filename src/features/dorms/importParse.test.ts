import { describe, expect, it } from 'vitest'
import { parseDormTable } from './importParse'
import type { DormImportContext } from './types'

const ctx: DormImportContext = {
  existingNames: ['melati a1', 'anggrek b2'],
  teachers: [
    { id: 't-1', name: 'Ustadz Ahmad' },
    { id: 't-2', name: 'Ustadzah Fatimah' },
  ],
}

describe('parseDormTable', () => {
  it('melempar error bila kolom nama tidak ada', () => {
    expect(() => parseDormTable([['Gender', 'Kapasitas'], ['Putra', '10']], ctx)).toThrow(
      /Kolom "Nama" tidak ditemukan/,
    )
  })

  it('melempar error bila file kosong', () => {
    expect(() => parseDormTable([], ctx)).toThrow(/File kosong/)
  })

  it('mem-parsing baris valid dengan alias gender & status', () => {
    const result = parseDormTable(
      [
        ['Nama', 'Gender', 'Kapasitas', 'Musyrif', 'Status'],
        ['Mawar A1', 'Putra', '12', 'Ustadz Ahmad', 'aktif'],
        ['Melati B1', 'female', '8', '', 'nonaktif'],
      ],
      ctx,
    )
    expect(result.skippedRows).toBe(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toMatchObject({
      row: 1,
      name: 'Mawar A1',
      gender: 'male',
      capacity: 12,
      musyrifId: 't-1',
      status: 'active',
      rowStatus: 'siap',
    })
    expect(result.rows[1]).toMatchObject({
      name: 'Melati B1',
      gender: 'female',
      status: 'inactive',
      rowStatus: 'siap',
      message: undefined,
    })
  })

  it('default gender null, kapasitas wajib, status default aktif', () => {
    const result = parseDormTable(
      [['Nama', 'Kapasitas'], ['Cemara C1', '10']],
      ctx,
    )
    expect(result.rows[0]).toMatchObject({
      gender: null,
      capacity: 10,
      status: 'active',
      rowStatus: 'siap',
    })
  })

  it('menandai error: nama kosong, kapasitas invalid, gender tak dikenal', () => {
    const result = parseDormTable(
      [
        ['Nama', 'Gender', 'Kapasitas'],
        ['', 'Putra', '10'],
        ['Kamar X', 'Putra', 'abc'],
        ['Kamar Y', 'unknown', '10'],
        ['Kamar Z', 'Putra', '200'],
      ],
      ctx,
    )
    expect(result.rows.map((r) => r.rowStatus)).toEqual([
      'error',
      'error',
      'error',
      'error',
    ])
    expect(result.rows[0].message).toMatch(/Nama kamar wajib diisi/)
    expect(result.rows[1].message).toMatch(/Kapasitas harus angka bulat 1–100/)
    expect(result.rows[2].message).toMatch(/Gender tidak dikenal/)
    expect(result.rows[3].message).toMatch(/Kapasitas harus angka bulat/)
  })

  it('duplikat: nama sudah ada di database dan duplikat dalam file', () => {
    const result = parseDormTable(
      [
        ['Nama', 'Kapasitas'],
        ['Melati A1', '10'],
        ['Anggrek B2', '8'],
        ['Melati A1', '12'],
      ],
      ctx,
    )
    expect(result.rows[0].rowStatus).toBe('duplikat')
    expect(result.rows[0].message).toMatch(/sudah ada di database/)
    expect(result.rows[1].rowStatus).toBe('duplikat')
    expect(result.rows[1].message).toMatch(/sudah ada di database/)
    expect(result.rows[2].rowStatus).toBe('duplikat')
    expect(result.rows[2].message).toMatch(/Duplikat dalam file/)
  })

  it('musyrif tidak dikenal → tetap siap dengan peringatan, musyrifId null', () => {
    const result = parseDormTable(
      [['Nama', 'Kapasitas', 'Musyrif'], ['Mawar D1', '10', 'Ustadz Tidak Ada']],
      ctx,
    )
    expect(result.rows[0]).toMatchObject({
      rowStatus: 'siap',
      musyrifId: null,
      message: expect.stringMatching(/tidak ditemukan/),
    })
  })

  it('musyrif di-resolve case-insensitive & kolom tak berurutan', () => {
    const result = parseDormTable(
      [['Status', 'Nama Kamar', 'Nama Musyrif', 'Kuota'], ['penuh', 'Mawar E1', 'ustadzah fatimah', '6']],
      ctx,
    )
    expect(result.rows[0]).toMatchObject({
      name: 'Mawar E1',
      musyrifId: 't-2',
      capacity: 6,
      status: 'full',
      rowStatus: 'siap',
    })
  })

  it('melewati baris kosong dan menghitungnya sebagai skipped', () => {
    const result = parseDormTable(
      [['Nama', 'Kapasitas'], ['Mawar F1', '10'], ['', ''], ['  ', '']],
      ctx,
    )
    expect(result.rows).toHaveLength(1)
    expect(result.skippedRows).toBe(2)
  })
})
