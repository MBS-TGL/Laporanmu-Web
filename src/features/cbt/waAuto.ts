import { supabase } from '../../lib/supabase'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'
import type { CbtAttempt } from './types'

/**
 * Pesan WA skor ujian ke wali — dikirim setelah skor final diketahui
 * (grading essay selesai / selesaikan paksa).
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Hasil ujian "{ujian}" untuk {nama} (kelas {kelas}):\n' +
  'Nilai: {skor}\n' +
  'Jawaban benar: {benar}\n\n' +
  'Terima kasih.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

/** Fire-and-forget: kegagalan hanya di-log, tidak memblokir alur grading. */
export async function maybeSendCbtWa(attempt: CbtAttempt, finalScore: number | null): Promise<void> {
  try {
    if (finalScore === null || finalScore === undefined) return
    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_cbt_wa) return

    const { data, error } = await supabase
      .from('students')
      .select('name, phone, guardian_name, classes!students_class_id_fkey(name)')
      .eq('id', attempt.student_id)
      .maybeSingle()
    if (error) throw error
    const student = data as unknown as {
      name: string
      phone: string | null
      guardian_name: string | null
      classes: { name: string } | null
    } | null
    if (!student?.phone) return

    const message = renderTemplate(TEMPLATE, {
      wali: student.guardian_name ?? 'Bpk/Ibu',
      nama: student.name,
      kelas: student.classes?.name ?? '—',
      ujian: attempt.exam_id,
      skor: String(finalScore),
      benar: String(attempt.correct_count ?? 0),
    })

    const result = await sendWaBroadcast([{ target: waPhoneDigits(student.phone), message }])
    if (!result.ok) console.warn('[wa-auto] kirim WA CBT gagal:', result.reason, result.detail)
  } catch (err) {
    console.warn('[wa-auto] gagal mengirim WA CBT:', err)
  }
}
