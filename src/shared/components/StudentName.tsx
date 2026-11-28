import type { CSSProperties } from 'react'
import { Button } from 'antd'
import { formatDisplayName } from '../utils/displayName'

const MASK = '••••••'

interface StudentNameProps {
  name?: string | null
  /** Mode privasi: tampilkan masker, bukan nama asli */
  masked?: boolean
  /** Bila diisi, nama menjadi tombol tautan */
  onClick?: () => void
  size?: number
  weight?: number
  style?: CSSProperties
}

/**
 * Nama orang seragam di tabel: selalu lewat `formatDisplayName` supaya
 * nama KAPITAL dari database tampil Title Case. Nilai mentah tetap dipakai
 * untuk ekspor dan dokumen cetak.
 */
export function StudentName({
  name,
  masked = false,
  onClick,
  size = 14,
  weight = 600,
  style,
}: StudentNameProps) {
  if (!name) return null
  const label = masked ? MASK : formatDisplayName(name)

  if (onClick) {
    return (
      <Button
        type="link"
        onClick={onClick}
        style={{ padding: 0, height: 'auto', fontSize: size, fontWeight: weight, ...style }}
      >
        {label}
      </Button>
    )
  }

  return <span style={{ fontSize: size, fontWeight: weight, ...style }}>{label}</span>
}
