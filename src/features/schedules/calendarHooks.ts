import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { logAudit } from '../../shared/utils/auditLogger'
import {
  createCalendarEvent,
  fetchCalendarEvents,
  softDeleteCalendarEvent,
  updateCalendarEvent,
} from './calendarApi'
import type { CalendarEventFormValues } from './calendarTypes'

export function useCalendarEvents() {
  return useQuery({
    queryKey: ['academic-calendar-events'],
    queryFn: fetchCalendarEvents,
  })
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: CalendarEventFormValues) => createCalendarEvent(values),
    onSuccess: (event) => {
      void logAudit({
        action: 'INSERT',
        source: 'OPERATIONAL',
        tableName: 'academic_calendar_events',
        recordId: event.id,
        newData: { title: event.title, category: event.category },
      })
      void qc.invalidateQueries({ queryKey: ['academic-calendar-events'] })
    },
  })
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: CalendarEventFormValues }) =>
      updateCalendarEvent(id, values),
    onSuccess: (event) => {
      void logAudit({
        action: 'UPDATE',
        source: 'OPERATIONAL',
        tableName: 'academic_calendar_events',
        recordId: event.id,
        newData: { title: event.title },
      })
      void qc.invalidateQueries({ queryKey: ['academic-calendar-events'] })
    },
  })
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => softDeleteCalendarEvent(id),
    onSuccess: (_data, id) => {
      void logAudit({
        action: 'DELETE',
        source: 'OPERATIONAL',
        tableName: 'academic_calendar_events',
        recordId: id,
      })
      void qc.invalidateQueries({ queryKey: ['academic-calendar-events'] })
    },
  })
}
