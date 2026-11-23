import { describe, expect, it } from 'vitest'
import { parseScoreBlock } from './pasteParse'

describe('parseScoreBlock', () => {
  it('membaca blok tab dan baris', () => {
    expect(parseScoreBlock('8\t7\n9\t6', 9)).toEqual([
      [8, 7],
      [9, 6],
    ])
  })

  it('melewati sel kosong tanpa menggeser posisi', () => {
    expect(parseScoreBlock('8\t\t9\n\n7\t6', 9)).toEqual([
      [8, null, 9],
      [null],
      [7, 6],
    ])
  })

  it('clamp nilai dan menerima desimal koma', () => {
    expect(parseScoreBlock('12,5\t-1\nabc\t8.25', 9)).toEqual([
      [9, 0],
      [null, 8.3],
    ])
  })

  it('membuang baris kosong di akhir', () => {
    expect(parseScoreBlock('7\t8\n', 9)).toEqual([[7, 8]])
  })
})
