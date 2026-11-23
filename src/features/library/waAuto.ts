import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import { resolveGuardianPhone } from '../../shared/utils/guardianPhone'
import dayjs from 'dayjs'
import type { BookLoan } from './types'

/**
 * Pengingat WA keterlambatan pengembalian buku. Tidak ada auto-fire: ini
 * dipanggil dari aksi manual per baris agar tidak ada blast tak sengaja.
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Buku "{buku}" yang dipinjam {nama} (kelas {kelas}) belum dikembalikan.\n' +
  'Batas pengembalian: {batas} ({telat} hari lewat).\n\n' +
  'Mohon bantuan agar buku segera dikembalikan ke perpustakaan.\n' +
  'Terima kasih.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

/** Kirim pengingat keterlambatan (manual). Mengembalikan hasil agar UI bisa memberi tahu. */
export async function sendOverdueReminder(loan: BookLoan): Promise<{ ok: boolean; reason?: string }> {
  try {
    const status = await fetchWaSettingsStatus()
    if (!status.configured) return { ok: false, reason: 'WA belum dikonfigurasi' }

    const contact = await resolveGuardianPhone(loan.student_id)
    if (!contact.phone) return { ok: false, reason: 'Nomor wali belum tersedia' }

    const due = loan.due_date ? dayjs(loan.due_date) : null
    const lateDays = due ? dayjs().diff(due, 'day') : 0

    const message = renderTemplate(TEMPLATE, {
      wali: contact.name ?? 'Bpk/Ibu',
      buku: loan.books?.title ?? 'Buku perpustakaan',
      nama: loan.students?.name ?? 'santri',
      kelas: loan.students?.classes?.name ?? '—',
      batas: due ? due.format('DD MMMM YYYY') : '—',
      telat: String(Math.max(0, lateDays)),
    })

    const result = await sendWaBroadcast([{ target: waPhoneDigits(contact.phone), message }])
    if (!result.ok) return { ok: false, reason: result.reason ?? 'Gagal mengirim' }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: (err as Error).message }
  }
}
