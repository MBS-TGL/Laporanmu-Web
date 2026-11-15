import { supabase } from '../../lib/supabase'
import type { Schedule, ScheduleFormValues, SubstitutionLog, TimeSlot } from './types'

const SCHEDULE_SELECT =
  '*, classes(id, name, grade), subjects(id, name), teachers(id, name), time_slots(id, name, start_time, end_time)'

export async function fetchTimeSlots(academicYearId?: string): Promise<TimeSlot[]> {
  let q = supabase
    .from('time_slots')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order')
    .order('start_time')

  if (academicYearId) {
    q = q.eq('academic_year_id', academicYearId)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as TimeSlot[]
}

export async function fetchSubstitutionLogs(date: string): Promise<SubstitutionLog[]> {
  const { data, error } = await supabase
    .from('substitution_logs')
    .select('*, substitute_teacher:teachers!substitution_logs_substitute_teacher_id_fkey(id, name), original_teacher:teachers!substitution_logs_original_teacher_id_fkey(id, name)')
    .eq('date', date)

  if (error) throw error
  return (data ?? []) as unknown as SubstitutionLog[]
}

export async function createSubstitutionLog(payload: {
  schedule_id: string
  date: string
  original_teacher_id?: string | null
  substitute_teacher_id: string
  note?: string
}): Promise<SubstitutionLog> {
  const { data, error } = await supabase
    .from('substitution_logs')
    .upsert(
      {
        schedule_id: payload.schedule_id,
        date: payload.date,
        original_teacher_id: payload.original_teacher_id || null,
        substitute_teacher_id: payload.substitute_teacher_id,
        note: payload.note || null,
      },
      { onConflict: 'schedule_id,date' }
    )
    .select('*, substitute_teacher:teachers!substitution_logs_substitute_teacher_id_fkey(id, name), original_teacher:teachers!substitution_logs_original_teacher_id_fkey(id, name)')
    .single()

  if (error) throw error
  return data as unknown as SubstitutionLog
}

export async function deleteSubstitutionLog(id: string): Promise<void> {
  const { error } = await supabase.from('substitution_logs').delete().eq('id', id)
  if (error) throw error
}

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
      time_slot_id: values.time_slot_id || null,
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

/** Simpan banyak jadwal sekaligus (impor). Di-chunk 100 baris per request. */
export async function bulkCreateSchedules(list: ScheduleFormValues[]): Promise<number> {
  const payload = list.map((values) => ({
    class_id: values.class_id,
    subject_id: values.subject_id || null,
    teacher_id: values.teacher_id || null,
    time_slot_id: values.time_slot_id || null,
    day_of_week: values.day_of_week,
    start_time: `${values.start_time}:00`,
    end_time: `${values.end_time}:00`,
    room: values.room?.trim() || null,
    notes: values.notes?.trim() || null,
  }))
  let inserted = 0
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100)
    const { error } = await supabase.from('schedules').insert(chunk)
    if (error) throw error
    inserted += chunk.length
  }
  return inserted
}

export async function updateSchedule(id: string, values: ScheduleFormValues): Promise<Schedule> {
  const { data, error } = await supabase
    .from('schedules')
    .update({
      class_id: values.class_id,
      subject_id: values.subject_id || null,
      teacher_id: values.teacher_id || null,
      time_slot_id: values.time_slot_id || null,
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
