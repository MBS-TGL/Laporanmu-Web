import { describe, expect, it } from 'vitest'
import { buildChatContext } from './aiContext'
import { AI_KNOWLEDGE } from './aiKnowledge'

const hubWali = AI_KNOWLEDGE.filter((entry) => entry.id === 'hub-wali')

describe('buildChatContext', () => {
  it('menyembunyikan menu administrasi dari guru', () => {
    const context = buildChatContext({
      role: 'teacher',
      can: (perm) => perm !== 'admin:access',
    })
    expect(context).toContain('Poin & Disiplin (/discipline)')
    expect(context).not.toContain('Administrasi (/admin)')
  })

  it('memuat panduan Hub Wali beserta route-nya', () => {
    const context = buildChatContext({ role: 'admin', knowledge: hubWali })
    expect(context).toContain('Hub Wali')
    expect(context).toContain('/students?tab=guardian')
  })

  it('selalu menyertakan halaman publik', () => {
    const context = buildChatContext({ role: 'teacher' })
    expect(context).toContain('Cek Wali Santri (/check)')
    expect(context).toContain('Verifikasi Rapor (/verify)')
  })

  it('menjaga konteks di bawah batas server', () => {
    const context = buildChatContext({
      role: 'admin',
      knowledge: AI_KNOWLEDGE.slice(0, 4),
    })
    expect(context.length).toBeLessThan(12_000)
  })
})
