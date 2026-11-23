import { describe, expect, it } from 'vitest'
import { titleCaseName } from './text'

describe('titleCaseName', () => {
  it('mengubah nama kapital menjadi Title Case', () => {
    expect(titleCaseName('AHMAD FAUZI')).toBe('Ahmad Fauzi')
    expect(titleCaseName('MUHAMMAD ABDURRAHMAN')).toBe('Muhammad Abdurrahman')
  })

  it('mempertahankan singkatan resmi', () => {
    expect(titleCaseName('AHMAD H. MBS')).toBe('Ahmad H. MBS')
    expect(titleCaseName('KHOIRUL ANWAR, S.PD.')).toBe('Khoirul Anwar, S.Pd.')
  })

  it('tidak merusak nama yang sudah campuran', () => {
    expect(titleCaseName('Ahmad Fauzi')).toBe('Ahmad Fauzi')
    expect(titleCaseName('éL FATH')).toBe('éL Fath')
  })

  it('menangani tanda hubung dan apostrof', () => {
    expect(titleCaseName('ABDUL-RAHMAN')).toBe('Abdul-Rahman')
  })
})
