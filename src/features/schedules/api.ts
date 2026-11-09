import { supabase } from '../../lib/supabase'
import type { Schedule, ScheduleFormValues } from './types'

const SCHEDULE_SELECT =
  '*, classes(id, name), subjects(id, name), teachers(id, name)'

export async function fetchSchedules(): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .is('deleted_at', null)
    .order('day_of_week')
    .order('start_time')
  if (error) throw error
  return (data ?? []) as unknown as Schedule[]
}

export async function createSchedule(values: ScheduleFormValues): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .insert({
      class_id: values.class_id,
      subject_id: values.subject_id || null,
      teacher_id: values.teacher_id || null,
      day_of_week: values.day_of_week,
      start_time: `${values.start_time}:00`,
      end_time: `${values.end_time}:00`,
      room: values.room?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .select(SCHEDULE_SELECT)
    .single()
  if (error) throw error
  return data as unknown as Schedule
}

export async function updateSchedule(id: string, values: ScheduleFormValues): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .update({
      class_id: values.class_id,
      subject_id: values.subject_id || null,
      teacher_id: values.teacher_id || null,
      day_of_week: values.day_of_week,
      start_time: `${values.start_time}:00`,
      end_time: `${values.end_time}:00`,
      room: values.room?.trim() || null,
      notes: values.notes?.trim() || null,
    })
    .eq('id', id)
    .select(SCHEDULE_SELECT)
    .single()
  if (error) throw error
  return data as unknown as Schedule
}

export async function softDeleteSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from('schedules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
