import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import { useClassesBrief } from '../students/hooks'
import { useTeachersBrief } from '../teachers/hooks'
import { useSubjectsBrief } from '../subjects/hooks'
import {
  bulkCreateSchedules,
  createSchedule,
  createSubstitutionLog,
  deleteSubstitutionLog,
  fetchSchedules,
  fetchSubstitutionLogs,
  fetchTimeSlots,
  softDeleteSchedule,
  updateSchedule,
} from './api'
import type {
  Schedule,
  ScheduleConflict,
  ScheduleCandidate,
  ScheduleFormValues,
  DetectedConflictGroup,
} from './types'

export { useClassesBrief, useTeachersBrief, useSubjectsBrief }

export function useTimeSlots(academicYearId?: string) {
  return useQuery({
    queryKey: ['time-slots', academicYearId],
    queryFn: () => fetchTimeSlots(academicYearId),
  })
}

export function useSubstitutionLogs(date: string) {
  return useQuery({
    queryKey: ['substitution-logs', date],
    queryFn: () => fetchSubstitutionLogs(date),
    enabled: !!date,
  })
}

export function useCreateSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      schedule_id: string
      date: string
      original_teacher_id?: string | null
      substitute_teacher_id: string
      note?: string
    }) => createSubstitutionLog(payload),
    onSuccess: (data) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'substitution_logs',
        recordId: data.id,
        newData: { schedule_id: data.schedule_id, date: data.date },
      })
      void qc.invalidateQueries({ queryKey: ['substitution-logs'] })
      void qc.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}

export function useDeleteSubstitution() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSubstitutionLog(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['substitution-logs'] })
      void qc.invalidateQueries({ queryKey: ['schedules'] })
    },
  })
}

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

export function useBulkCreateSchedules() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (list: ScheduleFormValues[]) => bulkCreateSchedules(list),
    onSuccess: (count) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'schedules',
        recordId: 'bulk-import',
        newData: { imported: count },
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

export function toMinutes(time: string): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Cek apakah 2 rentang waktu beririsan (overlap) */
export function isTimeOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return s1 < e2 && s2 < e1
}

/** Cari jadwal lain yang bertabrakan dengan kandidat (kelas, guru, atau ruang). */
export function findConflicts(
  schedules: Schedule[],
  candidate: ScheduleCandidate,
): ScheduleConflict[] {
  if (!candidate.start_time || !candidate.end_time) return []
  const start = toMinutes(candidate.start_time)
  const end = toMinutes(candidate.end_time)
  if (start >= end) return []

  const candRoom = candidate.room?.trim().toLowerCase()

  return schedules
    .filter((s) => s.id !== candidate.excludeId && s.day_of_week === candidate.day_of_week)
    .filter((s) => {
      const sStart = toMinutes(s.start_time)
      const sEnd = toMinutes(s.end_time)
      return isTimeOverlap(start, end, sStart, sEnd)
    })
    .filter((s) => {
      if (s.class_id === candidate.class_id) return true
      if (candidate.teacher_id && s.teacher_id && s.teacher_id === candidate.teacher_id) return true
      if (candRoom && s.room && s.room.trim().toLowerCase() === candRoom) return true
      return false
    })
    .map((s) => {
      let reason: 'class' | 'teacher' | 'room' = 'class'
      if (candidate.teacher_id && s.teacher_id && s.teacher_id === candidate.teacher_id) {
        reason = 'teacher'
      } else if (candRoom && s.room && s.room.trim().toLowerCase() === candRoom) {
        reason = 'room'
      }
      return { schedule: s, reason }
    })
}

/**
 * Menganalisis seluruh dataset jadwal untuk menemukan semua konflik/tabrakan.
 * Mengembalikan:
 * - conflictScheduleIds: Set id jadwal yang terlibat bentrok
 * - conflictInfoMap: Map id jadwal -> array alasan singkat (mis. ['Guru bentrok di VII-B', 'Ruang Lab dipakai'])
 * - conflictGroups: Pengelompokan kejadian bentrok untuk audit / modal detail
 */
export function analyzeAllConflicts(schedules: Schedule[]): {
  conflictScheduleIds: Set<string>
  conflictInfoMap: Map<string, string[]>
  conflictGroups: DetectedConflictGroup[]
} {
  const conflictScheduleIds = new Set<string>()
  const conflictInfoMap = new Map<string, string[]>()
  const conflictGroups: DetectedConflictGroup[] = []

  const addInfo = (id: string, text: string) => {
    conflictScheduleIds.add(id)
    const existing = conflictInfoMap.get(id) ?? []
    if (!existing.includes(text)) {
      existing.push(text)
      conflictInfoMap.set(id, existing)
    }
  }

  // Kelompokkan per hari agar pencarian O(N_hari^2) sangat cepat
  const byDay = new Map<number, Schedule[]>()
  for (const s of schedules) {
    const list = byDay.get(s.day_of_week) ?? []
    list.push(s)
    byDay.set(s.day_of_week, list)
  }

  for (const [day, daySchedules] of byDay.entries()) {
    const len = daySchedules.length
    for (let i = 0; i < len; i++) {
      const a = daySchedules[i]
      const aStart = toMinutes(a.start_time)
      const aEnd = toMinutes(a.end_time)

      for (let j = i + 1; j < len; j++) {
        const b = daySchedules[j]
        const bStart = toMinutes(b.start_time)
        const bEnd = toMinutes(b.end_time)

        if (!isTimeOverlap(aStart, aEnd, bStart, bEnd)) continue

        // 1. Bentrok Guru
        if (a.teacher_id && b.teacher_id && a.teacher_id === b.teacher_id) {
          const teacherName = a.teachers?.name ?? 'Guru yang sama'
          const timeA = `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`
          const timeB = `${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`
          const classA = a.classes?.name ?? 'Kelas lain'
          const classB = b.classes?.name ?? 'Kelas lain'

          addInfo(a.id, `Guru bentrok: ${teacherName} juga mengajar di ${classB} (${timeB})`)
          addInfo(b.id, `Guru bentrok: ${teacherName} juga mengajar di ${classA} (${timeA})`)

          conflictGroups.push({
            id: `teacher-${a.id}-${b.id}`,
            day_of_week: day,
            start_time: a.start_time,
            end_time: a.end_time,
            reason: 'teacher',
            targetName: teacherName,
            schedules: [a, b],
          })
        }

        // 2. Bentrok Kelas (satu kelas 2 mapel bersamaan)
        if (a.class_id && b.class_id && a.class_id === b.class_id) {
          const className = a.classes?.name ?? 'Kelas yang sama'
          const mapelA = a.subjects?.name ?? 'Mapel 1'
          const mapelB = b.subjects?.name ?? 'Mapel 2'

          addInfo(a.id, `Kelas tabrakan: ${className} juga terjadwal ${mapelB}`)
          addInfo(b.id, `Kelas tabrakan: ${className} juga terjadwal ${mapelA}`)

          conflictGroups.push({
            id: `class-${a.id}-${b.id}`,
            day_of_week: day,
            start_time: a.start_time,
            end_time: a.end_time,
            reason: 'class',
            targetName: className,
            schedules: [a, b],
          })
        }

        // 3. Bentrok Ruang (jika ruang diisi dan sama)
        const roomA = a.room?.trim()
        const roomB = b.room?.trim()
        if (roomA && roomB && roomA.toLowerCase() === roomB.toLowerCase()) {
          const classA = a.classes?.name ?? 'Kelas A'
          const classB = b.classes?.name ?? 'Kelas B'

          addInfo(a.id, `Ruang '${roomA}' juga dipakai ${classB}`)
          addInfo(b.id, `Ruang '${roomB}' juga dipakai ${classA}`)

          conflictGroups.push({
            id: `room-${a.id}-${b.id}`,
            day_of_week: day,
            start_time: a.start_time,
            end_time: a.end_time,
            reason: 'room',
            targetName: roomA,
            schedules: [a, b],
          })
        }
      }
    }
  }

  return { conflictScheduleIds, conflictInfoMap, conflictGroups }
}
