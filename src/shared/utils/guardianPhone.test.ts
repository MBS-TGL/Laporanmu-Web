import { describe, expect, it } from 'vitest'
import { pickGuardianContact } from './guardianPhone'

describe('pickGuardianContact', () => {
  const student = { name: 'Ahmad', phone: '081200000001' }

  it('memprioritaskan wali resmi di atas ibu dan ayah', () => {
    const result = pickGuardianContact(
      [
        { relation: 'father', name: 'Bapak', phone: '0811' },
        { relation: 'mother', name: 'Ibu', phone: '0822' },
        { relation: 'guardian', name: 'Pak Budi', phone: '0833' },
      ],
      student,
    )
    expect(result).toEqual({ phone: '0833', name: 'Pak Budi', source: 'guardian' })
  })

  it('jatuh ke ibu bila wali resmi tidak punya nomor', () => {
    const result = pickGuardianContact(
      [
        { relation: 'guardian', name: 'Pak Budi', phone: null },
        { relation: 'mother', name: 'Ibu', phone: '0822' },
      ],
      student,
    )
    expect(result).toEqual({ phone: '0822', name: 'Ibu', source: 'mother' })
  })

  it('mengabaikan nomor kosong dan spasi', () => {
    const result = pickGuardianContact(
      [
        { relation: 'mother', name: 'Ibu', phone: '   ' },
        { relation: 'father', name: 'Bapak', phone: '0811' },
      ],
      student,
    )
    expect(result).toEqual({ phone: '0811', name: 'Bapak', source: 'father' })
  })

  it('kembali ke nomor santri bila tidak ada baris wali', () => {
    const result = pickGuardianContact([], student)
    expect(result).toEqual({ phone: '081200000001', name: 'Ahmad', source: 'student' })
  })

  it('mengembalikan phone null bila semua kosong', () => {
    const result = pickGuardianContact([], { name: 'Ahmad', phone: null })
    expect(result).toEqual({ phone: null, name: 'Ahmad', source: 'student' })
  })
})
