/** Baca blok tempelan Excel/Sheets: baris dipisah newline, kolom oleh tab.
 * Sel kosong atau bukan angka menjadi null (dilewati), nilai di-clamp 0..max. */
export function parseScoreBlock(text: string, max: number): (number | null)[][] {
  const lines = text.replace(/\r/g, '').split('\n')
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()

  return lines.map((line) =>
    line.split('\t').map((cell) => {
      const raw = cell.trim().replace(',', '.')
      if (raw === '') return null
      const value = Number.parseFloat(raw)
      if (Number.isNaN(value)) return null
      return Math.round(Math.min(max, Math.max(0, value)) * 10) / 10
    }),
  )
}
