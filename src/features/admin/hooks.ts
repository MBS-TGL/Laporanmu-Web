import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createStaffUser,
  deleteStorageFiles,
  fetchAuditActivity,
  fetchAuditLogs,
  fetchBuckets,
  fetchIntegrityIssues,
  fetchLargestFiles,
  fetchOrphanFiles,
  fetchTeachersForLinking,
  fetchProfiles,
  fetchTableStats,
  sendPasswordResetEmail,
  setTeacherProfileLink,
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

// ------------------------------------------------------------
// Link guru ↔ akun & reset password
// ------------------------------------------------------------
export function useTeachersForLinking() {
  return useQuery({
    queryKey: ['admin', 'teachers-for-linking'],
    queryFn: fetchTeachersForLinking,
    staleTime: 60_000,
  })
}

export function useSetTeacherLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teacherId, profileId }: { teacherId: string; profileId: string | null }) =>
      setTeacherProfileLink(teacherId, profileId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'teachers-for-linking'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'integrity'] })
      void qc.invalidateQueries({ queryKey: ['teachers'] })
    },
  })
}

export function useSendPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => sendPasswordResetEmail(email),
  })
}

export function useCreateStaffUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStaffUser,
    // Akun baru muncul di daftar profil & status link guru berubah
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'profiles'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'teachers-for-linking'] })
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
export function useTableStats(opts?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['admin', 'table-stats'],
    queryFn: fetchTableStats,
    // Hitungan per tabel mahal (puluhan head-count) — anggap segar 1 menit
    staleTime: 60_000,
    refetchInterval: opts?.refetchInterval,
  })
}

export function useIntegrityIssues(opts?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['admin', 'integrity'],
    queryFn: fetchIntegrityIssues,
    staleTime: 60_000,
    refetchInterval: opts?.refetchInterval,
  })
}

export function useAuditActivity(days = 7) {
  return useQuery({
    queryKey: ['admin', 'audit-activity', days],
    queryFn: () => fetchAuditActivity(days),
    staleTime: 60_000,
  })
}

// ------------------------------------------------------------
// Storage
// ------------------------------------------------------------
export function useBuckets() {
  return useQuery({
    queryKey: ['admin', 'buckets'],
    queryFn: fetchBuckets,
    staleTime: 5 * 60_000,
  })
}

export function useLargestFiles() {
  return useQuery({
    queryKey: ['admin', 'storage-largest'],
    queryFn: () => fetchLargestFiles(),
    staleTime: 60_000,
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
