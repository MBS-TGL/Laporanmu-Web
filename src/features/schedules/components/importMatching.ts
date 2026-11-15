export type Option = { id: string; name: string }
export type Match = { id?: string; level: 'exact' | 'fuzzy' | 'none'; score: number }

const TITLES = new Set(['pd', 'md', 'sos', 'ag', 'kom', 'amd', 'spd', 'drs', 'dr', 'ust', 'ustadz', 'ustadzah'])

/** huruf kecil, tanpa tanda baca; apostrof dibuang ("Mas'ad" → "masad") */
export function norm(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** nama guru tanpa gelar (S.Pd, S.E., A.Md., S.H.I.) dan inisial 1 huruf */
export function personKey(name: string): string {
  return norm(name)
    .split(' ')
    .filter((t) => t.length > 1 && !TITLES.has(t))
    .join(' ')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
  }
  return dp[a.length][b.length]
}

export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max
}

function best(key: string, options: Option[], keyOf: (o: Option) => string): { o?: Option; score: number } {
  let o: Option | undefined
  let score = 0
  for (const opt of options) {
    const s = similarity(key, keyOf(opt))
    if (s > score) {
      score = s
      o = opt
    }
  }
  return { o, score }
}

export function matchTeacher(name: string, options: Option[]): Match {
  const key = personKey(name)
  if (!key) return { level: 'none', score: 0 }
  const { o, score } = best(key, options, (x) => personKey(x.name))
  if (o && score === 1) return { id: o.id, level: 'exact', score }
  if (o && score >= 0.8) return { id: o.id, level: 'fuzzy', score }
  return { level: 'none', score }
}

/** Nama mapel di jadwal PDF → kemungkinan nama di Data Mapel */
const SUBJECT_ALIASES: Record<string, string[]> = {
  matematika: ['mtk'],
  tik: ['informatika', 'teknologi informasi dan komunikasi', 'teknologi informasi'],
  sbdp: ['seni budaya', 'seni budaya dan prakarya', 'seni dan prakarya'],
  'bahasa jawa': ['bahasa daerah', 'muatan lokal bahasa jawa'],
  pjok: ['pendidikan jasmani', 'penjaskes', 'pendidikan jasmani olahraga dan kesehatan'],
  'pendidikan pancasila': ['ppkn', 'pkn', 'pendidikan pancasila dan kewarganegaraan'],
  ipa: ['ilmu pengetahuan alam', 'ipa terpadu'],
  ips: ['ilmu pengetahuan sosial', 'ips terpadu'],
  'bahasa indonesia': ['bin'],
  kemuhammadiyahan: ['ismuba', 'kemuhammadiyahan ismuba'],
}

export function matchSubject(name: string, options: Option[]): Match {
  const key = norm(name)
  if (!key) return { level: 'none', score: 0 }
  const byNorm = new Map(options.map((o) => [norm(o.name), o]))
  const direct = byNorm.get(key)
  if (direct) return { id: direct.id, level: 'exact', score: 1 }
  for (const alias of SUBJECT_ALIASES[key] ?? []) {
    const hit = byNorm.get(norm(alias))
    if (hit) return { id: hit.id, level: 'fuzzy', score: 0.9 }
  }
  const { o, score } = best(key, options, (x) => norm(x.name))
  if (o && score >= 0.88) return { id: o.id, level: 'fuzzy', score }
  return { level: 'none', score }
}

export function matchClass(name: string, options: Option[]): Match {
  const key = norm(name).replace(/ /g, '')
  if (!key) return { level: 'none', score: 0 }
  const exact = options.find((o) => norm(o.name).replace(/ /g, '') === key)
  if (exact) return { id: exact.id, level: 'exact', score: 1 }
  // mis. "7A" ↔ "7A Boarding Putra": hanya bila tepat satu kandidat
  const starts = options.filter((o) => norm(o.name).replace(/ /g, '').startsWith(key))
  if (starts.length === 1) return { id: starts[0].id, level: 'fuzzy', score: 0.9 }
  return { level: 'none', score: 0 }
}
