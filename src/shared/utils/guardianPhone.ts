import { supabase } from '../../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface GuardianContact {
  phone: string | null
  name: string | null
  source: 'guardian' | 'mother' | 'father' | 'student'
}

interface GuardianRow {
  relation: string
  name: string | null
  phone: string | null
}

/**
 * Urutan prioritas kontak wali: wali resmi, lalu ibu, lalu ayah, lalu nomor
 * santri sendiri. Nomor kosong/spasi dianggap tidak ada, jadi baris yang
 * sudah diisi tapi tanpa nomor tidak memblokir fallback berikutnya.
 */
export function pickGuardianContact(
  guardians: GuardianRow[],
  studentFallback: { name: string | null; phone: string | null },
): GuardianContact {
  const order: GuardianContact['source'][] = ['guardian', 'mother', 'father']
  for (const relation of order) {
    const hit = guardians.find(
      (g) => g.relation === relation && typeof g.phone === 'string' && g.phone.trim() !== '',
    )
    if (hit) {
      return {
        phone: hit.phone!.trim(),
        name: hit.name?.trim() || studentFallback.name,
        source: relation as GuardianContact['source'],
      }
    }
  }
  const fallbackPhone =
    typeof studentFallback.phone === 'string' && studentFallback.phone.trim() !== ''
      ? studentFallback.phone.trim()
      : null
  return { phone: fallbackPhone, name: studentFallback.name, source: 'student' }
}

/**
 * Nomor WA wali untuk notifikasi keuangan/absensi. Sebelumnya modul WA selalu
 * memakai students.phone, padahal tabel student_guardians (0020) sudah berisi
 * nomor ayah/ibu/wali. Tanpa baris wali, perilaku kembali ke nomor santri.
 */
export async function resolveGuardianPhone(
  studentId: string,
  client: SupabaseClient = supabase,
): Promise<GuardianContact> {
  const [studentRes, guardiansRes] = await Promise.all([
    client
      .from('students')
      .select('name, phone, guardian_name')
      .eq('id', studentId)
      .maybeSingle(),
    client
      .from('student_guardians')
      .select('relation, name, phone')
      .eq('student_id', studentId)
      .is('deleted_at', null),
  ])

  if (studentRes.error) throw studentRes.error
  // Guardians boleh gagal (RLS guru) tanpa memblokir pengiriman ke nomor santri.
  const guardians = (guardiansRes.data ?? []) as GuardianRow[]
  const student = studentRes.data as { name: string | null; phone: string | null; guardian_name: string | null } | null

  const contact = pickGuardianContact(guardians, {
    name: student?.guardian_name ?? student?.name ?? null,
    phone: student?.phone ?? null,
  })

  return contact
}
