// Prompt & parser untuk generator draf soal CBT dengan AI (Gemini).
// Murni tanpa side effect — dipakai GenerateModal + tes vitest.

import type { CbtImportRow } from './importParse'
import { OPTION_KEYS } from './importParse'

export type AiSourceMode = 'materi' | 'existing'

export interface AiPromptInput {
  mode: AiSourceMode
  /** Teks materi / CP-TP (mode materi) atau soal existing (mode existing). */
  source: string
  count: number
  /** Instruksi tambahan guru (fokus bab, jenjang, tingkat kesulitan). */
  extra?: string
}

export const AI_QUESTION_SYSTEM = `Kamu adalah pembuat soal pilihan ganda untuk sekolah Indonesia (SMP/SMA).
ATURAN KETAT:
1. Balas HANYA array JSON tanpa penjelasan, tanpa pembungkus kode, dalam bahasa Indonesia.
2. Skema tiap item: {"question": string, "options": {"A": string, "B": string, "C": string, "D": string, "E": string (boleh dilewati)}, "answer_key": "A"|"B"|"C"|"D"|"E", "points": number}
3. Soal berbasis HANYA pada materi yang diberikan. Jangan mengarang fakta di luar materi.
4. Opsi pengecoh (distraktor) harus masuk akal dan sejenis dengan kunci.
5. Variasikan posisi kunci jawaban, jangan menumpuk di satu huruf.
6. Bahasa soal sesuai jenjang sekolah menengah pertama/atas.`

export function buildAiQuestionPrompt(input: AiPromptInput): { system: string; prompt: string } {
  const modeText =
    input.mode === 'materi'
      ? `Buat ${input.count} soal pilihan ganda BARU berdasarkan MATERI berikut.`
      : `Ubah/normalisasi soal-soal pilihan ganda berikut menjadi format rapi (jangan mengubah makna soal, opsi, atau kunci; maksimal ${input.count} soal).`
  const extra = input.extra?.trim() ? `\nInstruksi tambahan guru: ${input.extra.trim()}` : ''
  return {
    system: AI_QUESTION_SYSTEM,
    prompt: `${modeText}${extra}\n\nMATERI / SOAL:\n"""\n${input.source.trim()}\n"""`,
  }
}

/** Ambil array JSON dari balasan AI (toleran terhadap pembungkus kode & teks sisa). */
export function parseAiQuestions(text: string): { rows: CbtImportRow[]; error?: string } {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const candidate = (fenced ? fenced[1] : text).trim()
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) {
    return { rows: [], error: 'Balasan AI tidak berisi daftar soal. Coba hasilkan ulang.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return { rows: [], error: 'Balasan AI bukan JSON yang valid. Coba hasilkan ulang.' }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { rows: [], error: 'Balasan AI kosong. Coba hasilkan ulang.' }
  }

  const rows: CbtImportRow[] = []
  parsed.forEach((item, i) => {
    const obj = item as Record<string, unknown>
    const question = typeof obj.question === 'string' ? obj.question.trim() : ''
    const rawOptions = (obj.options ?? {}) as Record<string, unknown>
    const options = OPTION_KEYS.filter((k) => {
      const v = rawOptions[k]
      return typeof v === 'string' && v.trim() !== ''
    }).map((k) => ({ key: k, text: String(rawOptions[k]).trim() }))
    const rawKey = obj.answer_key ?? obj.answerKey ?? obj.kunci
    const answerKey = typeof rawKey === 'string' ? rawKey.trim().toUpperCase() : ''
    const rawPoints = obj.points ?? obj.poin
    const pointsNum = Number(rawPoints)

    let error: string | undefined
    if (!question) error = 'Soal kosong'
    else if (options.length < 2) error = 'Opsi kurang dari 2'
    else if (!OPTION_KEYS.includes(answerKey as (typeof OPTION_KEYS)[number])) error = 'Kunci tidak valid'
    else if (!options.some((o) => o.key === answerKey)) error = `Kunci ${answerKey} tidak punya teks opsi`

    rows.push({
      row: i + 1,
      question,
      options,
      answerKey,
      points: Number.isFinite(pointsNum) && pointsNum > 0 ? pointsNum : 1,
      error,
    })
  })

  return { rows }
}
