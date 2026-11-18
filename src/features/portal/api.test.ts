import { describe, expect, it } from 'vitest'
import { summarizeDays } from './api'

describe('summarizeDays', () => {
  it('menghitung status H/S/I/A/P', () => {
    expect(
      summarizeDays({ '1': 'H', '2': 'H', '3': 'S', '4': 'I', '5': 'A', '6': 'P' }),
    ).toEqual({ H: 2, S: 1, I: 1, A: 1, P: 1 })
  })

  it('toleran huruf kecil dan spasi, buang nilai asing', () => {
    expect(summarizeDays({ '1': 'h', '2': ' H ', '3': 'x', '4': '' })).toEqual({
      H: 2,
      S: 0,
      I: 0,
      A: 0,
      P: 0,
    })
  })

  it('days kosong = nol semua', () => {
    expect(summarizeDays({})).toEqual({ H: 0, S: 0, I: 0, A: 0, P: 0 })
  })
})
