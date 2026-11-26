import { describe, expect, it } from 'vitest'
import {
  buildReportNumber,
  getYearDisplay,
  toPrintMonthly,
  toPrintSemester,
  toPrintSettings,
} from './adapters'
import { toArabicNum } from './labels'
import { getGradePredicate } from './predicates'
import { translitClassToAr, translitToAr } from './translit'
import type { MonthlyReport, SemesterReport, SchoolSettings } from '../types'

const monthlyRow: MonthlyReport = {
  id: 'r1',
  student_id: 's1',
  month: 11,
  year: 2026,
  character_score: 9,
  worship_score: 8,
  cleanliness_score: 7,
  quran_score: null,
  language_score: 6,
  weight_kg: 45,
  height_cm: 150,
  ziyadah: '1 Halaman',
  murojaah: '2 Juz',
  total_hafalan: '3 Juz',
  sholat: 'Berjamaah',
  sick_days: 1,
  excused_days: 2,
  absent_days: 0,
  early_leave_days: 1,
  notes: 'Baik',
  violations: null,
  achievements: 'Juara',
  musyrif_name: 'Ust. A',
}

describe('toPrintMonthly', () => {
  it('memetakan skor bulanan ke key v1 dan extras ke seksi cetak', () => {
    const result = toPrintMonthly(monthlyRow)
    expect(result.scores).toEqual({
      nilai_akhlak: 9,
      nilai_ibadah: 8,
      nilai_kebersihan: 7,
      nilai_quran: null,
      nilai_bahasa: 6,
    })
    expect(result.extra).toMatchObject({
      berat_badan: 45,
      tinggi_badan: 150,
      hari_sakit: 1,
      hari_izin: 2,
      hari_alpa: 0,
      hari_pulang: 1,
      catatan: 'Baik',
      prestasi: 'Juara',
      ziyadah: '1 Halaman',
    })
  })

  it('aman untuk baris kosong', () => {
    expect(toPrintMonthly(null)).toEqual({ scores: {}, extra: {} })
  })
})

describe('toPrintSemester', () => {
  it('memetakan scores dan extras semester', () => {
    const row: SemesterReport = {
      id: 'r1',
      student_id: 's1',
      report_type: 'general',
      semester: 1,
      academic_year_id: 'ay1',
      scores: { matematika: 88 },
      extras: { weight_kg: 50, height_cm: 160, sick_days: 2, notes: 'Mantap' },
      musyrif_name: null,
    }
    const result = toPrintSemester(row)
    expect(result.scores).toEqual({ matematika: 88 })
    expect(result.extra).toMatchObject({
      berat_badan: 50,
      tinggi_badan: 160,
      hari_sakit: 2,
      catatan: 'Mantap',
    })
  })
})

describe('buildReportNumber', () => {
  it('memakai prefix, kelas pendek, bulan, dan urut 3 digit', () => {
    expect(
      buildReportNumber({
        prefix: 'RPT',
        className: '11 A',
        reportType: 'bulanan',
        month: 11,
        year: 2026,
        semester: 1,
        studentIndex: 7,
      }),
    ).toBe('RPT/11A/NOVEMBER2026/007')
  })

  it('memakai token semester untuk raport semester', () => {
    expect(
      buildReportNumber({
        prefix: 'RPT',
        className: '7B',
        reportType: 'pondok_lisan',
        month: 1,
        year: 2026,
        semester: 2,
        studentIndex: 12,
      }),
    ).toBe('RPT/7B/SEM2/012')
  })
})

describe('toPrintSettings', () => {
  it('memakai fallback kop MBS saat kolom baru masih kosong', () => {
    const settings = { school_name: 'MBS Tanggul' } as SchoolSettings
    const result = toPrintSettings(settings)
    expect(result.school_name_id).toBe('MBS Tanggul')
    expect(result.school_name_ar).toContain('محمدية')
    expect(result.report_color_primary).toBe('#1a5c35')
  })

  it('menghormati kolom baru bila tersedia', () => {
    const result = toPrintSettings({
      school_name: 'MBS',
      school_name_ar: 'معهد الاختبار',
      report_color_primary: '#123456',
      logo_url: '/logos/custom.png',
    } as SchoolSettings)
    expect(result.school_name_ar).toBe('معهد الاختبار')
    expect(result.report_color_primary).toBe('#123456')
    expect(result.logo_url).toBe('/logos/custom.png')
  })
})

describe('helper cetak', () => {
  it('toArabicNum mengganti digit', () => {
    expect(toArabicNum('2026')).toBe('٢٠٢٦')
  })

  it('translit nama dan kelas', () => {
    expect(translitToAr('Muhammad Ahmad')).toContain('محمد')
    expect(translitToAr('Khoirul Anwar, S.Pd.')).not.toContain('فد')
    expect(translitClassToAr('7A')).toBe('السابع أ')
    expect(translitClassToAr('7 Putra')).toContain('بنين')
    expect(translitClassToAr('8 Putri')).toContain('بنات')
  })

  it('predikat bulanan mengikuti skala 1-9', () => {
    expect(getGradePredicate(9, 'bulanan').id).toBe('Sangat Baik')
    expect(getGradePredicate(7, 'bulanan').id).toBe('Cukup')
    expect(getGradePredicate(null, 'bulanan').id).toBe('—')
  })

  it('tahun ajaran mengikuti bulan Juli', () => {
    expect(getYearDisplay(11, 2026, 'id', '')).toBe('2026 – 2027')
    expect(getYearDisplay(3, 2026, 'id', '')).toBe('2025 – 2026')
    expect(getYearDisplay(3, 2026, 'id', '2025/2026')).toBe('2025/2026')
    expect(getYearDisplay(3, 2026, 'id', '2026 - 2027 (Ganjil)')).toBe('2026 - 2027')
    expect(getYearDisplay(3, 2026, 'id', '2026/2027 Genap')).toBe('2026/2027')
  })
})
