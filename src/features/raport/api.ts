import { supabase } from '../../lib/supabase'
import type {
  BehaviorItem,
  MonthlyReport,
  MonthlyReportPayload,
  RaportClass,
  RaportStudent,
  SchoolSettings,
  SemesterReport,
  SemesterReportPayload,
  SemesterType,
} from './types'

// ------------------------------------------------------------
// Kelas & siswa
// ------------------------------------------------------------
export async function fetchRaportClasses(): Promise<RaportClass[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, homeroom_teacher_id, academic_year_id, homeroom_teacher:teachers!classes_homeroom_teacher_id_fkey(name)')
    .is('deleted_at', null)
    .order('name')

  if (error) throw error
  return (data ?? []) as unknown as RaportClass[]
}

export async function fetchRaportStudents(classId: string): Promise<RaportStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, name, registration_code, gender, dorm_id, guardian_name, dorms(name)')
    .eq('class_id', classId)
    .is('deleted_at', null)
    .order('name')

  if (error) throw error
  return (data ?? []) as unknown as RaportStudent[]
}

// Peta siswa aktif → kelas (untuk agregasi progres dashboard/arsip)
export async function fetchAllStudentClasses(): Promise<{ id: string; class_id: string | null }[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, class_id')
    .is('deleted_at', null)

  if (error) throw error
  return (data ?? []) as { id: string; class_id: string | null }[]
}

// ------------------------------------------------------------
// Raport bulanan
// ------------------------------------------------------------
export async function fetchMonthlyRows(studentIds: string[], month: number, year: number): Promise<MonthlyReport[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from('student_monthly_reports')
    .select('*')
    .in('student_id', studentIds)
    .eq('month', month)
    .eq('year', year)

  if (error) throw error
  return (data ?? []) as MonthlyReport[]
}

export async function upsertMonthlyRows(payload: MonthlyReportPayload[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('student_monthly_reports')
    .upsert(payload, { onConflict: 'student_id,month,year' })
  if (error) throw error
}

export async function deleteMonthlyPeriod(studentIds: string[], month: number, year: number): Promise<void> {
  if (studentIds.length === 0) return
  const { error } = await supabase
    .from('student_monthly_reports')
    .delete()
    .in('student_id', studentIds)
    .eq('month', month)
    .eq('year', year)
  if (error) throw error
}

// Semua baris bulanan satu bulan (untuk progres dashboard)
export async function fetchMonthlyRowsForMonth(month: number, year: number): Promise<MonthlyReport[]> {
  const { data, error } = await supabase
    .from('student_monthly_reports')
    .select('student_id, month, year, nilai_akhlak, nilai_ibadah, nilai_kebersihan, nilai_quran, nilai_bahasa')
    .eq('month', month)
    .eq('year', year)

  if (error) throw error
  return (data ?? []) as MonthlyReport[]
}

// Seluruh riwayat bulanan (untuk arsip)
export async function fetchAllMonthlyRows(): Promise<MonthlyReport[]> {
  const { data, error } = await supabase
    .from('student_monthly_reports')
    .select('student_id, month, year, musyrif_name, nilai_akhlak, nilai_ibadah, nilai_kebersihan, nilai_quran, nilai_bahasa')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) throw error
  return (data ?? []) as MonthlyReport[]
}

// ------------------------------------------------------------
// Raport semester
// ------------------------------------------------------------
export async function fetchSemesterRows(
  studentIds: string[],
  reportType: SemesterType,
  semester: 1 | 2,
  academicYearId: string,
): Promise<SemesterReport[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from('student_semester_reports')
    .select('*')
    .in('student_id', studentIds)
    .eq('report_type', reportType)
    .eq('semester', semester)
    .eq('academic_year_id', academicYearId)

  if (error) throw error
  return (data ?? []) as SemesterReport[]
}

export async function upsertSemesterRows(payload: SemesterReportPayload[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('student_semester_reports')
    .upsert(payload, { onConflict: 'student_id,report_type,semester,academic_year_id' })
  if (error) throw error
}

export async function deleteSemesterPeriod(
  studentIds: string[],
  reportType: SemesterType,
  semester: 1 | 2,
  academicYearId: string,
): Promise<void> {
  if (studentIds.length === 0) return
  const { error } = await supabase
    .from('student_semester_reports')
    .delete()
    .in('student_id', studentIds)
    .eq('report_type', reportType)
    .eq('semester', semester)
    .eq('academic_year_id', academicYearId)
  if (error) throw error
}

export async function fetchAllSemesterRows(reportType: SemesterType): Promise<SemesterReport[]> {
  const { data, error } = await supabase
    .from('student_semester_reports')
    .select('student_id, report_type, semester, academic_year_id, scores')
    .eq('report_type', reportType)

  if (error) throw error
  return (data ?? []) as SemesterReport[]
}

// ------------------------------------------------------------
// Catatan perilaku bulan berjalan (feed dari modul Poin Santri)
// ------------------------------------------------------------
export async function fetchBehaviorForMonth(
  studentIds: string[],
  startDate: string,
  endDate: string,
): Promise<BehaviorItem[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from('reports')
    .select('student_id, points, notes, reported_at, rule:point_rules(name)')
    .in('student_id', studentIds)
    .gte('reported_at', startDate)
    .lte('reported_at', endDate)
    .order('reported_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      student_id: string
      points: number
      notes: string | null
      reported_at: string
      rule?: { name: string } | null
    }
    return {
      student_id: r.student_id,
      points: r.points,
      notes: r.notes,
      reported_at: r.reported_at,
      rule_name: r.rule?.name ?? null,
    }
  })
}

// ------------------------------------------------------------
// Profil sekolah
// ------------------------------------------------------------
export async function fetchSchoolSettings(): Promise<SchoolSettings> {
  const { data, error } = await supabase
    .from('school_settings')
    .select('school_name, school_address, headmaster_name, pengasuh_name, color_primary, color_secondary')
    .eq('id', true)
    .single()

  if (error) throw error
  return data as SchoolSettings
}

export async function upsertSchoolSettings(values: SchoolSettings, updatedBy: string | null): Promise<void> {
  const { error } = await supabase.from('school_settings').upsert({
    id: true,
    ...values,
    updated_by: updatedBy,
  })
  if (error) throw error
}
