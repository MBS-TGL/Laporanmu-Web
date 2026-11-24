import { describe, expect, it } from 'vitest'
import { findOrphanIds, formatDuration, pruneRuns, type AutomationRun } from './automation'

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

describe('pruneRuns', () => {
  const run = (startedAt: string): AutomationRun => ({
    id: startedAt,
    automationId: 'sync_stats',
    startedAt,
    durationMs: 10,
    ok: true,
    summary: 'ok',
  })

  it('membatasi jumlah entri ke maksimum', () => {
    const runs = Array.from({ length: 130 }, (_, i) => run(`2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`))
    expect(pruneRuns(runs, 100)).toHaveLength(100)
  })

  it('mengurutkan dari yang terbaru', () => {
    const result = pruneRuns([run('2026-01-01T00:00:00Z'), run('2026-02-01T00:00:00Z')])
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
