import { supabase } from '../../lib/supabase'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import { resolveGuardianPhone } from '../../shared/utils/guardianPhone'
import { formatRupiah } from './sppUtil'
import type { SppPayment } from './types'

/**
 * Pesan WA konfirmasi pembayaran SPP — memuat komponen, nominal,
 * dan sisa tagihan setelah pembayaran dicatat petugas.
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Pembayaran SPP {nama} (kelas {kelas}) telah kami terima:\n' +
  'Komponen: {komponen}\n' +
  'Nominal: {nominal}\n' +
  'Sisa tagihan: {sisa}\n\n' +
  'Terima kasih.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

interface SppStudent {
  name: string
  phone: string | null
  guardian_name: string | null
  classes: { name: string } | null
}

/** Kirim WA ke nomor siswa setelah pembayaran SPP dicatat.
 *  Fire-and-forget: semua kegagalan hanya di-log — pencatatan kas
 *  tidak boleh terblokir oleh pengiriman WA. */
export async function maybeSendSppWa(payment: SppPayment, sisaSetelahBayar: number): Promise<void> {
  try {
    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_spp_wa) return

    const studentId = payment.obligation?.student?.id
    if (!studentId) return
    const { data, error } = await supabase
      .from('students')
      .select('name, phone, guardian_name, classes!students_class_id_fkey(name)')
      .eq('id', studentId)
      .maybeSingle()
    if (error) throw error
    const student = data as unknown as SppStudent | null
    // Nomor wali (student_guardians) lebih tepat daripada nomor santri
    const contact = await resolveGuardianPhone(studentId)
    if (!contact.phone) return // tanpa nomor — tidak ada yang bisa dikirim

    const message = renderTemplate(TEMPLATE, {
      wali: contact.name ?? 'Bpk/Ibu',
      nama: student?.name ?? 'Santri',
      kelas: student?.classes?.name ?? '—',
      komponen: payment.obligation?.component?.name ?? 'SPP',
      nominal: formatRupiah(payment.amount),
      sisa: formatRupiah(Math.max(0, sisaSetelahBayar)),
    })

    const result = await sendWaBroadcast([{ target: waPhoneDigits(contact.phone), message }])
    if (!result.ok) console.warn('[wa-auto] kirim WA SPP gagal:', result.reason, result.detail)
  } catch (err) {
    console.warn('[wa-auto] gagal mengirim WA SPP:', err)
  }
}
