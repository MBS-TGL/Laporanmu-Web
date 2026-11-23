import { describe, expect, it } from 'vitest'
import { DASHBOARD_ITEM, NAV_GROUPS } from './navItems'
import { MODULE_REGISTRY } from '../rbac/permissions'

/**
 * Penjaga istilah UI. Gagal kalau label/deskripsi memakai istilah yang sudah
 * dipensiunkan di docs/GLOSSARY.md (Raport, Data Siswa, Pusat ..., dan seterusnya).
 */
const BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bRaport\b/, reason: 'pakai Rapor' },
  { pattern: /\bData Siswa\b/, reason: 'pakai Santri' },
  { pattern: /\bData Guru\b/, reason: 'pakai Guru' },
  { pattern: /\bData Kelas\b/, reason: 'pakai Kelas' },
  { pattern: /\bPusat Evaluasi\b/, reason: 'pakai Evaluasi' },
  { pattern: /\bPusat Dokumen\b/, reason: 'pakai Dokumen Akademik' },
  { pattern: /\bDashboard Admin\b/, reason: 'pakai Administrasi' },
  { pattern: /\bBimbingan & Konseling\b/, reason: 'pakai Bimbingan Konseling' },
]

function assertClean(strings: string[], source: string) {
  for (const value of strings) {
    for (const { pattern, reason } of BANNED) {
      expect(
        pattern.test(value),
        `${source}: "${value}" memakai istilah terlarang, ${reason}`,
      ).toBe(false)
    }
  }
}

describe('terminology guard', () => {
  it('sidebar memakai istilah baku', () => {
    const navStrings = [
      DASHBOARD_ITEM.label,
      DASHBOARD_ITEM.desc,
      ...NAV_GROUPS.flatMap((group) => [
        group.label,
        ...group.items.flatMap((item) => [item.label, item.desc]),
      ]),
    ]
    assertClean(navStrings, 'navItems')
  })

  it('label RBAC memakai istilah baku', () => {
    assertClean(
      MODULE_REGISTRY.map((module) => module.label),
      'permissions',
    )
  })
})
