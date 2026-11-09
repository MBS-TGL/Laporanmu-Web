import type { Student } from './types'

/** Nomor telepon → digit normal (0 di awal → 62) — dipakai wa.me & API Fonnte */
export function waPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

/** Nomor telepon → tautan wa.me (0 di awal → 62) */
export function waLink(phone: string, text?: string): string {
  const normalized = waPhoneDigits(phone)
  return text
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${normalized}`
}

export type WaTemplateId = 'report' | 'portal' | 'custom'

export interface WaTemplate {
  id: WaTemplateId
  label: string
  description: string
  /** Isi pesan default; kosong untuk 'custom' (ditulis pengguna) */
  body: string
}

export const WA_TEMPLATES: WaTemplate[] = [
  {
    id: 'report',
    label: 'Laporan Perilaku',
    description: 'Ringkasan poin & kelas siswa',
    body:
      "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
      'Laporan perkembangan {nama} (kelas {kelas}): ' +
      'total poin perilaku saat ini {poin}.\n\n' +
      'Terima kasih atas perhatian Bpk/Ibu.',
  },
  {
    id: 'portal',
    label: 'Akses Portal Wali',
    description: 'Kode registrasi & PIN portal',
    body:
      "Assalamu'alaikum Bpk/Ibu {wali},\n\n" +
      'Akses portal wali untuk {nama}:\n' +
      '• Kode: {kode}\n' +
      '• PIN: {pin}\n\n' +
      'Portal: {portal}',
  },
  {
    id: 'custom',
    label: 'Tulis Sendiri',
    description: 'Pesan bebas dengan merge tag',
    body: '',
  },
]

export const WA_MERGE_TAGS = ['{nama}', '{kelas}', '{poin}', '{wali}', '{kode}', '{pin}', '{portal}'] as const

/** Data merge tag satu siswa — dipakai WA broadcast & kartu portal */
export function waMergeFields(student: Student): Record<string, string> {
  return {
    nama: student.name,
    kelas: student.classes?.name ?? '—',
    poin: student.total_points > 0 ? `+${student.total_points}` : String(student.total_points),
    wali: student.guardian_name ?? 'Bpk/Ibu',
    kode: student.registration_code,
    pin: student.pin ?? 'belum diatur',
    // window tak tersedia di luar browser (test/non-DOM) — fallback path relatif
    portal: `${typeof window !== 'undefined' ? window.location.origin : ''}/check`,
  }
}

/** Ganti semua merge tag pada pesan dengan data siswa */
export function renderWaMessage(body: string, student: Student): string {
  const fields = waMergeFields(student)
  return body.replace(/\{(nama|kelas|poin|wali|kode|pin|portal)\}/g, (_, tag: string) => fields[tag] ?? `{${tag}}`)
}
