import { describe, expect, it } from 'vitest'
import { autoDescription, predikatOf, yudisiumChecks, yudisiumPassed } from './raporUtil'

describe('predikatOf', () => {
  it('band absolut A/B/C/D', () => {
    expect(predikatOf(90)).toBe('A')
    expect(predikatOf(86)).toBe('A')
    expect(predikatOf(71)).toBe('B')
    expect(predikatOf(56)).toBe('C')
    expect(predikatOf(55)).toBe('D')
    expect(predikatOf(null)).toBeNull()
  })
})

describe('autoDescription', () => {
  it('deskripsi per band memuat mapel & nilai', () => {
    const d = autoDescription('Matematika', 90)
    expect(d).toContain('Matematika')
    expect(d).toContain('90')
    expect(d).toContain('sangat baik')
    expect(autoDescription('B. Arab', 40)).toContain('remedial')
    expect(autoDescription('B. Arab', null)).toContain('belum lengkap')
  })
})

describe('yudisiumChecks', () => {
  it('lulus hanya bila semua syarat terpenuhi', () => {
    const ok = yudisiumChecks({
      gradesComplete: true,
      subjectsMissing: 0,
      tahfidzCount: 20,
      tahfidzTarget: 20,
      sppOutstanding: 0,
      totalPoints: 50,
      pointsLimit: 0,
    })
    expect(yudisiumPassed(ok)).toBe(true)

    const fail = yudisiumChecks({
      gradesComplete: true,
      subjectsMissing: 0,
      tahfidzCount: 10,
      tahfidzTarget: 20,
      sppOutstanding: 500000,
      totalPoints: -30,
      pointsLimit: 0,
    })
    expect(yudisiumPassed(fail)).toBe(false)
    expect(fail.filter((r) => !r.pass).map((r) => r.key)).toEqual(['tahfidz', 'spp', 'points'])
  })
})
