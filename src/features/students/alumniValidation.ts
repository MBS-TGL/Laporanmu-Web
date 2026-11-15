import dayjs from 'dayjs'

export interface AlumniValidationInput {
  name?: string
  gender?: string
  graduation_year?: number | string
  nisn?: string
  class_name?: string
  graduated_at?: string
  phone?: string
}

export interface AlumniClassLookup {
  id: string
  name: string
}

export interface ExistingStudentKey {
  id?: string
  nisn?: string | null
  name: string
  graduation_year?: number | null
}

export interface AlumniValidationResult {
  isValid: boolean
  error?: string
  normalized: {
    name: string
    gender: 'L' | 'P'
    graduation_year: number
    nisn?: string
    last_class_id?: string
    last_class_name?: string
    graduated_at?: string
    phone?: string
  }
}

export type DuplicateStatus = 'baru' | 'duplikat' | 'error'

const GENDER_ALIASES: Record<string, 'L' | 'P'> = {
  l: 'L',
  'laki-laki': 'L',
  'laki laki': 'L',
  lakilaki: 'L',
  pria: 'L',
  male: 'L',
  m: 'L',
  p: 'P',
  perempuan: 'P',
  wanita: 'P',
  female: 'P',
  f: 'P',
}

/**
 * Bersihkan dan normalisasi nama alumni untuk disimpan ke database:
 * 1. Samakan apostrof melengkung (’ ‘ ` ´) menjadi lurus (')
 * 2. Samakan dash/strip unicode (– —) menjadi (-) dan hilangkan spasi di sekitar strip (AZ- ZAHRANI -> AZ-ZAHRANI)
 * 3. Bersihkan spasi ganda dan trim
 * 4. Simpan ke database dalam format UPPERCASE bersih
 */
export function normalizeAlumniName(value?: string): string {
  if (!value) return ''
  return value
    // Samakan apostrof melengkung ke lurus
    .replace(/[’‘`´]/g, "'")
    // Samakan dash/strip panjang ke strip standar
    .replace(/[–—]/g, '-')
    // Hilangkan spasi di sekitar tanda hubung / strip (misal: "AZ- ZAHRANI" atau "AZ - ZAHRANI" -> "AZ-ZAHRANI")
    .replace(/\s*-\s*/g, '-')
    // Bersihkan spasi ganda dan karakter whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/** Nilai komparasi nama untuk deteksi duplikat (lowercase, tanpa spasi ganda/simbol) */
export function getComparableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

export function parseAlumniGender(value?: string): 'L' | 'P' | undefined {
  if (!value) return undefined
  const v = value.trim().toLowerCase()
  return GENDER_ALIASES[v]
}

export function normalizeAlumniPhone(value?: string): string | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/[\s\-().]/g, '').trim()
  if (!cleaned) return undefined
  // Awalan 62 -> 08
  if (cleaned.startsWith('62')) {
    return `0${cleaned.slice(2)}`
  }
  // Awalan 8 -> 08 (kasus umum Excel memotong angka 0 di depan)
  if (/^8\d{8,12}$/.test(cleaned)) {
    return `0${cleaned}`
  }
  return cleaned
}

/** Parse tanggal lulus ke format YYYY-MM-DD */
export function parseGraduationDate(value?: unknown): string | null | undefined {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return dayjs(value).format('YYYY-MM-DD')
  }
  const str = String(value).trim()
  if (!str) return undefined

  // Format ISO YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str)
  if (isoMatch) {
    const d = dayjs(`${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(str)
  if (dmyMatch) {
    const d = dayjs(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  const parsed = dayjs(str)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

/**
 * Validasi kolom input alumni.
 * Aturan:
 * - nama: wajib
 * - jenis_kelamin: wajib ('L' atau 'P')
 * - tahun_lulus: wajib, range 1990 s.d. tahun sekarang
 * - nisn: opsional, jika diisi tepat 10 digit numerik
 * - kelas_terakhir: opsional, jika diisi dicocokkan dengan classes
 * - tanggal_lulus: opsional, valid YYYY-MM-DD jika diisi
 * - no_hp: opsional
 */
export function validateAlumniRow(
  input: AlumniValidationInput,
  classesLookup: AlumniClassLookup[] = [],
): AlumniValidationResult {
  const currentYear = new Date().getFullYear()
  const name = normalizeAlumniName(input.name)
  const gender = parseAlumniGender(input.gender)

  // Tahun lulus
  let yearNum: number | undefined
  if (input.graduation_year !== undefined && input.graduation_year !== null && String(input.graduation_year).trim() !== '') {
    const parsed = Number(String(input.graduation_year).trim())
    if (!isNaN(parsed) && Number.isInteger(parsed)) {
      yearNum = parsed
    }
  }

  // NISN
  const rawNisn = input.nisn ? String(input.nisn).trim() : ''
  const nisn = rawNisn || undefined

  // Kelas terakhir
  const rawClass = input.class_name ? String(input.class_name).trim() : ''
  let matchedClass: AlumniClassLookup | undefined
  if (rawClass) {
    const normSearch = rawClass.toLowerCase().replace(/[^a-z0-9]/g, '')
    matchedClass = classesLookup.find(
      (c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normSearch,
    )
  }

  // Tanggal lulus
  const parsedDate = parseGraduationDate(input.graduated_at)

  // No HP
  const phone = normalizeAlumniPhone(input.phone)

  // Evaluasi kesalahan
  let error: string | undefined

  if (!name) {
    error = 'Nama wajib diisi'
  } else if (!gender) {
    error = 'Jenis kelamin wajib diisi (L atau P)'
  } else if (yearNum === undefined) {
    error = 'Tahun lulus wajib diisi'
  } else if (yearNum < 1990 || yearNum > currentYear) {
    error = `Tahun lulus harus di antara 1990 dan ${currentYear}`
  } else if (nisn && (!/^\d+$/.test(nisn) || nisn.length !== 10)) {
    error = 'NISN harus berupa 10 digit angka'
  } else if (rawClass && !matchedClass) {
    error = `Kelas "${rawClass}" tidak ditemukan pada daftar kelas aktif`
  } else if (parsedDate === null) {
    error = 'Format tanggal lulus tidak valid (gunakan YYYY-MM-DD atau DD/MM/YYYY)'
  }

  return {
    isValid: !error,
    error,
    normalized: {
      name,
      gender: gender ?? 'L',
      graduation_year: yearNum ?? currentYear,
      nisn,
      last_class_id: matchedClass?.id,
      last_class_name: matchedClass?.name ?? (rawClass || undefined),
      graduated_at: parsedDate ?? undefined,
      phone,
    },
  }
}

/**
 * Cek apakah alumni duplikat terhadap daftar siswa yang sudah ada di DB atau dalam batch yang sama:
 * - Jika NISN terisi: cek apakah NISN sudah ada.
 * - Jika NISN kosong: cek kombinasi Nama + Tahun Lulus.
 */
export function checkAlumniDuplicate(
  candidate: {
    nisn?: string
    name: string
    graduation_year: number
    id?: string // jika sedang edit, exclude ID diri sendiri
  },
  existingStudents: ExistingStudentKey[],
  batchSeenKeys?: {
    nisnSet: Set<string>
    nameYearSet: Set<string>
  },
): { isDuplicate: boolean; reason?: string } {
  const candNameComp = getComparableName(candidate.name)
  const candNisn = candidate.nisn?.trim()
  const candYear = candidate.graduation_year

  // 1. Cek terhadap batch di memori (in-file duplikat)
  if (batchSeenKeys) {
    if (candNisn && batchSeenKeys.nisnSet.has(candNisn)) {
      return { isDuplicate: true, reason: `NISN "${candNisn}" duplikat dalam file impor` }
    }
    if (!candNisn && candNameComp && candYear) {
      const key = `${candNameComp}_${candYear}`
      if (batchSeenKeys.nameYearSet.has(key)) {
        return {
          isDuplicate: true,
          reason: `Nama "${candidate.name}" dan tahun ${candYear} duplikat dalam file impor`,
        }
      }
    }
  }

  // 2. Cek terhadap database existing
  if (candNisn) {
    const match = existingStudents.find((s) => s.id !== candidate.id && s.nisn?.trim() === candNisn)
    if (match) {
      return { isDuplicate: true, reason: `NISN "${candNisn}" sudah terdaftar atas nama ${match.name}` }
    }
  } else if (candNameComp && candYear) {
    const match = existingStudents.find(
      (s) =>
        s.id !== candidate.id &&
        s.graduation_year === candYear &&
        getComparableName(s.name) === candNameComp,
    )
    if (match) {
      return {
        isDuplicate: true,
        reason: `Alumni "${match.name}" angkatan ${candYear} sudah terdaftar`,
      }
    }
  }

  return { isDuplicate: false }
}
