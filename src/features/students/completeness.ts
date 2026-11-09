/**
 * Definisi tunggal kelengkapan data master siswa (PRD §6.1b) — dipakai
 * DetailDrawer (ring persen), filter "belum lengkap" StudentsPage, dan
 * rekap stats per kelas supaya angkanya konsisten di seluruh halaman.
 */
export interface CompletenessFields {
  photo_url: string | null
  nisn: string | null
  nis: string | null
  nik: string | null
  phone: string | null
  address: string | null
  birth_place: string | null
  birth_date: string | null
  religion: string | null
  guardian_name: string | null
  kk_number: string | null
  origin_school: string | null
  tags: string[] | null
}

/** Field master yang dihitung untuk persentase kelengkapan data */
export const FIELD_CHECKS: { label: string; test: (s: CompletenessFields) => boolean }[] = [
  { label: 'Foto', test: (s) => !!s.photo_url },
  { label: 'NISN', test: (s) => !!s.nisn },
  { label: 'NIS', test: (s) => !!s.nis },
  { label: 'NIK', test: (s) => !!s.nik },
  { label: 'Telepon', test: (s) => !!s.phone },
  { label: 'Alamat', test: (s) => !!s.address },
  { label: 'Tempat lahir', test: (s) => !!s.birth_place },
  { label: 'Tanggal lahir', test: (s) => !!s.birth_date },
  { label: 'Agama', test: (s) => !!s.religion },
  { label: 'Nama wali', test: (s) => !!s.guardian_name },
  { label: 'No. KK', test: (s) => !!s.kk_number },
  { label: 'Sekolah asal', test: (s) => !!s.origin_school },
  { label: 'Label', test: (s) => !!s.tags?.length },
]

/** Label field yang masih kosong pada siswa */
export function missingFieldsOf(s: CompletenessFields): string[] {
  return FIELD_CHECKS.filter((f) => !f.test(s)).map((f) => f.label)
}

/** Persen kelengkapan data 0–100 */
export function completenessPercent(s: CompletenessFields): number {
  return Math.round(((FIELD_CHECKS.length - missingFieldsOf(s).length) / FIELD_CHECKS.length) * 100)
}

/** true bila minimal satu field master belum diisi */
export function isIncomplete(s: CompletenessFields): boolean {
  return missingFieldsOf(s).length > 0
}
