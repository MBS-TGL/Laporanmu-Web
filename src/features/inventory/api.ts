import { supabase } from '../../lib/supabase'
import type { ItemFormValues, InventoryItem } from './types'

export async function fetchItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .is('deleted_at', null)
    .order('name')
    .limit(1000)
  if (error) throw error
  return (data ?? []) as InventoryItem[]
}

export async function createItem(values: ItemFormValues): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      name: values.name.trim(),
      code: values.code?.trim() || null,
      category: values.category?.trim() || null,
      quantity: values.quantity ?? 0,
      unit: values.unit?.trim() || null,
      condition: values.condition,
      location: values.location?.trim() || null,
      min_quantity: values.min_quantity ?? 0,
      acquired_at: values.acquired_at || null,
      price: values.price ?? null,
      source: values.source?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as InventoryItem
}

export async function updateItem(id: string, values: ItemFormValues): Promise<InventoryItem> {
  const { data, error } = await supabase
    .from('inventory_items')
    .update({
      name: values.name.trim(),
      code: values.code?.trim() || null,
      category: values.category?.trim() || null,
      quantity: values.quantity ?? 0,
      unit: values.unit?.trim() || null,
      condition: values.condition,
      location: values.location?.trim() || null,
      min_quantity: values.min_quantity ?? 0,
      acquired_at: values.acquired_at || null,
      price: values.price ?? null,
      source: values.source?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as InventoryItem
}

export async function softDeleteItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function itemCodeExists(code: string, excludeId?: string): Promise<boolean> {
  let query = supabase
    .from('inventory_items')
    .select('id', { count: 'exact', head: true })
    .eq('code', code)
    .is('deleted_at', null)
  if (excludeId) query = query.neq('id', excludeId)
  const { count, error } = await query
  if (error) throw error
  return (count ?? 0) > 0
}
