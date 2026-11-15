import dayjs from 'dayjs'
import Papa from 'papaparse'
import { supabase } from '../../lib/supabase'
import type {
  BulkInsertResult,
  GateDirection,
  GateLog,
  GateLogFilters,
  GateLogInsertRow,
  GateOutsideStudent,
  GateStudentLite,
  GateTodayStats,
} from './types'

// students!inner agar filter embed (students.name) bisa dipakai.
// classes harus disambiguasi lewat FK — students punya class_id + last_class_id.
const SELECT_STR =
  '*, student:students!inner(id, name, registration_code, classes!students_class_id_fkey(name)), recorder:profiles(name)'

// Batas aman jumlah baris ekspor sekali jalan
export const GATE_EXPORT_LIMIT = 10_000

// Ukuran chunk insert impor massal
const IMPORT_CHUNK_SIZE = 500

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
    .select(
      '*, student:students(id, name, registration_code, classes!students_class_id_fkey(name)), recorder:profiles(name)',
    )
    .eq('student_id', studentId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as unknown as GateLog[]
}

// Versi tanpa pagination — untuk ekspor (mengikuti filter aktif), kronologis
export async function fetchGateLogsForExport(
  filters: Omit<GateLogFilters, 'page' | 'pageSize'>,
): Promise<GateLog[]> {
  const { search, direction, from, to } = filters

  let query = supabase.from('gate_logs').select(SELECT_STR).limit(GATE_EXPORT_LIMIT)

  if (search) query = query.ilike('students.name', `%${search}%`)
  if (direction) query = query.eq('direction', direction)
  if (from) query = query.gte('occurred_at', from)
  if (to) query = query.lte('occurred_at', to)

  const { data, error } = await query.order('occurred_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as GateLog[]
}

// Ekspor baris terpilih di tabel
export async function fetchGateLogsByIds(ids: string[]): Promise<GateLog[]> {
  const { data, error } = await supabase
    .from('gate_logs')
    .select(SELECT_STR)
    .in('id', ids)
    .order('occurred_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as GateLog[]
}

/** Baris ekspor — satu sumber untuk CSV & Excel agar kolomnya selalu sinkron */
export function downloadOutsideStudentsCsv(outside: GateOutsideStudent[]): void {
  const csv = Papa.unparse(
    outside.map((o) => ({
      Nama: o.name,
      'Kode Registrasi': o.registration_code,
      Kelas: o.class_name ?? '',
      'Keluar Pukul': dayjs(o.last_exit_at).format('DD/MM/YYYY HH:mm'),
    })),
  )
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `santri-di-luar-gerbang-${dayjs().format('YYYY-MM-DD')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ------------------------------------------------------------------
// Statistik hari ini — 1 query log minimal + 1 query nama (ringan)
// ------------------------------------------------------------------
export async function fetchGateTodayStats(): Promise<GateTodayStats> {
  const from = dayjs().startOf('day').format()

  const { data, error } = await supabase
    .from('gate_logs')
    .select('student_id, direction, occurred_at')
    .gte('occurred_at', from)
    .order('occurred_at', { ascending: true })

  if (error) throw error
  const rows = data ?? []

  let entryCount = 0
  let exitCount = 0
  const lastByStudent = new Map<string, { direction: GateDirection; occurred_at: string }>()
  for (const row of rows) {
    if (row.direction === 'entry') entryCount++
    else exitCount++
    lastByStudent.set(row.student_id, {
      direction: row.direction as GateDirection,
      occurred_at: row.occurred_at,
    })
  }

  const outsideIds = [...lastByStudent.entries()]
    .filter(([, v]) => v.direction === 'exit')
    .map(([k]) => k)

  let outside: GateOutsideStudent[] = []
  if (outsideIds.length > 0) {
    const { data: students, error: sErr } = await supabase
      .from('students')
      .select('id, name, registration_code, classes!students_class_id_fkey(name)')
      .in('id', outsideIds)
      .is('deleted_at', null)
    if (sErr) throw sErr
    outside = ((students ?? []) as unknown as {
      id: string
      name: string
      registration_code: string
      classes?: { name: string } | null
    }[])
      .map((s) => ({
        student_id: s.id,
        name: s.name,
        registration_code: s.registration_code,
        class_name: s.classes?.name ?? null,
        last_exit_at: lastByStudent.get(s.id)?.occurred_at ?? '',
      }))
      .sort((a, b) => a.last_exit_at.localeCompare(b.last_exit_at))
  }

  return { entryCount, exitCount, outside, logCount: rows.length }
}

// ------------------------------------------------------------------
// Resolusi siswa dari hasil scan / kode manual
// ------------------------------------------------------------------
const LITE_SELECT = 'id, name, registration_code, nisn, classes!students_class_id_fkey(name)'

function toLite(row: unknown): GateStudentLite {
  const r = row as {
    id: string
    name: string
    registration_code: string
    nisn: string | null
    classes?: { name: string } | null
  }
  return {
    id: r.id,
    name: r.name,
    registration_code: r.registration_code,
    nisn: r.nisn,
    class_name: r.classes?.name ?? null,
  }
}

/** Cari siswa dari kode registrasi (persis → longgar) lalu NISN */
export async function fetchStudentByGateCode(rawCode: string): Promise<GateStudentLite | null> {
  const code = rawCode.trim()
  if (!code) return null

  const { data: byCode, error: e1 } = await supabase
    .from('students')
    .select(LITE_SELECT)
    .eq('registration_code', code)
    .is('deleted_at', null)
    .maybeSingle()
  if (e1) throw e1
  if (byCode) return toLite(byCode)

  const { data: byNisn, error: e2 } = await supabase
    .from('students')
    .select(LITE_SELECT)
    .eq('nisn', code)
    .is('deleted_at', null)
    .maybeSingle()
  if (e2) throw e2
  if (byNisn) return toLite(byNisn)

  // Longgar: beda huruf besar-kecil / trailing spasi
  if (code.length >= 3) {
    const { data: loose, error: e3 } = await supabase
      .from('students')
      .select(LITE_SELECT)
      .ilike('registration_code', code)
      .is('deleted_at', null)
      .limit(1)
    if (e3) throw e3
    if (loose && loose.length > 0) return toLite(loose[0])
  }

  return null
}

/** Indeks seluruh siswa aktif — untuk validasi impor (dipetakan di klien) */
export async function fetchGateStudentIndex(): Promise<GateStudentLite[]> {
  const { data, error } = await supabase
    .from('students')
    .select(LITE_SELECT)
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []).map(toLite)
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

/** Insert massal per chunk; bila satu chunk gagal, fallback per baris agar valid tetap masuk */
export async function bulkInsertGateLogs(
  rows: GateLogInsertRow[],
  onProgress?: (processed: number, total: number) => void,
): Promise<BulkInsertResult> {
  const { data: userData } = await supabase.auth.getUser()
  const recordedBy = userData.user?.id ?? null

  let ok = 0
  const errors: { row_index: number; error: string }[] = []

  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE).map((r) => ({
      student_id: r.student_id,
      direction: r.direction,
      occurred_at: r.occurred_at,
      note: r.note || null,
      recorded_by: recordedBy,
    }))

    const { error } = await supabase.from('gate_logs').insert(chunk)
    if (error) {
      // Chunk gagal (biasanya 1 baris bermasalah) — ulangi per baris
      for (let j = 0; j < chunk.length; j++) {
        const { error: rowErr } = await supabase.from('gate_logs').insert(chunk[j])
        if (rowErr) errors.push({ row_index: i + j, error: rowErr.message })
        else ok++
      }
    } else {
      ok += chunk.length
    }

    onProgress?.(Math.min(i + IMPORT_CHUNK_SIZE, rows.length), rows.length)
  }

  return { ok, failed: errors.length, errors }
}
