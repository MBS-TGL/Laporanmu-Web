import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import { useClassesBrief } from '../students/hooks'
import { useTeachersBrief } from '../teachers/hooks'
import { useSubjectsBrief } from '../subjects/hooks'
import { createSchedule, fetchSchedules, softDeleteSchedule, updateSchedule } from './api'
import type { Schedule, ScheduleConflict, ScheduleCandidate, ScheduleFormValues } from './types'

export { useClassesBrief, useTeachersBrief, useSubjectsBrief }

export function useSchedules() {
  return useQuery({
    queryKey: ['schedules', 'list'],
    queryFn: fetchSchedules,
  })
}

export function useCreateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ScheduleFormValues) => createSchedule(values),
    onSuccess: (schedule) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'schedules',
        recordId: schedule.id,
        newData: { class_id: schedule.class_id, day_of_week: schedule.day_of_week },
      })
      void qc.invalidateQueries({ queryKey: ['schedules'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ScheduleFormValues }) =>
      updateSchedule(id, values),
    onSuccess: (schedule) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'schedules',
        recordId: schedule.id,
      })
      void qc.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}

export function useDeleteSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteSchedule(id),
    onSuccess: (_data, id) => {
      void logAudit({ action: 'DELETE', source: 'OPERATIONAL', tableName: 'schedules', recordId: id })
      void qc.invalidateQueries({ queryKey: ['schedules'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ------------------------------------------------------------
// Deteksi bentrok jadwal (client-side — volume jadwal ratusan)
// ------------------------------------------------------------

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Cari jadwal lain yang bertabrakan dengan kandidat (kelas atau guru yang sama). */
export function findConflicts(
  schedules: Schedule[],
  candidate: ScheduleCandidate,
): ScheduleConflict[] {
  const start = toMinutes(candidate.start_time)
  const end = toMinutes(candidate.end_time)
  return schedules
    .filter((s) => s.id !== candidate.excludeId && s.day_of_week === candidate.day_of_week)
    .filter((s) => {
      const sStart = toMinutes(s.start_time)
      const sEnd = toMinutes(s.end_time)
      return start < sEnd && sStart < end
    })
    .filter((s) => {
      if (s.class_id === candidate.class_id) return true
      if (candidate.teacher_id && s.teacher_id === candidate.teacher_id) return true
      return false
    })
    .map((s) => ({
      schedule: s,
      reason: s.class_id === candidate.class_id ? ('class' as const) : ('teacher' as const),
    }))
}
