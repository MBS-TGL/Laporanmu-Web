import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import type {
  ComponentFormValues,
  PaymentFormValues,
  SppComponent,
  SppObligation,
  SppPayment,
} from './types'

// Embed classes dari students WAJIB hint FK (students punya 3 FK ke classes)
const OBLIGATION_SELECT = `*,
  student:students(id, name, registration_code, class:classes!students_class_id_fkey(id, name)),
  component:components:spp_components(id, name, frequency)`
const PAYMENT_SELECT = `*,
  obligation:spp_obligations(id, period, amount, academic_year_id,
    component:spp_components(name),
    student:students(id, name, registration_code, class:classes!students_class_id_fkey(name))),
  creator:profiles(name)`

// ------------------------------------------------------------
// Komponen biaya
// ------------------------------------------------------------
export async function fetchSppComponents(academicYearId?: string): Promise<SppComponent[]> {
  let query = supabase
    .from('spp_components')
    .select('*, academic_year:academic_years(id, name)')
    .is('deleted_at', null)
    .order('name')
    .limit(500)
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as SppComponent[]
}

export async function createSppComponent(values: ComponentFormValues, academicYearId: string): Promise<SppComponent> {
  const { data, error } = await supabase
    .from('spp_components')
    .insert({
      academic_year_id: academicYearId,
      name: values.name.trim(),
      amount: values.amount,
      frequency: values.frequency,
      grade: values.grade ?? null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as SppComponent
}

export async function updateSppComponent(id: string, values: ComponentFormValues): Promise<void> {
  const { error } = await supabase
    .from('spp_components')
    .update({
      name: values.name.trim(),
      amount: values.amount,
      frequency: values.frequency,
      grade: values.grade ?? null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteSppComponent(id: string): Promise<void> {
  return softDelete('spp_components', id)
}

// ------------------------------------------------------------
// Kewajiban
// ------------------------------------------------------------
export async function fetchSppObligations(academicYearId?: string): Promise<SppObligation[]> {
  let query = supabase
    .from('spp_obligations')
    .select(OBLIGATION_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (academicYearId) query = query.eq('academic_year_id', academicYearId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as SppObligation[]
}

/** Generate kewajiban massal: semua santri aktif pada kelas (atau tingkat) target. */
export async function generateSppObligations(params: {
  componentId: string
  academicYearId: string
  amount: number
  grade: '7' | '8' | '9' | null
  classId?: string
  periods: string[]
  dueDate: string | null
}): Promise<number> {
  // target santri: kelas spesifik atau semua kelas se-tingkat
  let studentQuery = supabase
    .from('students')
    .select('id, class_id')
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(2000)
  if (params.classId) studentQuery = studentQuery.eq('class_id', params.classId)
  else if (params.grade) studentQuery = studentQuery.eq('classes.grade', params.grade)
  const { data: students, error: sErr } = await studentQuery
  if (sErr) throw sErr
  const targets = (students ?? []) as { id: string; class_id: string | null }[]
  if (targets.length === 0) return 0

  const rows = targets.flatMap((s) =>
    params.periods.map((period) => ({
      student_id: s.id,
      component_id: params.componentId,
      academic_year_id: params.academicYearId,
      amount: params.amount,
      period: period || '',
      due_date: params.dueDate,
    })),
  )

  // upsert: baris yang sudah ada (duplikat unique) dilewati
  const { error } = await supabase
    .from('spp_obligations')
    .upsert(rows, {
      onConflict: 'student_id,component_id,period',
      ignoreDuplicates: true,
    })
  if (error) throw error
  return rows.length
}

export async function deleteSppObligation(id: string): Promise<void> {
  return softDelete('spp_obligations', id)
}

// ------------------------------------------------------------
// Pembayaran
// ------------------------------------------------------------
export async function fetchSppPayments(academicYearId?: string): Promise<SppPayment[]> {
  const { data, error } = await supabase
    .from('spp_payments')
    .select(PAYMENT_SELECT)
    .order('paid_at', { ascending: false })
    .limit(2000)
  if (error) throw error
  const rows = (data ?? []) as unknown as SppPayment[]
  if (!academicYearId) return rows
  return rows.filter((p) => p.obligation?.academic_year_id === academicYearId)
}

export async function createSppPayment(values: PaymentFormValues, createdBy: string | null): Promise<SppPayment> {
  const { data, error } = await supabase
    .from('spp_payments')
    .insert({
      obligation_id: values.obligation_id,
      amount: values.amount,
      method: values.method,
      paid_at: values.paid_at,
      note: values.note?.trim() || null,
      created_by: createdBy,
    })
    .select(PAYMENT_SELECT)
    .single()
  if (error) throw error
  return data as unknown as SppPayment
}

export async function deleteSppPayment(id: string): Promise<void> {
  // Ledger: hapus fisik hanya dev/admin (RLS is_staff_deleter) — pembatalan salah catat
  const { error } = await supabase.from('spp_payments').delete().eq('id', id)
  if (error) throw error
}
