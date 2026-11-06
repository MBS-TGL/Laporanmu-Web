import { supabase } from '../../lib/supabase'
import type { AdminProfile, AuditLog } from './types'

// ------------------------------------------------------------
// Manajemen pengguna (dev/admin)
// ------------------------------------------------------------
export async function fetchProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name')
  if (error) throw error
  return (data ?? []) as AdminProfile[]
}

export async function updateProfile(
  id: string,
  updates: { name?: string; role?: string },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', id)
  if (error) throw error
}

// ------------------------------------------------------------
// Audit log viewer
// ------------------------------------------------------------
export interface AuditFilters {
  source?: string
  action?: string
  tableName?: string
  search?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}

export async function fetchAuditLogs(
  filters: AuditFilters,
): Promise<{ data: AuditLog[]; total: number }> {
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.source) query = query.eq('source', filters.source)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.tableName) query = query.eq('table_name', filters.tableName)
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`)
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59Z`)
  if (filters.search) {
    const term = `%${filters.search}%`
    query = query.or(`actor_name.ilike.${term},table_name.ilike.${term},action.ilike.${term}`)
  }

  const from = (filters.page - 1) * filters.pageSize
  const { data, count, error } = await query.range(from, from + filters.pageSize - 1)
  if (error) throw error
  return { data: (data ?? []) as AuditLog[], total: count ?? 0 }
}
