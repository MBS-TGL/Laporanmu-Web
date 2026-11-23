import { describe, expect, it } from 'vitest'
import { computeFine, FINE_PER_DAY } from './types'

describe('computeFine', () => {
  it('tidak mendenda bila kembali tepat waktu', () => {
    expect(computeFine('2026-11-10', '2026-11-10')).toBe(0)
  })

  it('tidak mendenda bila kembali lebih awal', () => {
    expect(computeFine('2026-11-10', '2026-11-01')).toBe(0)
  })

  it('mendenda per hari keterlambatan', () => {
    expect(computeFine('2026-11-10', '2026-11-13')).toBe(3 * FINE_PER_DAY)
  })

  it('tanpa jatuh tempo atau tanggal kembali berarti tanpa denda', () => {
    expect(computeFine(null, '2026-11-13')).toBe(0)
    expect(computeFine('2026-11-10', null)).toBe(0)
  })
})
