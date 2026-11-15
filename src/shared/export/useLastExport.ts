import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Info ekspor terakhir untuk satu tabel — dari audit_logs (action=EXPORT). */
export interface LastExportInfo {
  createdAt: string
  actorName: string | null
  /** Format dari new_data audit ('xlsx' | 'csv' | custom onExport). */
  format: string | null
  /** Jumlah baris dari new_data audit. */
  count: number | null
}

interface ExportAuditData {
  format?: string
  count?: number
}

async function fetchLastExport(tableName: string): Promise<LastExportInfo | null> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('created_at, actor_name, new_data')
    .eq('action', 'EXPORT')
    .eq('table_name', tableName)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const newData = (data.new_data ?? {}) as ExportAuditData
  return {
    createdAt: data.created_at,
    actorName: data.actor_name ?? null,
    format: newData.format ?? null,
    count: typeof newData.count === 'number' ? newData.count : null,
  }
}

/**
 * Ekspor terakhir satu tabel (dipakai ExportModal untuk baris info kecil).
 * enabled=false → query idle; invalidasi dengan key ['audit','last-export',table]
 * setelah ekspor baru tercatat.
 */
export function useLastExport(tableName: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['audit', 'last-export', tableName],
    queryFn: () => fetchLastExport(tableName as string),
    enabled: Boolean(tableName) && enabled,
    staleTime: 30_000,
    retry: false,
  })
}
