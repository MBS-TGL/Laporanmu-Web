import { describe, expect, it } from 'vitest'
import { retrieveKnowledge } from './aiKnowledge'

function ids(question: string, can?: (perm: string) => boolean): string[] {
  return retrieveKnowledge(question, can ? { can } : {}).map((entry) => entry.id)
}

describe('retrieveKnowledge', () => {
  it('menemukan penjelasan poin santri', () => {
    expect(ids('Apa itu poin santri?')).toContain('poin-santri')
  })

  it('mengarahkan cek rapor wali ke halaman yang benar', () => {
    expect(ids('Bagaimana orang tua cek rapor?')).toContain('cek-wali')
  })

  it('mengenali data wali sebagai Hub Wali', () => {
    const result = ids('Di mana data wali?')
    expect(result).toContain('hub-wali')
    expect(result).not.toContain('data-wali')
  })

  it('menolak data spesifik lewat panduan data-spesifik', () => {
    expect(ids('Siapa nomor HP wali Ahmad?')).toContain('data-spesifik')
  })

  it('menyembunyikan administrasi dari role tanpa izin', () => {
    const can = (perm: string) => perm !== 'admin:access'
    const result = ids('Buka administrasi', can)
    expect(result).not.toContain('administrasi')
    expect(result).toContain('akses-admin')
  })

  it('menyembunyikan modul dengan flag mati', () => {
    const result = retrieveKnowledge('Di mana halaqah?', {
      flags: { 'module.halaqah': false },
    })
    expect(result.map((entry) => entry.id)).not.toContain('halaqah')
  })
})
