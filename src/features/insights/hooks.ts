import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchInsightLogs, fetchSnapshot } from './api'

export function useSnapshot() {
  return useQuery({
    queryKey: ['insights', 'snapshot'],
    queryFn: fetchSnapshot,
    staleTime: 60_000,
  })
}

/** Riwayat snapshot analisis (tabel insight_logs, migrasi 0062) — 10 terakhir. */
export function useInsightLogs(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['insights', 'logs'],
    queryFn: fetchInsightLogs,
    staleTime: 30_000,
    enabled: opts?.enabled,
  })
}

export function useInvalidateInsightLogs() {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['insights', 'logs'] })
}
