import dayjs from 'dayjs'
import type { PermitStudentBrief } from './types'

/**
 * Fungsi validasi murni (tanpa UI) untuk impor izin & parser hasil scan QR.
 * Pola mengikuti src/features/students/alumniValidation.ts — mudah diuji.
 */

// ------------------------------------------------------------
// Parser hasil scan QR kartu santri / surat izin
// ------------------------------------------------------------

/** Ambil kode izin dari teks `permit:<uuid>` (QR di surat cetak) */
export function extractPermitRef(raw: string): string | null {
  const str = String(raw ?? '').trim()
  const m = /^permit:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(str)
  return m ? m[1].toLowerCase() : null
}

/**
 * Ambil kode registrasi santri dari hasil scan.
 * QR kartu berisi URL `${origin}/check?code=REG-XXX&pin=...`; terima juga teks polos.
 * Mengembalikan null bila teks adalah referensi izin (`permit:`) atau tidak berisi kode.
 */
export function extractScannedCode(raw: string): string | null {
  if (extractPermitRef(raw)) return null
  const str = String(raw ?? '').trim()
  if (!str) return null

  try {
    const url = new URL(str)
    const code = url.searchParams.get('code')
    if (code) return code.trim().toUpperCase()
  } catch {
    // bukan URL — perlakukan sebagai teks polos di bawah
  }

  if (/^[A-Z0-9-]{3,32}$/i.test(str)) return str.toUpperCase()
  return null
}

// ------------------------------------------------------------
// Parser tanggal & jam untuk impor
// ------------------------------------------------------------

/** Terima ISO YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, atau Date → 'YYYY-MM-DD' */
export function parsePermitDate(value?: unknown): string | null | undefined {
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
  const dmyMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(str)
  if (dmyMatch) {
    const d = dayjs(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }

  const parsed = dayjs(str)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

/** Terima HH:mm, HH.mm, HH:mm:ss, "7.05" → 'HH:mm'; null bila tidak valid */
export function parsePermitTime(value?: unknown): string | null | undefined {
  if (value === null || value === undefined) return undefined
  if (value instanceof Date && !isNaN(value.getTime())) {
    return dayjs(value).format('HH:mm')
  }
  const str = String(value).trim()
  if (!str) return undefined

  const m = /^(\d{1,2})[.:](\d{1,2})(?::\d{1,2})?$/.exec(str)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Normalisasi nomor telepon sederhana: digit saja, 62… → 0… */
export function normalizePermitPhone(value?: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const str = String(value).replace(/\D/g, '').replace(/^62/, '0')
  return str || undefined
}

// ------------------------------------------------------------
// Validasi baris impor
// ------------------------------------------------------------

export type PermitImportStatus = 'baru' | 'duplikat' | 'error'

export interface PermitImportRowInput {
  kode_santri: string
  nama_santri: string
  tujuan: string
  keperluan: string
  tanggal_keluar: string
  tanggal_kembali: string
  jam_kembali: string
  no_telepon: string
}

export interface PermitImportNormalized {
  student_id: string
  student_name: string
  phone?: string
  destination: string
  purpose: string
  leave_date: string
  return_date: string
  return_time: string
}

/** Nama bandingkan: huruf kecil, hanya alfanumerik */
function getComparableName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function validatePermitImportRow(
  input: PermitImportRowInput,
  students: PermitStudentBrief[],
): { isValid: boolean; error?: string; normalized?: PermitImportNormalized } {
  const destination = input.tujuan.trim()
  const purpose = input.keperluan.trim()

  // Resolve santri: kode registrasi dulu, lalu nama (harus unik)
  const code = input.kode_santri.trim().toUpperCase()
  const name = input.nama_santri.trim()
  let student: PermitStudentBrief | undefined

  if (code) {
    student = students.find((s) => s.registration_code.toUpperCase() === code)
    if (!student) {
      return { isValid: false, error: `Kode santri "${code}" tidak ditemukan` }
    }
  } else if (name) {
    const matches = students.filter((s) => getComparableName(s.name) === getComparableName(name))
    if (matches.length === 0) {
      return { isValid: false, error: `Santri "${name}" tidak ditemukan` }
    }
    if (matches.length > 1) {
      return { isValid: false, error: `Nama "${name}" ambigu (${matches.length} santri) — isi kolom kode_santri` }
    }
    student = matches[0]
  } else {
    return { isValid: false, error: 'kode_santri wajib diisi' }
  }

  const leaveDate = parsePermitDate(input.tanggal_keluar)
  const returnDate = parsePermitDate(input.tanggal_kembali)
  const returnTime = parsePermitTime(input.jam_kembali)

  let error: string | undefined
  if (!destination) error = 'Tujuan wajib diisi'
  else if (!purpose) error = 'Keperluan wajib diisi'
  else if (leaveDate === null || leaveDate === undefined) error = 'Tanggal keluar tidak valid'
  else if (returnDate === null || returnDate === undefined) error = 'Tanggal kembali tidak valid'
  else if (returnDate < leaveDate) error = 'Tanggal kembali tidak boleh sebelum tanggal keluar'
  else if (returnTime === null || returnTime === undefined) error = 'Jam kembali tidak valid (HH:mm)'

  if (error) return { isValid: false, error }

  return {
    isValid: true,
    normalized: {
      student_id: student.id,
      student_name: student.name,
      phone: normalizePermitPhone(input.no_telepon),
      destination,
      purpose,
      leave_date: leaveDate as string,
      return_date: returnDate as string,
      return_time: returnTime as string,
    },
  }
}

export function checkPermitDuplicate(
  candidate: { student_id: string; leave_date: string },
  activeKeys: Set<string>,
  batchSeen: Set<string>,
): { isDuplicate: boolean; reason?: string } {
  const key = `${candidate.student_id}|${candidate.leave_date}`
  if (batchSeen.has(key)) {
    return { isDuplicate: true, reason: 'Duplikat dalam file yang sama' }
  }
  if (activeKeys.has(key)) {
    return { isDuplicate: true, reason: 'Santri sudah punya izin aktif di tanggal tersebut' }
  }
  return { isDuplicate: false }
}
