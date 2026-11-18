/**
 * P5b Multi-entity — daftar lembaga (yayasan/cabang/sekolah).
 * Konteks entity staff dikirim lewat request header `app.current_entity`
 * yang dibaca RLS `current_entity_id()` (migration 0052).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { softDelete } from '../../shared/api/crud'
import { logAudit } from '../../shared/utils/auditLogger'

export interface Entity {
  id: string
  name: string
  code: string
  type: 'sekolah' | 'cabang' | 'yayasan'
  is_active: boolean
  sort_order: number
}

export interface EntityFormValues {
  name: string
  code: string
  type: Entity['type']
}

export async function fetchEntities(): Promise<Entity[]> {
  const { data, error } = await supabase
    .from('entities')
    .select('id, name, code, type, is_active, sort_order')
    .is('deleted_at', null)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Entity[]
}

export async function createEntity(values: EntityFormValues): Promise<Entity> {
  const { data, error } = await supabase
    .from('entities')
    .insert({
      name: values.name.trim(),
      code: values.code.trim().toLowerCase(),
      type: values.type,
      sort_order: 99,
    })
    .select('*')
    .single()
  if (error) throw error
  void logAudit({
    action: 'INSERT',
    source: 'SYSTEM',
    tableName: 'entities',
    recordId: data.id,
    newData: data,
  })
  return data as Entity
}

export async function updateEntity(id: string, values: Partial<EntityFormValues> & { is_active?: boolean }): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (values.name !== undefined) payload.name = values.name.trim()
  if (values.code !== undefined) payload.code = values.code.trim().toLowerCase()
  if (values.type !== undefined) payload.type = values.type
  if (values.is_active !== undefined) payload.is_active = values.is_active
  const { error } = await supabase.from('entities').update(payload).eq('id', id)
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'SYSTEM',
    tableName: 'entities',
    recordId: id,
    newData: payload,
  })
}

export async function deleteEntity(id: string): Promise<void> {
  return softDelete('entities', id)
}

export function useEntities() {
  return useQuery({ queryKey: ['entities'], queryFn: fetchEntities, staleTime: 5 * 60_000 })
}

export function useCreateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEntity,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['entities'] }),
  })
}

export function useUpdateEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<EntityFormValues> & { is_active?: boolean } }) =>
      updateEntity(id, values),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['entities'] }),
  })
}

export function useDeleteEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteEntity,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['entities'] }),
  })
}
