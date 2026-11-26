import { describe, expect, it } from 'vitest'
import { getPrintCriteria } from './criteria'

describe('getPrintCriteria lisan', () => {
  it('boarding mencetak 12 baris non-praktik + 1 praktik di tingkat 7', () => {
    const criteria = getPrintCriteria('pondok_oral', '7', '7A Boarding')
    expect(criteria.filter((c) => !c.practical)).toHaveLength(12)
    expect(criteria.filter((c) => c.practical)).toHaveLength(1)
    expect(criteria.find((c) => c.key === 'tuhfatul_athfal')?.ar).toBe('تحفة الأطفال')
  })

  it('reguler mencetak 11 baris non-praktik tanpa Tuhfatul', () => {
    const criteria = getPrintCriteria('pondok_oral', '7', '7A Reguler')
    expect(criteria.filter((c) => !c.practical)).toHaveLength(11)
    expect(criteria.map((c) => c.key)).not.toContain('tuhfatul_athfal')
  })

  it('menghasilkan label Arab untuk tiap baris', () => {
    const criteria = getPrintCriteria('pondok_oral', '10', '10A')
    expect(criteria.every((c) => Boolean(c.ar))).toBe(true)
  })

  it('rapor bulanan tetap memakai 5 kolom tetap', () => {
    expect(getPrintCriteria('monthly', null)).toHaveLength(5)
  })
})
