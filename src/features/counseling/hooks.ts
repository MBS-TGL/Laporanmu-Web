import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCounselingLog,
  deleteCounselingLog,
  fetchCounselingLogs,
  fetchCounselingStatList,
  fetchCounselingStats,
  fetchStudentCounseling,
  updateCounselingLog,
  updateCounselingStatus,
  type CreateCounselingInput,
  type UpdateCounselingInput,
} from './api'
import type {
  CounselingFilters,
  CounselingLog,
  CounselingStatListKind,
  CounselingStatus,
} from './types'

// ------------------------------------------------------------
// Query
// ------------------------------------------------------------

/** Daftar sesi — pagination server-side, halaman sebelumnya dipakai sementara saat pindah filter. */
export function useCounselingLogs(filters: CounselingFilters & { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ['counseling', 'logs', filters],
    queryFn: () => fetchCounselingLogs(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Statistik agregat — dihitung di DB, tanpa menarik baris. */
export function useCounselingStats() {
  return useQuery({
    queryKey: ['counseling', 'stats'],
    queryFn: fetchCounselingStats,
    staleTime: 60_000,
  })
}

/** Daftar ringkas drawer statistik — hanya aktif saat drawer dibuka. */
export function useCounselingStatList(kind: CounselingStatListKind, enabled: boolean) {
  return useQuery({
    queryKey: ['counseling', 'statList', kind],
    queryFn: () => fetchCounselingStatList(kind),
    enabled,
    staleTime: 30_000,
  })
}

/** Riwayat sesi BK satu santri untuk drawer detail. */
export function useStudentCounseling(studentId: string | null) {
  return useQuery({
    queryKey: ['counseling', 'history', studentId],
    queryFn: () => fetchStudentCounseling(studentId as string),
    enabled: Boolean(studentId),
    staleTime: 30_000,
  })
}

// ------------------------------------------------------------
// Patch cache optimistic — log dipatch di SEMUA daftar cache (tabel,
// drawer statistik, riwayat santri) agar UI bereaksi instan.
// ------------------------------------------------------------

type LogsPatch = Partial<CounselingLog> & { id: string }

type LogsCacheShape = { data: CounselingLog[]; total?: number } | CounselingLog[]

function patchLogEverywhere(
  qc: ReturnType<typeof useQueryClient>,
  patch: LogsPatch,
) {
  const apply = (rows: CounselingLog[]) =>
    rows.map((row) => (row.id === patch.id ? { ...row, ...patch } : row))
  for (const prefix of ['logs', 'statList', 'history'] as const) {
    qc.setQueriesData<LogsCacheShape>(
      { queryKey: ['counseling', prefix] },
      (old) => {
        if (!old) return old
        if (!('data' in old)) return apply(old)
        return { ...old, data: apply(old.data) }
      },
    )
  }
}

function removeLogEverywhere(qc: ReturnType<typeof useQueryClient>, id: string) {
  for (const prefix of ['logs', 'statList', 'history'] as const) {
    qc.setQueriesData<LogsCacheShape>(
      { queryKey: ['counseling', prefix] },
      (old) => {
        if (!old) return old
        if (!('data' in old)) return old.filter((row) => row.id !== id)
        return {
          ...old,
          data: old.data.filter((row) => row.id !== id),
          total: Math.max(0, (old.total ?? 0) - 1),
        }
      },
    )
  }
}

// ------------------------------------------------------------
// Mutasi
// ------------------------------------------------------------

function useInvalidateCounseling() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['counseling', 'stats'] })
    void qc.invalidateQueries({ queryKey: ['counseling', 'logs'] })
    void qc.invalidateQueries({ queryKey: ['counseling', 'statList'] })
    void qc.invalidateQueries({ queryKey: ['counseling', 'history'] })
  }
}

export function useCreateCounseling() {
  const invalidate = useInvalidateCounseling()
  return useMutation({
    mutationFn: (input: CreateCounselingInput) => createCounselingLog(input),
    onSuccess: invalidate,
  })
}

export function useUpdateCounseling() {
  const invalidate = useInvalidateCounseling()
  return useMutation({
    mutationFn: (input: UpdateCounselingInput) => updateCounselingLog(input),
    onSuccess: invalidate,
  })
}

/** Toggle status dengan optimistic update — UI berubah instan, rollback jika gagal. */
export function useUpdateCounselingStatus() {
  const qc = useQueryClient()
  const invalidate = useInvalidateCounseling()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CounselingStatus }) =>
      updateCounselingStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['counseling', 'logs'] })
      const previous = qc.getQueriesData({ queryKey: ['counseling', 'logs'] })
      patchLogEverywhere(qc, { id, status })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, value]) => qc.setQueryData(key, value))
    },
    onSettled: invalidate,
  })
}

export function useDeleteCounseling() {
  const qc = useQueryClient()
  const invalidate = useInvalidateCounseling()
  return useMutation({
    mutationFn: (id: string) => deleteCounselingLog(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['counseling', 'logs'] })
      const previous = qc.getQueriesData({ queryKey: ['counseling', 'logs'] })
      removeLogEverywhere(qc, id)
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      ctx?.previous.forEach(([key, value]) => qc.setQueryData(key, value))
    },
    onSettled: invalidate,
  })
}
