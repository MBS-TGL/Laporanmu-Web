import dayjs from 'dayjs'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Tanggal singkat Indonesia (DD MMM atau DD MMM YYYY) — dayjs global masih English. */
export function formatDateId(value: string | null | undefined, withYear = false): string {
  if (!value) return ''
  const d = dayjs(value)
  const base = `${d.date()} ${MONTHS_SHORT[d.month()]}`
  return withYear ? `${base} ${d.year()}` : base
}
