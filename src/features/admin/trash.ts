import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { hardDelete } from '../../shared/api/crud'
import { logAudit } from '../../shared/utils/auditLogger'

// ------------------------------------------------------------
// Sampah terpusat — agregasi baris soft-deleted (deleted_at IS NOT NULL)
// lintas tabel. Registry di bawah mengikuti TABLE_CONFIG (api.ts) yang
// softDelete: true; tambahan kolom judul per tabel untuk ditampilkan.
// ------------------------------------------------------------

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

export interface TrashTableDef {
  table: string
  /** Label modul (konsisten dengan TABLE_CONFIG di api.ts) */
  label: string
  /** Kolom select + pembentuk judul baris sampah */
  select: string
  title: (row: Record<string, unknown>) => string
}

export const TRASH_TABLES: TrashTableDef[] = [
  { table: 'students', label: 'Santri', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'teachers', label: 'Guru', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'classes', label: 'Kelas', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'dorms', label: 'Asrama', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'academic_years', label: 'Tahun Akademik', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'subjects', label: 'Mata Pelajaran', select: 'name', title: (r) => String(r.name ?? '') },
  {
    table: 'schedules',
    label: 'Jadwal KBM',
    select: 'day_of_week, start_time, room, classes(name), subjects(name)',
    title: (r) => {
      const day = typeof r.day_of_week === 'number' ? DAY_NAMES[r.day_of_week - 1] ?? '' : ''
      const className = (r.classes as { name?: string } | null)?.name
      const subjectName = (r.subjects as { name?: string } | null)?.name
      return [className ?? 'Jadwal', subjectName, day, String(r.start_time ?? '')].filter(Boolean).join(' · ')
    },
  },
  {
    table: 'tahfidz_records',
    label: 'Setoran Tahfidz',
    select: 'surah, from_ayat, to_ayat, students(name)',
    title: (r) => {
      const studentName = (r.students as { name?: string } | null)?.name
      const ayat = r.from_ayat && r.to_ayat ? ` (${r.from_ayat}-${r.to_ayat})` : ''
      return [String(r.surah ?? '') + ayat, studentName].filter(Boolean).join(' · ') || 'Setoran Tahfidz'
    },
  },
  { table: 'halaqah_groups', label: 'Halaqah', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'extracurriculars', label: 'Ekstrakurikuler', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'books', label: 'Buku Perpustakaan', select: 'title', title: (r) => String(r.title ?? '') },
  {
    table: 'savings_accounts',
    label: 'Rekening Tabungan',
    select: 'balance, students(name)',
    title: (r) => {
      const studentName = (r.students as { name?: string } | null)?.name
      return studentName ? `Tabungan ${studentName}` : 'Rekening Tabungan'
    },
  },
  { table: 'inventory_items', label: 'Inventaris', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'admissions', label: 'Pendaftar PPDB', select: 'full_name', title: (r) => String(r.full_name ?? '') },
  // ── Tabel modul 0049–0056 (RPC 0062 me-resolve FK name yang dibutuhkan) ──
  { table: 'worship_items', label: 'Materi Ibadah', select: 'label', title: (r) => String(r.label ?? '') },
  { table: 'entities', label: 'Entitas', select: 'name', title: (r) => String(r.name ?? '') },
  { table: 'instruments', label: 'Instrumen Evaluasi', select: 'title', title: (r) => String(r.title ?? '') },
  {
    table: 'curriculum_cps',
    label: 'CP Kurikulum',
    select: 'subject, description',
    title: (r) => [String(r.subject ?? ''), String(r.description ?? '')].filter(Boolean).join(' · '),
  },
  { table: 'curriculum_tps', label: 'TP Kurikulum', select: 'description', title: (r) => String(r.description ?? '') },
  { table: 'cocurricular_dims', label: 'Dimensi Kokurikuler', select: 'name', title: (r) => String(r.name ?? '') },
]

export interface TrashEntry {
  table: string
  label: string
  id: string
  title: string
  deletedAt: string
  /** Sisa hari sebelum batas retensi 30 hari (bisa negatif = lewat batas) */
  daysLeft: number
}

const RETENTION_DAYS = 30

/**
 * Ambil baris soft-deleted dari semua tabel registry dalam SATU call RPC
 * (migrasi 0062, sebelumnya 13 query paralel limit 200/tabel). Payload =
 * seluruh baris (to_jsonb); nama FK untuk judul (classes/subjects/students)
 * di-resolve server-side sehingga pembentuk judul di bawah tetap bekerja.
 */
export async function fetchTrashItems(): Promise<TrashEntry[]> {
  const { data, error } = await supabase.rpc('admin_trash_items', {
    p_tables: TRASH_TABLES.map((def) => def.table),
  })
  if (error) throw error

  const defsByTable = new Map(TRASH_TABLES.map((def) => [def.table, def]))
  const rows = (data ?? []) as {
    table_name: string
    id: string
    deleted_at: string
    payload: Record<string, unknown>
  }[]
  return rows
    .map((row) => {
      const def = defsByTable.get(row.table_name)
      if (!def) return null
      const deletedAt = String(row.deleted_at)
      const days = Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000)
      return {
        table: row.table_name,
        label: def.label,
        id: String(row.id),
        title: def.title(row.payload) || '(tanpa judul)',
        deletedAt,
        daysLeft: RETENTION_DAYS - days,
      }
    })
    .filter((entry): entry is TrashEntry => entry !== null)
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
}

export async function restoreTrashItem(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).update({ deleted_at: null }).eq('id', id)
  if (error) throw error
  await logAudit({ action: 'UPDATE', tableName: table, recordId: id, newData: { restored: true } })
}

export async function purgeTrashItem(table: string, id: string): Promise<void> {
  await hardDelete(table, id)
  await logAudit({ action: 'DELETE', tableName: table, recordId: id, newData: { purgedFromTrash: true } })
}

// ------------------------------------------------------------
// Hooks
// ------------------------------------------------------------
export function useTrashItems(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['trash'],
    queryFn: fetchTrashItems,
    staleTime: 30_000,
    enabled: opts?.enabled,
  })
}

function useInvalidateTrash() {
  const qc = useQueryClient()
  return (table?: string) => {
    void qc.invalidateQueries({ queryKey: ['trash'] })
    if (table) void qc.invalidateQueries({ queryKey: [table] })
    // Ringkasan dashboard memuat hitungan data aktif
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    void qc.invalidateQueries({ queryKey: ['admin', 'table-stats'] })
  }
}

export function useRestoreTrash() {
  const invalidate = useInvalidateTrash()
  return useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => restoreTrashItem(table, id),
    onSuccess: (_data, vars) => invalidate(vars.table),
  })
}

export function usePurgeTrash() {
  const invalidate = useInvalidateTrash()
  return useMutation({
    mutationFn: ({ table, id }: { table: string; id: string }) => purgeTrashItem(table, id),
    onSuccess: (_data, vars) => invalidate(vars.table),
  })
}
