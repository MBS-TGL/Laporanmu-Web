// Grading respons per tipe soal — murni, sisi client (untuk analitik butir).
// Sumber kebenaran tetap grading di RPC server (_cbt_finalize_attempt).

import type { MatchingPairs } from './types'

/**
 * Nilai satu respons: mengembalikan poin diperoleh (0..points).
 * Tipe: pg, pg_multi (partial credit), true_false, matching (proporsional).
 * Essay tidak dinilai di sini (dinilai guru via RPC).
 */
export function gradeResponse(
  type: string,
  answerKey: string,
  answer: unknown,
  pairs: unknown,
  points: number,
  response: unknown,
): number {
  if (response === undefined || response === null) return 0

  if (type === 'pg') {
    return response === answerKey ? points : 0
  }

  if (type === 'true_false') {
    return response === answer ? points : 0
  }

  if (type === 'pg_multi') {
    const keys = Array.isArray(answer) ? (answer as string[]) : []
    const resp = Array.isArray(response) ? (response as string[]) : []
    if (keys.length === 0 || resp.length === 0) return 0
    const right = resp.filter((k) => keys.includes(k)).length
    const wrong = resp.filter((k) => !keys.includes(k)).length
    return round1((Math.max(0, right - wrong) / keys.length) * points)
  }

  if (type === 'matching') {
    const pairsObj = pairs as MatchingPairs | null
    const correct = pairsObj?.correct
    if (!correct) return 0
    const resp = (typeof response === 'object' && response !== null ? response : {}) as Record<string, string>
    const total = Object.keys(correct).length
    if (total === 0) return 0
    const hit = Object.entries(correct).filter(([left, right]) => resp[left] === right).length
    return round1((hit / total) * points)
  }

  return 0 // essay: dinilai guru
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
