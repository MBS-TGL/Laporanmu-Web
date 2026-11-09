export type ReportCardType = 'monthly' | 'pondok_oral' | 'pondok_subject' | 'general'

export type SemesterType = Exclude<ReportCardType, 'monthly'>

export interface MonthlyReport {
  id: string
  student_id: string
  month: number
  year: number
  character_score: number | null
  worship_score: number | null
  cleanliness_score: number | null
  quran_score: number | null
  language_score: number | null
  weight_kg: number | null
  height_cm: number | null
  ziyadah: string | null
  murojaah: string | null
  total_hafalan: string | null
  sholat: string | null
  sick_days: number
  excused_days: number
  absent_days: number
  early_leave_days: number
  notes: string | null
  violations: string | null
  achievements: string | null
  musyrif_name: string | null
  created_at?: string
  updated_at?: string
}

// Baris siap upsert (kolom skor datar)
export interface MonthlyReportPayload {
  student_id: string
  month: number
  year: number
  musyrif_name: string | null
  character_score: number | null
  worship_score: number | null
  cleanliness_score: number | null
  quran_score: number | null
  language_score: number | null
  weight_kg: number | null
  height_cm: number | null
  ziyadah: string | null
  murojaah: string | null
  total_hafalan: string | null
  sholat: string | null
  sick_days: number
  excused_days: number
  absent_days: number
  early_leave_days: number
  notes: string | null
  violations: string | null
  achievements: string | null
  updated_by: string | null
}

export interface SemesterReport {
  id: string
  student_id: string
  report_type: SemesterType
  semester: 1 | 2
  academic_year_id: string
  scores: Record<string, number | null>
  extras: {
    weight_kg?: number | null
    height_cm?: number | null
    sholat?: string | null
    sick_days?: number
    excused_days?: number
    absent_days?: number
    early_leave_days?: number
    notes?: string | null
  }
  musyrif_name: string | null
  created_at?: string
  updated_at?: string
}

export interface SemesterReportPayload {
  student_id: string
  report_type: SemesterType
  semester: 1 | 2
  academic_year_id: string
  scores: Record<string, number | null>
  extras: SemesterReport['extras']
  musyrif_name: string | null
  updated_by: string | null
}

export interface ReportCardStudent {
  id: string
  name: string
  registration_code: string
  gender: 'L' | 'P' | null
  dorm_id: string | null
  guardian_name: string | null
  dorms?: { name: string } | null
}

export interface ReportCardClass {
  id: string
  name: string
  grade: string | null
  homeroom_teacher_id: string | null
  homeroom_teacher?: { name: string } | null
  academic_year_id: string | null
}

export interface BehaviorItem {
  student_id: string
  points: number
  notes: string | null
  reported_at: string
  rule_name: string | null
}

export interface SchoolSettings {
  school_name: string
  school_address: string | null
  headmaster_name: string | null
  caretaker_name: string | null
  color_primary: string
  color_secondary: string
}

// Baris raport yang sedang diedit di tabel input (gabungan skor + extras)
export interface MonthlyDraft {
  character_score?: number | null
  worship_score?: number | null
  cleanliness_score?: number | null
  quran_score?: number | null
  language_score?: number | null
  weight_kg?: number | null
  height_cm?: number | null
  ziyadah?: string
  murojaah?: string
  total_hafalan?: string
  sholat?: string
  sick_days?: number
  excused_days?: number
  absent_days?: number
  early_leave_days?: number
  notes?: string
  violations?: string
  achievements?: string
}

export interface SemesterDraft {
  scores: Record<string, number | null>
  weight_kg?: number | null
  height_cm?: number | null
  sholat?: string
  sick_days?: number
  excused_days?: number
  absent_days?: number
  early_leave_days?: number
  notes?: string
}
