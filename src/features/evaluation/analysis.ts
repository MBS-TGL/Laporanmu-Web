// Analisis hasil angket — murni, aman vitest.
// AKPD/EDOM: rata-rata skala per dimensi. MBTI: preferensi 4 huruf.
// Sosiometri: Moreno (popularitas, isolasi) + kohesi.

import type { EvalQuestion, InstrumentResponse, InstrumentKind } from './types'

export interface DimensionScore {
  dimension: string
  /** Rata-rata skala (1..max) */
  avg: number
  count: number
}

/** Skor 0..1 per jawaban skala (jawaban / max). Non-skala diabaikan. */
function skalaRatio(q: EvalQuestion | undefined, value: unknown): number | null {
  if (!q || q.type !== 'skala') return null
  const v = Number(value)
  const max = q.max ?? 5
  if (!Number.isFinite(v) || v < 1 || v > max) return null
  return v / max
}

/** Rata-rata per dimensi untuk satu responden (AKPD/EDOM/MBTI-dimension). */
export function dimensionScores(
  questions: EvalQuestion[],
  answers: Record<string, unknown>,
): DimensionScore[] {
  const acc = new Map<string, { sum: number; count: number }>()
  for (const q of questions) {
    const ratio = skalaRatio(q, answers[q.id])
    if (ratio === null) continue
    const dim = q.dimension ?? 'Umum'
    const cur = acc.get(dim) ?? { sum: 0, count: 0 }
    cur.sum += ratio
    cur.count += 1
    acc.set(dim, cur)
  }
  return [...acc.entries()]
    .map(([dimension, { sum, count }]) => ({
      dimension,
      avg: Math.round((sum / count) * 100) / 100,
      count,
    }))
    .sort((a, b) => b.avg - a.avg)
}

/** Rata-rata per dimensi dirata-rata seluruh responden (rekap kelas). */
export function classDimensionScores(
  questions: EvalQuestion[],
  responses: InstrumentResponse[],
): DimensionScore[] {
  const per = responses
    .filter((r) => r.submitted_at)
    .map((r) => dimensionScores(questions, r.answers))
  if (per.length === 0) return []
  const dims = [...new Set(per.flat().map((d) => d.dimension))]
  return dims
    .map((dimension) => {
      const vals = per
        .map((list) => list.find((d) => d.dimension === dimension)?.avg)
        .filter((v): v is number => v !== undefined)
      return {
        dimension,
        avg: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100,
        count: vals.length,
      }
    })
    .sort((a, b) => b.avg - a.avg)
}

// ─── MBTI ────────────────────────────────────────────────────────────────────

/**
 * Preferensi satu dimensi (mis. 'EI'): jawaban skala 1..5.
 * 1-2 condong huruf kiri (a), 4-5 huruf kanan (b), 3 netral.
 * questions membawa dimension 'EI' dan props a/b via options? —
 * dipetakan lewat map dims: { 'EI': ['E','I'], ... } dari template MBTI.
 */
export function mbtiType(questions: EvalQuestion[], answers: Record<string, unknown>): string | null {
  // dimensi unik menjaga urutan
  const dims: string[] = []
  for (const q of questions) {
    if (q.type === 'skala' && q.dimension && !dims.includes(q.dimension)) dims.push(q.dimension)
  }
  if (dims.length === 0) return null

  const letters: string[] = []
  for (const dim of dims) {
    const [a = '', b = ''] = dim.split('-')
    if (!a || !b) return null
    const ratios = questions
      .filter((q) => q.dimension === dim && q.type === 'skala')
      .map((q) => skalaRatio(q, answers[q.id]))
      .filter((v): v is number => v !== null)
    if (ratios.length === 0) return null
    const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length
    // <0.5 condong a (jawaban kecil), >0.5 condong b, 0.5 netral → ambil a
    letters.push(avg < 0.5 ? a : avg >= 0.5 ? b : a)
  }
  return letters.join('')
}

/** Distribusi tipe MBTI seluruh responden. */
export function mbtiDistribution(
  questions: EvalQuestion[],
  responses: InstrumentResponse[],
): { type: string; count: number }[] {
  const acc = new Map<string, number>()
  for (const r of responses.filter((x) => x.submitted_at)) {
    const t = mbtiType(questions, r.answers)
    if (t) acc.set(t, (acc.get(t) ?? 0) + 1)
  }
  return [...acc.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
}

// ─── Sosiometri (Moreno) ─────────────────────────────────────────────────────

export interface SociometryResult {
  /** Pilihan diterima per santri (student_id → jumlah) */
  received: Map<string, number>
  /** Pilihan diberikan per santri */
  given: Map<string, number>
  /** Pasangan saling memilih (mutual), pasangan id terurut */
  mutual: number
  /** Indeks kohesi = mutual / total pilihan */
  cohesion: number
  /** Santri terpopuler (paling banyak dipilih, ≥1) */
  stars: { studentId: string; received: number }[]
  /** Santri terisolasi (tidak memilih & tidak dipilih) */
  isolated: string[]
  totalChoices: number
}

const TEMAN_QUESTIONS = (questions: EvalQuestion[]) => questions.filter((q) => q.type === 'teman')

function answeredIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value) return [value]
  return []
}

/** Analisis sosiometri dari semua pilihan 'teman' yang tersimpan. */
export function sociometry(
  questions: EvalQuestion[],
  responses: InstrumentResponse[],
  classmateIds: string[],
): SociometryResult {
  const received = new Map<string, number>()
  const given = new Map<string, number>()
  const pairsSeen = new Set<string>()
  let totalChoices = 0
  let mutual = 0

  for (const r of responses.filter((x) => x.submitted_at)) {
    for (const q of TEMAN_QUESTIONS(questions)) {
      for (const target of answeredIds(r.answers[q.id])) {
        totalChoices += 1
        received.set(target, (received.get(target) ?? 0) + 1)
        given.set(r.student_id, (given.get(r.student_id) ?? 0) + 1)
        const pairKey = [r.student_id, target].sort().join('|')
        if (pairsSeen.has(pairKey)) mutual += 1
        pairsSeen.add(pairKey)
      }
    }
  }

  const stars = classmateIds
    .map((id) => ({ studentId: id, received: received.get(id) ?? 0 }))
    .filter((x) => x.received > 0)
    .sort((a, b) => b.received - a.received)
    .slice(0, 5)

  const isolated = classmateIds.filter((id) => !(received.get(id) ?? 0) && !(given.get(id) ?? 0))

  return {
    received,
    given,
    mutual,
    cohesion: totalChoices ? Math.round((mutual / totalChoices) * 100) / 100 : 0,
    stars,
    isolated,
    totalChoices,
  }
}

/** Analisis utama per jenis angket — dipakai UI hasil. */
export function analyze(
  kind: InstrumentKind,
  questions: EvalQuestion[],
  responses: InstrumentResponse[],
  classmateIds: string[],
): {
  dimensions: DimensionScore[]
  mbtiDistribution: { type: string; count: number }[]
  sociometry: SociometryResult | null
} {
  return {
    dimensions: classDimensionScores(questions, responses),
    mbtiDistribution: kind === 'mbti' ? mbtiDistribution(questions, responses) : [],
    sociometry: kind === 'sosiometri' ? sociometry(questions, responses, classmateIds) : null,
  }
}
