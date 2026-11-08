import { supabase } from '../../lib/supabase'
import type { HealthLog, HealthFormValues, HealthMedicine, HealthMedicineFormValues } from './types'

// ------------------------------------------------------------
// Obat
// ------------------------------------------------------------
export async function fetchMedicines(): Promise<HealthMedicine[]> {
  const { data, error } = await supabase
    .from('health_medicines')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as HealthMedicine[]
}

export async function createMedicine(values: HealthMedicineFormValues): Promise<HealthMedicine> {
  const { data, error } = await supabase
    .from('health_medicines')
    .insert({
      name: values.name,
      category: values.category || null,
      stock: values.stock,
      unit: values.unit,
      min_stock: values.min_stock,
      description: values.description || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as HealthMedicine
}

export async function updateMedicine(
  id: string,
  values: HealthMedicineFormValues,
): Promise<HealthMedicine> {
  const { data, error } = await supabase
    .from('health_medicines')
    .update({
      name: values.name,
      category: values.category || null,
      stock: values.stock,
      unit: values.unit,
      min_stock: values.min_stock,
      description: values.description || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as HealthMedicine
}

export async function deleteMedicine(id: string): Promise<void> {
  const { error } = await supabase.from('health_medicines').delete().eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Log kunjungan
// ------------------------------------------------------------
export async function fetchHealthLogs(): Promise<HealthLog[]> {
  const { data, error } = await supabase
    .from('health_logs')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
  if (error) throw error
  return (data ?? []) as HealthLog[]
}

export interface CreateHealthLogInput {
  values: HealthFormValues
  studentName: string
  className: string | null
  medicine: HealthMedicine | null
  createdBy: string | null
}

// Insert log + deduksi stok obat (floor 0) — satu aksi pengunjung baru
export async function createHealthLog(input: CreateHealthLogInput): Promise<HealthLog> {
  const { values, studentName, className, medicine, createdBy } = input

  const { data, error } = await supabase
    .from('health_logs')
    .insert({
      date: values.date,
      time: values.time,
      student_id: values.student_id,
      student_name: studentName,
      class_name: className,
      complaint: values.complaint,
      diagnosis: values.diagnosis || null,
      treatment: values.treatment,
      medicine_id: medicine?.id ?? null,
      medicine_name: medicine ? `${medicine.name} (${values.medicine_qty ?? 1} ${medicine.unit})` : null,
      medicine_qty: medicine ? values.medicine_qty ?? 0 : 0,
      status: values.status,
      created_by: createdBy,
    })
    .select('*')
    .single()
  if (error) throw error

  if (medicine && (values.medicine_qty ?? 0) > 0) {
    const nextStock = Math.max(0, medicine.stock - (values.medicine_qty ?? 0))
    const { error: stockError } = await supabase
      .from('health_medicines')
      .update({ stock: nextStock })
      .eq('id', medicine.id)
    if (stockError) throw stockError
  }

  return data as HealthLog
}

export async function updateHealthLogStatus(id: string, status: HealthLog['status']): Promise<void> {
  const { error } = await supabase.from('health_logs').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteHealthLog(id: string): Promise<void> {
  const { error } = await supabase.from('health_logs').delete().eq('id', id)
  if (error) throw error
}
