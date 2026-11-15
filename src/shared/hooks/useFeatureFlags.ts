import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { buildFlagMap } from '../constants/navItems'
import { logAudit } from '../utils/auditLogger'

export interface FeatureFlag {
  id: string
  key: string
  label: string
  category: string
  description: string | null
  enabled: boolean
  sort_order: number
  updated_at: string
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('category')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as FeatureFlag[]
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: 30_000,
  })
}

// Fail-open: flag yang tidak ada / belum ter-seed dianggap aktif,
// jadi fitur yang dikunci flag tidak tiba-tiba hilang.
export function useFlag(key: string, fallback = true): boolean {
  const { data } = useFeatureFlags()
  if (!data) return fallback
  const flag = data.find((f) => f.key === key)
  return flag ? flag.enabled : fallback
}

// Peta key → enabled untuk filter menu (navItems). undefined saat data
// belum termuat, sehingga menu tetap tampil penuh (fail-open).
export function useFlagMap(): Record<string, boolean> | undefined {
  const { data } = useFeatureFlags()
  return buildFlagMap(data)
}

export function useToggleFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean; key: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled, updated_by: user?.id ?? null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_data, { id, enabled, key }) => {
      void qc.invalidateQueries({ queryKey: ['feature-flags'] })
      void logAudit({
        action: 'UPDATE',
        source: 'SYSTEM',
        tableName: 'feature_flags',
        recordId: id,
        newData: { key, enabled },
      })
    },
  })
}

// ─── CRUD flag penuh (tab Pengaturan Developer) ──────────────────────────────

export interface FlagInput {
  id?: string
  key: string
  label: string
  category: string
  description: string | null
  sort_order: number
  enabled: boolean
}

export async function saveFlag(input: FlagInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const payload = { ...input, updated_by: user?.id ?? null }
  if (input.id) {
    const { id, ...updates } = payload
    const { error } = await supabase.from('feature_flags').update(updates).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('feature_flags').insert(payload)
    if (error) throw error
  }
}

export async function deleteFlag(id: string): Promise<void> {
  const { error } = await supabase.from('feature_flags').delete().eq('id', id)
  if (error) throw error
}

export function useSaveFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveFlag,
    onSuccess: (_d, input) => {
      void qc.invalidateQueries({ queryKey: ['feature-flags'] })
      void logAudit({
        action: input.id ? 'UPDATE' : 'INSERT',
        source: 'SYSTEM',
        tableName: 'feature_flags',
        recordId: input.id ?? input.key,
        newData: { key: input.key, label: input.label, enabled: input.enabled },
      })
    },
  })
}

export function useDeleteFlag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; key: string }) => deleteFlag(id),
    onSuccess: (_d, { id, key }) => {
      void qc.invalidateQueries({ queryKey: ['feature-flags'] })
      void logAudit({
        action: 'DELETE',
        source: 'SYSTEM',
        tableName: 'feature_flags',
        recordId: id,
        newData: { key },
      })
    },
  })
}
