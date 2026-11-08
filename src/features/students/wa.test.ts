import { describe, expect, it } from 'vitest'
import { renderWaMessage, waLink, waMergeFields, waPhoneDigits } from './wa'
import type { Student } from './types'

const student = {
  name: 'Ahmad Fulan',
  registration_code: 'LPM-0001-001',
  total_points: -5,
  guardian_name: null,
  pin: '1234',
  classes: { name: 'Kelas 7A' },
} as unknown as Student

describe('waPhoneDigits', () => {
  it('mengubah awalan 0 menjadi 62', () => {
    expect(waPhoneDigits('0812-3456-7890')).toBe('6281234567890')
  })

  it('mempertahankan nomor yang sudah internasional', () => {
    expect(waPhoneDigits('6281234567890')).toBe('6281234567890')
  })

  it('membuang karakter non-digit', () => {
    expect(waPhoneDigits('+62 812 3456 7890')).toBe('6281234567890')
  })
})

describe('waLink', () => {
  it('membuat tautan wa.me dengan pesan ter-encode', () => {
    const link = waLink('081234567890', 'Assalamu\'alaikum & hai')
    expect(link).toBe('https://wa.me/6281234567890?text=' + encodeURIComponent("Assalamu'alaikum & hai"))
  })

  it('tanpa pesan hanya nomor', () => {
    expect(waLink('0812')).toBe('https://wa.me/62812')
  })
})

describe('waMergeFields', () => {
  it('mengisi default untuk wali yang belum tercatat', () => {
    expect(waMergeFields(student).wali).toBe('Bpk/Ibu')
  })

  it('menandai PIN belum diatur', () => {
    expect(waMergeFields({ ...student, pin: null } as unknown as Student).pin).toBe('belum diatur')
  })

  it('poin negatif tanpa tanda tambah', () => {
    expect(waMergeFields(student).poin).toBe('-5')
  })

  it('poin positif diberi tanda tambah', () => {
    expect(waMergeFields({ ...student, total_points: 3 } as unknown as Student).poin).toBe('+3')
  })
})

describe('renderWaMessage', () => {
  it('mengganti semua merge tag', () => {
    const msg = renderWaMessage('{wali}: poin {nama} ({kelas}) = {poin}', student)
    expect(msg).toBe('Bpk/Ibu: poin Ahmad Fulan (Kelas 7A) = -5')
  })

  it('membiarkan tag tak dikenal apa adanya', () => {
    expect(renderWaMessage('{unknown}', student)).toBe('{unknown}')
  })
})
