import { useQuery } from '@tanstack/react-query'
import { fetchSnapshot } from './api'

export function useSnapshot() {
  return useQuery({
    queryKey: ['insights', 'snapshot'],
    queryFn: fetchSnapshot,
    staleTime: 60_000,
  })
}
