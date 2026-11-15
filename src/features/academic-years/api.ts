import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import type {
  AcademicYear,
  AcademicYearFilters,
  Room,
  RoomFormValues,
  TimeSlot,
  SlotFormValues,
  YearFormValues,
} from './types'

export async function fetchAcademicYears(
  filters: AcademicYearFilters,
): Promise<{ data: AcademicYear[]; total: number }> {
  const { search, page, pageSize } = filters
  const from = (page - 1) * pageSize

  let query = supabase
    .from('academic_years')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as AcademicYear[], total: count ?? 0 }
}

export async function createAcademicYear(values: YearFormValues): Promise<AcademicYear> {
  const { data, error } = await supabase
    .from('academic_years')
    .insert({
      name: values.name,
      semester: values.semester,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      curriculum: values.curriculum || null,
      is_active: values.makeActive ?? false,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as AcademicYear
}

export async function updateAcademicYear(
  id: string,
  values: YearFormValues,
): Promise<AcademicYear> {
  const { data, error } = await supabase
    .from('academic_years')
    .update({
      name: values.name,
      semester: values.semester,
      start_date: values.start_date || null,
      end_date: values.end_date || null,
      curriculum: values.curriculum || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as AcademicYear
}

export async function softDeleteAcademicYear(id: string): Promise<void> {
  const { error } = await supabase
    .from('academic_years')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Nonaktifkan semua tahun lain, lalu aktifkan target (urutan sama seperti legacy). */
export async function setActiveAcademicYear(id: string): Promise<void> {
  const deactivate = await supabase
    .from('academic_years')
    .update({ is_active: false })
    .neq('id', id)
  if (deactivate.error) throw deactivate.error

  const activate = await supabase
    .from('academic_years')
    .update({ is_active: true })
    .eq('id', id)
  if (activate.error) throw activate.error
}

// ─── Slot Jam (time_slots) ──────────────────────────────────────────────────

export async function fetchTimeSlots(academicYearId: string): Promise<TimeSlot[]> {
  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .eq('academic_year_id', academicYearId)
    .is('deleted_at', null)
    .order('sort_order')
    .order('start_time')
  if (error) throw error
  return (data ?? []) as TimeSlot[]
}

export async function createTimeSlot(
  academicYearId: string,
  values: SlotFormValues,
): Promise<TimeSlot> {
  const { data, error } = await supabase
    .from('time_slots')
    .insert({ academic_year_id: academicYearId, ...values })
    .select('*')
    .single()
  if (error) throw error
  return data as TimeSlot
}

export async function updateTimeSlot(id: string, values: SlotFormValues): Promise<TimeSlot> {
  const { data, error } = await supabase
    .from('time_slots')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as TimeSlot
}

export async function softDeleteTimeSlot(id: string): Promise<void> {
  return softDelete('time_slots', id)
}

/**
 * Buat slot standar sekali klik, mengikuti struktur hari pondok:
 * Sholat Dhuha → Upacara/Apel → Jam 1–5 → Istirahat & Dzuhur di tengah →
 * Jam 6–7 → Tahfidz → Sholat Ashar (07.00–15.30, 7 jam KBM).
 */
export async function createDefaultTimeSlots(academicYearId: string): Promise<number> {
  const preset = [
    { name: 'Sholat Dhuha', start_time: '07:00', end_time: '07:30', sort_order: 1, is_break: true },
    { name: 'Upacara / Apel', start_time: '07:30', end_time: '08:10', sort_order: 2, is_break: true },
    { name: 'Jam Ke-1', start_time: '08:10', end_time: '08:50', sort_order: 3, is_break: false },
    { name: 'Jam Ke-2', start_time: '08:50', end_time: '09:30', sort_order: 4, is_break: false },
    { name: 'Istirahat', start_time: '09:30', end_time: '09:45', sort_order: 5, is_break: true },
    { name: 'Jam Ke-3', start_time: '09:45', end_time: '10:25', sort_order: 6, is_break: false },
    { name: 'Jam Ke-4', start_time: '10:25', end_time: '11:05', sort_order: 7, is_break: false },
    { name: 'Jam Ke-5', start_time: '11:05', end_time: '11:45', sort_order: 8, is_break: false },
    { name: 'Dzuhur + Istirahat', start_time: '11:45', end_time: '12:45', sort_order: 9, is_break: true },
    { name: 'Jam Ke-6', start_time: '12:45', end_time: '13:25', sort_order: 10, is_break: false },
    { name: 'Jam Ke-7', start_time: '13:25', end_time: '14:05', sort_order: 11, is_break: false },
    { name: 'Tahfidz', start_time: '14:05', end_time: '14:40', sort_order: 12, is_break: true },
    { name: 'Sholat Ashar', start_time: '14:40', end_time: '15:30', sort_order: 13, is_break: true },
  ]
  const { error } = await supabase
    .from('time_slots')
    .insert(preset.map((p) => ({ ...p, academic_year_id: academicYearId })))
  if (error) throw error
  return preset.length
}

// ─── Ruang KBM (rooms) ──────────────────────────────────────────────────────

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as Room[]
}

export async function createRoom(values: RoomFormValues): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name: values.name.trim(),
      code: values.code?.trim() || null,
      capacity: values.capacity ?? null,
      notes: values.notes?.trim() || null,
      is_active: values.is_active,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Room
}

export async function updateRoom(id: string, values: RoomFormValues): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .update({
      name: values.name.trim(),
      code: values.code?.trim() || null,
      capacity: values.capacity ?? null,
      notes: values.notes?.trim() || null,
      is_active: values.is_active,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Room
}

export async function softDeleteRoom(id: string): Promise<void> {
  return softDelete('rooms', id)
}
