import type { ImportRowStatus } from '../../shared/import/ImportWizard'

/** Satu baris hasil parse file impor kelas */
export interface ClassImportRow {
  name: string
  grade: string
  major: string
  teacher: string
  year: string
  academicYearId: string | null
  homeroomTeacherId: string | null
  /** Nama kelas sama (di file / di DB) untuk tahun akademik yang sama */
  duplicate: boolean
}

export const CLASS_IMPORT_HEADERS = ['Nama Kelas', 'Tingkat', 'Jurusan', 'Wali Kelas', 'Tahun Ajaran']

const norm = (s: string) => s.trim().toLowerCase()

/**
 * Parser murni tabel string → baris impor kelas. Tahun & wali di-resolve ke id
 * via nama; bila tidak cocok, id-nya null dan baris tetap siap dengan pesan
 * peringatan (pola yang sama dengan impor kelas V1).
 */
export function parseClassTable(
  table: string[][],
  opts: {
    teachers: { id: string; name: string }[]
    years: { id: string; name: string }[]
    /** Kunci "nama|tahunId" kelas yang sudah ada di DB (tahun sama) */
    existingKeys: Set<string>
  },
): ClassImportRow[] {
  if (table.length === 0) return []
  const headers = table[0].map(norm)
  const col = (...names: string[]) =>
    headers.findIndex((h) => names.some((n) => h === norm(n)))
  const iName = col('nama kelas', 'nama', 'kelas')
  const iGrade = col('tingkat', 'grade')
  const iMajor = col('jurusan', 'program', 'major')
  const iTeacher = col('wali kelas', 'wali', 'guru')
  const iYear = col('tahun ajaran', 'tahun akademik', 'tahun')

  if (iName === -1) throw new Error('Kolom "Nama Kelas" tidak ditemukan di baris pertama file')

  const teacherByName = new Map(opts.teachers.map((t) => [norm(t.name), t]))
  const yearByName = new Map(opts.years.map((y) => [norm(y.name), y]))
  const seen = new Set<string>()

  return table
    .slice(1)
    // Lewati baris benar-benar kosong (sering muncul di ujung sheet)
    .filter((r) => r.some((c) => (c ?? '').toString().trim() !== ''))
    .map((raw) => {
      const name = (raw[iName] ?? '').toString().trim()
      const grade = iGrade >= 0 ? (raw[iGrade] ?? '').toString().trim() : ''
      const major = iMajor >= 0 ? (raw[iMajor] ?? '').toString().trim() : ''
      const teacher = iTeacher >= 0 ? (raw[iTeacher] ?? '').toString().trim() : ''
      const year = iYear >= 0 ? (raw[iYear] ?? '').toString().trim() : ''

      const yearMatch = year ? yearByName.get(norm(year)) : undefined
      const teacherMatch = teacher ? teacherByName.get(norm(teacher)) : undefined
      const academicYearId = yearMatch?.id ?? null

      const key = `${norm(name)}|${academicYearId ?? ''}`
      const duplicate = !!name && (seen.has(key) || opts.existingKeys.has(key))
      if (name) seen.add(key)

      return {
        name,
        grade,
        major,
        teacher,
        year,
        academicYearId,
        homeroomTeacherId: teacherMatch?.id ?? null,
        duplicate,
      }
    })
}

export function getClassRowStatus(row: ClassImportRow): ImportRowStatus {
  if (!row.name) return 'error'
  if (row.duplicate) return 'duplikat'
  return 'siap'
}

export function getClassRowMessage(row: ClassImportRow): string | undefined {
  const msgs: string[] = []
  if (!row.name) msgs.push('Nama kelas wajib diisi')
  if (row.duplicate) msgs.push('Nama kelas sudah dipakai di tahun akademik ini')
  if (row.year && !row.academicYearId) msgs.push(`Tahun ajaran "${row.year}" tidak dikenal, dikosongkan`)
  if (row.teacher && !row.homeroomTeacherId) msgs.push(`Wali "${row.teacher}" tidak dikenal, dikosongkan`)
  return msgs.length > 0 ? msgs.join(' · ') : undefined
}
