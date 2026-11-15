import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createAcademicYear,
  createDefaultTimeSlots,
  createTimeSlot,
  createRoom,
  fetchAcademicYears,
  fetchRooms,
  fetchTimeSlots,
  setActiveAcademicYear,
  softDeleteAcademicYear,
  softDeleteRoom,
  softDeleteTimeSlot,
  updateAcademicYear,
  updateTimeSlot,
  updateRoom,
} from './api'
import type {
  AcademicYearFilters,
  RoomFormValues,
  SlotFormValues,
  YearFormValues,
} from './types'

export function useAcademicYears(filters: AcademicYearFilters) {
  return useQuery({
    queryKey: ['academic-years', filters],
    queryFn: () => fetchAcademicYears(filters),
  })
}

export function useCreateAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: YearFormValues) => createAcademicYear(values),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: created.id,
        newData: created,
      })
    },
  })
}

export function useUpdateAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: YearFormValues }) =>
      updateAcademicYear(id, values),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: updated.id,
        newData: updated,
      })
    },
  })
}

export function useDeleteAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteAcademicYear(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: id,
      })
    },
  })
}

export function useSetActiveAcademicYear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => setActiveAcademicYear(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['academic-years'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'academic_years',
        recordId: id,
        newData: { is_active: true },
      })
    },
  })
}

// ─── Slot Jam (time_slots) ──────────────────────────────────────────────────

export function useTimeSlots(academicYearId: string | undefined) {
  return useQuery({
    queryKey: ['time-slots', academicYearId],
    queryFn: () => fetchTimeSlots(academicYearId as string),
    enabled: Boolean(academicYearId),
  })
}

export function useCreateTimeSlot(academicYearId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: SlotFormValues) => createTimeSlot(academicYearId, values),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['time-slots'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'time_slots',
        recordId: created.id,
        newData: created,
      })
    },
  })
}

export function useUpdateTimeSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: SlotFormValues }) =>
      updateTimeSlot(id, values),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['time-slots'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'time_slots',
        recordId: updated.id,
        newData: updated,
      })
    },
  })
}

export function useDeleteTimeSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteTimeSlot(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['time-slots'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'time_slots',
        recordId: id,
      })
    },
  })
}

export function useCreateDefaultTimeSlots(academicYearId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => createDefaultTimeSlots(academicYearId),
    onSuccess: (count) => {
      void qc.invalidateQueries({ queryKey: ['time-slots'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'time_slots',
        newData: { preset: count },
      })
    },
  })
}

// ─── Ruang KBM (rooms) ──────────────────────────────────────────────────────

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: RoomFormValues) => createRoom(values),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ['rooms'] })
      void logAudit({
        action: 'INSERT',
        source: 'MASTER',
        tableName: 'rooms',
        recordId: created.id,
        newData: created,
      })
    },
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: RoomFormValues }) => updateRoom(id, values),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['rooms'] })
      void logAudit({
        action: 'UPDATE',
        source: 'MASTER',
        tableName: 'rooms',
        recordId: updated.id,
        newData: updated,
      })
    },
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteRoom(id),
    onSuccess: (_void, id) => {
      void qc.invalidateQueries({ queryKey: ['rooms'] })
      void logAudit({
        action: 'DELETE',
        source: 'MASTER',
        tableName: 'rooms',
        recordId: id,
      })
    },
  })
}
