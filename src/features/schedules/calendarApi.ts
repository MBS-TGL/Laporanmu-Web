import { supabase } from '../../lib/supabase'
import type { CalendarEvent, CalendarEventFormValues } from './calendarTypes'

export async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from('academic_calendar_events')
    .select('*')
    .is('deleted_at', null)
    .order('start_date', { ascending: true })

  if (error) {
    // Jika tabel belum dibuat di server atau error koneksi, fallback ke empty array agar UI tidak crash
    console.warn('Gagal memuat academic_calendar_events:', error.message)
    return []
  }
  return (data ?? []) as CalendarEvent[]
}

export async function createCalendarEvent(values: CalendarEventFormValues): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('academic_calendar_events')
    .insert({
      title: values.title,
      category: values.category,
      target_level: values.target_level,
      start_date: values.start_date,
      end_date: values.end_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      location: values.location?.trim() || null,
      description: values.description?.trim() || null,
      color: values.color || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as CalendarEvent
}

export async function updateCalendarEvent(id: string, values: CalendarEventFormValues): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('academic_calendar_events')
    .update({
      title: values.title,
      category: values.category,
      target_level: values.target_level,
      start_date: values.start_date,
      end_date: values.end_date,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      location: values.location?.trim() || null,
      description: values.description?.trim() || null,
      color: values.color || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CalendarEvent
}

export async function softDeleteCalendarEvent(id: string): Promise<void> {
  const { error } = await supabase
    .from('academic_calendar_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}
