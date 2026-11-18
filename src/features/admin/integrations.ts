/**
 * P5a Connectivity — API key webhook PPDB.
 * Raw key hanya ditampilkan SEKALI saat dibuat (DB simpan sha256,
 * lihat migration 0051). Cabut = revoked_at (jejak tetap ada).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface ApiKeyUsage {
  last24h: number
  lastMinute: number
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ApiKey[]
}

export async function fetchApiKeyUsage(): Promise<ApiKeyUsage> {
  const now = Date.now()
  const [day, minute] = await Promise.all([
    supabase
      .from('api_request_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - 24 * 3600_000).toISOString()),
    supabase
      .from('api_request_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - 60_000).toISOString()),
  ])
  return { last24h: day.count ?? 0, lastMinute: minute.count ?? 0 }
}

export async function createApiKey(name: string): Promise<{ id: string; rawKey: string }> {
  const { data, error } = await supabase.rpc('create_api_key', { p_name: name })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { id: string; raw_key: string }
  void logAudit({
    action: 'INSERT',
    source: 'SYSTEM',
    tableName: 'api_keys',
    recordId: row.id,
    newData: { name },
  })
  return { id: row.id, rawKey: row.raw_key }
}

export async function revokeApiKey(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  void logAudit({
    action: 'UPDATE',
    source: 'SYSTEM',
    tableName: 'api_keys',
    recordId: id,
    newData: { name, revoked: true },
  })
}

export function useApiKeys() {
  return useQuery({ queryKey: ['api-keys'], queryFn: fetchApiKeys })
}

export function useApiKeyUsage() {
  return useQuery({
    queryKey: ['api-keys', 'usage'],
    queryFn: fetchApiKeyUsage,
    staleTime: 30_000,
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useRevokeApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => revokeApiKey(id, name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}
