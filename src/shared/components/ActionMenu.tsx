import type { ReactNode } from 'react'
import { Kbd } from './ShortcutsModal'

/**
 * Label item dropdown aksi halaman — gaya seragam seluruh aplikasi:
 * baris judul (+ badge shortcut di ujung kanan bila ada) dan deskripsi kecil di bawah.
 * Taxa dipakai oleh menu "more" StudentsPage, TeachersPage, dan AlumniPage.
 */
export function actionMenuLabel(title: string, desc?: string, shortcut?: string[]): ReactNode {
  return (
    <div style={{ minWidth: 180, paddingBlock: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {shortcut && shortcut.length > 0 && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
            {shortcut.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        )}
      </div>
      {desc && <div style={{ fontSize: 12, color: '#64748b' }}>{desc}</div>}
    </div>
  )
}
