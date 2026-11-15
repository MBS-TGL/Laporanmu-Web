// Analitik butir soal (item analysis) — murni, aman vitest.
// Menghitung % benar per soal + indeks daya beda (kelompok atas vs bawah).

import type { CbtAttempt } from './types'
import { gradeResponse } from './grading'

export interface ItemStat {
  questionId: string
  /** Jumlah santri yang menjawab soal ini */
  answered: number
  /** % benar (0–100) */
  pCorrect: number
  /** Indeks daya beda (−1..1): p_atas − p_bawah (Kelompok 27% atas vs bawah) */
  discrimination: number | null
  verdict: 'baik' | 'mudah' | 'sulit' | 'beda-rendah'
}

/** Skor per soal: 1 benar / 0 salah — partial credit (pg_multi/matching) dihitung proporsional. */
function isCorrectRatio(
  question: { id: string; type?: string; answer_key: string; answer: unknown; pairs: unknown; points: number },
  response: unknown,
): number {
  const r = gradeResponse(
    question.type ?? 'pg',
    question.answer_key,
    question.answer,
    question.pairs,
    question.points,
    response,
  )
  return question.points > 0 ? Math.min(1, Math.max(0, r / question.points)) : 0
}

/**
 * Analisis butir dari attempt final (submitted/grading). Kelompok atas &
 * bawah = 27% santri dengan skor tertinggi/terendah (konvensi klasik).
 */
export function itemAnalysis(
  questions: { id: string; type?: string; answer_key: string; answer: unknown; pairs: unknown; points: number }[],
  attempts: CbtAttempt[],
): ItemStat[] {
  const final = attempts.filter((a) => a.status === 'submitted' || a.status === 'grading')
  if (final.length < 2) return []

  // skor total per attempt (urut naik) untuk pembagian kelompok
  const withScore = [...final]
    .map((a) => ({ a, total: a.score ?? 0 }))
    .sort((x, y) => x.total - y.total)
  const groupSize = Math.max(1, Math.floor(withScore.length * 0.27))
  const low = withScore.slice(0, groupSize).map((x) => x.a)
  const high = withScore.slice(-groupSize).map((x) => x.a)

  return questions.map((q) => {
    let answered = 0
    let correctSum = 0
    let lowSum = 0
    let lowN = 0
    let highSum = 0
    let highN = 0

    for (const a of final) {
      const resp = (a.answers as Record<string, unknown> | null)?.[q.id]
      if (resp === undefined || resp === null) continue
      answered += 1
      const ratio = isCorrectRatio(q, resp)
      correctSum += ratio
      if (low.includes(a)) {
        lowSum += ratio
        lowN += 1
      }
      if (high.includes(a)) {
        highSum += ratio
        highN += 1
      }
    }
    if (answered === 0) {
      return { questionId: q.id, answered: 0, pCorrect: 0, discrimination: null, verdict: 'baik' }
    }

    const pCorrect = Math.round((correctSum / answered) * 100)
    const pHigh = highN ? highSum / highN : 0
    const pLow = lowN ? lowSum / lowN : 0
    const discrimination = Math.round((pHigh - pLow) * 100) / 100

    let verdict: ItemStat['verdict'] = 'baik'
    if (pCorrect >= 90) verdict = 'mudah'
    else if (pCorrect <= 25) verdict = 'sulit'
    else if (discrimination < 0.2) verdict = 'beda-rendah'

    return { questionId: q.id, answered, pCorrect, discrimination, verdict }
  })
}
