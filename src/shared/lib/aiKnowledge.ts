export interface AiKnowledgeEntry {
  id: string
  title: string
  keywords: string[]
  answer: string
  route?: string
  perm?: string
  flag?: string
  isPublic?: boolean
}

export interface AiSource {
  id: string
  title: string
  route: string
  isPublic?: boolean
}

export interface KnowledgeFilters {
  can?: (perm: string) => boolean
  flags?: Record<string, boolean>
}

export const AI_KNOWLEDGE: AiKnowledgeEntry[] = [
  {
    id: 'fitur-umum',
    title: 'Fitur Laporanmu',
    keywords: ['fitur', 'aplikasi', 'laporanmu', 'modul', 'menu apa', 'apa saja', 'kegunaan'],
    answer:
      'Laporanmu mengelola data santri dan guru, poin dan disiplin, absensi, izin keluar, gerbang, asrama, kesehatan, bimbingan konseling, halaqah, ekstrakurikuler, ibadah, jadwal, penilaian, rapor, CBT, keuangan SPP, tabungan, inventaris, pengumuman, dan administrasi. Menu yang terlihat bergantung pada role dan izin akun.',
  },
  {
    id: 'poin-santri',
    title: 'Poin Santri',
    keywords: ['poin', 'poin santri', 'pelanggaran', 'prestasi', 'disiplin', 'total poin', 'minus', 'plus'],
    answer:
      'Poin santri adalah akumulasi poin dari catatan pelanggaran (minus) dan prestasi (plus). Staf mencatatnya lewat tombol Catat Poin di halaman Poin & Disiplin, tab Catatan. Bobot poin tiap aturan diatur di tab Aturan. Total poin per santri terlihat di daftar Santri dan di detail santri.',
    route: '/discipline',
    perm: 'discipline:read',
  },
  {
    id: 'catat-poin',
    title: 'Mencatat Poin',
    keywords: ['catat poin', 'input poin', 'tambah poin', 'pelanggaran', 'prestasi', 'catatan poin'],
    answer:
      'Buka Poin & Disiplin (/discipline), tab Catatan, lalu klik Catat Poin. Pilih santri dan aturan yang sesuai, isi catatan bila perlu, lalu simpan. Total poin santri menyesuaikan otomatis.',
    route: '/discipline',
    perm: 'discipline:read',
  },
  {
    id: 'aturan-poin',
    title: 'Aturan Poin',
    keywords: ['aturan poin', 'bobot poin', 'jenis pelanggaran', 'prestasi', 'kategori aturan'],
    answer:
      'Daftar aturan pelanggaran dan prestasi beserta bobot poinnya ada di Poin & Disiplin (/discipline), tab Aturan. Aturan bisa dicari, difilter, ditambah, diubah, dan dihapus sesuai izin akun.',
    route: '/discipline?tab=rules',
    perm: 'discipline:read',
  },
  {
    id: 'skorsing',
    title: 'Skorsing',
    keywords: ['skorsing', 'suspend', 'hukuman', 'pembinaan', 'wali'],
    answer:
      'Data skorsing dan pembinaan bersama wali ada di Poin & Disiplin (/discipline), tab Skorsing. Detail skorsing dibuka sebagai drawer dari tabel.',
    route: '/discipline?tab=suspension',
    perm: 'discipline:read',
  },
  {
    id: 'cek-wali',
    title: 'Cek Wali Santri',
    keywords: [
      'cek wali',
      'cek poin',
      'cek rapor',
      'portal wali',
      'orang tua',
      'wali',
      'kode registrasi',
      'pin',
      'login wali',
      'akses wali',
    ],
    answer:
      'Wali tidak perlu membuat akun. Buka halaman Cek Wali Santri (/check), lalu masukkan kode registrasi dan PIN santri. PIN diberikan pihak sekolah melalui wali kelas atau musyrif. Halaman ini menampilkan informasi santri yang diizinkan untuk wali.',
    route: '/check',
    isPublic: true,
  },
  {
    id: 'lupa-pin',
    title: 'Lupa PIN Santri',
    keywords: ['lupa pin', 'pin hilang', 'reset pin', 'pin wali', 'pin santri'],
    answer:
      'PIN hanya diketahui wali dan pihak sekolah. Jika PIN lupa, hubungi musyrif, pengasuhan, atau wali kelas untuk mengatur ulang PIN. Asisten AI tidak dapat melihat atau mengganti PIN.',
    route: '/check',
    isPublic: true,
  },
  {
    id: 'hub-wali',
    title: 'Hub Wali',
    keywords: [
      'hub wali',
      'data wali',
      'kontak wali',
      'nomor hp wali',
      'nomor wali',
      'telepon wali',
      'orang tua',
      'ayah',
      'ibu',
      'wali',
      'guardian',
    ],
    answer:
      'Rekap ayah, ibu, dan wali per keluarga ada di Santri (/students), tab Hub Wali. Tab ini hanya terlihat untuk developer, admin, dan manager. Nomor HP wali tidak bisa ditampilkan oleh Asisten AI; buka Hub Wali atau detail santri untuk melihat data yang tersimpan.',
    route: '/students?tab=guardian',
    perm: 'students:read',
  },
  {
    id: 'data-santri',
    title: 'Data Santri',
    keywords: ['data santri', 'daftar santri', 'santri aktif', 'arsip santri', 'alumni', 'data induk'],
    answer:
      'Data induk santri ada di halaman Santri (/students). Halaman ini punya tab Santri Aktif, Arsip, Alumni, dan Hub Wali. Gunakan pencarian dan filter untuk menemukan santri.',
    route: '/students',
    perm: 'students:read',
  },
  {
    id: 'arsip-santri',
    title: 'Arsip Santri',
    keywords: ['arsip santri', 'santri arsip', 'pulihkan santri', 'soft delete'],
    answer:
      'Santri yang diarsipkan ada di Santri (/students), tab Arsip. Dari tab ini santri bisa dipulihkan. Data operasional tidak dihapus permanen.',
    route: '/students?tab=archive',
    perm: 'students:read',
  },
  {
    id: 'alumni',
    title: 'Alumni',
    keywords: ['alumni', 'lulus', 'kelulusan', 'riwayat poin', 'rapor alumni'],
    answer:
      'Data alumni ada di Santri (/students), tab Alumni. Tab ini menyimpan jejak santri lulus, riwayat poin, rapor, dan log terkait.',
    route: '/students?tab=alumni',
    perm: 'students:read',
  },
  {
    id: 'rapor',
    title: 'Rapor',
    keywords: ['rapor', 'raport', 'nilai rapor', 'rapor bulanan', 'rapor semester', 'laporan hasil belajar'],
    answer:
      'Rapor bulanan dan semester per kelas ada di halaman Rapor (/report-cards). Untuk dokumen akademik seperti rapor, KHS, transkrip, buku induk, dan yudisium, buka Dokumen Akademik (/documents).',
    route: '/report-cards',
    perm: 'report_cards:read',
  },
  {
    id: 'dokumen-akademik',
    title: 'Dokumen Akademik',
    keywords: ['dokumen akademik', 'khs', 'transkrip', 'buku induk', 'yudisium', 'dokumen rapor'],
    answer:
      'Rapor, KHS, transkrip, buku induk, dan yudisium ada di Dokumen Akademik (/documents).',
    route: '/documents',
    perm: 'documents:read',
  },
  {
    id: 'verifikasi-rapor',
    title: 'Verifikasi Rapor',
    keywords: ['verifikasi rapor', 'keaslian rapor', 'cek rapor asli', 'qr rapor', 'id santri'],
    answer:
      'Rapor bulanan bisa diverifikasi publik lewat halaman Verifikasi Rapor (/verify). Tempel ID santri yang tertera pada QR atau dokumen rapor, lalu sistem mencocokkannya dengan arsip resmi sekolah.',
    route: '/verify',
    isPublic: true,
  },
  {
    id: 'absensi',
    title: 'Absensi',
    keywords: ['absensi', 'presensi', 'kehadiran', 'absen', 'mesin presensi'],
    answer: 'Absensi harian santri, guru, dan mesin presensi ada di halaman Absensi (/attendance).',
    route: '/attendance',
    perm: 'attendance:read',
  },
  {
    id: 'izin-keluar',
    title: 'Izin Keluar',
    keywords: ['izin keluar', 'surat izin', 'perizinan', 'keluar pondok', 'pulang'],
    answer:
      'Surat izin keluar dan pemantauan statusnya ada di halaman Izin Keluar (/leave-permit).',
    route: '/leave-permit',
    perm: 'leave_permit:read',
    flag: 'module.leave_permit',
  },
  {
    id: 'gerbang',
    title: 'Gerbang',
    keywords: ['gerbang', 'keluar masuk', 'gate', 'scan gerbang', 'laporan gerbang'],
    answer: 'Catatan keluar-masuk santri di gerbang ada di halaman Gerbang (/gate).',
    route: '/gate',
    perm: 'gate:read',
    flag: 'module.gate',
  },
  {
    id: 'asrama',
    title: 'Asrama',
    keywords: ['asrama', 'kamar', 'dorm', 'penempatan santri', 'musyrif'],
    answer: 'Data kamar dan penempatan santri asrama ada di halaman Asrama (/dorms).',
    route: '/dorms',
    perm: 'dorms:read',
    flag: 'module.dorms',
  },
  {
    id: 'kesehatan',
    title: 'Kesehatan',
    keywords: ['kesehatan', 'rekam medis', 'sakit', 'obat', 'observasi', 'klinik'],
    answer: 'Rekam medis, observasi, dan stok obat ada di halaman Kesehatan (/health).',
    route: '/health',
    perm: 'health:read',
    flag: 'module.health',
  },
  {
    id: 'bk',
    title: 'Bimbingan Konseling',
    keywords: ['bimbingan konseling', 'bk', 'konseling', 'konselor', 'pembinaan', 'surat resmi'],
    answer:
      'Sesi konseling, pembinaan, dan surat resmi ada di halaman Bimbingan Konseling (/counseling).',
    route: '/counseling',
    perm: 'counseling:read',
    flag: 'module.counseling',
  },
  {
    id: 'halaqah',
    title: 'Halaqah',
    keywords: ['halaqah', 'setoran', 'hafalan', 'tahfidz', 'kelompok halaqah', 'absensi halaqah'],
    answer:
      'Absensi, setoran hafalan, dan kelompok halaqah ada di halaman Halaqah (/halaqah).',
    route: '/halaqah',
    perm: 'halaqah:read',
    flag: 'module.halaqah',
  },
  {
    id: 'ekskul',
    title: 'Ekstrakurikuler',
    keywords: ['ekstrakurikuler', 'ekskul', 'kegiatan', 'pembina', 'anggota'],
    answer:
      'Kegiatan, pembina, dan anggota ekstrakurikuler ada di halaman Ekstrakurikuler (/extracurricular).',
    route: '/extracurricular',
    perm: 'ekskul:read',
    flag: 'module.ekskul',
  },
  {
    id: 'ibadah',
    title: 'Ibadah',
    keywords: ['ibadah', 'kemahiran ibadah', 'nilai ibadah', 'spiritual', 'sholat'],
    answer: 'Kemahiran ibadah dan nilai bulanan santri ada di halaman Ibadah (/worship).',
    route: '/worship',
    perm: 'worship:read',
    flag: 'module.spiritual',
  },
  {
    id: 'spp',
    title: 'Keuangan SPP',
    keywords: ['spp', 'keuangan', 'tagihan', 'pembayaran', 'tunggakan', 'uang sekolah'],
    answer: 'Tagihan, pembayaran, dan tunggakan SPP ada di halaman Keuangan SPP (/finance).',
    route: '/finance',
    perm: 'finance:read',
    flag: 'module.finance_spp',
  },
  {
    id: 'tabungan',
    title: 'Tabungan Santri',
    keywords: ['tabungan', 'rekening santri', 'setor', 'tarik', 'buku tabungan'],
    answer:
      'Rekening, setor-tarik, dan buku tabungan santri ada di halaman Tabungan (/savings).',
    route: '/savings',
    perm: 'savings:read',
    flag: 'module.savings',
  },
  {
    id: 'inventaris',
    title: 'Inventaris',
    keywords: ['inventaris', 'aset', 'barang', 'kondisi barang'],
    answer: 'Data aset dan barang beserta kondisinya ada di halaman Inventaris (/inventory).',
    route: '/inventory',
    perm: 'inventory:read',
  },
  {
    id: 'penilaian',
    title: 'Penilaian',
    keywords: ['penilaian', 'nilai', 'ulangan', 'leger', 'ketuntasan', 'nilai santri'],
    answer: 'Nilai ulangan, leger, dan ketuntasan belajar ada di halaman Penilaian (/grades).',
    route: '/grades',
    perm: 'grades:read',
    flag: 'module.grades',
  },
  {
    id: 'cbt',
    title: 'CBT',
    keywords: ['cbt', 'ujian', 'bank soal', 'sesi ujian', 'ujian online'],
    answer: 'Bank soal, sesi ujian, dan pemantauan CBT ada di halaman CBT (/cbt).',
    route: '/cbt',
    perm: 'cbt:read',
    flag: 'module.cbt',
  },
  {
    id: 'jadwal',
    title: 'Jadwal dan Kalender',
    keywords: ['jadwal', 'kalender', 'pelajaran', 'agenda pondok', 'kalender akademik'],
    answer:
      'Jadwal pelajaran, kalender akademik, dan agenda pondok ada di halaman Jadwal & Kalender (/schedules).',
    route: '/schedules',
    perm: 'schedules:read',
    flag: 'module.schedules',
  },
  {
    id: 'pengumuman',
    title: 'Pengumuman',
    keywords: ['pengumuman', 'informasi', 'berita', 'wali', 'staf'],
    answer: 'Pengumuman untuk staf dan wali ada di halaman Pengumuman (/announcements).',
    route: '/announcements',
    perm: 'announcements:read',
  },
  {
    id: 'ppdb',
    title: 'PPDB',
    keywords: ['ppdb', 'pendaftaran', 'pendaftar baru', 'calon santri', 'admissions'],
    answer: 'Pendaftar baru dan konversi menjadi santri ada di halaman PPDB (/admissions).',
    route: '/admissions',
    perm: 'admissions:read',
    flag: 'module.ppdb',
  },
  {
    id: 'guru',
    title: 'Data Guru',
    keywords: ['guru', 'musyrif', 'tenaga kependidikan', 'data guru', 'ustadz'],
    answer: 'Data guru, musyrif, dan tenaga kependidikan ada di halaman Guru (/teachers).',
    route: '/teachers',
    perm: 'teachers:read',
  },
  {
    id: 'kelas',
    title: 'Kelas',
    keywords: ['kelas', 'wali kelas', 'tingkat', 'struktur kelas'],
    answer: 'Struktur kelas, tingkat, dan wali kelas ada di halaman Kelas (/classes).',
    route: '/classes',
    perm: 'classes:read',
  },
  {
    id: 'mapel',
    title: 'Mata Pelajaran',
    keywords: ['mata pelajaran', 'mapel', 'cp', 'tp', 'beban jam'],
    answer:
      'Daftar mata pelajaran, CP/TP, dan beban jam ada di halaman Mata Pelajaran (/subjects).',
    route: '/subjects',
    perm: 'subjects:read',
  },
  {
    id: 'tahun-akademik',
    title: 'Tahun Akademik',
    keywords: ['tahun akademik', 'tahun ajaran', 'semester', 'slot jam', 'ruang'],
    answer:
      'Tahun ajaran, semester, slot jam, dan ruang ada di halaman Tahun Akademik (/academic-years).',
    route: '/academic-years',
    perm: 'academic_years:read',
  },
  {
    id: 'perpustakaan',
    title: 'Perpustakaan',
    keywords: ['perpustakaan', 'buku', 'peminjaman', 'katalog'],
    answer: 'Katalog buku dan peminjaman santri ada di halaman Perpustakaan (/library).',
    route: '/library',
    perm: 'library:read',
    flag: 'module.library',
  },
  {
    id: 'evaluasi',
    title: 'Evaluasi',
    keywords: ['evaluasi', 'angket', 'asesmen', 'akpd', 'sosiometri', 'mbti', 'edom'],
    answer:
      'Angket dan asesmen santri seperti AKPD, sosiometri, MBTI, dan EDOM ada di halaman Evaluasi (/instruments).',
    route: '/instruments',
    perm: 'evaluation:read',
    flag: 'module.evaluation',
  },
  {
    id: 'beban-mengajar',
    title: 'Beban Mengajar',
    keywords: ['beban mengajar', 'jam mengajar', 'cakupan kelas'],
    answer:
      'Sebaran jam mengajar dan cakupan kelas ada di halaman Beban Mengajar (/teaching-load).',
    route: '/teaching-load',
    perm: 'teaching_load:read',
  },
  {
    id: 'profil-sekolah',
    title: 'Profil Sekolah',
    keywords: ['profil sekolah', 'identitas sekolah', 'kop rapor', 'nama sekolah'],
    answer:
      'Identitas sekolah yang dipakai pada kop rapor ada di halaman Profil Sekolah (/school).',
    route: '/school',
    perm: 'school:read',
  },
  {
    id: 'administrasi',
    title: 'Administrasi',
    keywords: ['administrasi', 'pengguna', 'peran', 'role', 'basis data', 'media', 'audit', 'jejak audit'],
    answer:
      'Pengguna, peran, basis data, media, dan jejak audit ada di halaman Administrasi (/admin). Halaman ini hanya untuk akun dengan izin administrasi.',
    route: '/admin',
    perm: 'admin:access',
  },
  {
    id: 'akses-admin',
    title: 'Akses Administrasi',
    keywords: ['administrasi', 'admin', 'buka admin', 'menu admin', 'hak akses', 'izin admin'],
    answer:
      'Menu Administrasi hanya terbuka untuk akun dengan izin administrasi. Jika menu itu tidak muncul, akun belum punya izin. Hubungi admin sekolah untuk penyesuaian akses.',
  },
  {
    id: 'import-export',
    title: 'Impor dan Ekspor',
    keywords: ['import', 'impor', 'excel', 'csv', 'export', 'ekspor', 'unduh', 'unggah'],
    answer:
      'Beberapa halaman punya tombol Impor untuk membaca Excel atau CSV dan tombol Ekspor untuk mengunduh data. Tombol yang tersedia mengikuti izin akun.',
  },
  {
    id: 'role',
    title: 'Role Pengguna',
    keywords: ['role', 'peran', 'hak akses', 'developer', 'admin', 'manager', 'pengurus', 'guru', 'teacher'],
    answer:
      'Role pengguna aplikasi: developer, admin, manager (pengurus), dan teacher (guru). Menu dan aksi yang terlihat mengikuti izin role tersebut. Role tanpa izin tidak akan melihat menu terkait.',
  },
  {
    id: 'akses-menu',
    title: 'Akses Menu',
    keywords: ['akses menu', 'menu tidak muncul', 'tidak ada menu', 'izin', 'permission', 'tidak bisa buka'],
    answer:
      'Menu yang terlihat mengikuti role, izin permission, dan feature flag modul. Jika sebuah menu tidak muncul, akun tersebut belum punya izin atau modulnya sedang dimatikan. Hubungi admin sekolah untuk penyesuaian akses.',
  },
  {
    id: 'akun-wali',
    title: 'Akun Wali',
    keywords: ['akun wali', 'daftar wali', 'login wali', 'registrasi wali', 'orang tua'],
    answer:
      'Wali tidak perlu membuat akun. Wali cukup membuka Cek Wali Santri (/check) dan memasukkan kode registrasi serta PIN santri.',
    route: '/check',
    isPublic: true,
  },
  {
    id: 'keamanan-data',
    title: 'Keamanan Data Wali',
    keywords: ['keamanan data', 'privasi', 'data aman', 'pin', 'percobaan gagal', 'audit'],
    answer:
      'Data wali dibuka dengan kombinasi kode registrasi dan PIN. Server membatasi percobaan gagal, dan perubahan data penting tercatat di audit log sekolah.',
    route: '/check',
    isPublic: true,
  },
  {
    id: 'login',
    title: 'Login Staf',
    keywords: ['login', 'masuk', 'akun staf', 'tidak bisa login', 'sesi berakhir'],
    answer:
      'Staf masuk lewat halaman Login (/login). Jika sesi berakhir, login ulang lalu buka kembali Asisten AI.',
    route: '/login',
    isPublic: true,
  },
  {
    id: 'wali-kelas',
    title: 'Wali Kelas',
    keywords: ['wali kelas', 'homeroom', 'guru kelas'],
    answer:
      'Nama wali kelas tidak bisa ditampilkan oleh Asisten AI. Buka data Kelas atau detail santri untuk melihat wali kelas yang tercatat.',
  },
  {
    id: 'data-spesifik',
    title: 'Data Spesifik',
    keywords: ['nama', 'nomor', 'hp', 'telepon', 'alamat', 'nilai', 'data santri', 'data guru', 'siapa'],
    answer:
      'Asisten AI tidak dapat menampilkan nama, nomor HP, alamat, nilai, atau data santri dan guru tertentu. Buka menu terkait untuk melihat data yang tersimpan.',
  },
  {
    id: 'bantuan',
    title: 'Bantuan dan Kontak',
    keywords: ['bantuan', 'kontak', 'hubungi', 'admin sekolah', 'masalah', 'error'],
    answer:
      'Untuk masalah akun, PIN, atau data yang tidak sesuai, hubungi admin sekolah, musyrif, atau pengasuhan melalui kontak resmi sekolah. Asisten AI tidak dapat mengubah data.',
  },
]

const STOPWORDS = new Set([
  'apa',
  'apakah',
  'itu',
  'ini',
  'yang',
  'di',
  'ke',
  'dari',
  'bagaimana',
  'cara',
  'gimana',
  'dan',
  'atau',
  'untuk',
  'saya',
  'aku',
  'mau',
  'ingin',
  'bisa',
  'kah',
  'sih',
  'dong',
  'ya',
  'adalah',
  'dengan',
  'pada',
  'dalam',
  'tentang',
  'soal',
  'nih',
  'deh',
  'aja',
  'saja',
  'mana',
  'kapan',
  'siapa',
])

const MIN_SCORE = 5
const MAX_RESULTS = 4

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
}

function isVisible(entry: AiKnowledgeEntry, filters: KnowledgeFilters): boolean {
  if (entry.perm && filters.can && !filters.can(entry.perm)) return false
  if (entry.flag && filters.flags?.[entry.flag] === false) return false
  return true
}

function scoreEntry(entry: AiKnowledgeEntry, question: string, tokens: string[]): number {
  const phrase = ` ${normalize(question)} `
  const title = normalize(entry.title)
  let score = title && phrase.includes(` ${title} `) ? 10 : 0

  for (const keyword of entry.keywords) {
    const key = normalize(keyword)
    if (!key) continue
    if (phrase.includes(` ${key} `)) {
      score += key.includes(' ') ? 6 : 3
      continue
    }
    const keyTokens = key.split(' ').filter(Boolean)
    if (keyTokens.length < 2) continue
    const matches = keyTokens.filter((token) => tokens.includes(token)).length
    if (matches > 1) score += matches * 2
  }

  const titleTokens = tokenize(entry.title)
  score += titleTokens.filter((token) => tokens.includes(token)).length * 2
  return score
}

export function retrieveKnowledge(
  question: string,
  filters: KnowledgeFilters = {},
): AiKnowledgeEntry[] {
  const tokens = tokenize(question)
  if (tokens.length === 0) return []

  return AI_KNOWLEDGE.filter((entry) => isVisible(entry, filters))
    .map((entry) => ({ entry, score: scoreEntry(entry, question, tokens) }))
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, MAX_RESULTS)
    .map(({ entry }) => entry)
}

export function toSources(entries: AiKnowledgeEntry[]): AiSource[] {
  return entries
    .filter((entry): entry is AiKnowledgeEntry & { route: string } => Boolean(entry.route))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      route: entry.route,
      isPublic: entry.isPublic,
    }))
}
