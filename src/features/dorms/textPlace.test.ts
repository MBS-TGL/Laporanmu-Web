import { describe, expect, it } from 'vitest'
import {
  matchTextBlocks,
  normalizeName,
  parseDormText,
  rowsToAssignments,
} from './textPlace'
import type { MatchStudent } from './textPlace'
import type { TextDorm } from './textPlace'

/** Contoh data nyata dari user (format WhatsApp) */
const SAMPLE = `Mas Mansyur (16)
Wali Kamar : Aziz

1. Adli Malik
2. Azka Al Fatih
3. Akmal Pratama
4. Asyraful Azkia
5. Nabil Attaqy
6. Kevin Hersyand
7. Haidar Azmi
8. Dafa Adi
9. Fachry Muayat
10. Hisbi Fifikri
11. Zakka Caesar
12. Aji Rahadji
13. Najib Abdillah
14. Rizky Abaydowi
15. Zavier Shaquilla
16. Azriel Musthafa

Ibrahim (20)
Wali Kamar : Pramudia

1. Alif Ikbar Jauhari
2. Haidar Ali William
3. Sembara El-Azzam
4. M. Revan Setiawan
5. Fadlin Abi 🛏️
6. Ezhar Fahri Harvano
7. Farel Fikry
8. Fathur Ramadhan
9. Catra Nararya
10. Afif Asyam
11. Yafiq Annadim Rafif
12. Wildan Mubarok
13. Ali Wafa
14. Gemilang Damar
15. Al-Kautsar
16. Arfian Rafi
17. Satya Dharma
18. Zulfanda Riqsya
19. Fawas Fajar
20. Ahdan Abror

Fachruddin (17)
Wali Kamar : Mas'ad

1. Hilmi Muttaqin
2. Ferdyan Rezky
3. Dzaky Ibnu
4. Satria Ananda
5. Lathif Hasan
6. Fauzi Rais
7. Hilmi Ridho
8. Hailuzin Hamdi
9. Abiyu Jamanil
10. Maksim Malakai
11. Azzamul Huda
12. Maulana Bakri
13. Ahza As Shiddiqi
14. Alvaro Ibnu Masito
15. Abid Furqon
16. Maulana Anugrah
17. Fawwas Imtiyadz

Achmad Dahlan (12)
Wali Kamar : Wafiq

1. Hamizan Nur Yatiman
2. Zidan Wiki
3. Hasby Al Aisy
4. Riandri Gilang
5. Harun Tan
6. Wildan Syamsi
7. Misbakhul Huda
8. Alvaro Gavriel
9. Farrel Ardhana
10. Albi Al Ghifari
11. Faeyza Ammar
12. Zidan Setiawan`

// Database santri — nama DB huruf besar, beberapa ditulis beda dari teks
const db = (id: string, name: string, gender: 'L' | 'P' | null = 'L', dorm_id: string | null = null): MatchStudent => ({
  id,
  name,
  gender,
  dorm_id,
})

const STUDENTS: MatchStudent[] = [
  db('s1', 'ADLI MALIK'),
  db('s2', 'AZKA AL FATIH'),
  db('s3', 'AKMAL PRATAMA'),
  db('s4', 'ASYRAFUL AZKIA'),
  db('s5', 'NABIL ATTAQY'),
  db('s6', 'KEVIN HERSYAND'),
  db('s7', 'HAIDAR AZMI'),
  db('s8', 'DAFA ADI'),
  db('s9', 'FACHRY MUAYAT'),
  db('s10', 'HISBI FIFIKRI'),
  db('s11', 'ZAKKA CAESAR'),
  db('s12', 'AJI RAHADJI'),
  db('s13', 'ACHMAD NAJIB ABDILLAH'), // teks: "Najib Abdillah" → fuzzy
  db('s14', 'RIZKY ABAYDOWI'),
  db('s15', 'ZAVIER SHAQUILLA'),
  db('s16', 'AZRIEL MUSTHAFA'),
  db('s20', 'ALIF IKBAR JAUHARI'),
  db('s21', 'HAIDAR ALI WILLIAM'),
  db('s22', 'SEMBARA EL-AZZAM'),
  db('s23', 'MUHAMMAD REVAN SETIAWAN'), // teks: "M. Revan Setiawan" → token-prefix
  db('s24', 'FADLIN ABI'), // teks: "Fadlin Abi 🛏️" → emoji dihapus
  db('s25', 'EZHAR FAHRI HARVANO'),
  db('s26', 'FAREL FIKRY'),
  db('s27', 'FATHUR RAMADHAN'),
  db('s28', 'CATRA NARARYA'),
  db('s29', 'AFIF ASYAM'),
  db('s30', 'YAFIQ ANNADIM RAFIF'),
  db('s31', 'WILDAN MUBAROK'),
  db('s32', 'ALI WAFA'),
  db('s33', 'GEMILANG DAMAR'),
  db('s34', 'AL-KAUTSAR'),
  db('s35', 'ARFIAN RAFI'),
  db('s36', 'SATYA DHARMA'),
  db('s37', 'ZULFANDA RIQSYA'),
  db('s38', 'FAWAS FAJAR'),
  db('s39', 'AHDAN ABROR'),
  db('s40', 'HILMI MUTTAQIN'),
  db('s41', 'FERDYAN REZKY'),
  db('s42', 'DZAKY IBNU'),
  db('s43', 'SATRIANANDA'), // tanpa spasi di DB → contains tetap cocok? tidak — uji error saja
  db('s44', 'LATHIF HASAN'),
  db('s45', 'FAUZI RAIS'),
  db('s46', 'HILMI RIDHO'),
  db('s47', 'HAILUZIN HAMDI'),
  db('s48', 'ABIYU JAMANIL'),
  db('s49', 'MAKSIM MALAKAI'),
  db('s50', 'AZZAMUL HUDA'),
  db('s51', 'MAULANA BAKRI'),
  db('s52', 'AHZA AS SHIDDIQI'),
  db('s53', 'ALVARO IBNU MASITO'),
  db('s54', 'ABID FURQON'),
  db('s55', 'MAULANA ANUGRAH'), // "Maulana Anugrah" ambigu dengan Maulana Bakri? tidak — token lengkap
  db('s56', 'FAWWAS IMTIYADZ'),
  db('s60', 'HAMIZAN NUR YATIMAN'),
  db('s61', 'ZIDAN WIKI'),
  db('s62', 'HASBY AL AISY'),
  db('s63', 'RIANDRI GILANG'),
  db('s64', 'HARUN TAN'),
  db('s65', 'WILDAN SYAMSI'),
  db('s66', 'MISBAKHUL HUDA'),
  db('s67', 'ALVARO GAVRIEL'),
  db('s68', 'FARREL ARDHANA'),
  db('s69', 'ALBI AL GHIFARI'),
  db('s70', 'FAEYZA AMMAR'),
  db('s71', 'ZIDAN SETIAWAN'),
]

const DORMS: TextDorm[] = [
  { id: 'd1', name: 'Mas Mansyur', gender: 'male', capacity: 20, occupied: 0, status: 'active' },
  { id: 'd2', name: 'Ibrahim', gender: 'male', capacity: 20, occupied: 0, status: 'active' },
  { id: 'd3', name: 'Fachruddin', gender: 'male', capacity: 20, occupied: 0, status: 'active' },
  { id: 'd4', name: 'Ahmad Dahlan', gender: 'male', capacity: 20, occupied: 0, status: 'active' },
]

describe('normalizeName', () => {
  it('menghapus emoji, tanda baca, dan menormalkan spasi', () => {
    expect(normalizeName('Fadlin Abi 🛏️')).toBe('fadlin abi')
    expect(normalizeName('M. Revan Setiawan')).toBe('m revan setiawan')
    expect(normalizeName('  Wildan Mubarok ')).toBe('wildan mubarok')
    expect(normalizeName('Sembara El-Azzam')).toBe('sembara el-azzam')
    expect(normalizeName("Mas'ad")).toBe("mas'ad")
  })
})

describe('parseDormText', () => {
  it('mem-parsing contoh data user: 4 blok dengan jumlah benar', () => {
    const blocks = parseDormText(SAMPLE)
    expect(blocks.map((b) => [b.roomName, b.declaredCount, b.studentNames.length])).toEqual([
      ['Mas Mansyur', 16, 16],
      ['Ibrahim', 20, 20],
      ['Fachruddin', 17, 17],
      ['Achmad Dahlan', 12, 12],
    ])
    expect(blocks[0].studentNames[0]).toBe('Adli Malik')
    expect(blocks[1].studentNames[3]).toBe('M. Revan Setiawan')
    expect(blocks[1].studentNames[4]).toBe('Fadlin Abi 🛏️')
  })

  it('mendukung header tanpa jumlah dan daftar tanpa nomor', () => {
    const blocks = parseDormText('Ibrahim\n\nFadlin Abi\nAhdan Abror')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ roomName: 'Ibrahim', declaredCount: null })
    expect(blocks[0].studentNames).toEqual(['Fadlin Abi', 'Ahdan Abror'])
  })

  it('baris bernomor tanpa header → blok anonim', () => {
    const blocks = parseDormText('1. Adli Malik\n2. Azka Al Fatih')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].roomName).toBe('')
    expect(blocks[0].studentNames).toHaveLength(2)
  })

  it('mendukung penomoran "1)" dan "12 -"', () => {
    const blocks = parseDormText('Ibrahim (2)\n1) Fadlin Abi\n12 - Ahdan Abror')
    expect(blocks[0].studentNames).toEqual(['Fadlin Abi', 'Ahdan Abror'])
  })
})

describe('matchTextBlocks', () => {
  const result = matchTextBlocks(parseDormText(SAMPLE), DORMS, STUDENTS)

  it('mencocokkan persis, fuzzy, dan token-prefix sesuai tier', () => {
    const find = (raw: string) => result.rows.find((r) => r.raw === raw)
    expect(find('Adli Malik')).toMatchObject({ status: 'siap', studentId: 's1', matchedName: 'ADLI MALIK' })
    expect(find('Najib Abdillah')).toMatchObject({
      status: 'siap',
      studentId: 's13',
      matchedName: 'ACHMAD NAJIB ABDILLAH',
    })
    expect(find('M. Revan Setiawan')).toMatchObject({
      status: 'siap',
      studentId: 's23',
      matchedName: 'MUHAMMAD REVAN SETIAWAN',
    })
    expect(find('Fadlin Abi 🛏️')).toMatchObject({ status: 'siap', studentId: 's24' })
    expect(find('Sembara El-Azzam')).toMatchObject({ status: 'siap', studentId: 's22' })
    expect(find('Al-Kautsar')).toMatchObject({ status: 'siap', studentId: 's34' })
  })

  it('santri yang tidak ada di database ditandai error', () => {
    const find = (raw: string) => result.rows.find((r) => r.raw === raw)
    expect(find('Satria Ananda')).toMatchObject({ status: 'error', message: expect.stringMatching(/Tidak ditemukan/) })
  })

  it('ringkasan per kamar: semua kebagian tanpa warning kapasitas', () => {
    expect(result.rooms.map((r) => [r.roomName, r.dormId, r.matchedCount])).toEqual([
      ['Mas Mansyur', 'd1', 16],
      ['Ibrahim', 'd2', 20],
      ['Fachruddin', 'd3', 16], // 1 error (Satria Ananda)
      ['Achmad Dahlan', 'd4', 12], // typo "Achmad" → tetap ter-match ke "Ahmad Dahlan"
    ])
    expect(result.rooms[2].warnings).toHaveLength(0) // 16 < 20 slot
    expect(result.rooms[3].warnings).toHaveLength(0)
    expect(result.totalMatched).toBe(16 + 20 + 16 + 12)
  })

  it('kamar tidak ditemukan → semua santri blok itu error', () => {
    const res = matchTextBlocks(
      parseDormText('Kamar Baru (1)\n1. Adli Malik'),
      DORMS,
      STUDENTS,
    )
    expect(res.rows[0]).toMatchObject({ status: 'error', message: 'Kamar tidak dikenali' })
    expect(res.rooms[0].warnings[0]).toMatch(/tidak ditemukan/)
  })

  it('jumlah header ≠ jumlah nama → warning', () => {
    const res = matchTextBlocks(
      parseDormText('Ibrahim (3)\n1. Adli Malik\n2. Azka Al Fatih'),
      DORMS,
      STUDENTS,
    )
    expect(res.rooms[0].warnings.join(' ')).toMatch(/Jumlah di header \(3\) ≠/)
  })

  it('kapasitas kurang → warning', () => {
    const nearlyFull = [{ ...DORMS[1], capacity: 20, occupied: 19 }]
    const ibrahim = parseDormText(SAMPLE).find((b) => b.roomName === 'Ibrahim')!
    const text =
      'Ibrahim (20)\n' +
      ibrahim.studentNames.map((n, i) => `${i + 1}. ${n}`).join('\n')
    const res = matchTextBlocks(parseDormText(text), nearlyFull, STUDENTS)
    expect(res.rooms[0].warnings.join(' ')).toMatch(/Kapasitas kurang/)
  })

  it('gender tidak sesuai → warning per kamar', () => {
    const putri = [{ ...DORMS[1], gender: 'female' as const }]
    const students = [
      db('p1', 'AISYAH SHEZA ELMIRA', 'P'),
      db('p2', 'ADLI MALIK', 'L'),
    ]
    const res = matchTextBlocks(
      parseDormText('Ibrahim (2)\n1. Aisyah Sheza Elmira\n2. Adli Malik'),
      putri,
      students,
    )
    // Aisyah cocok (P di kamar putri), Adli L → mismatch
    expect(res.rows[0]).toMatchObject({ status: 'siap', studentId: 'p1' })
    expect(res.rooms[0].warnings.join(' ')).toMatch(/1 santri gendernya tidak sesuai/)
  })

  it('santri yang sudah punya kamar lain diberi catatan pindah', () => {
    const students = [db('x1', 'ADLI MALIK', 'L', 'd4')]
    const res = matchTextBlocks(parseDormText('Ibrahim (1)\n1. Adli Malik'), DORMS, students)
    expect(res.rows[0]).toMatchObject({ status: 'siap', studentId: 'x1' })
    expect(res.rows[0].message).toMatch(/Pindah dari kamar/)
  })
})

describe('parser fleksibel (format bebas)', () => {
  it('menerima bullet •, *, - di awal nama', () => {
    const blocks = parseDormText('Ibrahim\n• Fadlin Abi\n* Ahdan Abror\n- Ali Wafa')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].studentNames).toEqual(['Fadlin Abi', 'Ahdan Abror', 'Ali Wafa'])
  })

  it('memisahkan beberapa nama dalam satu baris (koma/titik koma/pipe)', () => {
    const blocks = parseDormText('Ibrahim: Alif, Haidar; Sembara | Ahdan')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].roomName).toBe('Ibrahim')
    expect(blocks[0].studentNames).toEqual(['Alif', 'Haidar', 'Sembara', 'Ahdan'])
  })

  it('baris bernomor bisa memuat beberapa nama: "1. Adli, Azka"', () => {
    const blocks = parseDormText('Ibrahim (3)\n1. Adli, Azka\n2. Akmal')
    expect(blocks[0].declaredCount).toBe(3)
    expect(blocks[0].studentNames).toEqual(['Adli', 'Azka', 'Akmal'])
  })

  it('header dengan satuan: "(16 orang)", "(20 santri)"', () => {
    const blocks = parseDormText('Ibrahim (20 orang)\n1. Adli\n\nMas Mansyur (16 santri)\n1. Azka')
    expect(blocks.map((b) => [b.roomName, b.declaredCount])).toEqual([
      ['Ibrahim', 20],
      ['Mas Mansyur', 16],
    ])
  })

  it('header didekorasi "=== Ibrahim ===" tetap terbaca', () => {
    const blocks = parseDormText('=== Ibrahim ===\n1. Adli')
    expect(blocks[0].roomName).toBe('Ibrahim')
    expect(blocks[0].studentNames).toEqual(['Adli'])
  })

  it('knownRoomNames: baris polos bernama kamar di dalam blok = header baru', () => {
    // Blok pertama tanpa jumlah; "Ibrahim" harus jadi header, bukan nama santri
    const blocks = parseDormText('Mas Mansyur\n1. Adli Malik\nIbrahim\n1. Ahdan Abror', {
      knownRoomNames: ['Mas Mansyur', 'Ibrahim'],
    })
    expect(blocks.map((b) => b.roomName)).toEqual(['Mas Mansyur', 'Ibrahim'])
    expect(blocks[0].studentNames).toEqual(['Adli Malik'])
    expect(blocks[1].studentNames).toEqual(['Ahdan Abror'])
  })

  it('fallbackDormId dipakai untuk blok anonim', () => {
    const res = matchTextBlocks(
      parseDormText('1. Adli Malik\n2. Azka Al Fatih'),
      DORMS,
      STUDENTS,
      { fallbackDormId: 'd1' },
    )
    expect(res.rows.filter((r) => r.status === 'siap')).toHaveLength(2)
    expect(res.rows.every((r) => r.dormId === 'd1')).toBe(true)
    expect(res.rooms[0].warnings).toHaveLength(0)
  })

  it('forceDormId mengabaikan semua header', () => {
    const res = matchTextBlocks(
      parseDormText('Ibrahim (2)\n1. Adli Malik\n\nFachruddin\n2. Azka Al Fatih', {
        knownRoomNames: ['Ibrahim', 'Fachruddin'],
      }),
      DORMS,
      STUDENTS,
      { forceDormId: 'd4' },
    )
    expect(res.rows.every((r) => r.dormId === 'd4')).toBe(true)
    expect(res.rows.every((r) => r.status === 'siap')).toBe(true)
    expect(res.rooms.every((r) => r.warnings.length === 0)).toBe(true)
  })

  it('blok anonim tanpa fallback tetap warning', () => {
    const res = matchTextBlocks(parseDormText('1. Adli Malik'), DORMS, STUDENTS)
    expect(res.rooms[0].warnings[0]).toMatch(/Kamar Fallback/)
    expect(res.rows[0].status).toBe('error')
  })
})

describe('rowsToAssignments', () => {
  it('mengelompokkan baris siap per kamar, mengabaikan error', () => {
    const rows = matchTextBlocks(parseDormText(SAMPLE), DORMS, STUDENTS).rows
    const assignments = rowsToAssignments(rows)
    const byRoom = new Map(assignments.map((a) => [a.roomId, a.studentIds.length]))
    expect(byRoom.get('d1')).toBe(16)
    expect(byRoom.get('d2')).toBe(20)
    expect(byRoom.get('d3')).toBe(16)
    expect(byRoom.get('d4')).toBe(12)
    // Tidak ada id duplikat
    const all = assignments.flatMap((a) => a.studentIds)
    expect(new Set(all).size).toBe(all.length)
  })
})
