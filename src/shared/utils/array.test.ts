import { describe, expect, it } from 'vitest'
import { chunk } from './array'

describe('chunk', () => {
  it('memecah array sesuai ukuran chunk', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('mengembalikan array kosong tanpa error', () => {
    expect(chunk([], 10)).toEqual([])
  })

  it('melempar error untuk ukuran tidak valid', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})
