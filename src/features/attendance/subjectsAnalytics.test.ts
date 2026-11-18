import { describe, expect, it } from 'vitest'
import { earlyWarning, heatmapBySubject, weekStartOf, weeklyTrend } from './subjectsAnalytics'
import type { SubjectAttendanceEntry } from './api'

const entry = (over: Partial<SubjectAttendanceEntry>): SubjectAttendanceEntry => ({
  student_id: 's1',
  schedule_id: 'sc1',
  date: '2026-11-09',
  status: 'H',
  subject: 'Matematika',
  ...over,
})

describe('weeklyTrend', () => {
  it('mengelompokkan per minggu ISO (Senin) dan menghitung % hadir', () => {
    const rows = [
      entry({ date: '2026-11-09', status: 'H' }), // Senin
      entry({ date: '2026-11-10', status: 'A' }),
      entry({ date: '2026-11-15', status: 'H' }), // Minggu → minggu mulai 09-11
      entry({ date: '2026-11-16', status: 'H' }), // Senin berikutnya
    ]
    const trend = weeklyTrend(rows)
    expect(trend).toEqual([
      { weekStart: '2026-11-09', hadir: 2, total: 3, pct: 67 },
      { weekStart: '2026-11-16', hadir: 1, total: 1, pct: 100 },
    ])
  })

  it('weekStartOf mingguan: Minggu mundur ke Senin', () => {
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09')
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09')
  })
})

describe('heatmapBySubject', () => {
  it('rekap status per mapel, % terendah di atas', () => {
    const rows = [
      entry({ subject: 'Matematika', status: 'H' }),
      entry({ subject: 'Matematika', status: 'A' }),
      entry({ subject: 'B. Arab', status: 'H' }),
      entry({ subject: 'B. Arab', status: 'S' }),
      entry({ subject: null, status: 'I' }),
    ]
    const heat = heatmapBySubject(rows)
    expect(heat.map((r) => r.subject)).toEqual(['Tanpa Mapel', 'Matematika', 'B. Arab'])
    // Tanpa Mapel (0% hadir) di atas; Matematika & B. Arab tie 50% → total 2 sama
    expect(heat[0]).toMatchObject({ hadir: 0, izin: 1, total: 1, pct: 0 })
    expect(heat[1]).toMatchObject({ hadir: 1, alpa: 1, total: 2, pct: 50 })
    expect(heat[2]).toMatchObject({ hadir: 1, sakit: 1, total: 2, pct: 50 })
  })
})

describe('earlyWarning', () => {
  it('hanya santri dengan alpa >= ambang, urut terbanyak', () => {
    const rows = [
      entry({ student_id: 'a', status: 'A' }),
      entry({ student_id: 'a', status: 'A' }),
      entry({ student_id: 'a', status: 'A' }),
      entry({ student_id: 'b', status: 'A' }),
      entry({ student_id: 'b', status: 'A' }),
      entry({ student_id: 'c', status: 'H' }),
    ]
    expect(earlyWarning(rows, 3)).toEqual([
      { studentId: 'a', alpa: 3, total: 3 },
    ])
    expect(earlyWarning(rows, 2)).toEqual([
      { studentId: 'a', alpa: 3, total: 3 },
      { studentId: 'b', alpa: 2, total: 2 },
    ])
  })
})
