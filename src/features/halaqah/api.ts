import { supabase } from '../../lib/supabase'
import type { HalaqahFormValues, HalaqahGroup, HalaqahMember } from './types'

export async function fetchHalaqah(): Promise<HalaqahGroup[]> {
  const { data, error } = await supabase
    .from('halaqah_groups')
    .select('*, teachers(id, name), members:halaqah_members(count)')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as unknown as HalaqahGroup[]
}

export async function createHalaqah(values: HalaqahFormValues): Promise<HalaqahGroup> {
  const { data, error } = await supabase
    .from('halaqah_groups')
    .insert({
      name: values.name.trim(),
      musyrif_id: values.musyrif_id || null,
      gender: values.gender || null,
      place: values.place?.trim() || null,
      schedule: values.schedule?.trim() || null,
      capacity: values.capacity ?? 0,
      notes: values.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as HalaqahGroup
}

export async function updateHalaqah(id: string, values: HalaqahFormValues): Promise<HalaqahGroup> {
  const { data, error } = await supabase
    .from('halaqah_groups')
    .update({
      name: values.name.trim(),
      musyrif_id: values.musyrif_id || null,
      gender: values.gender || null,
      place: values.place?.trim() || null,
      schedule: values.schedule?.trim() || null,
      capacity: values.capacity ?? 0,
      notes: values.notes?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as HalaqahGroup
}

export async function softDeleteHalaqah(id: string): Promise<void> {
  const { error } = await supabase
    .from('halaqah_groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchHalaqahMembers(groupId: string): Promise<HalaqahMember[]> {
  const { data, error } = await supabase
    .from('halaqah_members')
    .select('*, students(id, name, registration_code, classes(name))')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('joined_at')
  if (error) throw error
  return (data ?? []) as unknown as HalaqahMember[]
}

/** Tambah anggota — yang sudah tergabung dilewati (aman dari unique aktif). */
export async function addHalaqahMembers(
  groupId: string,
  studentIds: string[],
): Promise<number> {
  const existing = await fetchHalaqahMembers(groupId)
  const existingSet = new Set(existing.map((m) => m.student_id))
  const fresh = studentIds.filter((id) => !existingSet.has(id))
  if (fresh.length === 0) return 0

  const { error } = await supabase
    .from('halaqah_members')
    .insert(fresh.map((student_id) => ({ group_id: groupId, student_id })))
  if (error) throw error
  return fresh.length
}

export async function removeHalaqahMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('halaqah_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}
