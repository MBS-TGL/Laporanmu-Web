import { describe, expect, it } from 'vitest'
import {
  checkPermitDuplicate,
  extractPermitRef,
  extractScannedCode,
  normalizePermitPhone,
  parsePermitDate,
  parsePermitTime,
  validatePermitImportRow,
} from './permitValidation'
import type { PermitStudentBrief } from './types'

const students: PermitStudentBrief[] = [
  { id: 's1', name: 'AHMAD FULAN', registration_code: 'REG-001', phone: '081234567890' },
  { id: 's2', name: 'SITI AMINAH', registration_code: 'REG-002', phone: null },
  { id: 's3', name: 'AHMAD FULAN', registration_code: 'REG-003', phone: null }, // nama ambigu
]

describe('extractPermitRef', () => {
  it('mengenali format permit:<uuid>', () => {
    const id = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
    expect(extractPermitRef(`permit:${id}`)).toBe(id)
  })

  it('menolak teks lain', () => {
    expect(extractPermitRef('REG-001')).toBeNull()
    expect(extractPermitRef('permit:bukan-uuid')).toBeNull()
  })
})

describe('extractScannedCode', () => {
  it('mengambil param code dari URL kartu santri', () => {
    expect(extractScannedCode('https://app.laporanmu.id/check?code=REG-007&pin=1234')).toBe('REG-007')
  })

  it('menerima kode polos dan meng-uppercase-kan', () => {
    expect(extractScannedCode('reg-042')).toBe('REG-042')
  })

  it('mengembalikan null untuk referensi izin dan teks acak', () => {
    expect(extractScannedCode('permit:a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d')).toBeNull()
    expect(extractScannedCode('halo dunia apa kabar')).toBeNull()
    expect(extractScannedCode('')).toBeNull()
  })
})

describe('parsePermitDate', () => {
  it('menerima ISO, DD/MM/YYYY, dan DD-MM-YYYY', () => {
    expect(parsePermitDate('2026-03-05')).toBe('2026-03-05')
    expect(parsePermitDate('05/03/2026')).toBe('2026-03-05')
    expect(parsePermitDate('5-3-2026')).toBe('2026-03-05')
  })

  it('menerima objek Date dan menolak sampah', () => {
    expect(parsePermitDate(new Date(2026, 2, 5))).toBe('2026-03-05')
    expect(parsePermitDate('bukan tanggal')).toBeNull()
    expect(parsePermitDate('')).toBeUndefined()
  })
})

describe('parsePermitTime', () => {
  it('menerima HH:mm dengan pemisah titik dua / titik', () => {
    expect(parsePermitTime('14:30')).toBe('14:30')
    expect(parsePermitTime('7.05')).toBe('07:05')
    expect(parsePermitTime('9:15:00')).toBe('09:15')
  })

  it('menolak jam atau menit di luar jangkauan', () => {
    expect(parsePermitTime('25:00')).toBeNull()
    expect(parsePermitTime('12:75')).toBeNull()
    expect(parsePermitTime('pagi')).toBeNull()
  })
})

describe('normalizePermitPhone', () => {
  it('mengubah 62 menjadi 0 dan membuang non-digit', () => {
    expect(normalizePermitPhone('+62 812-3456-7890')).toBe('081234567890')
    expect(normalizePermitPhone('0812 3456 789')).toBe('08123456789')
    expect(normalizePermitPhone('')).toBeUndefined()
  })
})

describe('validatePermitImportRow', () => {
  const base = {
    kode_santri: 'REG-001',
    nama_santri: '',
    tujuan: 'Rumah orang tua',
    keperluan: 'Pulang ke rumah',
    tanggal_keluar: '2026-03-05',
    tanggal_kembali: '2026-03-07',
    jam_kembali: '16:00',
    no_telepon: '081234567890',
  }

  it('valid dengan kode santri', () => {
    const res = validatePermitImportRow(base, students)
    expect(res.isValid).toBe(true)
    expect(res.normalized?.student_id).toBe('s1')
    expect(res.normalized?.leave_date).toBe('2026-03-05')
    expect(res.normalized?.return_time).toBe('16:00')
  })

  it('fallback ke nama santri bila kode kosong', () => {
    const res = validatePermitImportRow({ ...base, kode_santri: '', nama_santri: 'Siti Aminah' }, students)
    expect(res.isValid).toBe(true)
    expect(res.normalized?.student_id).toBe('s2')
  })

  it('menolak nama ambigu', () => {
    const res = validatePermitImportRow({ ...base, kode_santri: '', nama_santri: 'Ahmad Fulan' }, students)
    expect(res.isValid).toBe(false)
    expect(res.error).toContain('ambigu')
  })

  it('menolak kode tidak dikenal & field wajib kosong', () => {
    expect(validatePermitImportRow({ ...base, kode_santri: 'REG-999' }, students).error).toContain('tidak ditemukan')
    expect(validatePermitImportRow({ ...base, tujuan: ' ' }, students).error).toContain('Tujuan')
    expect(validatePermitImportRow({ ...base, keperluan: '' }, students).error).toContain('Keperluan')
  })

  it('menolak tanggal kembali sebelum keluar & jam tidak valid', () => {
    expect(
      validatePermitImportRow({ ...base, tanggal_kembali: '2026-03-01' }, students).error,
    ).toContain('sebelum')
    expect(validatePermitImportRow({ ...base, jam_kembali: '99:00' }, students).error).toContain('Jam kembali')
  })
})

describe('checkPermitDuplicate', () => {
  const activeKeys = new Set(['s1|2026-03-05'])

  it('mendeteksi izin aktif di database', () => {
    const res = checkPermitDuplicate({ student_id: 's1', leave_date: '2026-03-05' }, activeKeys, new Set())
    expect(res.isDuplicate).toBe(true)
    expect(res.reason).toContain('izin aktif')
  })

  it('mendeteksi duplikat dalam file yang sama', () => {
    const res = checkPermitDuplicate({ student_id: 's2', leave_date: '2026-03-05' }, activeKeys, new Set(['s2|2026-03-05']))
    expect(res.isDuplicate).toBe(true)
    expect(res.reason).toContain('file')
  })

  it('lolos untuk santri & tanggal baru', () => {
    expect(checkPermitDuplicate({ student_id: 's2', leave_date: '2026-03-06' }, activeKeys, new Set()).isDuplicate).toBe(false)
  })
})
