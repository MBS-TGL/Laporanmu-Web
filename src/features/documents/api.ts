import { supabase } from '../../lib/supabase'
import { softDelete, softDeleteMany } from '../../shared/api/crud'
import { logAudit } from '../../shared/utils/auditLogger'

// ─── Kurikulum CP/TP ─────────────────────────────────────────────────────────

export interface CurriculumCp {
  id: string
  subject: string
  phase: string
  description: string
  sort_order: number
}

export interface CurriculumTp {
  id: string
  cp_id: string
  description: string
  sort_order: number
}

export async function fetchCurriculumCps(): Promise<CurriculumCp[]> {
  const { data, error } = await supabase
    .from('curriculum_cps')
    .select('*')
    .is('deleted_at', null)
    .order('subject')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as CurriculumCp[]
}

export async function fetchCurriculumTps(): Promise<CurriculumTp[]> {
  const { data, error } = await supabase
    .from('curriculum_tps')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order')
    // sekunder: semua sort_order 0 → urutan tidak deterministik tanpa ini
    .order('created_at')
  if (error) throw error
  return (data ?? []) as CurriculumTp[]
}

/** Cegah CP ganda untuk kombinasi mapel + fase yang sama. */
async function assertNoDuplicateCp(subject: string, phase: string, excludeId?: string): Promise<void> {
  let query = supabase
    .from('curriculum_cps')
    .select('id', { count: 'exact', head: true })
    .eq('subject', subject)
    .eq('phase', phase)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  if ((count ?? 0) > 0) throw new Error(`CP untuk mapel "${subject}" fase ${phase} sudah ada`)
}

export async function createCurriculumCp(values: {
  subject: string
  phase: string
  description: string
  sort_order?: number
}): Promise<CurriculumCp> {
  const subject = values.subject.trim()
  const phase = values.phase.trim() || 'D'
  await assertNoDuplicateCp(subject, phase)
  const { data, error } = await supabase
    .from('curriculum_cps')
    .insert({
      subject,
      phase,
      description: values.description.trim(),
      sort_order: values.sort_order ?? 0,
    })
    .select('id')
    .single()
  if (error) throw error
  const row = data as CurriculumCp
  void logAudit({
    action: 'INSERT',
    source: 'MASTER',
    tableName: 'curriculum_cps',
    recordId: row.id,
    newData: { subject, phase, description: values.description.trim() },
  })
  return row
}

export async function updateCurriculumCp(
  id: string,
  values: { subject: string; phase: string; description: string; sort_order: number },
): Promise<void> {
  const subject = values.subject.trim()
  const phase = values.phase.trim() || 'D'
  await assertNoDuplicateCp(subject, phase, id)
  const payload = {
    subject,
    phase,
    description: values.description.trim(),
    sort_order: values.sort_order,
  }
  const { error } = await supabase.from('curriculum_cps').update(payload).eq('id', id)
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'MASTER',
    tableName: 'curriculum_cps',
    recordId: id,
    newData: payload,
  })
}

export async function createCurriculumTp(
  cpId: string,
  description: string,
  sortOrder = 0,
): Promise<void> {
  const { data, error } = await supabase
    .from('curriculum_tps')
    .insert({
      cp_id: cpId,
      description: description.trim(),
      sort_order: sortOrder,
    })
    .select('id')
    .single()
  if (error) throw error
  void logAudit({
    action: 'INSERT',
    source: 'MASTER',
    tableName: 'curriculum_tps',
    recordId: (data as { id: string }).id,
    newData: { cp_id: cpId, description: description.trim() },
  })
}

export async function updateCurriculumTp(id: string, description: string): Promise<void> {
  const payload = { description: description.trim() }
  const { error } = await supabase.from('curriculum_tps').update(payload).eq('id', id)
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'MASTER',
    tableName: 'curriculum_tps',
    recordId: id,
    newData: payload,
  })
}

export async function deleteCurriculumCp(id: string): Promise<void> {
  // Soft delete tidak cascade — TP anak ikut ditandai terhapus agar tidak yatim
  const { data: tpRows, error: tpErr } = await supabase
    .from('curriculum_tps')
    .select('id')
    .eq('cp_id', id)
    .is('deleted_at', null)
  if (tpErr) throw tpErr
  const tpIds = (tpRows ?? []).map((r) => r.id)
  if (tpIds.length > 0) await softDeleteMany('curriculum_tps', tpIds)
  await softDelete('curriculum_cps', id)
  void logAudit({
    action: 'DELETE',
    source: 'MASTER',
    tableName: 'curriculum_cps',
    recordId: id,
    newData: { tp_deleted: tpIds.length },
  })
}

export async function deleteCurriculumTp(id: string): Promise<void> {
  await softDelete('curriculum_tps', id)
  void logAudit({
    action: 'DELETE',
    source: 'MASTER',
    tableName: 'curriculum_tps',
    recordId: id,
  })
}

/** Tukar posisi TP dengan tetangganya (urutan: sort_order, lalu created_at). */
export async function moveCurriculumTp(id: string, dir: 'up' | 'down'): Promise<void> {
  const { data: row, error } = await supabase
    .from('curriculum_tps')
    .select('id, cp_id')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!row) throw new Error('Tujuan pembelajaran tidak ditemukan')

  const { data: siblings, error: sibErr } = await supabase
    .from('curriculum_tps')
    .select('id, sort_order')
    .eq('cp_id', (row as { cp_id: string }).cp_id)
    .is('deleted_at', null)
    .order('sort_order')
    .order('created_at')
  if (sibErr) throw sibErr

  const list = (siblings ?? []) as Array<{ id: string; sort_order: number }>
  const idx = list.findIndex((t) => t.id === id)
  const target = dir === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || target < 0 || target >= list.length) return

  // Renumber 0..n-1 setelah swap — sekalian memperbaiki sort_order duplikat lama
  const next = [...list]
  ;[next[idx], next[target]] = [next[target], next[idx]]
  const updates = next
    .map((t, i) => ({ id: t.id, sort_order: i }))
    .filter((u, i) => u.sort_order !== list[i].sort_order)
  for (const u of updates) {
    const { error: updErr } = await supabase
      .from('curriculum_tps')
      .update({ sort_order: u.sort_order })
      .eq('id', u.id)
    if (updErr) throw updErr
  }
  void logAudit({
    action: 'UPDATE',
    source: 'MASTER',
    tableName: 'curriculum_tps',
    recordId: id,
    newData: { moved: dir },
  })
}

// ─── Kokurikuler ─────────────────────────────────────────────────────────────

export interface CocurricularDim {
  id: string
  name: string
  sort_order: number
}

export async function fetchCocurricularDims(): Promise<CocurricularDim[]> {
  const { data, error } = await supabase
    .from('cocurricular_dims')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as CocurricularDim[]
}

export async function createCocurricularDim(name: string, sortOrder: number): Promise<void> {
  const { data, error } = await supabase
    .from('cocurricular_dims')
    .insert({ name: name.trim(), sort_order: sortOrder })
    .select('id')
    .single()
  if (error) throw error
  void logAudit({
    action: 'INSERT',
    source: 'MASTER',
    tableName: 'cocurricular_dims',
    recordId: (data as { id: string }).id,
    newData: { name: name.trim() },
  })
}

export async function updateCocurricularDim(
  id: string,
  values: { name: string; sort_order: number },
): Promise<void> {
  const payload = { name: values.name.trim(), sort_order: values.sort_order }
  const { error } = await supabase.from('cocurricular_dims').update(payload).eq('id', id)
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'MASTER',
    tableName: 'cocurricular_dims',
    recordId: id,
    newData: payload,
  })
}

export async function deleteCocurricularDim(id: string): Promise<void> {
  await softDelete('cocurricular_dims', id)
  void logAudit({
    action: 'DELETE',
    source: 'MASTER',
    tableName: 'cocurricular_dims',
    recordId: id,
  })
}

export interface CocurricularScoreRow {
  id: string
  student_id: string
  dim_id: string
  academic_year_id: string
  semester: 'Odd' | 'Even'
  predicate: string
  description: string | null
  created_at?: string
  updated_at?: string
}

export async function fetchCocurricularScores(
  classId: string,
  academicYearId: string,
  semester: 'Odd' | 'Even',
): Promise<CocurricularScoreRow[]> {
  const { data, error } = await supabase
    .from('cocurricular_scores')
    .select('*, students!inner(class_id)')
    .eq('students.class_id', classId)
    .eq('academic_year_id', academicYearId)
    .eq('semester', semester)
  if (error) throw error
  return (data ?? []) as unknown as CocurricularScoreRow[]
}

// ─── Yudisium ────────────────────────────────────────────────────────────────

export interface GraduationCheckRow {
  id: string
  student_id: string
  academic_year_id: string
  requirements: Record<string, unknown>
  status: 'pending' | 'lulus' | 'ditahan'
  notes: string | null
  approved_at: string | null
}

export async function fetchGraduationChecks(
  academicYearId: string,
): Promise<GraduationCheckRow[]> {
  const { data, error } = await supabase
    .from('graduation_checks')
    .select('*')
    .eq('academic_year_id', academicYearId)
  if (error) throw error
  return (data ?? []) as GraduationCheckRow[]
}

export async function saveGraduationCheck(input: {
  student_id: string
  academic_year_id: string
  requirements: Record<string, unknown>
  status: 'pending' | 'lulus' | 'ditahan'
  notes: string | null
  approved_by: string | null
}): Promise<void> {
  const { error } = await supabase.from('graduation_checks').upsert(
    {
      student_id: input.student_id,
      academic_year_id: input.academic_year_id,
      requirements: input.requirements,
      status: input.status,
      notes: input.notes,
      approved_by: input.approved_by,
      approved_at: input.status === 'pending' ? null : new Date().toISOString(),
    },
    { onConflict: 'student_id,academic_year_id' },
  )
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'OPERATIONAL',
    tableName: 'graduation_checks',
    recordId: input.student_id,
    newData: { status: input.status },
  })
}

// ─── Data pendukung yudisium (tahfidz + SPP) ────────────────────────────────

export async function fetchTahfidzCounts(studentIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (studentIds.length === 0) return map
  const { data, error } = await supabase
    .from('tahfidz_records')
    .select('student_id')
    .in('student_id', studentIds)
    .is('deleted_at', null)
  if (error) throw error
  for (const r of (data ?? []) as Array<{ student_id: string }>) {
    map.set(r.student_id, (map.get(r.student_id) ?? 0) + 1)
  }
  return map
}

export interface SppOutstandingRow {
  student_id: string
  outstanding: number
}

export async function fetchSppOutstanding(studentIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (studentIds.length === 0) return map
  const [obligations, payments] = await Promise.all([
    supabase
      .from('spp_obligations')
      .select('student_id, amount')
      .in('student_id', studentIds)
      .is('deleted_at', null),
    supabase
      .from('spp_payments')
      .select('amount, obligation_id, spp_obligations!inner(student_id)')
      .in('spp_obligations.student_id', studentIds)
      // Pembayaran atas kewajiban yang sudah di-soft-delete tidak boleh
      // memotong tagihan aktif lainnya
      .eq('spp_obligations.deleted_at', null),
  ])
  if (obligations.error) throw obligations.error
  if (payments.error) throw payments.error

  const due = new Map<string, number>()
  for (const o of (obligations.data ?? []) as Array<{ student_id: string; amount: number }>) {
    due.set(o.student_id, (due.get(o.student_id) ?? 0) + Number(o.amount))
  }
  const paid = new Map<string, number>()
  for (const p of (payments.data ?? []) as unknown as Array<{ amount: number; spp_obligations: { student_id: string } }>) {
    const sid = p.spp_obligations.student_id
    paid.set(sid, (paid.get(sid) ?? 0) + Number(p.amount))
  }
  for (const sid of studentIds) {
    map.set(sid, Math.max(0, (due.get(sid) ?? 0) - (paid.get(sid) ?? 0)))
  }
  return map
}

// ─── Buku induk: biodata santri kelas ────────────────────────────────────────

export interface BukuIndukStudent {
  id: string
  name: string
  registration_code: string
  nis: string | null
  nisn: string | null
  gender: string | null
  birth_place: string | null
  birth_date: string | null
  address: string | null
  parent_name: string | null
  parent_phone: string | null
}

export async function fetchBukuIndukStudents(classId: string): Promise<BukuIndukStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select(
      'id, name, registration_code, nis, nisn, gender, birth_place, birth_date, address, parent_name, parent_phone',
    )
    .eq('class_id', classId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as BukuIndukStudent[]
}

export async function fetchStudentPoints(studentIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (studentIds.length === 0) return map
  const { data, error } = await supabase
    .from('students')
    .select('id, total_points')
    .in('id', studentIds)
  if (error) throw error
  for (const r of (data ?? []) as Array<{ id: string; total_points: number }>) {
    map.set(r.id, r.total_points)
  }
  return map
}
