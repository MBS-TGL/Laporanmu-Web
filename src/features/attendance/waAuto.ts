import { supabase } from '../../lib/supabase'
import { fetchWaSettingsStatus, sendWaBroadcast } from '../students/api'
import { waPhoneDigits } from '../students/wa'

/**
 * WA wali saat santri alpa jam pelajaran (P2, toggle auto_absen_mapel_wa).
 * Debounce 1 pesan per santri per hari via localStorage — grid bisa
 * disimpan berkali-kali dalam sehari tanpa spam.
 */
const TEMPLATE =
  "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
  'Kami informasikan bahwa {nama} (kelas {kelas}) tercatat TIDAK HADIR pada:\n' +
  '{tanggal}, jam {jam} ({mapel}).\n\n' +
  'Mohon konfirmasi ke sekolah bila ada ketidakhadiran yang belum diizinkan.\n' +
  'Terima kasih perhatian dan kerja samanya.'

function renderTemplate(body: string, fields: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}

const debounceKey = (studentId: string, date: string) => `laporanmu_wa_absen_mapel_${studentId}_${date}`

interface AbsentStudent {
  studentId: string
  name: string
  className: string
  guardianName: string | null
  phone: string | null
  /** Info jam alpa pertama hari itu (untuk isi pesan) */
  slot: { jam: string; mapel: string }
}

/** Kirim WA alpa (fire-and-forget) untuk santri yang belum dikirimi hari itu. */
export async function maybeSendAbsentWa(
  date: string,
  absentees: AbsentStudent[],
): Promise<void> {
  if (absentees.length === 0) return
  try {
    const status = await fetchWaSettingsStatus()
    if (!status.configured || !status.auto_absen_mapel_wa) return

    const pending = absentees
      .filter((a): a is AbsentStudent & { phone: string } => Boolean(a.phone))
      .filter((a) => {
      if (typeof localStorage === 'undefined') return true
      return localStorage.getItem(debounceKey(a.studentId, date)) !== '1'
    })
    if (pending.length === 0) return

    for (const a of pending) {
      const message = renderTemplate(TEMPLATE, {
        wali: a.guardianName ?? 'Bpk/Ibu',
        nama: a.name,
        kelas: a.className,
        tanggal: new Date(date).toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        jam: a.slot.jam,
        mapel: a.slot.mapel,
      })
      const result = await sendWaBroadcast([
        { target: waPhoneDigits(a.phone), message },
      ])
      if (!result.ok) {
        console.warn('[wa-auto] WA absen mapel gagal:', result.reason, result.detail)
        continue // jangan tandai sudah-kirim bila gagal
      }
      try {
        localStorage.setItem(debounceKey(a.studentId, date), '1')
      } catch {
        /* debounce opsional */
      }
    }
  } catch (err) {
    console.warn('[wa-auto] WA absen mapel dilewati:', err)
  }
}

/** Ambil kontak wali untuk daftar santri alpa (embed students). */
export async function fetchAbsentContacts(
  studentIds: string[],
): Promise<Map<string, { name: string; className: string; guardianName: string | null; phone: string | null }>> {
  const map = new Map<string, { name: string; className: string; guardianName: string | null; phone: string | null }>()
  if (studentIds.length === 0) return map
  const { data, error } = await supabase
    .from('students')
    .select('id, name, phone, guardian_name, classes!students_class_id_fkey(name)')
    .in('id', studentIds)
  if (error) throw error
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map.set(r.id as string, {
      name: r.name as string,
      className: (r.classes as { name: string } | null)?.name ?? '',
      guardianName: (r.guardian_name as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
    })
  }
  return map
}
