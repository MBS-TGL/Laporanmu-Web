import { describe, expect, it } from 'vitest'
import { parseQuestionText } from './textParse'
import { buildAiQuestionPrompt, parseAiQuestions } from './aiParse'
import { getCbtRowStatus } from './importParse'

describe('parseQuestionText', () => {
  const sample = `1. Ibu kota Indonesia adalah ...
   yang dimaksud adalah ibu kota negara.
   A. Jakarta
   B. Bandung
   C. Surabaya
   D. Medan
   Kunci: A
   Poin: 2

2. Hasil 12 x 8 adalah
   A. 86
   B. 96
   C. 106
   Kunci: B`

  it('memecah dua soal dengan opsi, kunci, dan poin', () => {
    const rows = parseQuestionText(sample)
    expect(rows).toHaveLength(2)
    expect(getCbtRowStatus(rows[0])).toBe('siap')
    expect(rows[0].question).toContain('ibu kota negara')
    expect(rows[0].options).toHaveLength(4)
    expect(rows[0].answerKey).toBe('A')
    expect(rows[0].points).toBe(2)
    expect(getCbtRowStatus(rows[1])).toBe('siap')
    expect(rows[1].points).toBe(1)
    expect(rows[1].options).toHaveLength(3)
  })

  it('soal tanpa kunci menjadi error', () => {
    const rows = parseQuestionText('1. Soal tanpa kunci\nA. Satu\nB. Dua')
    expect(getCbtRowStatus(rows[0])).toBe('error')
    expect(rows[0].error).toContain('Kunci')
  })

  it('duplikat dengan bank terdeteksi', () => {
    const rows = parseQuestionText('1. Soal tanpa kunci\nA. Satu\nB. Dua\nKunci: A', ['soal tanpa kunci'])
    expect(getCbtRowStatus(rows[0])).toBe('duplikat')
  })

  it('huruf opsi kecil diterima', () => {
    const rows = parseQuestionText('1. Soal\na. satu\nb. dua\nc. tiga\nKunci: C')
    expect(rows[0].options.map((o) => o.key)).toEqual(['A', 'B', 'C'])
    expect(getCbtRowStatus(rows[0])).toBe('siap')
  })

  it('teks non-soal di awal diabaikan', () => {
    const rows = parseQuestionText('Catatan guru minggu ini\n\n1. Soal benar\nA. Satu\nB. Dua\nKunci: A')
    expect(rows).toHaveLength(1)
    expect(getCbtRowStatus(rows[0])).toBe('siap')
  })
})

describe('parseAiQuestions', () => {
  const json = `Berikut draf soalnya:
\`\`\`json
[
  {"question": "Ibu kota Indonesia?", "options": {"A": "Jakarta", "B": "Bandung", "C": "Surabaya", "D": "Medan"}, "answer_key": "A", "points": 1},
  {"question": "Hasil 7 x 6?", "options": {"A": "42", "B": "40", "C": "48"}, "answer_key": "A", "points": 2}
]
\`\`\``

  it('membaca array JSON dari balasan ber-fence', () => {
    const { rows, error } = parseAiQuestions(json)
    expect(error).toBeUndefined()
    expect(rows).toHaveLength(2)
    expect(getCbtRowStatus(rows[0])).toBe('siap')
    expect(rows[1].points).toBe(2)
    expect(rows[1].options).toHaveLength(3)
  })

  it('kunci tanpa teks opsi menjadi error', () => {
    const { rows } = parseAiQuestions(
      '[{"question": "Soal", "options": {"A": "satu", "B": "dua"}, "answer_key": "D", "points": 1}]',
    )
    expect(getCbtRowStatus(rows[0])).toBe('error')
    expect(rows[0].error).toContain('D')
  })

  it('balasan tanpa JSON memberi pesan ramah', () => {
    const { error } = parseAiQuestions('Maaf, saya tidak bisa membuat soal.')
    expect(error).toContain('Coba hasilkan ulang')
  })
})

describe('buildAiQuestionPrompt', () => {
  it('mode materi & existing berbeda instruksi', () => {
    const materi = buildAiQuestionPrompt({ mode: 'materi', source: 'Fotosintesis adalah...', count: 5 })
    expect(materi.prompt).toContain('5 soal')
    expect(materi.prompt).toContain('Fotosintesis')
    const existing = buildAiQuestionPrompt({ mode: 'existing', source: '1. Soal lama...', count: 10 })
    expect(existing.prompt).toContain('normalisasi')
  })
})
