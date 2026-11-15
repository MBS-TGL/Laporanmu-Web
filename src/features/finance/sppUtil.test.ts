import { describe, expect, it } from 'vitest'
import { monthRange, obligationStatus, outstandingOf, periodLabel, summarizeObligations } from './sppUtil'

describe('periodLabel', () => {
  it('menerjemahkan periode bulanan & kosong', () => {
    expect(periodLabel('2026-07')).toBe('Jul 2026')
    expect(periodLabel('2027-01')).toBe('Jan 2027')
    expect(periodLabel('')).toBe('Sekali')
  })

  it('periode tak valid dikembalikan apa adanya', () => {
    expect(periodLabel('x')).toBe('x')
  })
})

describe('monthRange', () => {
  it('rentang dalam satu tahun', () => {
    expect(monthRange('2026-07', '2026-09')).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('rentang lintas tahun', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('rentang terbalik / tidak valid → kosong', () => {
    expect(monthRange('2026-09', '2026-07')).toEqual([])
    expect(monthRange('abc', '2026-07')).toEqual([])
  })
})

describe('outstanding & status', () => {
  it('sisa tidak pernah negatif', () => {
    expect(outstandingOf({ amount: 100, paid: 150 })).toBe(0)
    expect(outstandingOf({ amount: 100, paid: 40 })).toBe(60)
  })

  it('status lunas / kurang / belum', () => {
    expect(obligationStatus({ amount: 100, paid: 100 })).toBe('lunas')
    expect(obligationStatus({ amount: 100, paid: 30 })).toBe('kurang')
    expect(obligationStatus({ amount: 100, paid: 0 })).toBe('belum')
  })
})

describe('summarizeObligations', () => {
  it('total, terbayar (dibatasi nominal), dan tunggakan', () => {
    const s = summarizeObligations([
      { amount: 100, paid: 100 },
      { amount: 200, paid: 50 },
      { amount: 300, paid: 0 },
    ])
    expect(s.total).toBe(600)
    expect(s.paid).toBe(150)
    expect(s.outstanding).toBe(450)
  })
})
