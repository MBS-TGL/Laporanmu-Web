// Parser murni impor bank soal CBT (Excel/CSV) — tanpa side effect.
// Kolom: Soal | Opsi A..E | Kunci | Poin

export interface CbtImportRow {
  /** Nomor baris di file sumber */
  row: number
  question: string
  options: { key: string; text: string }[]
  answerKey: string
  points: number
  error?: string
  duplicate?: boolean
}

export const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Ubah tabel string hasil readSheet menjadi baris impor ter-validasi.
 * `existingQuestions` = soal yang sudah ada di bank (normalisasi teks),
 * dipakai menandai duplikat lintas file.
 */
export function parseCbtQuestionTable(
  table: string[][],
  existingQuestions: string[] = [],
): CbtImportRow[] {
  const existing = new Set(existingQuestions.map(normalize))
  const seen = new Set<string>()
  const rows: CbtImportRow[] = []

  for (let i = 0; i < table.length; i++) {
    const raw = table[i]
    const rowNo = i + 2 // +1 header, +1 index basis 1
    const question = (raw[0] ?? '').trim()
    const options = OPTION_KEYS.map((key, idx) => ({ key, text: (raw[idx + 1] ?? '').trim() })).filter(
      (o) => o.text !== '',
    )
    const answerKey = (raw[6] ?? '').trim().toUpperCase()
    const pointsRaw = (raw[7] ?? '').trim()
    const points = pointsRaw === '' ? 1 : Number.parseFloat(pointsRaw.replace(',', '.'))

    let error: string | undefined
    if (question === '') {
      error = 'Soal kosong'
    } else if (options.length < 2) {
      error = 'Minimal 2 opsi jawaban terisi'
    } else if (!OPTION_KEYS.includes(answerKey as (typeof OPTION_KEYS)[number])) {
      error = 'Kunci harus huruf opsi (A-E)'
    } else if (!options.some((o) => o.key === answerKey)) {
      error = `Kunci ${answerKey} tidak punya teks opsi`
    } else if (!Number.isFinite(points) || points <= 0) {
      error = 'Poin harus angka positif'
    }

    const normalized = normalize(question)
    const duplicate = !error && (existing.has(normalized) || seen.has(normalized))
    // Baris error tidak dihitung kandidat duplikat agar tidak memblokir baris valid
    if (normalized && !error) seen.add(normalized)

    rows.push({ row: rowNo, question, options, answerKey, points, error, duplicate })
  }

  return rows
}

export function getCbtRowStatus(row: CbtImportRow): 'siap' | 'error' | 'duplikat' {
  if (row.error) return 'error'
  if (row.duplicate) return 'duplikat'
  return 'siap'
}

export function getCbtRowMessage(row: CbtImportRow): string | undefined {
  if (row.error) return row.error
  if (row.duplicate) return 'Soal sudah ada di bank (atau duplikat dalam file)'
  return undefined
}
