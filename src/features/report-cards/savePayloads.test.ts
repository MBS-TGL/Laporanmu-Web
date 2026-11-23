import { describe, expect, it } from 'vitest'
import { mergeMonthlyRows, mergeSemesterRows } from './savePayloads'
import type {
  MonthlyReport,
  MonthlyReportPayload,
  SemesterReport,
  SemesterReportPayload,
} from './types'

function monthlyPayload(studentId: string, score: number): MonthlyReportPayload {
  return {
    student_id: studentId,
    month: 9,
    year: 2025,
    musyrif_name: 'Ust. A',
    character_score: score,
    worship_score: null,
    cleanliness_score: null,
    quran_score: null,
    language_score: null,
    weight_kg: null,
    height_cm: null,
    ziyadah: null,
    murojaah: null,
    total_hafalan: null,
    sholat: null,
    sick_days: 0,
    excused_days: 0,
    absent_days: 0,
    early_leave_days: 0,
    notes: null,
    violations: null,
    achievements: null,
    updated_by: 'user-1',
  }
}

function semesterPayload(studentId: string, score: number): SemesterReportPayload {
  return {
    student_id: studentId,
    report_type: 'general',
    semester: 1,
    academic_year_id: 'ay-1',
    scores: { matematika: score },
    extras: { notes: null },
    musyrif_name: 'Ust. A',
    updated_by: 'user-1',
  }
}

describe('mergeMonthlyRows', () => {
  it('mempertahankan baris lama, menambah baris baru, dan menimpa nilai hasil upsert', () => {
    const existing: MonthlyReport[] = [
      { id: 'row-1', ...monthlyPayload('s1', 5) },
    ]
    const result = mergeMonthlyRows(existing, [
      monthlyPayload('s1', 8),
      monthlyPayload('s2', 7),
    ])

    expect(result).toHaveLength(2)
    expect(result.find((row) => row.student_id === 's1')).toMatchObject({
      id: 'row-1',
      character_score: 8,
    })
    expect(result.find((row) => row.student_id === 's2')).toMatchObject({
      student_id: 's2',
      character_score: 7,
    })
  })

  it('aman saat cache belum berisi data', () => {
    const result = mergeMonthlyRows(undefined, [monthlyPayload('s1', 9)])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ student_id: 's1', character_score: 9 })
  })
})

describe('mergeSemesterRows', () => {
  it('menggabungkan skor hasil upsert dengan baris tersimpan', () => {
    const existing: SemesterReport[] = [
      { id: 'row-1', ...semesterPayload('s1', 80) },
    ]
    const result = mergeSemesterRows(existing, [
      semesterPayload('s1', 90),
      semesterPayload('s2', 70),
    ])

    expect(result).toHaveLength(2)
    expect(result.find((row) => row.student_id === 's1')).toMatchObject({
      id: 'row-1',
      scores: { matematika: 90 },
    })
    expect(result.find((row) => row.student_id === 's2')).toMatchObject({
      student_id: 's2',
      scores: { matematika: 70 },
    })
  })
})
