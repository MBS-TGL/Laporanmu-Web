import { supabase } from '../../lib/supabase'

/**
 * Soft delete satu baris: set `deleted_at = now()`.
 * Seluruh tabel operasional aplikasi memakai kolom ini — JANGAN hard delete.
 * Pengecualian: hapus permanen di halaman Arsip (hardDelete/hardDeleteMany di bawah),
 * khusus developer/admin (RLS delete + gate `canDelete` di UI).
 */
export async function softDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Soft delete banyak baris sekaligus (aksi massal dari ActionBar). */
export async function softDeleteMany(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

/**
 * Hapus permanen satu baris dari database — IRREVERSIBLE.
 * HANYA dipakai di halaman Arsip untuk baris yang sudah ter-soft delete,
 * selalu gated `canDelete` di UI + Modal.confirm danger.
 */
export async function hardDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

/** Hapus permanen banyak baris sekaligus (aksi massal dari ActionBar di Arsip). */
export async function hardDeleteMany(table: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from(table).delete().in('id', ids)
  if (error) throw error
}

/**
 * Pesan ramah untuk error hard delete — baris yang masih dirujuk tabel lain
 * (absensi, pelanggaran, dsb. yang tidak cascade) gagal dengan FK 23503.
 */
export function hardDeleteErrorMessage(err: unknown): string {
  const code = (err as { code?: string } | null)?.code
  if (code === '23503') {
    return 'Tidak bisa dihapus permanen karena masih dipakai data lain. Pulihkan dulu, hapus data terkait, lalu coba lagi.'
  }
  return err instanceof Error ? err.message : 'Gagal menghapus permanen'
}
