import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { supabase } from '../../lib/supabase'
import { waPhoneDigits } from '../students/wa'
import { WORSHIP_CATEGORY_LABEL } from './types'
import type { WorshipCategory } from './types'

/**
 * WA wali saat santri dinyatakan TERAMPIL pada butir ibadah (P3,
 * toggle auto_rohani_wa).
 *
 * Anti-ganda: "klaim atomik" di database lewat kolom
 * worship_mastery.wa_notified_at. Hanya satu klien yang berhasil mengubah
 * kolom itu dari NULL, jadi aman lintas perangkat/guru dan tidak terkirim
 * ulang walau status on → off → on. Bila pengiriman gagal, klaim dilepas
 * agar bisa dicoba lagi.
 * Butuh migrasi: 00_migration.sql
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Alhamdulillah, {nama} (kelas {kelas}) telah dinyatakan TERAMPIL pada:\n' +
  '{kategori}: {butir}\n\n' +
  'Mari bersama membimbing kelanjutan pembinaannya.\n' +
  'Barakallahu fiikum.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

/** Kirim WA kemahiran (fire-and-forget) bila toggle aktif & belum pernah terkirim. */
export async function maybeSendMasteryWa(
  studentId: string,
  itemId: string,
  category: WorshipCategory,
  itemLabel: string,
): Promise<void> {
  let claimed = false
  const release = async () => {
    await supabase
      .from('worship_mastery')
      .update({ wa_notified_at: null })
      .eq('student_id', studentId)
      .eq('item_id', itemId)
  }

  try {
    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_rohani_wa) return

    // Klaim atomik: hanya satu klien yang mendapat baris kembali
    const { data: won, error: claimErr } = await supabase
      .from('worship_mastery')
      .update({ wa_notified_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('item_id', itemId)
      .eq('mastered', true)
      .is('wa_notified_at', null)
      .select('id')
    if (claimErr) throw claimErr
    if (!won?.length) return
    claimed = true

    const { data, error } = await supabase
      .from('students')
      .select('name, phone, guardian_name, classes!students_class_id_fkey(name)')
      .eq('id', studentId)
      .maybeSingle()
    if (error) throw error
    const student = data as unknown as {
      name: string
      phone: string | null
      guardian_name: string | null
      classes: { name: string } | null
    } | null
    if (!student?.phone) {
      await release()
      return
    }

    const message = renderTemplate(TEMPLATE, {
      wali: student.guardian_name ?? 'Bpk/Ibu',
      nama: student.name,
      kelas: student.classes?.name ?? '',
      kategori: WORSHIP_CATEGORY_LABEL[category],
      butir: itemLabel,
    })
    const result = await sendWaBroadcast([{ target: waPhoneDigits(student.phone), message }])
    if (!result.ok) {
      console.warn('[wa-auto] WA rohani gagal:', result.reason, result.detail)
      await release()
    }
  } catch (err) {
    if (claimed) await release()
    console.warn('[wa-auto] WA rohani dilewati:', err)
  }
}
