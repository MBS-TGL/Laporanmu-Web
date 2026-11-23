import { formatRupiah, outstandingOf } from './sppUtil'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import { resolveGuardianPhone } from '../../shared/utils/guardianPhone'
import type { SppObligation } from './types'

/**
 * Pengingat tunggakan SPP ke nomor wali. Sengaja manual (bukan auto-fire)
 * agar tidak ada blast tagihan ke semua wali tanpa persetujuan petugas.
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Kami ingatkan tunggakan pembayaran {nama} (kelas {kelas}):\n' +
  '{rincian}\n\n' +
  'Total tunggakan: {total}\n\n' +
  'Mohon segera diselesaikan. Bila sudah dibayar, abaikan pesan ini.\n' +
  'Terima kasih.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

export interface ReminderResult {
  studentName: string
  ok: boolean
  reason?: string
}

/** Kirim pengingat tunggakan untuk sekelompok kewajiban (satu pesan per santri). */
export async function sendArrearsReminders(obligations: SppObligation[]): Promise<ReminderResult[]> {
  if (obligations.length === 0) return []

  const status = await fetchWaSettingsStatus()
  if (!status.configured) {
    return obligations.map((o) => ({
      studentName: o.student?.name ?? 'Santri',
      ok: false,
      reason: 'WA belum dikonfigurasi',
    }))
  }

  // Gabungkan per santri: satu pesan memuat semua komponen yang menunggak
  const byStudent = new Map<string, SppObligation[]>()
  for (const o of obligations) {
    if (!o.student_id) continue
    const list = byStudent.get(o.student_id) ?? []
    list.push(o)
    byStudent.set(o.student_id, list)
  }

  const results: ReminderResult[] = []
  for (const [studentId, list] of byStudent) {
    const student = list[0].student
    const name = student?.name ?? 'Santri'
    try {
      const contact = await resolveGuardianPhone(studentId)
      if (!contact.phone) {
        results.push({ studentName: name, ok: false, reason: 'Nomor wali belum tersedia' })
        continue
      }
      const rincian = list
        .map((o) => `- ${o.component?.name ?? 'SPP'}${o.period ? ` (${o.period})` : ''}: ${formatRupiah(outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }))}`)
        .join('\n')
      const total = list.reduce((s, o) => s + outstandingOf({ amount: o.amount, paid: o.paid ?? 0 }), 0)
      const message = renderTemplate(TEMPLATE, {
        wali: contact.name ?? 'Bpk/Ibu',
        nama: name,
        kelas: student?.class?.name ?? '—',
        rincian,
        total: formatRupiah(total),
      })
      const result = await sendWaBroadcast([{ target: waPhoneDigits(contact.phone), message }])
      results.push({ studentName: name, ok: result.ok, reason: result.ok ? undefined : result.reason })
    } catch (err) {
      results.push({ studentName: name, ok: false, reason: (err as Error).message })
    }
  }
  return results
}
