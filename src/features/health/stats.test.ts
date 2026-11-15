import { describe, expect, it } from 'vitest'
import {
  computeMedicineUsage,
  countByClass,
  countByStatus,
  countTodayVisits,
  countVisitsPerDay,
  filterHealthLogs,
  matchesPeriod,
  movingAverageDaily,
  pctDelta,
  shiftDate,
  topComplaintKeywords,
  topComplaintPhrases,
} from './stats'
import type { HealthLog } from './types'

const TODAY = '2026-11-11'

function log(partial: Partial<HealthLog>): HealthLog {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    date: TODAY,
    time: '08:00',
    student_id: 's1',
    student_name: 'Ahmad',
    class_name: '7A',
    complaint: 'demam',
    diagnosis: null,
    treatment: 'istirahat',
    medicine_id: null,
    medicine_name: null,
    medicine_qty: 0,
    status: 'Returned',
    ...partial,
  }
}

describe('shiftDate', () => {
  it('mundur & maju lintas bulan dengan aman', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDate('2026-11-11', 20)).toBe('2026-12-01')
    expect(shiftDate(TODAY, 0)).toBe(TODAY)
  })
})

describe('matchesPeriod', () => {
  it('today hanya mencocokkan hari yang sama', () => {
    expect(matchesPeriod(TODAY, 'today', TODAY)).toBe(true)
    expect(matchesPeriod('2026-11-10', 'today', TODAY)).toBe(false)
  })

  it('7d mencakup 7 hari terakhir termasuk hari ini', () => {
    expect(matchesPeriod('2026-11-05', '7d', TODAY)).toBe(true)
    expect(matchesPeriod('2026-11-04', '7d', TODAY)).toBe(false)
    expect(matchesPeriod(TODAY, '7d', TODAY)).toBe(true)
  })

  it('30d dan all', () => {
    expect(matchesPeriod('2026-10-13', '30d', TODAY)).toBe(true)
    expect(matchesPeriod('2026-10-12', '30d', TODAY)).toBe(false)
    expect(matchesPeriod('2020-01-01', 'all', TODAY)).toBe(true)
  })
})

describe('filterHealthLogs', () => {
  const logs = [
    log({ id: 'a', date: TODAY, complaint: 'demam tinggi', class_name: '7A', status: 'UKS' }),
    log({ id: 'b', date: '2026-11-01', complaint: 'sakit perut', class_name: '8B', status: 'Dormitory' }),
    log({ id: 'c', date: '2026-09-15', complaint: 'flu', class_name: '7A', status: 'Returned' }),
  ]

  const base = { search: '', period: 'all', status: 'all', className: 'all' } as const

  it('filter kombinasi periode + status + kelas', () => {
    expect(filterHealthLogs(logs, { ...base, period: 'today' }, TODAY).map((l) => l.id)).toEqual(['a'])
    expect(
      filterHealthLogs(logs, { ...base, status: 'UKS', className: '7A' }, TODAY).map((l) => l.id),
    ).toEqual(['a'])
    expect(filterHealthLogs(logs, { ...base, period: '30d' }, TODAY).map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('pencarian menyentuh semua kolom teks', () => {
    expect(filterHealthLogs(logs, { ...base, search: 'perut' }, TODAY).map((l) => l.id)).toEqual(['b'])
    expect(filterHealthLogs(logs, { ...base, search: '8B' }, TODAY).map((l) => l.id)).toEqual(['b'])
    expect(filterHealthLogs(logs, { ...base, search: 'istiraHat' }, TODAY)).toHaveLength(3)
  })
})

describe('countVisitsPerDay', () => {
  it('zero-fill hari kosong dan urut naik', () => {
    const logs = [log({ date: TODAY }), log({ date: TODAY }), log({ date: '2026-11-09' })]
    const result = countVisitsPerDay(logs, 5, TODAY)
    expect(result).toHaveLength(5)
    expect(result.map((r) => r.count)).toEqual([0, 0, 1, 0, 2])
    expect(result[4].date).toBe(TODAY)
  })
})

describe('countTodayVisits / countByClass / countByStatus', () => {
  const logs = [
    log({ id: 'a', class_name: '7A', status: 'UKS' }),
    log({ id: 'b', class_name: '7A', status: 'Returned' }),
    log({ id: 'c', class_name: null, status: 'UKS' }),
  ]

  it('menghitung kunjungan hari ini', () => {
    expect(countTodayVisits(logs, TODAY)).toBe(3)
    expect(countTodayVisits(logs, '2026-01-01')).toBe(0)
  })

  it('kelas null masuk kelompok Tanpa Kelas', () => {
    expect(countByClass(logs)).toEqual([
      { label: '7A', count: 2 },
      { label: 'Tanpa Kelas', count: 1 },
    ])
  })

  it('rekap status', () => {
    expect(countByStatus(logs)).toEqual([
      { status: 'UKS', count: 2 },
      { status: 'Returned', count: 1 },
    ])
  })
})

describe('topComplaintKeywords / topComplaintPhrases', () => {
  const logs = [
    log({ complaint: 'Sakit kepala sejak pagi' }),
    log({ complaint: 'sakit perut' }),
    log({ complaint: 'Sakit Gigi!' }),
    log({ complaint: 'demam tinggi' }),
    log({ complaint: 'masih demam' }),
    log({ complaint: 'unik sekali' }),
  ]

  it('kata kunci mengabaikan stopword & tanda baca', () => {
    const top = topComplaintKeywords(logs, 5)
    expect(top[0]).toEqual({ label: 'sakit', count: 3 })
    expect(top.slice(1).map((t) => t.label)).toEqual(['demam', 'gigi', 'kepala', 'pagi'])
    expect(top.some((t) => t.label === 'masih' || t.label === 'sejak')).toBe(false)
  })

  it('frasa utuh hanya yang muncul ≥2 kali (dinormalisasi)', () => {
    const repeated = [
      ...logs,
      log({ complaint: 'Demam Tinggi' }),
      log({ complaint: 'Sakit Perut  ' }),
    ]
    const phrases = topComplaintPhrases(repeated, 5)
    expect(phrases).toEqual([
      { label: 'demam tinggi', count: 2 },
      { label: 'sakit perut', count: 2 },
    ])
  })
})

describe('computeMedicineUsage', () => {
  it('menjumlah qty per obat dalam 30 hari terakhir', () => {
    const logs = [
      log({ medicine_id: 'm1', medicine_qty: 2, date: TODAY }),
      log({ medicine_id: 'm1', medicine_qty: 1, date: '2026-11-01' }),
      log({ medicine_id: 'm2', medicine_qty: 3, date: '2026-10-20' }),
      log({ medicine_id: 'm3', medicine_qty: 5, date: '2026-09-01' }),
      log({ medicine_qty: 4, date: TODAY }),
    ]
    const usage = computeMedicineUsage(logs, 30, TODAY)
    expect(usage.get('m1')).toBe(3)
    expect(usage.get('m2')).toBe(3)
    expect(usage.has('m3')).toBe(false)
    expect(usage.size).toBe(2)
  })
})

describe('movingAverageDaily', () => {
  it('null di awal sampai window terpenuhi, lalu rata-rata bergerak', () => {
    const counts = countVisitsPerDay(
      [log({ date: '2026-11-07' }), log({ date: '2026-11-09' }), log({ date: '2026-11-11' }), log({ date: '2026-11-11' })],
      5,
      TODAY,
    )
    // 7..11 Nov: 1,0,1,0,2 → rata-rata dibulatkan 1 desimal
    expect(movingAverageDaily(counts, 3)).toEqual([null, null, 0.7, 0.3, 1])
  })

  it('window 1 = deret asli', () => {
    const counts = countVisitsPerDay([], 3, TODAY)
    expect(movingAverageDaily(counts, 1)).toEqual([0, 0, 0])
  })
})

describe('pctDelta', () => {
  it('menghitung persen perubahan bulat', () => {
    expect(pctDelta(12, 10)).toBe(20)
    expect(pctDelta(8, 10)).toBe(-20)
    expect(pctDelta(0, 4)).toBe(-100)
  })

  it('null bila baseline 0', () => {
    expect(pctDelta(0, 0)).toBeNull()
    expect(pctDelta(5, 0)).toBeNull()
  })
})
