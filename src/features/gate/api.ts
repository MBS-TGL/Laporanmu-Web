import { supabase } from '../../lib/supabase'
import type { GateDirection, GateLog, GateLogFilters } from './types'

// students!inner agar filter embed (students.name) bisa dipakai
const SELECT_STR =
  '*, student:students!inner(id, name, registration_code), recorder:profiles(name)'

export async function fetchGateLogs(
  filters: GateLogFilters,
): Promise<{ data: GateLog[]; total: number }> {
  const { search, direction, from, to, page, pageSize } = filters
  const fromIdx = (page - 1) * pageSize

  let query = supabase.from('gate_logs').select(SELECT_STR, { count: 'exact' })

  if (search) query = query.ilike('students.name', `%${search}%`)
  if (direction) query = query.eq('direction', direction)
  if (from) query = query.gte('occurred_at', from)
  if (to) query = query.lte('occurred_at', to)

  const { data, count, error } = await query
    .order('occurred_at', { ascending: false })
    .range(fromIdx, fromIdx + pageSize - 1)

  if (error) throw error
  return { data: (data ?? []) as unknown as GateLog[], total: count ?? 0 }
}

// Riwayat gerbang satu siswa (dipakai drawer detail siswa)
export async function fetchGateLogsByStudent(studentId: string, limit = 5): Promise<GateLog[]> {
  const { data, error } = await supabase
    .from('gate_logs')
    .select('*, student:students(id, name, registration_code), recorder:profiles(name)')
    .eq('student_id', studentId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as GateLog[]
}

export async function createGateLog(
  studentId: string,
  direction: GateDirection,
  note?: string,
): Promise<GateLog> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError

  const { data, error } = await supabase
    .from('gate_logs')
    .insert({
      student_id: studentId,
      direction,
      occurred_at: new Date().toISOString(),
      recorded_by: userData.user?.id ?? null,
      note: note || null,
    })
    .select(SELECT_STR)
    .single()

  if (error) throw error
  return data as unknown as GateLog
}
