import type { LeavePermit, PermitStatus } from './types'

/** Meta tampilan status — satu sumber untuk tabel, drawer, & scan */
export const STATUS_META: Record<PermitStatus, { label: string; color: string }> = {
  issued: { label: 'Diterbitkan', color: 'blue' },
  departed: { label: 'Berangkat', color: 'orange' },
  returned: { label: 'Kembali', color: 'green' },
  overdue: { label: 'Terlambat', color: 'red' },
  cancelled: { label: 'Dibatalkan', color: 'default' },
}

export interface PermitFilters {
  search?: string
  status?: PermitStatus | ''
  classId?: string
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
}

/**
 * Status efektif: izin `departed` yang melewati batas kembali tampil
 * sebagai `overdue` tanpa perlu diubah di database.
 */
export function effectiveStatus(p: LeavePermit): PermitStatus {
  if (p.status === 'departed' && new Date(p.return_deadline) < new Date()) return 'overdue'
  return p.status
}

/** Filter in-memory satu sumber — dipakai tabel halaman & ekspor "hasil filter" */
export function filterPermits(permits: LeavePermit[], f: PermitFilters): LeavePermit[] {
  const q = (f.search ?? '').trim().toLowerCase()
  return permits.filter((p) => {
    if (f.status) {
      const eff = effectiveStatus(p)
      if (f.status === 'overdue') {
        if (eff !== 'overdue') return false
      } else if (p.status !== f.status) {
        return false
      }
    }
    if (f.classId && p.student?.classes?.id !== f.classId) return false
    if (f.from && p.leave_date < f.from) return false
    if (f.to && p.leave_date > f.to) return false
    if (q) {
      const hay =
        `${p.student?.name ?? ''} ${p.student?.registration_code ?? ''} ${p.destination} ${p.purpose}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function permitNo(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

export function formatPermitDate(v: string): string {
  return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatPermitDateTime(v: string): string {
  return new Date(v).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Teks notifikasi WhatsApp untuk wali — dipakai tombol WA di tabel & drawer */
export function permitWaText(p: LeavePermit): string {
  const name = p.student?.name ?? 'Santri'
  return (
    "Assalamu'alaikum Bpk/Ibu,\n\n" +
    `Ananda ${name} mendapat izin keluar pondok:\n` +
    `• Tujuan: ${p.destination}\n` +
    `• Keperluan: ${p.purpose}\n` +
    `• Keluar: ${formatPermitDate(p.leave_date)}\n` +
    `• Batas kembali: ${formatPermitDateTime(p.return_deadline)}\n\n` +
    `No. izin: ${permitNo(p.id)}\n` +
    'Mohon doa restu dan supervisi Bpk/Ibu. Terima kasih.\n' +
    '— Pengasuhan Santri Laporanmu'
  )
}

/** Teks pengingat WA untuk izin yang melewati batas kembali */
export function permitReminderWaText(p: LeavePermit): string {
  const name = p.student?.name ?? 'Santri'
  return (
    "Assalamu'alaikum Bpk/Ibu,\n\n" +
    `Mohon maaf mengganggu. Kami informasikan bahwa ananda ${name}` +
    `${p.student?.classes?.name ? ` (${p.student.classes.name})` : ''} yang mendapat izin keluar menuju ` +
    `${p.destination} telah melewati batas kembali (${formatPermitDateTime(p.return_deadline)}).\n\n` +
    'Mohon konfirmasi dan bimbingan agar ananda segera kembali ke pondok. Terima kasih.\n' +
    '— Pengasuhan Santri Laporanmu'
  )
}
