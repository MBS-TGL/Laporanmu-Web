import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWorshipItem,
  deleteWorshipItem,
  fetchWorshipItems,
  fetchWorshipMastery,
  fetchWorshipScores,
  fetchStudentWorshipProgress,
  fetchStudentMonthlyWorshipScores,
  loadWorshipPresets,
  reorderWorshipItems,
  syncWorshipScoresToMonthlyReports,
  updateWorshipItemLabel,
  upsertWorshipMastery,
  upsertWorshipScores,
  type MasteryUpsert,
  type ScoreUpsert,
} from './api'
import type { WorshipCategory, WorshipFormValues, WorshipMasteryRow } from './types'

// ─── Butir ───────────────────────────────────────────────────────────────────

export function useWorshipItems(category: WorshipCategory) {
  return useQuery({
    queryKey: ['worship-items', category],
    queryFn: () => fetchWorshipItems(category),
    staleTime: 30_000,
  })
}

export function useCreateWorshipItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createWorshipItem,
    onSuccess: (item) => void qc.invalidateQueries({ queryKey: ['worship-items', item.category] }),
  })
}

export function useLoadWorshipPresets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ category, labels }: { category: WorshipCategory; labels: string[] }) =>
      loadWorshipPresets(category, labels),
    onSuccess: (_count, { category }) =>
      void qc.invalidateQueries({ queryKey: ['worship-items', category] }),
  })
}

export function useDeleteWorshipItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string; category: WorshipCategory }) =>
      deleteWorshipItem(id, label),
    onSuccess: (_d, { category }) => {
      void qc.invalidateQueries({ queryKey: ['worship-items', category] })
      void qc.invalidateQueries({ queryKey: ['worship-mastery', category] })
      void qc.invalidateQueries({ queryKey: ['worship-scores', category] })
      void qc.invalidateQueries({ queryKey: ['student-worship-progress'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateWorshipItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: string; label: string; category: WorshipCategory }) =>
      updateWorshipItemLabel(id, label),
    onSuccess: (_d, { category }) => {
      void qc.invalidateQueries({ queryKey: ['worship-items', category] })
      void qc.invalidateQueries({ queryKey: ['student-worship-progress'] })
    },
  })
}

export function useReorderWorshipItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ updates }: { updates: Array<{ id: string; sort_order: number }>; category: WorshipCategory }) =>
      reorderWorshipItems(updates),
    onSuccess: (_d, { category }) =>
      void qc.invalidateQueries({ queryKey: ['worship-items', category] }),
  })
}

// ─── Kemahiran ───────────────────────────────────────────────────────────────

export function useWorshipMastery(category: WorshipCategory, classId: string | undefined) {
  return useQuery({
    queryKey: ['worship-mastery', category, classId],
    queryFn: () => fetchWorshipMastery(category, classId!),
    enabled: Boolean(classId),
  })
}

/** Optimistic update: bintang langsung berubah, rollback bila gagal,
 *  refetch hanya setelah mutasi terakhir selesai (aman untuk klik beruntun). */
export function useUpsertWorshipMastery(category: WorshipCategory) {
  const qc = useQueryClient()
  const key = ['worship-mastery', category]
  const mutationKey = ['worship-mastery-upsert', category]
  return useMutation({
    mutationKey,
    mutationFn: (payload: MasteryUpsert[]) => upsertWorshipMastery(payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: key })
      const snapshots = qc.getQueriesData<WorshipMasteryRow[]>({ queryKey: key })
      qc.setQueriesData<WorshipMasteryRow[]>({ queryKey: key }, (old) => {
        if (!old) return old
        const rows = [...old]
        for (const p of payload) {
          const patch = { mastered: p.mastered, mastered_at: p.mastered_at }
          const idx = rows.findIndex((r) => r.student_id === p.student_id && r.item_id === p.item_id)
          if (idx >= 0) rows[idx] = { ...rows[idx], ...patch }
          else
            rows.push({
              id: `tmp-${p.student_id}-${p.item_id}`,
              student_id: p.student_id,
              item_id: p.item_id,
              ...patch,
            })
        }
        return rows
      })
      return { snapshots }
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: () => {
      if (qc.isMutating({ mutationKey }) === 1) {
        void qc.invalidateQueries({ queryKey: key })
        void qc.invalidateQueries({ queryKey: ['student-worship-progress'] })
        void qc.invalidateQueries({ queryKey: ['dashboard'] })
      }
    },
  })
}

// ─── Nilai bulanan ───────────────────────────────────────────────────────────

export function useWorshipScores(
  category: WorshipCategory,
  classId: string | undefined,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: ['worship-scores', category, classId, year, month],
    queryFn: () => fetchWorshipScores(category, classId!, year, month),
    enabled: Boolean(classId),
  })
}

export function useUpsertWorshipScores(category: WorshipCategory) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ScoreUpsert[]) => upsertWorshipScores(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['worship-scores', category] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useSyncWorshipToMonthlyReports() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ classId, year, month }: { classId: string; year: number; month: number }) =>
      syncWorshipScoresToMonthlyReports(classId, year, month),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['monthly-rows'] })
      void qc.invalidateQueries({ queryKey: ['monthly-rows-for-month'] })
      void qc.invalidateQueries({ queryKey: ['all-monthly-rows'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useStudentWorshipProgress(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-worship-progress', studentId],
    queryFn: () => fetchStudentWorshipProgress(studentId!),
    enabled: Boolean(studentId),
    staleTime: 60_000,
  })
}

export function useStudentMonthlyWorshipScores(studentId: string | undefined) {
  return useQuery({
    queryKey: ['student-monthly-worship-scores', studentId],
    queryFn: () => fetchStudentMonthlyWorshipScores(studentId!),
    enabled: Boolean(studentId),
    staleTime: 60_000,
  })
}

export type { WorshipFormValues }
