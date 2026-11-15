import { describe, expect, it } from 'vitest'
import { gradeResponse } from './grading'
import { itemAnalysis } from './itemAnalysis'
import type { CbtAttempt } from './types'

describe('gradeResponse', () => {
  it('pg tepat / salah', () => {
    expect(gradeResponse('pg', 'A', null, null, 10, 'A')).toBe(10)
    expect(gradeResponse('pg', 'A', null, null, 10, 'B')).toBe(0)
  })

  it('pg_multi partial credit', () => {
    const q = { id: 'q2', type: 'pg_multi', answer_key: '', answer: ['A', 'C'], pairs: null, points: 10 }
    expect(gradeResponse('pg_multi', '', q.answer, null, 10, ['A', 'C'])).toBe(10)
    expect(gradeResponse('pg_multi', '', q.answer, null, 10, ['A'])).toBe(5)
    // benar 1, salah 1 → (1-1)/2 = 0 (rumus partial credit klasik)
    expect(gradeResponse('pg_multi', '', q.answer, null, 10, ['A', 'B'])).toBe(0)
    expect(gradeResponse('pg_multi', '', q.answer, null, 10, ['B'])).toBe(0)
  })

  it('true_false', () => {
    expect(gradeResponse('true_false', '', 'B', null, 5, 'B')).toBe(5)
    expect(gradeResponse('true_false', '', 'B', null, 5, 'S')).toBe(0)
  })

  it('matching proporsional', () => {
    const pairs = { rights: [{ key: 'R1', text: 'x' }], correct: { '1': 'R1', '2': 'R1' } }
    expect(gradeResponse('matching', '', null, pairs, 10, { '1': 'R1', '2': 'R1' })).toBe(10)
    expect(gradeResponse('matching', '', null, pairs, 10, { '1': 'R1' })).toBe(5)
  })

  it('respons kosong = 0', () => {
    expect(gradeResponse('pg', 'A', null, null, 10, null)).toBe(0)
    expect(gradeResponse('essay', '', null, null, 10, 'jawaban')).toBe(0)
  })
})

describe('itemAnalysis', () => {
  const questions = [
    { id: 'q1', type: 'pg', answer_key: 'A', answer: null, pairs: null, points: 10 },
    { id: 'q2', type: 'pg', answer_key: 'B', answer: null, pairs: null, points: 10 },
  ]
  const mkAttempt = (id: string, score: number, answers: Record<string, string>): CbtAttempt =>
    ({
      id,
      exam_id: 'e',
      student_id: id,
      status: 'submitted',
      started_at: '',
      deadline_at: '',
      submitted_at: '',
      score,
      correct_count: null,
      answers,
      essay_scores: null,
      question_order: [],
      client_meta: null,
    }) as unknown as CbtAttempt

  it('butir selalu benar → mudah; butir selalu salah → sulit', () => {
    const attempts = [
      mkAttempt('s1', 80, { q1: 'A', q2: 'X' }),
      mkAttempt('s2', 60, { q1: 'A', q2: 'X' }),
      mkAttempt('s3', 40, { q1: 'A', q2: 'X' }),
    ]
    const stats = itemAnalysis(questions, attempts)
    expect(stats[0].pCorrect).toBe(100)
    expect(stats[0].verdict).toBe('mudah')
    expect(stats[1].pCorrect).toBe(0)
    expect(stats[1].verdict).toBe('sulit')
  })

  it('daya beda: kelompok atas benar, bawah salah → tinggi', () => {
    const attempts = [
      mkAttempt('s1', 100, { q1: 'A', q2: 'B' }),
      mkAttempt('s2', 50, { q1: 'X', q2: 'X' }),
      mkAttempt('s3', 0, { q1: 'X', q2: 'X' }),
    ]
    const stats = itemAnalysis(questions, attempts)
    expect(stats[0].discrimination).toBeGreaterThan(0.5)
  })

  it('attempt < 2 → kosong; tanpa jawaban → pCorrect 0', () => {
    expect(itemAnalysis(questions, [])).toEqual([])
    const one = itemAnalysis(questions, [mkAttempt('s1', 50, { q1: 'A' })])
    expect(one).toEqual([])
  })
})
