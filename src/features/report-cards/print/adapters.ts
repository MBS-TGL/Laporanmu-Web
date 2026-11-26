import { ORAL_LEGACY_KEY_MAP } from '../constants'
import type {
  MonthlyReport,
  ReportCardStudent,
  SchoolSettings,
  SemesterReport,
} from '../types'
import { MONTH_NAMES, toArabicNum, type ReportLabels } from './labels'
import type { V1ReportType } from './predicates'
import { translitToAr } from './translit'

export interface PrintStudent {
  id: string
  name: string
  nameAr: string
  room: string
  guardian: string
  registrationCode: string
}

export type PrintValue = string | number | null | undefined

export interface PrintExtra {
  berat_badan?: number | null
  tinggi_badan?: number | null
  ziyadah?: string | null
  murojaah?: string | null
  total_hafalan?: string | null
  hari_sakit?: number | null
  hari_izin?: number | null
  hari_alpa?: number | null
  hari_pulang?: number | null
  catatan?: string | null
  pelanggaran?: string | null
  prestasi?: string | null
  sholat?: string | null
  [key: string]: PrintValue
}

export interface PrintSettings {
  school_name_ar: string
  school_subtitle_ar: string
  school_name_id: string
  school_address_line1: string
  school_address_line2: string
  logo_url: string
  headmaster_name_id: string
  headmaster_name_ar: string
  headmaster_title_id: string
  headmaster_title_ar: string
  pengasuh_name_id: string
  pengasuh_name_ar: string
  report_color_primary: string
  report_color_secondary: string
  report_labels: Partial<ReportLabels>
  app_domain: string
}

type SchoolSettingsExtra = SchoolSettings & {
  school_name_ar?: string | null
  school_subtitle_ar?: string | null
  school_address_line1?: string | null
  school_address_line2?: string | null
  logo_url?: string | null
  headmaster_name_id?: string | null
  headmaster_name_ar?: string | null
  headmaster_title_id?: string | null
  headmaster_title_ar?: string | null
  pengasuh_name_id?: string | null
  pengasuh_name_ar?: string | null
  report_color_primary?: string | null
  report_color_secondary?: string | null
  report_labels?: Partial<ReportLabels> | null
  app_domain?: string | null
}

export interface PrintPayload {
  scores: Record<string, number | null>
  extra: PrintExtra
}

export function toPrintMonthly(row: MonthlyReport | null): PrintPayload {
  if (!row) return { scores: {}, extra: {} }
  return {
    scores: {
      nilai_akhlak: row.character_score,
      nilai_ibadah: row.worship_score,
      nilai_kebersihan: row.cleanliness_score,
      nilai_quran: row.quran_score,
      nilai_bahasa: row.language_score,
    },
    extra: {
      berat_badan: row.weight_kg,
      tinggi_badan: row.height_cm,
      ziyadah: row.ziyadah,
      murojaah: row.murojaah,
      total_hafalan: row.total_hafalan,
      hari_sakit: row.sick_days,
      hari_izin: row.excused_days,
      hari_alpa: row.absent_days,
      hari_pulang: row.early_leave_days,
      catatan: row.notes,
      pelanggaran: row.violations,
      prestasi: row.achievements,
      sholat: row.sholat,
    },
  }
}

export function toPrintSemester(row: SemesterReport | null): PrintPayload {
  if (!row) return { scores: {}, extra: {} }
  // Normalisasi key legacy (data lama masih memakai nama kolom sebelumnya)
  const raw = row.scores ?? {}
  const scores: Record<string, number | null> = { ...raw }
  for (const [legacy, modern] of Object.entries(ORAL_LEGACY_KEY_MAP)) {
    if (typeof raw[legacy] === 'number' && typeof raw[modern] !== 'number') {
      scores[modern] = raw[legacy]
    }
  }
  return {
    scores,
    extra: {
      berat_badan: row.extras?.weight_kg ?? null,
      tinggi_badan: row.extras?.height_cm ?? null,
      hari_sakit: row.extras?.sick_days ?? 0,
      hari_izin: row.extras?.excused_days ?? 0,
      hari_alpa: row.extras?.absent_days ?? 0,
      hari_pulang: row.extras?.early_leave_days ?? 0,
      catatan: row.extras?.notes ?? null,
      hafalan_note: row.extras?.hafalan_note ?? null,
      sholat: row.extras?.sholat ?? null,
    },
  }
}

export function toPrintStudent(student: ReportCardStudent): PrintStudent {
  return {
    id: student.id,
    name: student.name,
    nameAr: translitToAr(student.name),
    room: student.dorms?.name ?? '',
    guardian: student.guardian_name ?? '',
    registrationCode: student.registration_code,
  }
}

export function toPrintSettings(settings: SchoolSettings | null): PrintSettings {
  const source = (settings ?? {}) as SchoolSettingsExtra
  const headmasterName = source.headmaster_name_id ?? source.headmaster_name ?? 'Khoirul Anwar, S.Pd.'
  const pengasuhName = source.pengasuh_name_id ?? source.caretaker_name ?? 'Ir. H. M. Ali Maksum'
  return {
    school_name_ar: source.school_name_ar ?? 'معهد محمدية الإسلامي تانجول',
    school_subtitle_ar:
      source.school_subtitle_ar ??
      'المجلس التعليمي للمرحلتين الابتدائية والمتوسطة التابع للرئاسة الفرعية للجمعية المحمدية',
    school_name_id: source.school_name ?? 'Muhammadiyah Boarding School (MBS) Tanggul',
    school_address_line1:
      source.school_address_line1 ??
      source.school_address ??
      'Jl. Pemandian No. 88 Dusun Krajan II Patemon Tanggul Jember 68155',
    school_address_line2:
      source.school_address_line2 ??
      "Asrama Tahfidz Al-Qur'an Bambu Kuning Jl. Teratai No. 11 Tanggul Jember 68155",
    logo_url: source.logo_url ?? '/logos/logo-mbs.png',
    headmaster_name_id: headmasterName,
    headmaster_name_ar: source.headmaster_name_ar ?? translitToAr(headmasterName),
    headmaster_title_id: source.headmaster_title_id ?? 'Direktur MBS Tanggul',
    headmaster_title_ar: source.headmaster_title_ar ?? 'مدير معهد محمدية الإسلامي تانجول',
    pengasuh_name_id: pengasuhName,
    pengasuh_name_ar: source.pengasuh_name_ar ?? translitToAr(pengasuhName),
    report_color_primary: source.report_color_primary ?? source.color_primary ?? '#1a5c35',
    report_color_secondary: source.report_color_secondary ?? source.color_secondary ?? '#c8a400',
    report_labels: source.report_labels ?? {},
    app_domain: source.app_domain ?? 'laporanmu.my.id',
  }
}

function shortClassName(name: string): string {
  const clean = name.trim()
  const roman = clean.match(/^(XII|XI|IX|VIII|VII|VI|IV|III|II|I|X|V)\s*([A-Za-z])?/i)
  if (roman) return `${roman[1].toUpperCase()}${roman[2] ? roman[2].toUpperCase() : ''}`
  const numbered = clean.match(/^(\d+)\s*([A-Za-z])/)
  if (numbered) return `${numbered[1]}${numbered[2].toUpperCase()}`
  const digits = clean.match(/^(\d+)/)
  if (digits) return digits[1]
  return clean.replace(/[\s/]/g, '').slice(0, 5).toUpperCase()
}

export function buildReportNumber(args: {
  prefix: string
  className: string
  reportType: V1ReportType
  month: number
  year: number
  semester: 1 | 2
  studentIndex: number
}): string {
  const cleanClass = shortClassName(args.className)
  const period =
    args.reportType === 'bulanan'
      ? `${(MONTH_NAMES[args.month - 1] ?? 'BULAN').toUpperCase()}${args.year}`
      : `SEM${args.semester}`
  const order = String(args.studentIndex).padStart(3, '0')
  return `${args.prefix}/${cleanClass}/${period}/${order}`
}

export function buildVerifyUrl(args: {
  studentId: string
  reportNo: string
  reportType: V1ReportType
  dbReportType?: string
  semester?: 1 | 2
  academicYearId?: string
  appDomain?: string
}): string {
  const params = new URLSearchParams({ s: args.studentId, no: args.reportNo })
  if (args.reportType !== 'bulanan') {
    params.set('type', args.dbReportType ?? args.reportType)
    if (args.semester) params.set('semester', String(args.semester))
    if (args.academicYearId) params.set('ay', args.academicYearId)
  }
  const host = window.location.hostname
  const origin =
    (host === 'localhost' || host === '127.0.0.1') && args.appDomain
      ? `https://${args.appDomain}`
      : window.location.origin
  return `${origin}/verify?${params.toString()}`
}

export function cleanAcademicYearName(name: string): string {
  if (!name) return ''
  // Bersihkan embel-embel semester dari nama tahun akademik (mis. "(Ganjil)", "Genap", "Odd", "Even")
  return name
    .replace(/\s*\(?\b(ganjil|genap|odd|even|semester\s*\d*)\b\)?/gi, '')
    .trim()
}

export function getYearDisplay(
  month: number,
  year: number,
  lang: 'id' | 'ar',
  academicYear: string,
): string {
  const cleaned = cleanAcademicYearName(academicYear)
  if (cleaned) {
    // Normalisasi pemisah tahun ajaran menjadi YYYY/YYYY yang seragam
    const normalized = cleaned.replace(/\s*[-–]\s*/, '/')
    return lang === 'ar' ? `\u200F${toArabicNum(normalized)}` : normalized
  }
  const start = month >= 7 ? year : year - 1
  const end = start + 1
  return lang === 'ar' ? `\u200F${toArabicNum(start)}/${toArabicNum(end)}` : `${start}/${end}`
}

export function formatPrintDate(lang: 'id' | 'ar'): string {
  const now = new Date()
  const monthsAr = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ]
  const monthsId = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ]
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  if (lang === 'ar') {
    return `${toArabicNum(now.getDate())} ${monthsAr[now.getMonth()]} ${toArabicNum(now.getFullYear())} | ${toArabicNum(`${hours}:${minutes}`)}`
  }
  return `${now.getDate()} ${monthsId[now.getMonth()]} ${now.getFullYear()} ${hours}:${minutes}`
}
