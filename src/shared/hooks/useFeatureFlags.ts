import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
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
