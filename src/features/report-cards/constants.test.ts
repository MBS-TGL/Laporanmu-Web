import { describe, expect, it } from 'vitest'
import {
  ORAL_TAHFIDZ_JUZ,
  PONDOK_ORAL_CRITERIA_BY_GRADE,
  PONDOK_ORAL_CRITERIA_REGULAR_BY_GRADE,
  calcAverage,
  getCriteria,
  getOralProgram,
  isComplete,
  isPracticalKey,
  isTahfidzKey,
} from './constants'
import { buildSemesterPayload, semesterHasContent } from './savePayloads'
import type { SemesterReport } from './types'

const GRADES = [7, 8, 9, 10, 11, 12]

function scoresFor(
  criteria: { key: string }[],
  fill: (key: string) => number | null,
): Record<string, number | null> {
  const scores: Record<string, number | null> = {}
  for (const criterion of criteria) scores[criterion.key] = fill(criterion.key)
  return scores
}

describe('getOralProgram', () => {
  it('mengenali kelas reguler dari nama', () => {
    expect(getOralProgram('VII-A Reguler')).toBe('regular')
    expect(getOralProgram('Regular 8B')).toBe('regular')
    expect(getOralProgram('7A')).toBe('boarding')
    expect(getOralProgram('Boarding IX-C')).toBe('boarding')
    expect(getOralProgram(null)).toBe('boarding')
    expect(getOralProgram(undefined)).toBe('boarding')
  })
})

describe('kriteria lisan per program', () => {
  it('boarding punya 12 aspek non-praktik (7 materi + 5 juz) untuk semua tingkat', () => {
    for (const grade of GRADES) {
      const criteria = getCriteria('pondok_oral', String(grade), `${grade}A Boarding`)
      const nonPractical = criteria.filter((c) => !isPracticalKey(c.key))
      expect(nonPractical).toHaveLength(12)
      expect(criteria.map((c) => c.key)).toContain('tuhfatul_athfal')
    }
  })

  it('reguler punya 11 aspek non-praktik (6 materi + 5 juz) untuk semua tingkat', () => {
    for (const grade of GRADES) {
      const criteria = getCriteria('pondok_oral', String(grade), `${grade}A Reguler`)
      const nonPractical = criteria.filter((c) => !isPracticalKey(c.key))
      expect(nonPractical).toHaveLength(11)
      expect(criteria.map((c) => c.key)).not.toContain('tuhfatul_athfal')
    }
  })

  it('5 baris Juz 30-26 selalu ada dan berurutan dari awal', () => {
    for (const grade of GRADES) {
      for (const className of [`${grade}A`, `${grade}A Reguler`]) {
        const juzKeys = getCriteria('pondok_oral', String(grade), className)
          .filter((c) => isTahfidzKey(c.key))
          .map((c) => c.key)
        expect(juzKeys).toEqual(ORAL_TAHFIDZ_JUZ.map((juz) => `tahfidz_juz_${juz}`))
      }
    }
  })

  it('praktik ada di tingkat 7-9 dan tidak ada di 10-12', () => {
    for (const grade of [7, 8, 9]) {
      const practical = getCriteria('pondok_oral', String(grade), `${grade}A`).filter((c) =>
        isPracticalKey(c.key),
      )
      expect(practical).toHaveLength(1)
    }
    for (const grade of [10, 11, 12]) {
      const practical = getCriteria('pondok_oral', String(grade), `${grade}A`).filter((c) =>
        isPracticalKey(c.key),
      )
      expect(practical).toHaveLength(0)
    }
  })

  it('peta statis per program konsisten dengan getCriteria', () => {
    expect(PONDOK_ORAL_CRITERIA_BY_GRADE[7].filter((c) => !isPracticalKey(c.key))).toHaveLength(12)
    expect(PONDOK_ORAL_CRITERIA_REGULAR_BY_GRADE[7].filter((c) => !isPracticalKey(c.key))).toHaveLength(11)
  })
})

describe('isComplete lisan', () => {
  const criteria = getCriteria('pondok_oral', '7', '7A Boarding')
  const allFilled = (key: string) => (isTahfidzKey(key) || isPracticalKey(key) ? 80 : 85)

  it('materi + praktik + juz penuh = Lengkap', () => {
    expect(isComplete('pondok_oral', scoresFor(criteria, allFilled), '7', '7A Boarding')).toBe(true)
  })

  it('berhenti di celah pertama (baru Juz 30-29) tetap Lengkap', () => {
    const scores = scoresFor(criteria, (key) => {
      if (key === 'tahfidz_juz_30' || key === 'tahfidz_juz_29') return 80
      if (isTahfidzKey(key)) return null
      return allFilled(key)
    })
    expect(isComplete('pondok_oral', scores, '7', '7A Boarding')).toBe(true)
  })

  it('bolong (isi setelah celah) belum Lengkap', () => {
    const scores = scoresFor(criteria, (key) => {
      if (key === 'tahfidz_juz_30') return 80
      if (key === 'tahfidz_juz_28' || key === 'tahfidz_juz_27' || key === 'tahfidz_juz_26') return 80
      if (isTahfidzKey(key)) return null
      return allFilled(key)
    })
    expect(isComplete('pondok_oral', scores, '7', '7A Boarding')).toBe(false)
  })

  it('praktik wajib untuk status Lengkap', () => {
    const scores = scoresFor(criteria, allFilled)
    scores['wudhu_practice'] = null
    expect(isComplete('pondok_oral', scores, '7', '7A Boarding')).toBe(false)
  })

  it('materi wajib untuk status Lengkap', () => {
    const scores = scoresFor(criteria, allFilled)
    scores['wafa'] = null
    expect(isComplete('pondok_oral', scores, '7', '7A Boarding')).toBe(false)
  })

  it('membaca nilai legacy (key lama) tanpa dianggap kosong', () => {
    const scores = scoresFor(criteria, allFilled)
    delete scores['daily_prayers']
    scores['doa'] = 85
    expect(isComplete('pondok_oral', scores, '7', '7A Boarding')).toBe(true)
  })
})

describe('calcAverage', () => {
  it('mengecualikan materi praktik', () => {
    const criteria = getCriteria('pondok_oral', '7', '7A Boarding')
    const scores = scoresFor(criteria, (key) => (isPracticalKey(key) ? 100 : 80))
    expect(calcAverage('pondok_oral', scores, '7', '7A Boarding')).toBe(80)
  })

  it('membaca key legacy dan membulatkan 2 desimal', () => {
    const criteria = getCriteria('pondok_oral', '7', '7A Boarding')
    const scores = scoresFor(criteria, (key) => (isTahfidzKey(key) || isPracticalKey(key) ? 80 : 85))
    delete scores['daily_prayers']
    scores['doa'] = 85
    // 7 materi @85 + 5 juz @80 = 995 / 12 = 82.9166...
    expect(calcAverage('pondok_oral', scores, '7', '7A Boarding')).toBe(82.92)
  })

  it('reguler menghitung 11 aspek non-praktik (tanpa Tuhfatul)', () => {
    const criteria = getCriteria('pondok_oral', '7', '7A Reguler')
    expect(criteria.filter((c) => !isPracticalKey(c.key))).toHaveLength(11)
    const scores = scoresFor(criteria, () => 90)
    expect(calcAverage('pondok_oral', scores, '7', '7A Reguler')).toBe(90)
  })
})

describe('hafalan_note', () => {
  const saved: SemesterReport = {
    id: 'r1',
    student_id: 's1',
    report_type: 'pondok_oral',
    semester: 1,
    academic_year_id: 'ay1',
    scores: { wafa: 80 },
    extras: {},
    musyrif_name: null,
  }

  it('tersimpan ke extras dan terbaca semesterHasContent', () => {
    const payload = buildSemesterPayload({
      studentId: 's1',
      draft: { scores: {}, hafalan_note: 'Juz 30–25, 1–5' },
      saved,
      reportType: 'pondok_oral',
      semester: 1,
      academicYearId: 'ay1',
      musyrifName: null,
      updatedBy: null,
    })
    expect(payload?.extras.hafalan_note).toBe('Juz 30–25, 1–5')
    expect(semesterHasContent({}, { hafalan_note: 'Juz 30' })).toBe(true)
    expect(semesterHasContent({}, {})).toBe(false)
  })

  it('draf mengalahkan nilai tersimpan, dan nilai tersimpan bertahan saat draf kosong', () => {
    const withSaved = buildSemesterPayload({
      studentId: 's1',
      draft: { scores: {} },
      saved: { ...saved, extras: { hafalan_note: 'Juz 30–26' } },
      reportType: 'pondok_oral',
      semester: 1,
      academicYearId: 'ay1',
      musyrifName: null,
      updatedBy: null,
    })
    expect(withSaved?.extras.hafalan_note).toBe('Juz 30–26')

    const cleared = buildSemesterPayload({
      studentId: 's1',
      draft: { scores: {}, hafalan_note: '' },
      saved: { ...saved, extras: { hafalan_note: 'Juz 30–26' } },
      reportType: 'pondok_oral',
      semester: 1,
      academicYearId: 'ay1',
      musyrifName: null,
      updatedBy: null,
    })
    expect(cleared?.extras.hafalan_note).toBe('')
  })
})
