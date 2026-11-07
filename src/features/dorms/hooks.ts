import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  assignStudents,
  createDorm,
  fetchClassesBrief,
  fetchDormResidents,
  fetchDormRooms,
  fetchDorms,
  fetchPlacementCounts,
  fetchPlacementOptions,
  fetchPlacements,
  softDeleteDorm,
  updateDorm,
} from './api'
import type { DormFilters, DormFormValues, PlacementFilters } from './types'

export function useDorms(filters: DormFilters) {
  return useQuery({
    queryKey: ['dorms', filters],
    queryFn: () => fetchDorms(filters),
  })
}

export function useDormRooms() {
  return useQuery({
    queryKey: ['dorms', 'rooms'],
    queryFn: fetchDormRooms,
    staleTime: 30_000,
  })
}

export interface DormOccupancy {
  dorm_id: string
  occupied: number
}

// View dorm_occupancy (0009_views.sql). Kalau view belum ada, kembalikan
// array kosong agar halaman tetap jalan (okupansi tampil 0).
export function useDormOccupancy() {
  return useQuery({
    queryKey: ['dorm-occupancy'],
    queryFn: async (): Promise<DormOccupancy[]> => {
      try {
        const { data, error } = await supabase.from('dorm_occupancy').select('*')
        if (error) return []
        return (data ?? []) as DormOccupancy[]
      } catch {
        return []
      }
    },
    staleTime: 60_000,
  })
}

export function useMusyrifBrief() {
  return useQuery({
    queryKey: ['teachers', 'brief'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, name')
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      return (data ?? []) as { id: string; name: string }[]
    },
  })
}

// ------------------------------------------------------------
// Penempatan santri
// ------------------------------------------------------------
export function usePlacements(filters: PlacementFilters) {
  return useQuery({
    queryKey: ['placements', filters],
    queryFn: () => fetchPlacements(filters),
  })
}

/** Opsi santri untuk modal penempatan — satu fetch, dicari via Select */
export function usePlacementOptions() {
  return useQuery({
    queryKey: ['placements', 'options'],
    queryFn: fetchPlacementOptions,
    staleTime: 30_000,
  })
}

export function usePlacementCounts() {
  return useQuery({
    queryKey: ['placements', 'counts'],
    queryFn: fetchPlacementCounts,
    staleTime: 30_000,
  })
}

export function useDormResidents(dormId: string | null) {
  return useQuery({
    queryKey: ['placements', 'residents', dormId],
    queryFn: () => fetchDormResidents(dormId as string),
    enabled: !!dormId,
  })
}

export function useClassesBrief() {
  return useQuery({
    queryKey: ['classes', 'brief'],
    queryFn: fetchClassesBrief,
    staleTime: 60_000,
  })
}

function useInvalidateDormData() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['dorms'] })
    void qc.invalidateQueries({ queryKey: ['dorm-occupancy'] })
    void qc.invalidateQueries({ queryKey: ['placements'] })
    void qc.invalidateQueries({ queryKey: ['students'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

// ------------------------------------------------------------
// Mutations — semua ter-audit (logAudit fire-and-forget)
// ------------------------------------------------------------
export function useCreateDorm() {
  const invalidate = useInvalidateDormData()
  return useMutation({
    mutationFn: (values: DormFormValues) => createDorm(values),
    onSuccess: (created) => {
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'dorms',
        recordId: created.id,
        newData: { name: created.name, gender: created.gender, capacity: created.capacity, status: created.status },
      })
      invalidate()
    },
  })
}

export function useUpdateDorm() {
  const invalidate = useInvalidateDormData()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: DormFormValues }) => updateDorm(id, values),
    onSuccess: (updated, variables) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'dorms',
        recordId: variables.id,
        newData: { name: updated.name, gender: updated.gender, capacity: updated.capacity, status: updated.status },
      })
      invalidate()
    },
  })
}

export function useDeleteDorm() {
  const invalidate = useInvalidateDormData()
  return useMutation({
    mutationFn: (id: string) => softDeleteDorm(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'MASTER', tableName: 'dorms', recordId: id })
      invalidate()
    },
  })
}

export function useAssignStudents() {
  const invalidate = useInvalidateDormData()
  return useMutation({
    mutationFn: ({ ids, dormId }: { ids: string[]; dormId: string | null }) =>
      assignStudents(ids, dormId),
    onSuccess: (_data, variables) => {
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'students',
        newData: { count: variables.ids.length, dorm_id: variables.dormId },
      })
      invalidate()
    },
  })
}
