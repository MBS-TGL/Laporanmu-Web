// Helper murni Keuangan SPP — tanpa import supabase (aman vitest)

/** '2026-07' → 'Jul 2026'; '' (sekali/semester) → 'Sekali' */
export function periodLabel(period: string): string {
  if (!period) return 'Sekali'
  const [y, m] = period.split('-')
  const bulan = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
  ]
  const idx = Number(m) - 1
  return Number.isInteger(idx) && idx >= 0 && idx < 12 ? `${bulan[idx]} ${y}` : period
}

/** Daftar periode 'YYYY-MM' untuk rentang bulan inklusif (urut naik). */
export function monthRange(start: string, end: string): string[] {
  const parse = (v: string) => {
    const [y, m] = v.split('-').map(Number)
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null
    return y * 12 + (m - 1)
  }
  const a = parse(start)
  const b = parse(end)
  if (a === null || b === null || a > b) return []
  const out: string[] = []
  for (let v = a; v <= b; v++) {
    const y = Math.floor(v / 12)
    const m = (v % 12) + 1
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

export interface OutstandingRow {
  amount: number
  paid: number
}

/** Sisa tagihan = max(0, nominal - terbayar). */
export function outstandingOf(row: OutstandingRow): number {
  return Math.max(0, row.amount - row.paid)
}

export type ObligationStatus = 'lunas' | 'kurang' | 'belum'

export function obligationStatus(row: OutstandingRow): ObligationStatus {
  if (row.paid >= row.amount && row.amount > 0) return 'lunas'
  if (row.paid > 0) return 'kurang'
  return 'belum'
}

/** Ringkas daftar kewajiban: total nominal, terbayar, tunggakan. */
export function summarizeObligations(rows: OutstandingRow[]): {
  total: number
  paid: number
  outstanding: number
} {
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const paid = rows.reduce((s, r) => s + Math.min(r.paid, r.amount), 0)
  return { total, paid, outstanding: total - paid }
}

/** Format rupiah ringkas (tanpa desimal, pola app: uang integer). */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ─── Agregasi (butuh tipe api — diimpor longgar via structural typing) ──────

interface ObligationLike {
  id: string
  amount: number
  paid?: number
}

interface PaymentLike {
  obligation_id: string
  amount: number
}

/**
 * Tempel total terbayar ke tiap kewajiban (dipakai tab & modal agar
 * perhitungan tunggakan konsisten dari satu sumber).
 */
export function attachPaid<T extends ObligationLike>(obligations: T[], payments: PaymentLike[]): (T & { paid: number })[] {
  const sums = new Map<string, number>()
  for (const p of payments) sums.set(p.obligation_id, (sums.get(p.obligation_id) ?? 0) + p.amount)
  return obligations.map((o) => ({ ...o, paid: sums.get(o.id) ?? 0 }))
}
