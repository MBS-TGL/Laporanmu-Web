import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import { logAudit } from '../../shared/utils/auditLogger'
import { suppressCombinedPresets } from './presets'
import type { WorshipCategory, WorshipFormValues, WorshipItem, WorshipMasteryRow, WorshipScoreRow } from './types'

// ─── Butir ibadah ────────────────────────────────────────────────────────────

export async function fetchWorshipItems(category: WorshipCategory): Promise<WorshipItem[]> {
  const { data, error } = await supabase
    .from('worship_items')
    .select('id, category, label, sort_order, is_preset')
    .eq('category', category)
    .is('deleted_at', null)
    .order('sort_order')
    .order('label')
  if (error) throw error
  return (data ?? []) as WorshipItem[]
}

export async function createWorshipItem(values: WorshipFormValues): Promise<WorshipItem> {
  const { data, error } = await supabase
    .from('worship_items')
    .insert({
      category: values.category,
      label: values.label.trim(),
      sort_order: values.sort_order,
    })
    .select('*')
    .single()
  if (error) throw error
  void logAudit({
    action: 'INSERT',
    source: 'OPERATIONAL',
    tableName: 'worship_items',
    recordId: data.id,
    newData: data,
  })
  return data as WorshipItem
}

/** Muat preset kategori: insert butir yang BELUM ada.
 *  Gotcha: unique index (category,label) sifatnya PARTIAL (where deleted_at
 *  is null) – PostgREST tidak bisa memakainya untuk onConflict ("no unique
 *  or exclusion constraint"), jadi dedupe dilakukan di sisi klien lalu
 *  insert biasa.
 *  sort_order dihitung dari MAX sort_order existing + offset agar tidak
 *  menabrak urutan baris yang sudah ada; butir gabungan dilewat bila semua
 *  komponennya sudah tersedia (lihat suppressCombinedPresets). */
export async function loadWorshipPresets(
  category: WorshipCategory,
  labels: string[],
): Promise<number> {
  if (labels.length === 0) return 0
  const { data: existing, error: fetchErr } = await supabase
    .from('worship_items')
    .select('label, sort_order')
    .eq('category', category)
    .is('deleted_at', null)
  if (fetchErr) throw fetchErr
  const rows0 = (existing ?? []) as Array<{ label: string; sort_order: number }>
  const known = new Set(rows0.map((r) => r.label.toLowerCase()))
  const maxSort = rows0.reduce((m, r) => Math.max(m, r.sort_order), 0)
  const targets = suppressCombinedPresets(
    labels,
    rows0.map((r) => r.label),
  )
  const rows = targets
    .map((label, i) => ({ label, sort_order: maxSort + (i + 1) * 10 }))
    .filter(({ label }) => !known.has(label.toLowerCase()))
    .map((r) => ({ category, ...r, is_preset: true }))
  if (rows.length === 0) return 0
  const { data, error } = await supabase.from('worship_items').insert(rows).select('id')
  if (error) throw error
  void logAudit({
    action: 'INSERT',
    source: 'OPERATIONAL',
    tableName: 'worship_items',
    recordId: `presets-${category}`,
    newData: { category, count: (data ?? []).length },
  })
  return (data ?? []).length
}

export async function deleteWorshipItem(id: string, label: string): Promise<void> {
  await softDelete('worship_items', id)
  void logAudit({
    action: 'DELETE',
    source: 'OPERATIONAL',
    tableName: 'worship_items',
    recordId: id,
    newData: { label },
  })
}

export async function updateWorshipItemLabel(id: string, label: string): Promise<void> {
  const clean = label.trim()
  const { error } = await supabase
    .from('worship_items')
    .update({ label: clean })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'worship_items',
    recordId: id,
    newData: { label: clean },
  })
}

/** Simpan urutan baru butir (hanya baris yang berubah). */
export async function reorderWorshipItems(
  updates: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  if (updates.length === 0) return
  const results = await Promise.all(
    updates.map((u) =>
      supabase.from('worship_items').update({ sort_order: u.sort_order }).eq('id', u.id),
    ),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'worship_items',
    recordId: `reorder-${updates.length}`,
    newData: { updates },
  })
}

// ─── Kemahiran (mastery) ─────────────────────────────────────────────────────

export async function fetchWorshipMastery(
  category: WorshipCategory,
  classId: string,
): Promise<WorshipMasteryRow[]> {
  const { data, error } = await supabase
    .from('worship_mastery')
    .select(
      'id, student_id, item_id, mastered, mastered_at, worship_items!inner(category, deleted_at), students!inner(class_id)',
    )
    .eq('worship_items.category', category)
    .is('worship_items.deleted_at', null)
    .eq('students.class_id', classId)
  if (error) throw error
  return (data ?? []) as unknown as WorshipMasteryRow[]
}

export interface MasteryUpsert {
  student_id: string
  item_id: string
  mastered: boolean
  mastered_at: string | null
  recorded_by: string | null
}

export async function upsertWorshipMastery(payload: MasteryUpsert[]): Promise<void> {
  if (payload.length === 0) return
  // recorded_by diisi dari session (lokal, tanpa request jaringan)
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const rows = payload.map((p) => ({ ...p, recorded_by: session?.user.id ?? null }))
  // wa_notified_at sengaja TIDAK dikirim agar tidak tertimpa saat upsert
  const { error } = await supabase
    .from('worship_mastery')
    .upsert(rows, { onConflict: 'student_id,item_id' })
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'worship_mastery',
    recordId: rows.length === 1 ? `${rows[0].student_id}:${rows[0].item_id}` : `bulk-${rows.length}`,
    newData: rows.length === 1 ? rows[0] : { count: rows.length },
  })
}

// ─── Nilai bulanan ───────────────────────────────────────────────────────────

export async function fetchWorshipScores(
  category: WorshipCategory,
  classId: string,
  year: number,
  month: number,
): Promise<WorshipScoreRow[]> {
  const { data, error } = await supabase
    .from('worship_scores')
    .select(
      'id, student_id, item_id, year, month, grade, worship_items!inner(category, deleted_at), students!inner(class_id)',
    )
    .eq('worship_items.category', category)
    .is('worship_items.deleted_at', null)
    .eq('students.class_id', classId)
    .eq('year', year)
    .eq('month', month)
  if (error) throw error
  return (data ?? []) as unknown as WorshipScoreRow[]
}

export interface ScoreUpsert {
  student_id: string
  item_id: string
  year: number
  month: number
  grade: number
}

export async function upsertWorshipScores(payload: ScoreUpsert[]): Promise<void> {
  if (payload.length === 0) return
  const { error } = await supabase
    .from('worship_scores')
    .upsert(payload, { onConflict: 'student_id,item_id,year,month' })
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'worship_scores',
    recordId:
      payload.length === 1
        ? `${payload[0].student_id}:${payload[0].item_id}:${payload[0].year}-${payload[0].month}`
        : `bulk-${payload.length}`,
    newData: payload.length === 1 ? payload[0] : { count: payload.length },
  })
}

/**
 * Sinkronisasi rata-rata worship_scores kelas ke student_monthly_reports.worship_score
 * untuk bulan & tahun yang dipilih. Butir yang sudah dihapus (soft-delete) tidak
 * ikut dihitung. Upsert hanya mengirim kolom yang berubah, sehingga kolom rapor
 * lain tidak tertimpa.
 */
export async function syncWorshipScoresToMonthlyReports(
  classId: string,
  year: number,
  month: number,
): Promise<{ updatedCount: number }> {
  // 1. Ambil semua nilai santri di kelas tsb untuk periode terpilih (butir aktif saja)
  const { data: scores, error: scoreErr } = await supabase
    .from('worship_scores')
    .select('student_id, grade, students!inner(class_id), worship_items!inner(deleted_at)')
    .eq('students.class_id', classId)
    .is('worship_items.deleted_at', null)
    .eq('year', year)
    .eq('month', month)

  if (scoreErr) throw scoreErr
  if (!scores || scores.length === 0) return { updatedCount: 0 }

  // 2. Rata-rata per santri
  const gradesByStudent = new Map<string, number[]>()
  for (const row of scores as Array<{ student_id: string; grade: number }>) {
    const list = gradesByStudent.get(row.student_id) ?? []
    list.push(row.grade)
    gradesByStudent.set(row.student_id, list)
  }

  // 3. Upsert payload minimal
  const payloads = Array.from(gradesByStudent, ([student_id, grades]) => ({
    student_id,
    year,
    month,
    worship_score: Math.round(grades.reduce((a, b) => a + b, 0) / grades.length),
  }))

  const { error: upsertErr } = await supabase
    .from('student_monthly_reports')
    .upsert(payloads, { onConflict: 'student_id,month,year' })

  if (upsertErr) throw upsertErr

  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'student_monthly_reports',
    recordId: `sync-worship-${classId}-${year}-${month}`,
    newData: { count: payloads.length, year, month },
  })

  return { updatedCount: payloads.length }
}

/**
 * Sinkronisasi rata-rata nilai bulanan ibadah ke Rapor Pondok Lisan Semester.
 * Menghitung akumulasi nilai kemahiran ibadah santri se-kelas pada semester aktif
 * lalu menuliskan ke tabel student_semester_reports tipe 'pondok_oral'.
 */
export async function syncWorshipScoresToSemesterOralReport(
  classId: string,
  academicYearId: string,
  semester: 1 | 2,
  year: number,
): Promise<{ updatedCount: number }> {
  // Ambil seluruh nilai ibadah tahun ajaran beserta label & kategori butirnya
  const { data: scores, error: scoreErr } = await supabase
    .from('worship_scores')
    .select('student_id, grade, item_id, worship_items!inner(category, label), students!inner(class_id)')
    .eq('students.class_id', classId)
    .eq('year', year)

  if (scoreErr) throw scoreErr
  if (!scores || scores.length === 0) return { updatedCount: 0 }

  // Kumpulkan per student berdasarkan jenis materi spesifik
  // Key pemetaan Rapor Lisan:
  // - 'wafa'
  // - 'h_arbain' (Hadist Arbain)
  // - 'h_biru' (Hadist Sehari-hari)
  // - 'doa' (Doa Sehari-hari)
  // - 'd_sholat' (Dzikir Setelah Sholat)
  // - 'pagi_petang' (Dzikir Pagi Petang)
  // - 'tuhfatul_athfal' (Matan Tuhfatul Athfal)
  // - 'praktek_wudhu' (Wudhu)
  // - 'sujud_sahwi_tilawah' (Sujud)
  const gradesByStudent = new Map<string, Record<string, number[]>>()
  for (const row of scores as any[]) {
    const sMap = gradesByStudent.get(row.student_id) ?? {}
    const labelLower = String(row.worship_items?.label || '').toLowerCase()
    const cat = String(row.worship_items?.category || '')

    let targetKey = ''
    if (labelLower.includes('wafa')) {
      targetKey = 'wafa'
    } else if (labelLower.includes('arbain')) {
      targetKey = 'hadith_arbain'
    } else if (labelLower.includes('tuhfatul')) {
      targetKey = 'tuhfatul_athfal'
    } else if (labelLower.includes('hadist') || cat === 'hafalan_hadist') {
      targetKey = 'daily_hadith'
    } else if (labelLower.includes('dzikir pagi') || labelLower.includes('petang')) {
      targetKey = 'morning_evening_dhikr'
    } else if (labelLower.includes('dzikir') || labelLower.includes('setelah sholat')) {
      targetKey = 'post_prayer_dhikr'
    } else if (labelLower.includes('sujud')) {
      targetKey = 'prostration_practice'
    } else if (cat === 'wudhu' || labelLower.includes('wudhu')) {
      targetKey = 'wudhu_practice'
    } else if (cat === 'hafalan_doa' || labelLower.includes('doa')) {
      targetKey = 'daily_prayers'
    }

    if (targetKey) {
      const list = sMap[targetKey] ?? []
      list.push(row.grade)
      sMap[targetKey] = list
      gradesByStudent.set(row.student_id, sMap)
    }
  }

  // Ambil rapor semester pondok_oral yang sudah ada agar tidak menimpa nilai yang lain
  const studentIds = Array.from(gradesByStudent.keys())
  const { data: existingReports } = await supabase
    .from('student_semester_reports')
    .select('id, student_id, scores')
    .in('student_id', studentIds)
    .eq('report_type', 'pondok_oral')
    .eq('semester', semester)
    .eq('academic_year_id', academicYearId)

  const reportMap = new Map((existingReports ?? []).map((r) => [r.student_id, r]))

  const payloads = studentIds.map((studentId) => {
    const sMap = gradesByStudent.get(studentId) ?? {}
    const existing = reportMap.get(studentId)
    const currentScores: Record<string, number | null> = (existing?.scores as any) || {}

    const avg = (list?: number[]) =>
      list && list.length > 0 ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null

    const wafaAvg = avg(sMap['wafa'])
    const arbainAvg = avg(sMap['hadith_arbain'])
    const hadithAvg = avg(sMap['daily_hadith'])
    const prayersAvg = avg(sMap['daily_prayers'])
    const dhikrAvg = avg(sMap['post_prayer_dhikr'])
    const morningEveningAvg = avg(sMap['morning_evening_dhikr'])
    const tuhfatulAvg = avg(sMap['tuhfatul_athfal'])
    const wudhuAvg = avg(sMap['wudhu_practice'])
    const prostrationAvg = avg(sMap['prostration_practice'])

    const updatedScores = {
      ...currentScores,
      // Standar English keys baru
      ...(wafaAvg !== null ? { wafa: wafaAvg } : {}),
      ...(arbainAvg !== null ? { hadith_arbain: arbainAvg, h_arbain: arbainAvg } : {}),
      ...(hadithAvg !== null ? { daily_hadith: hadithAvg, h_biru: hadithAvg } : {}),
      ...(prayersAvg !== null ? { daily_prayers: prayersAvg, doa: prayersAvg } : {}),
      ...(dhikrAvg !== null ? { post_prayer_dhikr: dhikrAvg, d_sholat: dhikrAvg } : {}),
      ...(morningEveningAvg !== null ? { morning_evening_dhikr: morningEveningAvg, pagi_petang: morningEveningAvg } : {}),
      ...(tuhfatulAvg !== null ? { tuhfatul_athfal: tuhfatulAvg } : {}),
      ...(wudhuAvg !== null ? { wudhu_practice: wudhuAvg, praktek_wudhu: wudhuAvg, praktek: wudhuAvg } : {}),
      ...(prostrationAvg !== null ? { prostration_practice: prostrationAvg, sujud_sahwi_tilawah: prostrationAvg } : {}),
    }

    return {
      student_id: studentId,
      academic_year_id: academicYearId,
      semester,
      report_type: 'pondok_oral' as const,
      scores: updatedScores,
    }
  })

  const { error: upsertErr } = await supabase
    .from('student_semester_reports')
    .upsert(payloads, { onConflict: 'student_id,report_type,semester,academic_year_id' })

  if (upsertErr) throw upsertErr

  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'student_semester_reports',
    recordId: `sync-oral-${classId}-${semester}`,
    newData: { count: payloads.length, semester },
  })

  return { updatedCount: payloads.length }
}

// ─── Progres kemahiran santri (untuk detail & portal) ─────────────────────────

export interface StudentWorshipProgress {
  category: WorshipCategory
  totalItems: number
  masteredCount: number
  items: Array<{ id: string; label: string; mastered: boolean; mastered_at?: string | null }>
}

export async function fetchStudentWorshipProgress(studentId: string): Promise<StudentWorshipProgress[]> {
  const { data: items, error: itemsErr } = await supabase
    .from('worship_items')
    .select('id, category, label, sort_order')
    .is('deleted_at', null)
    .order('sort_order')
    .order('label')

  if (itemsErr) throw itemsErr

  const { data: mastery, error: masteryErr } = await supabase
    .from('worship_mastery')
    .select('item_id, mastered, mastered_at')
    .eq('student_id', studentId)

  if (masteryErr) throw masteryErr

  const masteryMap = new Map((mastery ?? []).map((m) => [m.item_id, { mastered: m.mastered, mastered_at: m.mastered_at }]))

  const categories: WorshipCategory[] = ['wudhu', 'sholat', 'hafalan_hadist', 'hafalan_doa']

  return categories.map((cat) => {
    const catItems = (items ?? []).filter((i) => i.category === cat)
    const itemDetails = catItems.map((i) => {
      const m = masteryMap.get(i.id)
      return {
        id: i.id,
        label: i.label,
        mastered: m?.mastered ?? false,
        mastered_at: m?.mastered_at ?? null,
      }
    })
    const masteredCount = itemDetails.filter((i) => i.mastered).length

    return {
      category: cat,
      totalItems: catItems.length,
      masteredCount,
      items: itemDetails,
    }
  })
}

// Riwayat nilai bulanan ibadah seorang santri
export async function fetchStudentMonthlyWorshipScores(studentId: string): Promise<WorshipScoreRow[]> {
  const { data, error } = await supabase
    .from('worship_scores')
    .select('id, student_id, item_id, year, month, grade')
    .eq('student_id', studentId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) throw error
  return (data ?? []) as WorshipScoreRow[]
}

