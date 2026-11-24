import { describe, expect, it } from 'vitest'
import {
  AI_CACHE_KEY,
  AI_CACHE_TTL_MS,
  getCachedAnswer,
  isCacheableQuestion,
  normalizeCacheKey,
  setCachedAnswer,
  type CacheStorage,
} from './aiCache'
import type { AiSource } from './aiKnowledge'

function createStorage(): CacheStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

const source: AiSource = {
  id: 'poin-santri',
  title: 'Poin Santri',
  route: '/discipline',
}

describe('aiCache', () => {
  it('menormalkan kunci pertanyaan', () => {
    expect(normalizeCacheKey('  Apa ITU poin santri? ')).toBe('apa itu poin santri')
  })

  it('menyimpan dan membaca jawaban', () => {
    const storage = createStorage()
    setCachedAnswer(
      'Apa itu poin santri?',
      { text: 'Poin dari pelanggaran dan prestasi.', sources: [source] },
      { storage, now: 1_000 },
    )

    expect(getCachedAnswer('apa itu poin santri', { storage, now: 2_000 })).toEqual({
      text: 'Poin dari pelanggaran dan prestasi.',
      sources: [source],
    })
  })

  it('memisahkan cache antar role', () => {
    const storage = createStorage()
    setCachedAnswer(
      'Buka administrasi',
      { text: 'Menu khusus admin.', sources: [] },
      { storage, scope: 'admin', now: 1_000 },
    )

    expect(getCachedAnswer('Buka administrasi', { storage, scope: 'teacher', now: 2_000 })).toBeNull()
    expect(getCachedAnswer('Buka administrasi', { storage, scope: 'admin', now: 2_000 })).not.toBeNull()
  })

  it('mengabaikan entri kedaluwarsa', () => {
    const storage = createStorage()
    setCachedAnswer(
      'Apa itu poin santri?',
      { text: 'Poin dari pelanggaran dan prestasi.', sources: [] },
      { storage, now: 1_000 },
    )

    expect(
      getCachedAnswer('Apa itu poin santri?', {
        storage,
        now: 1_000 + AI_CACHE_TTL_MS + 1,
      }),
    ).toBeNull()
  })

  it('tidak melempar saat storage gagal', () => {
    const broken: CacheStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }

    expect(() =>
      setCachedAnswer('Apa itu poin santri?', { text: 'Poin.', sources: [] }, { storage: broken }),
    ).not.toThrow()
    expect(getCachedAnswer('Apa itu poin santri?', { storage: broken })).toBeNull()
  })

  it('mengabaikan isi storage yang rusak', () => {
    const storage = createStorage()
    storage.setItem(AI_CACHE_KEY, '{rusak')
    expect(getCachedAnswer('Apa itu poin santri?', { storage })).toBeNull()
  })

  it('hanya cache pertanyaan yang punya knowledge atau saran', () => {
    expect(isCacheableQuestion('Apa itu poin santri?', 1, 0)).toBe(true)
    expect(isCacheableQuestion('Apa itu poin santri?', 0, 0)).toBe(false)
    expect(isCacheableQuestion('Jelaskan lebih lanjut', 1, 2)).toBe(false)
    expect(isCacheableQuestion('Jelaskan lebih lanjut', 1, 2, true)).toBe(true)
  })
})
