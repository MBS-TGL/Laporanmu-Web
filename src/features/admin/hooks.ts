import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteStorageFiles,
  fetchAuditActivity,
  fetchAuditLogs,
  fetchBuckets,
  fetchIntegrityIssues,
  fetchLargestFiles,
  fetchOrphanFiles,
  fetchProfiles,
  fetchTableStats,
  updateProfile,
  type AuditFilters,
} from './api'

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

// ------------------------------------------------------------
// Kesehatan database
// ------------------------------------------------------------
export function useTableStats() {
  return useQuery({
    queryKey: ['admin', 'table-stats'],
    queryFn: fetchTableStats,
  })
}

export function useIntegrityIssues() {
  return useQuery({
    queryKey: ['admin', 'integrity'],
    queryFn: fetchIntegrityIssues,
  })
}

export function useAuditActivity(days = 7) {
  return useQuery({
    queryKey: ['admin', 'audit-activity', days],
    queryFn: () => fetchAuditActivity(days),
  })
}

// ------------------------------------------------------------
// Storage
// ------------------------------------------------------------
export function useBuckets() {
  return useQuery({
    queryKey: ['admin', 'buckets'],
    queryFn: fetchBuckets,
  })
}

export function useLargestFiles() {
  return useQuery({
    queryKey: ['admin', 'storage-largest'],
    queryFn: () => fetchLargestFiles(),
  })
}

// Scan orphan mahal — tidak otomatis, dijalankan manual lewat refetch()
export function useOrphanScan() {
  return useQuery({
    queryKey: ['admin', 'storage-orphan'],
    queryFn: fetchOrphanFiles,
    enabled: false,
  })
}

export function useDeleteStorageFiles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bucket, names }: { bucket: string; names: string[] }) =>
      deleteStorageFiles(bucket, names),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'storage-largest'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'storage-orphan'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'buckets'] })
    },
  })
}
