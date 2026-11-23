/** Singkatan resmi yang tetap kapital saat nama diubah ke Title Case. */
const KEEP_UPPER = new Set(['MBS', 'SMP', 'SMA', 'MI', 'MTS', 'MA', 'SD', 'H', 'HJ', 'SE', 'ST'])

/**
 * Nama orang pada raport: Title Case, bukan kapital semua.
 * Hanya kata yang seluruhnya kapital yang diubah, agar nama campuran tetap utuh.
 * Huruf setelah `.`, `-`, dan `'` ikut dikapitalkan sehingga "S.PD." menjadi "S.Pd.".
 */
export function titleCaseName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return word
      if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase()
      const isAllCaps = word === word.toUpperCase() && /[A-Z]/.test(word)
      if (!isAllCaps) return word
      return word
        .toLowerCase()
        .replace(/(^|[.\-'’])([a-z\u00e0-\u00ff])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
    })
    .join(' ')
}
