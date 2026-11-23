import { supabase } from '../../lib/supabase'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import { resolveGuardianPhone } from '../../shared/utils/guardianPhone'
import { formatRupiah } from './api'
import type { SavingsAccount, SavingsTxnKind } from './types'

/**
 * Pesan WA saat mutasi tabungan (setor/tarik) dicatat petugas ber-PIN.
 * Nominal & saldo memakai format rupiah dari api.ts.
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Tabungan {nama} (kelas {kelas}):\n' +
  '{jenis}: {nominal}\n' +
  'Saldo saat ini: {saldo}\n' +
  'Dicatat pada {tanggal}.\n\n' +
  'Terima kasih.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

interface SavingsStudent {
  name: string
  phone: string | null
  guardian_name: string | null
  classes: { name: string } | null
}

/** Kirim WA ke nomor siswa setelah mutasi tabungan tersimpan.
 *  Fire-and-forget: semua kegagalan hanya di-log — transaksi kas
 *  tidak boleh terblokir oleh pengiriman WA. */
export async function maybeSendSavingsWa(
  account: SavingsAccount,
  kind: SavingsTxnKind,
  amount: number,
): Promise<void> {
  try {
    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_savings_wa) return

    const { data, error } = await supabase
      .from('students')
      .select('name, phone, guardian_name, classes!students_class_id_fkey(name)')
      .eq('id', account.student_id)
      .maybeSingle()
    if (error) throw error
    const student = data as unknown as SavingsStudent | null
    const contact = await resolveGuardianPhone(account.student_id)
    if (!contact.phone) return // tanpa nomor — tidak ada yang bisa dikirim

    const message = renderTemplate(TEMPLATE, {
      wali: contact.name ?? 'Bpk/Ibu',
      nama: student?.name ?? 'Santri',
      kelas: student?.classes?.name ?? '—',
      jenis: kind === 'deposit' ? 'Setoran' : 'Penarikan', // 'deposit' | 'withdrawal'
      nominal: formatRupiah(amount),
      saldo: formatRupiah(account.balance),
      tanggal: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
    })

    const result = await sendWaBroadcast([{ target: waPhoneDigits(contact.phone), message }])
    if (!result.ok) console.warn('[wa-auto] kirim WA tabungan gagal:', result.reason, result.detail)
  } catch (err) {
    console.warn('[wa-auto] gagal mengirim WA tabungan:', err)
  }
}
