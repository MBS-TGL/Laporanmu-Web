import { supabase } from '../../lib/supabase'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import type { BehaviorReport } from './types'

/** Pesan WA default saat pelanggaran dicatat — merge tag manual, data laporan */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Kami informasikan bahwa {nama} (kelas {kelas}) hari ini tercatat pelanggaran:\n' +
  '• {aturan} ({poin_laporan})\n\n' +
  'Total poin perilaku saat ini: {poin}.\n' +
  'Detail lengkap bisa dilihat di portal: {portal}\n\n' +
  'Mohon bimbingannya di rumah. Terima kasih.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

interface ViolationStudent {
  name: string
  phone: string | null
  guardian_name: string | null
  total_points: number
  classes: { name: string } | null
}

/** Kirim WA ke nomor siswa setelah laporan poin negatif tersimpan.
 *  Fire-and-forget: semua kegagalan hanya di-log — pencatatan poin
 *  tidak boleh terblokir oleh pengiriman WA. */
export async function maybeSendViolationWa(report: BehaviorReport): Promise<void> {
  try {
    // Hanya pelanggaran (poin negatif)
    if (report.points >= 0) return

    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_violation_wa) return

    // Nomor & data terkini siswa — total_points sudah disinkron trigger DB
    const { data, error } = await supabase
      .from('students')
      .select('name, phone, guardian_name, total_points, classes!students_class_id_fkey(name)')
      .eq('id', report.student_id)
      .maybeSingle()
    if (error) throw error
    const student = data as unknown as ViolationStudent | null
    if (!student?.phone) return // tanpa nomor — tidak ada yang bisa dikirim

    const total = student.total_points ?? 0
    const message = renderTemplate(TEMPLATE, {
      nama: report.student?.name ?? '',
      kelas: student.classes?.name ?? '—',
      aturan: report.rule?.name ?? 'Pelanggaran',
      poin_laporan: String(report.points),
      poin: total > 0 ? `+${total}` : String(total),
      wali: student.guardian_name ?? 'Bpk/Ibu',
      portal: `${window.location.origin}/check`,
    })

    const result = await sendWaBroadcast([{ target: waPhoneDigits(student.phone), message }])
    if (!result.ok) console.warn('[wa-auto] kirim gagal:', result.reason, result.detail)
  } catch (err) {
    console.warn('[wa-auto] gagal mengirim WA pelanggaran:', err)
  }
}
