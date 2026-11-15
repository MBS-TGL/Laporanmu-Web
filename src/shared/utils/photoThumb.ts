/**
 * URL thumbnail foto Supabase Storage via render transform (?width=&quality=).
 * Untuk avatar kecil di tabel: 1000 baris tidak lagi mengunduh foto full-size.
 * Kalau Storage transform tidak aktif di proyek, query diabaikan server dan
 * foto tetap tampil (full-size), jadi aman dipakai tanpa cek fitur.
 * URL kosong → undefined (Avatar pakai inisial), URL non-storage → apa adanya.
 */
export function photoThumb(url: string | null | undefined, width = 128): string | undefined {
  if (!url) return undefined
  if (url.includes('/storage/v1/object/')) return `${url}?width=${width}&quality=70`
  return url
}
