import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { createDorm, fetchDorms, softDeleteDorm, updateDorm } from './api'
import type { DormFilters, DormFormValues } from './types'

export function useDorms(filters: DormFilters) {
  return useQuery({
    queryKey: ['dorms', filters],
    queryFn: () => fetchDorms(filters),
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

export function useCreateDorm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: DormFormValues) => createDorm(values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dorms'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateDorm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: DormFormValues }) =>
      updateDorm(id, values),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dorms'] })
    },
  })
}

export function useDeleteDorm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteDorm(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dorms'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
