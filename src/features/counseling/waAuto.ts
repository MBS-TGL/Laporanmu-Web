import { supabase } from '../../lib/supabase'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import { resolveGuardianPhone } from '../../shared/utils/guardianPhone'
import { LETTER_TYPE_META, type OfficialLetter } from './letters/types'

/**
 * Pesan WA saat surat resmi BK diterbitkan — memuat link verifikasi
 * QR yang sama dengan yang tercetak di kop surat (/verify?token=...).
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Kami informasikan bahwa {nama} (kelas {kelas}) telah menerbitkan:\n' +
  '{jenis_surat} No. {nomor}\n' +
  'Perihal: {perihal}\n\n' +
  'Keaslian surat dapat diperiksa melalui tautan berikut:\n' +
  '{verifikasi}\n\n' +
  'Terima kasih perhatian dan kerja samanya.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

interface LetterStudent {
  name: string
  phone: string | null
  guardian_name: string | null
  classes: { name: string } | null
}

/** Kirim WA ke nomor siswa setelah surat resmi BK diterbitkan.
 *  Fire-and-forget: semua kegagalan hanya di-log — penerbitan surat
 *  tidak boleh terblokir oleh pengiriman WA. */
export async function maybeSendLetterWa(letter: OfficialLetter): Promise<void> {
  try {
    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_bk_wa) return

    // Data terkini santri (nomor & wali bisa berubah setelah surat dibuat)
    const { data, error } = await supabase
      .from('students')
      .select('name, phone, guardian_name, classes!students_class_id_fkey(name)')
      .eq('id', letter.student_id)
      .maybeSingle()
    if (error) throw error
    const student = data as unknown as LetterStudent | null
    const contact = await resolveGuardianPhone(letter.student_id)
    if (!contact.phone) return // tanpa nomor — tidak ada yang bisa dikirim

    const message = renderTemplate(TEMPLATE, {
      wali: contact.name ?? 'Bpk/Ibu',
      nama: student?.name ?? 'Santri',
      kelas: student?.classes?.name ?? '—',
      jenis_surat: LETTER_TYPE_META[letter.type]?.label ?? letter.type,
      nomor: letter.letter_no,
      perihal: letter.subject,
      verifikasi: `${window.location.origin}/verify?token=${letter.verify_token}`,
    })

    const result = await sendWaBroadcast([{ target: waPhoneDigits(contact.phone), message }])
    if (!result.ok) console.warn('[wa-auto] kirim WA surat BK gagal:', result.reason, result.detail)
  } catch (err) {
    console.warn('[wa-auto] gagal mengirim WA surat BK:', err)
  }
}
