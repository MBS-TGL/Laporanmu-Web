import { describe, expect, it } from 'vitest'
import {
  COMBINED_PRESETS,
  WORSHIP_CATEGORY_ORDER,
  WORSHIP_GRADE_PRESETS,
  WORSHIP_PRESETS,
  getCumulativeGradePresets,
  isItemApplicableForGrade,
  suppressCombinedPresets,
} from './presets'

describe('WORSHIP_PRESETS', () => {
  it('tiap kategori punya preset berlabel unik & tidak kosong', () => {
    for (const cat of WORSHIP_CATEGORY_ORDER) {
      const items = WORSHIP_PRESETS[cat]
      expect(items.length).toBeGreaterThan(0)
      expect(new Set(items).size).toBe(items.length)
      for (const label of items) {
        expect(label.trim().length).toBeGreaterThan(2)
      }
    }
  })

  it('urutan kategori mencakup semua key preset', () => {
    expect([...WORSHIP_CATEGORY_ORDER].sort()).toEqual(Object.keys(WORSHIP_PRESETS).sort())
  })

  it('isItemApplicableForGrade menyaring butir kelas di atas jenjang aktif', () => {
    // Materi Kelas 7
    expect(isItemApplicableForGrade('Arbain 1-3 (Kls 7)', 7)).toBe(true)
    expect(isItemApplicableForGrade('Arbain 1-3 (Kls 7)', 8)).toBe(true)
    expect(isItemApplicableForGrade('Arbain 1-3 (Kls 7)', 9)).toBe(true)

    // Materi Kelas 8 tidak boleh muncul di Kelas 7
    expect(isItemApplicableForGrade('Arbain 8-14 (Kls 8)', 7)).toBe(false)
    expect(isItemApplicableForGrade('Arbain 8-14 (Kls 8)', 8)).toBe(true)
    expect(isItemApplicableForGrade('Arbain 8-14 (Kls 8)', 9)).toBe(true)

    // Materi Range (Kls 10-12)
    expect(isItemApplicableForGrade('Hadist (Kls 10-12)', 9)).toBe(false)
    expect(isItemApplicableForGrade('Hadist (Kls 10-12)', 10)).toBe(true)
    expect(isItemApplicableForGrade('Hadist (Kls 10-12)', 11)).toBe(true)

    // Materi tanpa label kelas selalu aktif
    expect(isItemApplicableForGrade('Praktek Wudhu Sempurna', 7)).toBe(true)
  })

  it('getCumulativeGradePresets mengambil butir kumulatif hingga jenjang kelas aktif', () => {
    const kls7 = getCumulativeGradePresets('hafalan_hadist', 7)
    const kls8 = getCumulativeGradePresets('hafalan_hadist', 8)
    expect(kls7.length).toBeGreaterThan(0)
    expect(kls8.length).toBeGreaterThanOrEqual(kls7.length)
  })

  it('label antar daftar preset unik setelah strip penanda (Kls N) – cegah varian ganda', () => {
    const strip = (l: string) => l.replace(/\s*\(Kls\s+\d+(\s*-\s*\d+)?\)\s*$/i, '').trim()
    for (const cat of WORSHIP_CATEGORY_ORDER) {
      const all = [...WORSHIP_PRESETS[cat]]
      for (let g = 7; g <= 12; g++) all.push(...(WORSHIP_GRADE_PRESETS[g]?.[cat] ?? []))
      const byBase = new Map<string, Set<string>>()
      for (const l of all) {
        const b = strip(l)
        if (!byBase.has(b)) byBase.set(b, new Set())
        byBase.get(b)!.add(l)
      }
      for (const [base, variants] of byBase) {
        expect(variants.size, `${cat}: "${base}" punya varian label ${[...variants].join(' / ')}`).toBe(1)
      }
    }
  })

  it('semua komponen COMBINED_PRESETS terdefinisi di salah satu daftar preset', () => {
    for (const cat of WORSHIP_CATEGORY_ORDER) {
      const all = new Set(WORSHIP_PRESETS[cat])
      for (let g = 7; g <= 12; g++) {
        for (const l of WORSHIP_GRADE_PRESETS[g]?.[cat] ?? []) all.add(l)
      }
      for (const [combined, components] of Object.entries(COMBINED_PRESETS)) {
        if (!all.has(combined)) continue
        for (const c of components) {
          expect(all.has(c), `komponen "${c}" dari gabungan "${combined}" (${cat}) tidak ada di preset`).toBe(true)
        }
      }
    }
  })
})

describe('suppressCombinedPresets', () => {
  it('membuang butir gabungan saat semua komponen sudah ada di DB', () => {
    const out = suppressCombinedPresets(
      ['Dzikir Setelah Sholat & Pagi-Petang'],
      ['Dzikir Setelah Sholat', 'Dzikir Pagi dan Petang'],
    )
    expect(out).toEqual([])
  })

  it('mempertahankan gabungan bila satu komponen belum ada', () => {
    const out = suppressCombinedPresets(
      ['Dzikir Setelah Sholat & Pagi-Petang'],
      ['Dzikir Setelah Sholat'],
    )
    expect(out).toEqual(['Dzikir Setelah Sholat & Pagi-Petang'])
  })

  it('membuang gabungan saat komponennya berada di batch yang sama (DB kosong)', () => {
    const batch = [
      'Dzikir Setelah Sholat',
      'Dzikir Pagi dan Petang',
      'Dzikir Setelah Sholat & Pagi-Petang',
    ]
    expect(suppressCombinedPresets(batch, [])).toEqual([
      'Dzikir Setelah Sholat',
      'Dzikir Pagi dan Petang',
    ])
  })

  it('label non-gabungan tidak pernah disentuh', () => {
    const labels = ['Gerakan & Rukun Shalat Berjamaah', 'Sholat Jenazah & Sholat Khusyu']
    expect(suppressCombinedPresets(labels, [])).toEqual(labels)
  })

  it('case & spasi tidak mempengaruhi pencocokan komponen', () => {
    const out = suppressCombinedPresets(
      ['Doa Setelah Wudhu Sempurna'],
      ['  doa setelah wudhu (syahadat & taubat) '],
    )
    expect(out).toEqual([])
  })

  it('doa wudhu kelas 8 di-suppress bila padanan kelas 7 ada, dipertahankan bila belum', () => {
    expect(
      suppressCombinedPresets(['Doa Setelah Wudhu Sempurna'], ['Doa Setelah Wudhu (Syahadat & Taubat)']),
    ).toEqual([])
    expect(suppressCombinedPresets(['Doa Setelah Wudhu Sempurna'], [])).toEqual([
      'Doa Setelah Wudhu Sempurna',
    ])
  })
})

