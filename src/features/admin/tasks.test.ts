import { describe, expect, it } from 'vitest'
import {
  chunk,
  cutoffIso,
  findOrphanIds,
  formatDuration,
  pruneLogs,
  type TaskRunLog,
} from './tasks'

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

describe('findOrphanIds', () => {
  const valid = new Set(['a', 'b'])

  it('mengembalikan id yang tidak ada di parent', () => {
    expect(findOrphanIds(['a', 'x', 'b', 'y'], valid)).toEqual(['x', 'y'])
  })

  it('mengabaikan null dan undefined', () => {
    expect(findOrphanIds([null, undefined, 'a'], valid)).toEqual([])
  })

  it('hasil unik meski duplikat', () => {
    expect(findOrphanIds(['x', 'x', 'x'], valid)).toEqual(['x'])
  })
})

describe('cutoffIso', () => {
  it('mengurangi tanggal sesuai jumlah hari', () => {
    const now = new Date('2026-11-09T10:00:00.000Z')
    expect(cutoffIso(45, now)).toBe('2026-09-25T10:00:00.000Z')
  })

  it('memotong ke ISO string', () => {
    expect(cutoffIso(1, new Date('2026-01-01T00:00:00.000Z'))).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('pruneLogs', () => {
  const log = (startedAt: string): TaskRunLog => ({
    id: startedAt,
    taskId: 'sync_stats',
    startedAt,
    durationMs: 10,
    ok: true,
    summary: 'ok',
  })

  it('membatasi jumlah entri ke maksimum', () => {
    const logs = Array.from({ length: 130 }, (_, i) => log(`2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`))
    expect(pruneLogs(logs, 100)).toHaveLength(100)
  })

  it('mengurutkan dari yang terbaru', () => {
    const result = pruneLogs([log('2026-01-01T00:00:00Z'), log('2026-02-01T00:00:00Z')])
    expect(result[0].startedAt).toBe('2026-02-01T00:00:00Z')
  })
})

describe('formatDuration', () => {
  it('di bawah 1 detik pakai ms', () => {
    expect(formatDuration(850)).toBe('850 ms')
  })

  it('detik bulat', () => {
    expect(formatDuration(5000)).toBe('5 dtk')
  })

  it('gabungan menit dan detik', () => {
    expect(formatDuration(65000)).toBe('1 mnt 5 dtk')
  })

  it('menit bulat tanpa detik', () => {
    expect(formatDuration(120000)).toBe('2 mnt')
  })
})
