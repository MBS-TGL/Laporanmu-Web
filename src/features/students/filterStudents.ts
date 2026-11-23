import { isIncomplete, type CompletenessFields } from './completeness'
import type { Student, StudentFilters } from './types'

/** Kriteria filter halaman Data Siswa (tanpa paginasi) */
export type StudentCriteria = Omit<StudentFilters, 'page' | 'pageSize'>

/**
 * Satu sumber pencocokan filter untuk tabel DAN ekspor, supaya
 * "Hasil filter" di modal ekspor benar-benar sama dengan yang tampil.
 */
export function studentSearchText(s: Student): string {
  return [
    s.name,
    s.registration_code,
    s.nisn,
    s.nis,
    s.classes?.name,
    s.dorms?.name,
    s.guardian_name,
    s.phone,
    ...(s.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Lengkapi objek baris daftar (tanpa photo_url base64) untuk hitungan kelengkapan */
export function completenessOf(s: Student): CompletenessFields {
  return { ...s, photo_url: s.photo_url ?? (s.has_photo ? '1' : null) }
}

export function matchesStudentFilters(s: Student, f: StudentCriteria): boolean {
  const q = f.search?.trim().toLowerCase()
  if (q && !studentSearchText(s).includes(q)) return false
  if (f.classId && s.class_id !== f.classId) return false
  if (f.dormId && s.dorm_id !== f.dormId) return false
  if (f.tag && !(s.tags ?? []).includes(f.tag)) return false
  if (f.gender && s.gender !== f.gender) return false
  if (f.status && s.status !== f.status) return false
  if (f.graduationYear && s.graduation_year !== f.graduationYear) return false
  if (f.lastClassId && s.last_class_id !== f.lastClassId) return false
  if (f.missing === 'photo' && (s.photo_url || s.has_photo)) return false
  if (f.missing === 'phone' && s.phone) return false
  if (f.missing === 'nisn' && s.nisn) return false
  if (f.missing === 'pin' && (s.has_pin ?? !!s.pin)) return false
  if (f.missing === 'any' && !isIncomplete(completenessOf(s))) return false
  if (f.pointMode === 'negative' && s.total_points >= 0) return false
  if (f.pointMode === 'positive' && s.total_points <= 0) return false
  return true
}

/** Baris daftar aktif: lulusan selalu di luar (pintunya halaman Alumni) */
export function matchesStudentList(s: Student, f: StudentCriteria): boolean {
  if (s.status === 'graduated') return false
  return matchesStudentFilters(s, f)
}
