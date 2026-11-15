/**
 * UPPERCASE di database -> Title Case untuk tampilan.
 * Huruf setelah spasi atau strip jadi kapital; huruf setelah apostrof tetap kecil
 * (AZ-ZAHRANI -> Az-Zahrani, QOD'RIYAH -> Qod'riyah).
 * Hanya untuk tampilan: jangan dipakai untuk nilai yang disimpan, input edit, ekspor, atau dokumen cetak.
 */
export function formatDisplayName(name?: string | null): string {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}
