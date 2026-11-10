import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncements,
  fetchPublicAnnouncements,
  updateAnnouncement,
  type AnnouncementFilters,
} from './api'
import type { AnnouncementPatch } from './types'

export function useAnnouncements(filters: AnnouncementFilters) {
  return useQuery({
    queryKey: ['announcements', filters],
    queryFn: () => fetchAnnouncements(filters),
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: AnnouncementPatch) => createAnnouncement(patch),
    onSuccess: (created) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'announcements',
        recordId: created.id,
        newData: { title: created.title, category: created.category, is_published: created.is_published },
      })
      void qc.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AnnouncementPatch }) =>
      updateAnnouncement(id, patch),
    onSuccess: (updated, variables) => {
      // Log hanya perubahan yang relevan (bukan snapshot penuh)
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'announcements',
        recordId: variables.id,
        newData: {
          title: updated.title,
          is_published: updated.is_published,
          is_pinned: updated.is_pinned,
          is_public: updated.is_public,
        },
      })
      void qc.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'announcements', recordId: id })
      void qc.invalidateQueries({ queryKey: ['announcements'] })
    },
  })
}

// ------------------------------------------------------------
// Portal publik (landing, /check) — cache 5 menit supaya navigasi
// bolak-balik tidak refetch; gagal fetch diperlakukan non-kritis
// ------------------------------------------------------------
export function usePublicAnnouncements(limit?: number) {
  return useQuery({
    queryKey: ['announcements', 'public', limit ?? null],
    queryFn: async () => {
      const rows = await fetchPublicAnnouncements()
      return limit ? rows.slice(0, limit) : rows
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
