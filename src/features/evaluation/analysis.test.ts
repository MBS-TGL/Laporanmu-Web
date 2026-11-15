import { describe, expect, it } from 'vitest'
import { classDimensionScores, dimensionScores, mbtiType, sociometry } from './analysis'
import type { EvalQuestion, InstrumentResponse } from './types'

const likertQ: EvalQuestion[] = [
  { id: 'q1', text: 'A1', type: 'skala', dimension: 'Akademik', max: 5 },
  { id: 'q2', text: 'A2', type: 'skala', dimension: 'Akademik', max: 5 },
  { id: 's1', text: 'S1', type: 'skala', dimension: 'Seni', max: 5 },
]

const mkResp = (id: string, answers: Record<string, unknown>): InstrumentResponse =>
  ({
    id,
    instrument_id: 'i',
    student_id: id,
    answers,
    submitted_at: '2026-11-15T00:00:00Z',
  }) as unknown as InstrumentResponse

describe('dimensionScores', () => {
  it('rata-rata per dimensi', () => {
    const scores = dimensionScores(likertQ, { q1: 5, q2: 3, s1: 2 })
    expect(scores[0]).toEqual({ dimension: 'Akademik', avg: 0.8, count: 2 })
    expect(scores[1].dimension).toBe('Seni')
    expect(scores[1].avg).toBeCloseTo(0.4)
  })

  it('jawaban di luar rentang diabaikan', () => {
    const scores = dimensionScores(likertQ, { q1: 9, q2: 3, s1: 2 })
    expect(scores[0].count).toBe(1)
  })
})

describe('classDimensionScores', () => {
  it('merata-ratakan lintas responden', () => {
    const r1 = mkResp('s1', { q1: 5, q2: 5, s1: 1 })
    const r2 = mkResp('s2', { q1: 3, q2: 3, s1: 3 })
    const out = classDimensionScores(likertQ, [r1, r2])
    expect(out.find((d) => d.dimension === 'Akademik')?.avg).toBeCloseTo(0.8)
  })
})

describe('mbtiType', () => {
  const mbtiQ: EvalQuestion[] = [
    { id: 'e1', text: 'x', type: 'skala', dimension: 'I-E', max: 5 },
    { id: 'sn1', text: 'x', type: 'skala', dimension: 'N-S', max: 5 },
    { id: 'tf1', text: 'x', type: 'skala', dimension: 'F-T', max: 5 },
    { id: 'jp1', text: 'x', type: 'skala', dimension: 'P-J', max: 5 },
  ]

  it('skala rendah → huruf kiri, tinggi → huruf kanan', () => {
    const introvert = mbtiType(mbtiQ, { e1: 1, sn1: 2, tf1: 5, jp1: 4 })
    expect(introvert).toBe('INTJ')
    const extravert = mbtiType(mbtiQ, { e1: 5, sn1: 5, tf1: 5, jp1: 1 })
    expect(extravert).toBe('ESTP')
  })

  it('tanpa jawaban → null', () => {
    expect(mbtiType(mbtiQ, {})).toBeNull()
  })
})

describe('sociometry', () => {
  const soQ: EvalQuestion[] = [{ id: 'so1', text: 'pilih teman', type: 'teman', maxChoices: 3 }]
  const ids = ['a', 'b', 'c', 'd']

  it('menghitung diterima, diberikan, mutual, kohesi, terisolasi', () => {
    const responses = [
      mkResp('a', { so1: ['b', 'c'] }),
      mkResp('b', { so1: ['a', 'c'] }),
      mkResp('c', { so1: ['b'] }),
    ]
    const out = sociometry(soQ, responses, ids)
    expect(out.totalChoices).toBe(5)
    expect(out.received.get('b')).toBe(2)
    expect(out.received.get('c')).toBe(2)
    expect(out.mutual).toBe(2) // a↔b dan b↔c saling memilih
    expect(out.cohesion).toBeCloseTo(0.4)
    expect(out.stars[0].studentId).toBe('b')
    expect(out.isolated).toEqual(['d'])
  })
})
