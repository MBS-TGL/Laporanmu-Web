import type { DistribRoom, StudentGender } from './types'

/**
 * Parser & matcher untuk fitur "Penempatan via Teks": user menempel daftar
 * gaya WhatsApp (nama kamar + nomor santri), lalu tiap nama dicocokkan ke
 * santri di database. Pure tanpa efek samping agar mudah dites.
 *
 * Contoh format yang didukung:
 *   Mas Mansyur (16)
 *   Wali Kamar : Aziz
 *   1. Adli Malik
 *   2. Azka Al Fatih
 */

// ------------------------------------------------------------
// Parser blok teks
// ------------------------------------------------------------
export interface ParsedTextRoom {
  roomName: string
  /** Jumlah yang ditulis di header "(16)" — null bila tidak ditulis */
  declaredCount: number | null
  studentNames: string[]
}

export interface ParseDormTextOptions {
  /**
   * Nama kamar existing (dari database). Baris polos DI DALAM blok yang
   * cocok dengan salah satu nama ini dianggap header blok berikutnya —
   * menyelesaikan ambigu "nama kamar tanpa jumlah" vs "nama santri".
   */
  knownRoomNames?: string[]
}

/** Baris metadata yang dilewati (bukan nama santri) */
const METADATA_RE = /^(wali\s*\w*|musyrif|musyrifah|pembina|pengasuh|catatan|total)\b/i
/** Header kamar: "Mas Mansyur (16)", "(16 orang)", "(16 santri)" — kata satuan opsional */
const HEADER_WITH_COUNT_RE =
  /^(.{1,80}?)\s*\((\d{1,3})\s*(?:orang|santri|siswa|anak|org|people|students?)?\)\s*:?\s*$/i
/** Header + nama dalam satu baris: "Ibrahim: Alif, Haidar, Sembara" */
const HEADER_WITH_NAMES_RE = /^([^:\n]{1,60}?)\s*:\s*(.+)$/
/** Baris bernomor: "1. Nama", "1) Nama", "12 - Nama", "1 Nama" */
const NUMBERED_RE = /^(\d{1,3})\s*[.):–-]?\s+(.+)$/
/** Pemisah beberapa nama dalam satu baris */
const NAME_SPLIT_RE = /\s*[,;|]\s*/
/** Dekorasi bullet di awal baris santri: "• Adli", "- Adli", "* Adli", "=== Header" */
const DECOR_PREFIX_RE = /^[•·*≡»=–-]+\s*/

export function parseDormText(text: string, options?: ParseDormTextOptions): ParsedTextRoom[] {
  const knownRooms = new Set(
    (options?.knownRoomNames ?? []).map((n) => normalizeName(n)).filter(Boolean),
  )
  const blocks: ParsedTextRoom[] = []
  let current: ParsedTextRoom | null = null

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim()
    if (!line) continue
    // Buang dekorasi pembuka/penutup ("=== Mas Mansyur ===", "• Adli Malik")
    line = line.replace(DECOR_PREFIX_RE, '').replace(/[•·*=≡\s]+$/, '')
    if (!line) continue
    if (METADATA_RE.test(line)) continue

    const headerWithCount = line.match(HEADER_WITH_COUNT_RE)
    if (headerWithCount) {
      current = {
        roomName: headerWithCount[1].trim(),
        declaredCount: Number(headerWithCount[2]),
        studentNames: [],
      }
      blocks.push(current)
      continue
    }

    // "Kamar: nama1, nama2" — semua nama satu baris masuk blok itu
    const headerWithNames = line.match(HEADER_WITH_NAMES_RE)
    if (headerWithNames) {
      current = {
        roomName: headerWithNames[1].trim(),
        declaredCount: null,
        studentNames: headerWithNames[2].split(NAME_SPLIT_RE).map((s) => s.trim()).filter(Boolean),
      }
      blocks.push(current)
      continue
    }

    const numbered = line.match(NUMBERED_RE)
    if (numbered) {
      // Baris bernomor tanpa header kamar → blok anonim (ditandai error nanti)
      if (!current) {
        current = { roomName: '', declaredCount: null, studentNames: [] }
        blocks.push(current)
      }
      // Nomor bisa berisi beberapa nama sekaligus: "1. Adli, Azka"
      current.studentNames.push(
        ...numbered[2].split(NAME_SPLIT_RE).map((s) => s.trim()).filter(Boolean),
      )
      continue
    }

    // Baris polos: di luar blok ATAU cocok nama kamar existing = header blok baru;
    // selain itu = nama santri (bisa beberapa dipisah koma)
    if (!current || knownRooms.has(normalizeName(line))) {
      current = { roomName: line, declaredCount: null, studentNames: [] }
      blocks.push(current)
      continue
    }
    current.studentNames.push(...line.split(NAME_SPLIT_RE).map((s) => s.trim()).filter(Boolean))
  }

  return blocks
}

// ------------------------------------------------------------
// Normalisasi & pencocokan nama
// ------------------------------------------------------------
/** Emoji & simbol dekoratif (mis. 🛏️) dihapus dari nama */
const DECORATION_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu

export function normalizeName(value: string): string {
  return value
    .replace(DECORATION_RE, ' ')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface MatchStudent {
  id: string
  name: string
  gender: StudentGender | null
  dorm_id: string | null
}

interface StudentIndex {
  /** normalized name → kandidat (bisa lebih dari satu bila nama ganda) */
  byExact: Map<string, MatchStudent[]>
  all: { normalized: string; tokens: string[]; student: MatchStudent }[]
}

function buildStudentIndex(students: MatchStudent[]): StudentIndex {
  const byExact = new Map<string, MatchStudent[]>()
  const all: StudentIndex['all'] = []
  for (const student of students) {
    const normalized = normalizeName(student.name)
    if (!normalized) continue
    const list = byExact.get(normalized)
    if (list) list.push(student)
    else byExact.set(normalized, [student])
    all.push({ normalized, tokens: normalized.split(' '), student })
  }
  return { byExact, all }
}

interface MatchOutcome {
  student: MatchStudent | null
  /** 'exact' = persis, 'fuzzy' = pencocokan longgar (ditampilkan di preview) */
  matchType: 'exact' | 'fuzzy' | null
  message?: string
}

/**
 * Cocokkan satu nama teks ke santri database, bertingkat:
 * 1. Persis (setelah normalisasi emoji/huruf/tanda baca)
 * 2. Satu memuat yang lain secara utuh ("Najib Abdillah" ↔ "Achmad Najib Abdillah")
 * 3. Token-prefix: semua token teks jadi awalan token nama DB ("M. Revan Setiawan" →
 *    "Muhammad Revan Setiawan"). Kandidat harus unik — ambigu dianggap gagal.
 */
function matchStudent(raw: string, index: StudentIndex): MatchOutcome {
  const q = normalizeName(raw)
  if (!q) return { student: null, matchType: null, message: 'Nama kosong' }

  const exact = index.byExact.get(q)
  if (exact && exact.length === 1) return { student: exact[0], matchType: 'exact' }
  if (exact && exact.length > 1)
    return { student: null, matchType: null, message: `Nama ambigu: ${exact.length} santri bernama sama` }

  const contains = index.all.filter(
    (e) => e.normalized.includes(q) || q.includes(e.normalized),
  )
  if (contains.length === 1) return { student: contains[0].student, matchType: 'fuzzy' }

  const qTokens = q.split(' ')
  const tokenMatches = index.all.filter((e) =>
    qTokens.every((t) => e.tokens.some((db) => db.startsWith(t))),
  )
  if (tokenMatches.length === 1) return { student: tokenMatches[0].student, matchType: 'fuzzy' }
  if (tokenMatches.length > 1)
    return {
      student: null,
      matchType: null,
      message: `Nama ambigu: ${tokenMatches.length} kandidat mirip`,
    }

  return { student: null, matchType: null, message: 'Tidak ditemukan di database' }
}

// ------------------------------------------------------------
// Match blok → preview penempatan
// ------------------------------------------------------------
export interface TextPlacementRow {
  roomName: string
  dormId: string | null
  /** Nama kamar yang cocok di database (null bila kamar tak ditemukan) */
  dormName: string | null
  raw: string
  studentId: string | null
  matchedName: string | null
  status: 'siap' | 'error'
  message?: string
}

export interface TextRoomSummary {
  roomName: string
  dormId: string | null
  dormName: string | null
  declaredCount: number | null
  parsedCount: number
  matchedCount: number
  /** Peringatan per blok: kamar tak dikenali, jumlah ≠ header, kapasitas, gender */
  warnings: string[]
}

export interface TextPlacementPreview {
  rows: TextPlacementRow[]
  rooms: TextRoomSummary[]
  totalMatched: number
}

export interface TextDorm extends DistribRoom {
  status: string
}

/** Jarak edit Levenshtein — untuk toleransi typo nama kamar ("Achmad" ↔ "Ahmad") */
function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * Cari kamar untuk nama di teks: persis → mengandung (unik) → typo kecil.
 * Typo hanya diterima bila kandidat terdekat jelas unik (tidak seri).
 */
function findDorm(qRoom: string, dorms: TextDorm[]): TextDorm | null {
  if (!qRoom) return null
  const exact = dorms.find((d) => normalizeName(d.name) === qRoom)
  if (exact) return exact
  const loose = dorms.filter((d) => {
    const dn = normalizeName(d.name)
    return dn.includes(qRoom) || qRoom.includes(dn)
  })
  if (loose.length === 1) return loose[0]

  const maxDist = qRoom.length >= 8 ? 2 : 1
  const ranked = dorms
    .map((d) => ({ dorm: d, dist: levenshtein(qRoom, normalizeName(d.name)) }))
    .filter((x) => x.dist <= maxDist)
    .sort((a, b) => a.dist - b.dist)
  if (ranked.length >= 2 && ranked[0].dist === ranked[1].dist) return null
  return ranked[0]?.dorm ?? null
}

export interface MatchTextOptions {
  /** Kamar untuk blok anonim / baris tanpa header (dari Select di modal) */
  fallbackDormId?: string | null
  /** Paksa SEMUA nama ke satu kamar, abaikan header (dari checkbox di modal) */
  forceDormId?: string | null
}

export function matchTextBlocks(
  blocks: ParsedTextRoom[],
  dorms: TextDorm[],
  students: MatchStudent[],
  options?: MatchTextOptions,
): TextPlacementPreview {
  const index = buildStudentIndex(students)
  const rows: TextPlacementRow[] = []
  const rooms: TextRoomSummary[] = []

  // Okupansi hidup per kamar untuk cek kapasitas & gender
  const occupancy = new Map(dorms.map((d) => [d.id, d]))
  const incoming = new Map<string, number>()
  const bump = (id: string) => incoming.set(id, (incoming.get(id) ?? 0) + 1)

  const forced = options?.forceDormId
    ? (dorms.find((d) => d.id === options.forceDormId) ?? null)
    : null
  const fallback = options?.fallbackDormId
    ? (dorms.find((d) => d.id === options.fallbackDormId) ?? null)
    : null

  for (const block of blocks) {
    const warnings: string[] = []
    const qRoom = normalizeName(block.roomName)

    // Paksa semua → abaikan header; blok anonim → fallback kamar
    const dorm = forced ?? (!qRoom ? fallback : findDorm(qRoom, dorms))

    if (!forced) {
      if (!qRoom) {
        if (!fallback)
          warnings.push(
            'Blok tanpa nama kamar — tulis header "Nama Kamar (jumlah)" atau pilih Kamar Fallback',
          )
      } else if (!dorm) {
        warnings.push(`Kamar "${block.roomName}" tidak ditemukan di database`)
      } else if (dorm.status === 'inactive') {
        warnings.push(`Kamar "${dorm.name}" berstatus nonaktif`)
      }
      if (block.declaredCount !== null && block.declaredCount !== block.studentNames.length) {
        warnings.push(
          `Jumlah di header (${block.declaredCount}) ≠ jumlah nama di daftar (${block.studentNames.length})`,
        )
      }
    }

    let genderMismatch = 0
    let matchedCount = 0

    for (const raw of block.studentNames) {
      if (dorm) {
        const res = matchStudent(raw, index)
        if (res.student) {
          matchedCount++
          bump(dorm.id)
          // Cek gender kamar vs santri (campur/kamar tanpa gender = bebas)
          const studentGender = res.student.gender
          const incompatible =
            (dorm.gender === 'male' && studentGender === 'P') ||
            (dorm.gender === 'female' && studentGender === 'L')
          if (dorm.gender && dorm.gender !== 'mixed' && studentGender && incompatible) {
            genderMismatch++
          }
          const already = res.student.dorm_id && res.student.dorm_id !== dorm.id
          rows.push({
            roomName: block.roomName,
            dormId: dorm.id,
            dormName: dorm.name,
            raw,
            studentId: res.student.id,
            matchedName: res.student.name,
            status: 'siap',
            message: already
              ? `Pindah dari kamar sekarang ke ${dorm.name}`
              : res.matchType === 'fuzzy'
                ? 'Cocok longgar — periksa dulu'
                : undefined,
          })
        } else {
          rows.push({
            roomName: block.roomName,
            dormId: dorm.id,
            dormName: dorm.name,
            raw,
            studentId: null,
            matchedName: null,
            status: 'error',
            message: res.message,
          })
        }
      } else {
        rows.push({
          roomName: block.roomName || '(tanpa kamar)',
          dormId: null,
          dormName: null,
          raw,
          studentId: null,
          matchedName: null,
          status: 'error',
          message: 'Kamar tidak dikenali',
        })
      }
    }

    // Kapasitas: kamar harus ada di daftar kamar aktif
    if (dorm) {
      const info = occupancy.get(dorm.id)
      const willIn = incoming.get(dorm.id) ?? 0
      if (info && willIn > Math.max(0, info.capacity - info.occupied)) {
        warnings.push(
          `Kapasitas kurang: ${willIn} santri akan masuk, sisa slot ${Math.max(0, info.capacity - info.occupied)}`,
        )
      }
      if (genderMismatch > 0) {
        warnings.push(`${genderMismatch} santri gendernya tidak sesuai kamar`)
      }
    }

    rooms.push({
      roomName: block.roomName || '(tanpa kamar)',
      dormId: dorm?.id ?? null,
      dormName: dorm?.name ?? null,
      declaredCount: block.declaredCount,
      parsedCount: block.studentNames.length,
      matchedCount,
      warnings,
    })
  }

  return {
    rows,
    rooms,
    totalMatched: rows.filter((r) => r.status === 'siap').length,
  }
}

/** Kelompokkan baris siap → assignments per kamar (untuk apply) */
export function rowsToAssignments(rows: TextPlacementRow[]): { roomId: string; studentIds: string[] }[] {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    if (row.status !== 'siap' || !row.dormId || !row.studentId) continue
    const ids = map.get(row.dormId)
    if (ids) ids.push(row.studentId)
    else map.set(row.dormId, [row.studentId])
  }
  return [...map].map(([roomId, studentIds]) => ({ roomId, studentIds }))
}
