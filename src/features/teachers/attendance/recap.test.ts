import { describe, expect, it } from 'vitest'
import { buildTeacherRecap, isAttention, monthRange } from './recap'
import type { TeacherAttendance } from './types'

const row = (teacher_id: string, date: string, status: TeacherAttendance['status']): TeacherAttendance =>
  ({ id: `${teacher_id}-${date}`, teacher_id, date, status, note: null, created_by: null, created_at: '', updated_at: '' })

describe('monthRange', () => {
  it('mengembalikan awal & akhir bulan', () => {
    expect(monthRange(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange(2026, 2)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('menangani tahun kabisat', () => {
    expect(monthRange(2028, 2).to).toBe('2028-02-29')
  })
})

describe('buildTeacherRecap', () => {
  it('mengagregasi per guru: H/S/I/T, tercatat, dan persen hadir', () => {
    const rows = [
      row('g1', '2026-11-01', 'hadir'),
      row('g1', '2026-11-02', 'hadir'),
      row('g1', '2026-11-03', 'hadir'),
      row('g1', '2026-11-04', 'sakit'),
      row('g2', '2026-11-01', 'hadir'),
      row('g2', '2026-11-02', 'izin'),
      row('g2', '2026-11-03', 'tugas_luar'),
    ]
    const recap = buildTeacherRecap(rows)

    const g1 = recap.entries.get('g1')
    expect(g1).toMatchObject({ hadir: 3, sakit: 1, izin: 0, tugasLuar: 0, recorded: 4, pct: 75 })

    const g2 = recap.entries.get('g2')
    expect(g2).toMatchObject({ hadir: 1, sakit: 0, izin: 1, tugasLuar: 1, recorded: 3, pct: 33 })

    expect(recap.totals).toEqual({ hadir: 4, sakit: 1, izin: 1, tugasLuar: 1, recorded: 7 })
    expect(recap.minDate).toBe('2026-11-01')
    expect(recap.maxDate).toBe('2026-11-04')
  })

  it('mengembalikan totals nol untuk data kosong', () => {
    const recap = buildTeacherRecap([])
    expect(recap.entries.size).toBe(0)
    expect(recap.totals.recorded).toBe(0)
    expect(recap.minDate).toBe(null)
    expect(recap.maxDate).toBe(null)
  })

  it('baris dengan status tak dikenal tetap dihitung tercatat', () => {
    const rows = [row('g1', '2026-11-01', 'hadir'), { ...row('g1', '2026-11-02', 'hadir'), status: 'aneh' as never }]
    const recap = buildTeacherRecap(rows)
    expect(recap.entries.get('g1')?.recorded).toBe(2)
    expect(recap.entries.get('g1')?.hadir).toBe(1)
    expect(recap.totals.recorded).toBe(2)
  })
})

describe('isAttention', () => {
  it('true bila sakit+izin minimal 3 hari', () => {
    expect(isAttention({ teacherId: 'g', hadir: 0, sakit: 2, izin: 1, tugasLuar: 0, recorded: 3, pct: 0 })).toBe(true)
    expect(isAttention({ teacherId: 'g', hadir: 0, sakit: 2, izin: 0, tugasLuar: 5, recorded: 7, pct: 0 })).toBe(false)
  })
})
