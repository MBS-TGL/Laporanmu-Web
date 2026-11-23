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
  // Stok berjalan dikelola lewat inventory_movements; form edit tidak
  // mengirim quantity (field disabled), jadi jangan menimpanya dengan 0.
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    code: values.code?.trim() || null,
    category: values.category?.trim() || null,
    unit: values.unit?.trim() || null,
    condition: values.condition,
    location: values.location?.trim() || null,
    min_quantity: values.min_quantity ?? 0,
    acquired_at: values.acquired_at || null,
    price: values.price ?? null,
    source: values.source?.trim() || null,
    notes: values.notes?.trim() || null,
  }
  if (values.quantity !== undefined) payload.quantity = values.quantity

  const { data, error } = await supabase
    .from('inventory_items')
    .update(payload)
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

// ─── Mutasi stok (0069) ─────────────────────────────────────────────────────
// quantity TIDAK lagi diedit langsung di form; perubahan lewat ledger
// inventory_movements agar ada riwayat masuk/keluar/rusak/hilang.

export type MovementKind = 'in' | 'out' | 'damage' | 'loss' | 'adjustment'

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  in: 'Barang Masuk',
  out: 'Barang Keluar',
  damage: 'Rusak',
  loss: 'Hilang',
  adjustment: 'Penyesuaian Stok',
}

export interface InventoryMovement {
  id: string
  item_id: string
  kind: MovementKind
  quantity: number
  note: string | null
  actor_id: string | null
  created_at: string
  profiles?: { name: string } | null
}

export async function fetchMovements(itemId: string): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('id, item_id, kind, quantity, note, actor_id, created_at, profiles(name)')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as InventoryMovement[]
}

export async function createMovement(input: {
  itemId: string
  kind: MovementKind
  quantity: number
  note?: string | null
  actorId: string | null
}): Promise<void> {
  const { error } = await supabase.from('inventory_movements').insert({
    item_id: input.itemId,
    kind: input.kind,
    quantity: input.quantity,
    note: input.note?.trim() || null,
    actor_id: input.actorId,
  })
  if (error) throw error
}
