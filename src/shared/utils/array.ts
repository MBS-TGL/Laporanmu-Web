/** Pecah array jadi chunk berukuran maksimal `size` (untuk query `.in()` ber-urut). */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Ukuran chunk harus > 0')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}
