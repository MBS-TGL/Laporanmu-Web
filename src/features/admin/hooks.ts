import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAuditLogs, fetchProfiles, updateProfile, type AuditFilters } from './api'

export function useProfiles() {
  return useQuery({
    queryKey: ['admin', 'profiles'],
    queryFn: fetchProfiles,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { name?: string; role?: string } }) =>
      updateProfile(id, updates),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: () => fetchAuditLogs(filters),
  })
}
