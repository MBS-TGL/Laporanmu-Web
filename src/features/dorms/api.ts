import { supabase } from '../../lib/supabase'
import type { Dorm, DormFilters, DormFormValues, DormRoom, Placement, PlacementFilters } from './types'

const SELECT_STR = '*, musyrif:teachers!dorms_musyrif_id_fkey(name)'

// Kamar volumenya kecil (puluhan) — fetch tanpa pagination supaya statistik
// (jumlah penuh, okupansi global) akurat dan filter lanjutan dihitung di klien
export async function fetchDorms(filters: DormFilters): Promise<Dorm[]> {
  let query = supabase
    .from('dorms')
    .select(SELECT_STR)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(200)

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.gender) query = query.eq('gender', filters.gender)
  if (filters.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Dorm[]
}

function payload(values: DormFormValues) {
  return {
    name: values.name,
    gender: values.gender ?? null,
    capacity: values.capacity,
    musyrif_id: values.musyrif_id || null,
    status: values.status,
  }
}

export async function createDorm(values: DormFormValues): Promise<Dorm> {
  const { data, error } = await supabase
    .from('dorms')
    .insert(payload(values))
    .select('*')
    .single()

  if (error) throw error
  return data as Dorm
}

export async function updateDorm(id: string, values: DormFormValues): Promise<Dorm> {
  const { data, error } = await supabase
    .from('dorms')
    .update(payload(values))
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Dorm
}

export async function softDeleteDorm(id: string): Promise<void> {
  // Kosongkan dulu penempatan penghuni agar tidak ada santri
  // yang menunjuk kamar yang sudah terhapus
  const { error: unassignError } = await supabase
    .from('students')
    .update({ dorm_id: null })
    .eq('dorm_id', id)
  if (unassignError) throw unassignError

  const { error } = await supabase
    .from('dorms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Kamar + okupansi (untuk modal penempatan & drawer detail)
// ------------------------------------------------------------
export async function fetchDormRooms(): Promise<DormRoom[]> {
  const { data, error } = await supabase
    .from('dorms')
    .select('id, name, gender, capacity')
    .is('deleted_at', null)
    .neq('status', 'inactive')
    .order('name', { ascending: true })
  if (error) throw error

  const { data: occupancy, error: occError } = await supabase
    .from('dorm_occupancy')
    .select('dorm_id, occupied')
  if (occError) throw occError

  const occupiedMap = new Map((occupancy ?? []).map((o) => [o.dorm_id, o.occupied as number]))
  return ((data ?? []) as Omit<DormRoom, 'occupied'>[]).map((room) => ({
    ...room,
    occupied: occupiedMap.get(room.id) ?? 0,
  }))
}

// ------------------------------------------------------------
// Penempatan santri (join kelas & asrama)
// ------------------------------------------------------------
// hint FK wajib sejak 0018 — students punya 2 FK ke classes (class_id & last_class_id)
const PLACEMENT_SELECT =
  'id, name, gender, class_id, classes!students_class_id_fkey(name), dorm_id, dorms(name)'

export async function fetchPlacements(
  filters: PlacementFilters,
): Promise<{ data: Placement[]; total: number }> {
  let query = supabase
    .from('students')
    .select(PLACEMENT_SELECT, { count: 'exact' })
    .is('deleted_at', null)

  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  if (filters.gender) query = query.eq('gender', filters.gender)
  if (filters.classId) query = query.eq('class_id', filters.classId)
  if (filters.placement === 'unassigned') query = query.is('dorm_id', null)
  if (filters.placement === 'assigned') query = query.not('dorm_id', 'is', null)

  const from = (filters.page - 1) * filters.pageSize
  const { data, count, error } = await query
    .order('name', { ascending: true })
    .range(from, from + filters.pageSize - 1)
  if (error) throw error
  return { data: (data ?? []) as unknown as Placement[], total: count ?? 0 }
}

/** Semua santri aktif — opsi modal penempatan (pola PhotoModal) */
export async function fetchPlacementOptions(): Promise<Placement[]> {
  const { data, error } = await supabase
    .from('students')
    .select(PLACEMENT_SELECT)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(1000)
  if (error) throw error
  return (data ?? []) as unknown as Placement[]
}

export async function fetchPlacementCounts(): Promise<{ assigned: number; unassigned: number }> {
  const [assignedRes, unassignedRes] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('dorm_id', 'is', null),
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .is('dorm_id', null),
  ])
  if (assignedRes.error) throw assignedRes.error
  if (unassignedRes.error) throw unassignedRes.error
  return { assigned: assignedRes.count ?? 0, unassigned: unassignedRes.count ?? 0 }
}

/** Penghuni satu kamar (drawer detail) */
export async function fetchDormResidents(dormId: string): Promise<Placement[]> {
  const { data, error } = await supabase
    .from('students')
    .select(PLACEMENT_SELECT)
    .is('deleted_at', null)
    .eq('dorm_id', dormId)
    .order('name', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as Placement[]
}

export async function assignStudents(ids: string[], dormId: string | null): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('students').update({ dorm_id: dormId }).in('id', ids)
  if (error) throw error
}

export async function fetchClassesBrief(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as { id: string; name: string }[]
}
