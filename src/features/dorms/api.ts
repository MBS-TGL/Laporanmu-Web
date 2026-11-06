import { supabase } from '../../lib/supabase'
import type { Dorm, DormFilters, DormFormValues } from './types'

const SELECT_STR = '*, musyrif:teachers!dorms_musyrif_id_fkey(name)'

export async function fetchDorms(filters: DormFilters): Promise<{ data: Dorm[]; total: number }> {
  const { search, gender, page, pageSize } = filters
  const from = (page - 1) * pageSize

  let query = supabase
    .from('dorms')
    .select(SELECT_STR, { count: 'exact' })
    .is('deleted_at', null)

  if (search) query = query.ilike('name', `%${search}%`)
  if (gender) query = query.eq('gender', gender)

  const { data, count, error } = await query
    .order('name', { ascending: true })
    .range(from, from + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as unknown as Dorm[], total: count ?? 0 }
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
  const { error } = await supabase
    .from('dorms')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
