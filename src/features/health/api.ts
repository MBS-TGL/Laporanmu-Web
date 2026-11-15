import { supabase } from '../../lib/supabase'
import type {
  HealthLog,
  HealthFormValues,
  HealthMedicine,
  HealthMedicineFormValues,
  HealthStatus,
} from './types'

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
    // Pengaman pertumbuhan: tabel log bisa membengkak tanpa batas.
    .limit(5000)
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

// ------------------------------------------------------------
// Operasi massal: roster impor, insert log chunked, upsert obat
// ------------------------------------------------------------

export interface StudentRosterEntry {
  id: string
  name: string
  registration_code: string
  class_name: string | null
}

/** Roster ringan untuk pencocokan impor (kode → nama → snapshot kelas). */
export async function fetchStudentRoster(): Promise<StudentRosterEntry[]> {
  const { data, error } = await supabase
    .from('students')
    // hint FK wajib sejak 0018 — students punya 2 FK ke classes
    .select('id, name, registration_code, classes!students_class_id_fkey(name)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return ((data ?? []) as unknown as { id: string; name: string; registration_code: string; classes?: { name: string } | null }[]).map(
    (s) => ({ id: s.id, name: s.name, registration_code: s.registration_code, class_name: s.classes?.name ?? null }),
  )
}

export interface NewHealthLogRow {
  date: string
  time: string
  student_id: string | null
  student_name: string
  class_name: string | null
  complaint: string
  diagnosis: string | null
  treatment: string | null
  medicine_id: string | null
  medicine_name: string | null
  medicine_qty: number
  status: HealthStatus
  created_by: string | null
}

export interface BulkInsertResult {
  successful: number
  failed: number
  errors: { row: number; error: string }[]
}

const INSERT_CHUNK_SIZE = 500

/** Insert log massal per chunk; chunk gagal diulang baris-per-baris (pola importAlumniBatch). */
export async function bulkInsertHealthLogs(
  rows: NewHealthLogRow[],
  onProgress?: (processed: number, total: number) => void,
): Promise<BulkInsertResult> {
  let successful = 0
  const errors: { row: number; error: string }[] = []

  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + INSERT_CHUNK_SIZE)
    const { error } = await supabase.from('health_logs').insert(chunk)

    if (!error) {
      successful += chunk.length
    } else {
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowError } = await supabase.from('health_logs').insert(chunk[j])
        if (rowError) errors.push({ row: i + j, error: rowError.message })
        else successful++
      }
    }
    onProgress?.(Math.min(i + INSERT_CHUNK_SIZE, rows.length), rows.length)
  }

  return { successful, failed: errors.length, errors }
}

export async function deleteHealthLogsBulk(ids: string[]): Promise<void> {
  const { error } = await supabase.from('health_logs').delete().in('id', ids)
  if (error) throw error
}

/** Update stok absolut (dipakai restock dan deduksi impor). */
export async function updateMedicineStock(id: string, stock: number): Promise<void> {
  const { error } = await supabase.from('health_medicines').update({ stock }).eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Upsert obat (nama sebagai kunci pencocokan, bukan constraint DB)
// ------------------------------------------------------------

export interface MedicineUpsertPayload {
  /** Nomor baris sumber (untuk laporan error) */
  row: number
  /** id obat existing — null = insert baru */
  id: string | null
  values: HealthMedicineFormValues
}

export interface BulkUpsertResult {
  inserted: number
  updated: number
  failed: number
  errors: { row: number; error: string }[]
}

/**
 * Upsert obat massal: baris dengan `id` diupdate satu-per-satu,
 * baris baru di-insert per chunk dengan fallback baris-per-baris.
 */
export async function bulkUpsertMedicines(
  payloads: MedicineUpsertPayload[],
  onProgress?: (processed: number, total: number) => void,
): Promise<BulkUpsertResult> {
  const inserts = payloads.filter((p) => p.id === null)
  const updates = payloads.filter((p) => p.id !== null)
  const errors: { row: number; error: string }[] = []
  let inserted = 0
  let updated = 0
  let processed = 0
  const total = payloads.length

  for (const u of updates) {
    const { error } = await supabase
      .from('health_medicines')
      .update({
        name: u.values.name,
        category: u.values.category || null,
        stock: u.values.stock,
        unit: u.values.unit,
        min_stock: u.values.min_stock,
        description: u.values.description || null,
      })
      .eq('id', u.id as string)
    if (error) errors.push({ row: u.row, error: error.message })
    else updated++
    processed++
    onProgress?.(processed, total)
  }

  const toInsert = inserts.map((p) => ({
    name: p.values.name,
    category: p.values.category || null,
    stock: p.values.stock,
    unit: p.values.unit,
    min_stock: p.values.min_stock,
    description: p.values.description || null,
  }))

  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE)
    const { error } = await supabase.from('health_medicines').insert(chunk)
    if (!error) {
      inserted += chunk.length
    } else {
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowError } = await supabase.from('health_medicines').insert(chunk[j])
        if (rowError) errors.push({ row: inserts[i + j].row, error: rowError.message })
        else inserted++
      }
    }
    processed += chunk.length
    onProgress?.(Math.min(processed, total), total)
  }

  return { inserted, updated, failed: errors.length, errors }
}
