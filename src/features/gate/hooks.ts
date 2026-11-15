import { App } from 'antd'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  bulkInsertGateLogs,
  createGateLog,
  fetchGateLogs,
  fetchGateLogsByStudent,
  fetchGateStudentIndex,
  fetchGateTodayStats,
} from './api'
import { logAudit } from '../../shared/utils/auditLogger'

import type { GateDirection, GateLogFilters, GateLogInsertRow, GateStudentLite } from './types'

function invalidateGateData(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['gate-logs'] })
  void qc.invalidateQueries({ queryKey: ['gate-stats'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
}

export function useGateLogs(filters: GateLogFilters, opts?: { live?: boolean }) {
  return useQuery({
    queryKey: ['gate-logs', filters],
    queryFn: () => fetchGateLogs(filters),
    refetchInterval: opts?.live ? 30_000 : false,
  })
}

// Statistik hari ini; live = poll 30 detik (otomatis pause saat tab tidak aktif)
export function useGateTodayStats(live: boolean) {
  return useQuery({
    queryKey: ['gate-stats', 'today'],
    queryFn: fetchGateTodayStats,
    staleTime: 15_000,
    refetchInterval: live ? 30_000 : false,
  })
}

// Indeks siswa aktif untuk validasi impor — hanya diambil saat modal impor terbuka
export function useGateStudentIndex(enabled: boolean) {
  return useQuery({
    queryKey: ['gate-students', 'index'],
    queryFn: fetchGateStudentIndex,
    enabled,
    staleTime: 60_000,
  })
}

export function useCreateGateLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ studentId, direction, note }: { studentId: string; direction: GateDirection; note?: string }) =>
      createGateLog(studentId, direction, note),
    onSuccess: (log, variables) => {
      void logAudit({ action: 'INSERT', source: 'OPERATIONAL', tableName: 'gate_logs', recordId: log.id, newData: { student_id: variables.studentId, direction: variables.direction } })
      invalidateGateData(qc)
    },
  })
}

export function useCreateGateLogsBulk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      rows,
      onProgress,
    }: {
      rows: GateLogInsertRow[]
      onProgress?: (processed: number, total: number) => void
    }) => bulkInsertGateLogs(rows, onProgress),
    onSuccess: (result) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'gate_logs',
        newData: { source: 'import', ok: result.ok, failed: result.failed },
      })
      invalidateGateData(qc)
    },
  })
}

/**
 * Catat gerbang dengan guard pencatatan ganda: bila log terakhir siswa
 * arah sama kurang dari 3 menit lalu, minta konfirmasi dulu.
 * Mengembalikan false bila dibatalkan user.
 */
export function useGateRecord() {
  const { modal } = App.useApp()
  const createMutation = useCreateGateLog()

  return async (
    student: GateStudentLite,
    direction: GateDirection,
    note?: string,
  ): Promise<boolean> => {
    let last: { direction: GateDirection; occurred_at: string } | undefined
    try {
      last = (await fetchGateLogsByStudent(student.id, 1))[0]
    } catch {
      // Gagal cek log terakhir — biarkan lewat, jangan blokir pencatatan
    }

    if (last && last.direction === direction) {
      const mins = Math.floor((Date.now() - new Date(last.occurred_at).getTime()) / 60_000)
      if (mins < 3) {
        const confirmed = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: 'Mungkin pencatatan ganda',
            content: `${student.name} sudah tercatat ${
              direction === 'exit' ? 'keluar' : 'masuk'
            } ${mins === 0 ? 'baru saja' : `${mins} menit lalu`}. Tetap catat?`,
            okText: 'Tetap Catat',
            cancelText: 'Batal',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!confirmed) return false
      }
    }

    await createMutation.mutateAsync({ studentId: student.id, direction, note: note || undefined })
    return true
  }
}
