// Parser murni "Input Cepat Teks": tempel banyak soal format bebas.
// Konvensi baris:
//   1. Teks soal          (mulai soal baru; angka + titik/kurung)
//   A. teks opsi           (huruf A-E + titik/kurung)
//   Kunci: B               (boleh "Kunci" / "Jawaban")
//   Poin: 2                (opsional, default 1)
// Baris lain dianggap kelanjutan teks sebelumnya (pembungkusan baris).
// Hasil berupa tabel kolom yang divalidasi ulang oleh parseCbtQuestionTable
// agar aturan & deteksi duplikat identik dengan impor Excel.

import { parseCbtQuestionTable, type CbtImportRow } from './importParse'

const QUESTION_RE = /^\s*(\d{1,3})\s*[.)]\s+(.*)$/
const OPTION_RE = /^\s*([A-Ea-e])\s*[.)]\s+(.*)$/
const KEY_RE = /^\s*(?:kunci|jawaban)\s*[:.=]\s*([A-Ea-e])\b/i
const POINTS_RE = /^\s*(?:poin|bobot|nilai)\s*[:.=]\s*([\d.,]+)/i

/** Ubah teks tempel menjadi baris CbtImportRow (validasi via parser Excel). */
export function parseQuestionText(text: string, existingQuestions: string[] = []): CbtImportRow[] {
  const lines = text.split(/\r?\n/)
  const table: string[][] = []

  let question = ''
  const options: Record<string, string> = {}
  let key = ''
  let points = ''

  const flush = () => {
    const q = question.trim()
    // Teks lepas tanpa opsi/kunci (catatan pembuka, dsb) diabaikan
    if (Object.keys(options).length > 0 || key) {
      table.push([
        q,
        options.A ?? '',
        options.B ?? '',
        options.C ?? '',
        options.D ?? '',
        options.E ?? '',
        key.toUpperCase(),
        points,
      ])
    }
    question = ''
    for (const k of ['A', 'B', 'C', 'D', 'E']) delete options[k]
    key = ''
    points = ''
  }

  for (const line of lines) {
    if (!line.trim()) continue

    const qMatch = QUESTION_RE.exec(line)
    const oMatch = OPTION_RE.exec(line)
    const kMatch = KEY_RE.exec(line)
    const pMatch = POINTS_RE.exec(line)

    if (qMatch) {
      // Baris bernomor: soal baru (opsi/kunci sisa di-flush dulu bila ada)
      flush()
      question = qMatch[2]
    } else if (oMatch) {
      const letter = oMatch[1].toUpperCase()
      options[letter] = oMatch[2]
    } else if (kMatch) {
      key = kMatch[1].toUpperCase()
    } else if (pMatch) {
      points = pMatch[1]
    } else if (!Object.keys(options).length && !key) {
      // pembungkusan teks soal
      question = question ? `${question} ${line.trim()}` : line.trim()
    } else {
      // pembungkusan teks opsi terakhir
      const last = ['E', 'D', 'C', 'B', 'A'].find((k) => options[k])
      if (last) options[last] = `${options[last]} ${line.trim()}`
      else question = `${question} ${line.trim()}`
    }
  }
  flush()

  return parseCbtQuestionTable(table, existingQuestions)
}
