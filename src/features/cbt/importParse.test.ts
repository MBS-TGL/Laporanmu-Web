import { describe, expect, it } from 'vitest'
import { formatCountdown, formatToken, remainingMs } from './examUtil'
import { getCbtRowMessage, getCbtRowStatus, parseCbtQuestionTable } from './importParse'

describe('parseCbtQuestionTable', () => {
  const okRow = ['Ibu kota Indonesia adalah...', 'Jakarta', 'Bandung', 'Surabaya', 'Medan', '', 'A', '1']

  it('meneruskan baris valid dengan poin default', () => {
    const rows = parseCbtQuestionTable([okRow])
    expect(rows).toHaveLength(1)
    expect(getCbtRowStatus(rows[0])).toBe('siap')
    expect(rows[0].options).toHaveLength(4)
    expect(rows[0].points).toBe(1)
    expect(rows[0].answerKey).toBe('A')
  })

  it('menolak soal kosong', () => {
    const rows = parseCbtQuestionTable([['', 'A', 'B', '', '', '', 'A', '']])
    expect(getCbtRowStatus(rows[0])).toBe('error')
    expect(rows[0].error).toBe('Soal kosong')
  })

  it('menolak opsi kurang dari 2', () => {
    const rows = parseCbtQuestionTable([['Soal', 'Jakarta', '', '', '', '', 'A', '']])
    expect(getCbtRowStatus(rows[0])).toBe('error')
    expect(rows[0].error).toContain('2 opsi')
  })

  it('menolak kunci yang opsinya kosong', () => {
    const rows = parseCbtQuestionTable([['Soal', 'Jakarta', 'Bandung', '', '', '', 'C', '']])
    expect(getCbtRowStatus(rows[0])).toBe('error')
    expect(rows[0].error).toContain('C')
  })

  it('menolak kunci di luar A-E', () => {
    const rows = parseCbtQuestionTable([['Soal', 'Jakarta', 'Bandung', '', '', '', 'F', '']])
    expect(getCbtRowStatus(rows[0])).toBe('error')
  })

  it('menerima poin desimal dengan koma', () => {
    const rows = parseCbtQuestionTable([['Soal', 'A', 'B', '', '', '', 'B', '2,5']])
    expect(rows[0].points).toBeCloseTo(2.5)
  })

  it('menandai duplikat dalam file dan lintas bank', () => {
    const rows = parseCbtQuestionTable([okRow, okRow], ['ibu kota   indonesia adalah...'])
    expect(getCbtRowStatus(rows[0])).toBe('duplikat')
    expect(getCbtRowStatus(rows[1])).toBe('duplikat')
    expect(getCbtRowMessage(rows[1])).toContain('duplikat')
  })

  it('baris error tidak ikut jadi kandidat duplikat', () => {
    const rows = parseCbtQuestionTable([['Soal', 'A', 'B', '', '', '', 'Z', ''], ['Soal', 'A', 'B', '', '', '', 'A', '']])
    expect(getCbtRowStatus(rows[0])).toBe('error')
    expect(getCbtRowStatus(rows[1])).toBe('siap')
  })
})

describe('examUtil', () => {
  it('formatToken bergrup 4 karakter', () => {
    expect(formatToken('ABCD1234EFGH5678')).toBe('ABCD-1234-EFGH-5678')
  })

  it('remainingMs tidak negatif', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(remainingMs(past)).toBe(0)
    const future = new Date(Date.now() + 65_000).toISOString()
    expect(remainingMs(future)).toBeGreaterThan(0)
  })

  it('formatCountdown di bawah & di atas 1 jam', () => {
    expect(formatCountdown(65_000)).toBe('01:05')
    expect(formatCountdown(3_661_000)).toBe('01:01:01')
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-5_000)).toBe('00:00')
  })
})
