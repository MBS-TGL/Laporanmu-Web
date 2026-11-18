import type { WorshipCategory } from './types'

/**
 * Preset butir kemahiran ibadah (Fase 5 P3):
 * Diambil dari panduan kurikulum ibadah & tahfidz,
 * mencakup 9 aspek ujian pondok & pembinaan asrama kelas 7 s/d 12.
 */
export const WORSHIP_PRESETS: Record<WorshipCategory, string[]> = {
  // 1. PRAKTEK WUDHU (dan Thaharah)
  wudhu: [
    'Niat & Membaca Basmalah',
    'Membasuh Telapak Tangan & Sela Jari',
    'Berkumur & Istinsyaq (Menghirup Air)',
    'Istinsyar (Mengeluarkan Air Hidung) (Sunnah)',
    'Membasuh Muka secara Merata (Fardhu)',
    'Membasuh Tangan hingga Siku (Fardhu)',
    'Mengusap Kepala (Fardhu) & Kedua Telinga (Sunnah)',
    'Menyela Jenggot (Sunnah)',
    'Membasuh Kaki hingga Mata Kaki (Fardhu)',
    'Tertib & Berurutan Mendahulukan Kanan',
    'Doa Setelah Wudhu (Syahadat & Taubat)',
  ],

  // 2. SHOLAT (Termasuk Dzikir Ba'da Shalat, Dzikir Pagi-Petang, Sujud Sahwi & Tilawah)
  sholat: [
    'Gerakan & Rukun Shalat Berjamaah',
    'Bacaan Iftitah & Al-Fatihah Benar',
    'Bacaan Ruku, Itidal & Sujud Tumaninah',
    'Bacaan Tasyahud Awal & Tasyahud Akhir',
    'Praktek Sujud Sahwi (Sebab & Tata Cara)',
    'Praktek Sujud Tilawah (Ayat Sajdah & Doa)',
    'Dzikir Setelah Sholat',
    'Doa Setelah Sholat',
    'Dzikir Pagi dan Petang',
  ],

  // 3. HADIST (Hadist Arbain An-Nawawi & Hadist Sehari-hari)
  hafalan_hadist: [
    'Arbain 1-3: Niat, Iman-Islam-Ihsan, Rukun Islam (Kls 7)',
    'Arbain 4-7: Penciptaan, Bid’ah, Syubhat, Nasihat (Kls 7)',
    'Arbain 8-14: Darah Muslim, Taqwa, Halal-Haram (Kls 8)',
    'Arbain 15-21: Bicara Baik, Jangan Marah, Istiqamah (Kls 9)',
    'Arbain 22-28: Jalan Surga, Sedekah, Sunnah Nabi (Kls 10)',
    'Arbain 29-35: Pintu Kebaikan, Persaudaraan Muslim (Kls 11)',
    'Arbain 36-42: Menolong Muslim, Wali Allah, Taubat (Kls 12)',
    'Hadist Sehari-hari: Kesucian, Doa, Jangan Marah (Kls 7)',
    'Hadist Sehari-hari: Berkata Benar, Menuntut Ilmu (Kls 8)',
    'Hadist Sehari-hari: Silaturahmi, Menjaga Lisan (Kls 9)',
    'Hadist Sehari-hari: Akhlak & Keutamaan Amal (Kls 10-12)',
    'Matan Tuhfatul Athfal: Mukaddimah & Nun Mati (Kls 7)',
    'Matan Tuhfatul Athfal: Mim Mati & Idgham (Kls 8)',
    'Matan Tuhfatul Athfal: Hukum Mad & Penutup (Kls 9-12)',
  ],

  // 4. DOA SEHARI-HARI & WAFA
  hafalan_doa: [
    'Doa Sebelum & Bangun Tidur (Kls 7)',
    'Doa Masuk & Keluar Kamar Mandi/WC (Kls 7)',
    'Doa Setelah Adzan & Menuju Masjid (Kls 7)',
    'Doa Masuk & Keluar Masjid/Mushalla (Kls 7)',
    'Doa Berpakaian & Melepas Pakaian (Kls 7)',
    'Doa Sebelum & Sesudah Makan (Kls 8)',
    'Doa Masuk Kelas & Memulai Pelajaran (Kls 8)',
    'Doa Lapang Dada (Nabi Musa) & Mengakhiri KBM (Kls 8)',
    'Doa Kafarotul Majelis & Kebaikan Dunia Akhirat (Kls 8)',
    'Doa Meminta Hujan, Turun Hujan & Halilintar (Kls 8)',
    'Doa Bercermin, Masuk Pasar & Naik Kendaraan (Kls 9)',
    'Doa Istikharah & Doa Pilihan (Kls 10-12)',
    'Wafa: Tilawah Tartil Al-Qur’an',
    'Wafa: Penguasaan Tajwid & Bacaan Ghorib',
  ],
}

/**
 * Filter preset yang relevan per tingkatan kelas (7-12)
 * Memudahkan guru memuat target yang pas untuk kelas yang dipilih.
 */
export const WORSHIP_GRADE_PRESETS: Record<number, Record<WorshipCategory, string[]>> = {
  7: {
    wudhu: [
      'Niat & Membaca Basmalah',
      'Membasuh Telapak Tangan & Sela Jari',
      'Berkumur & Istinsyaq (Menghirup Air)',
      'Istinsyar (Mengeluarkan Air Hidung) (Sunnah)',
      'Membasuh Muka secara Merata (Fardhu)',
      'Membasuh Tangan hingga Siku (Fardhu)',
      'Mengusap Kepala (Fardhu) & Kedua Telinga (Sunnah)',
      'Menyela Jenggot (Sunnah)',
      'Membasuh Kaki hingga Mata Kaki (Fardhu)',
      'Tertib & Berurutan Mendahulukan Kanan',
      'Doa Setelah Wudhu (Syahadat & Taubat)',
    ],
    sholat: [
      'Gerakan & Rukun Shalat Berjamaah',
      'Bacaan Iftitah & Al-Fatihah Benar',
      'Bacaan Ruku, Itidal & Sujud Tumaninah',
      'Bacaan Tasyahud Awal & Tasyahud Akhir',
      'Dzikir Setelah Sholat',
      'Doa Setelah Sholat',
      'Dzikir Pagi dan Petang',
    ],
    hafalan_hadist: [
      'Arbain 1-3: Niat, Iman-Islam-Ihsan, Rukun Islam (Kls 7)',
      'Arbain 4-7: Penciptaan, Bid’ah, Syubhat, Nasihat (Kls 7)',
      'Hadist Sehari-hari: Kesucian, Doa, Jangan Marah (Kls 7)',
      'Matan Tuhfatul Athfal: Mukaddimah & Nun Mati (Kls 7)',
    ],
    hafalan_doa: [
      'Doa Sebelum & Bangun Tidur (Kls 7)',
      'Doa Masuk & Keluar Kamar Mandi/WC (Kls 7)',
      'Doa Setelah Adzan & Menuju Masjid (Kls 7)',
      'Doa Masuk & Keluar Masjid/Mushalla (Kls 7)',
      'Doa Berpakaian & Melepas Pakaian (Kls 7)',
      'Wafa: Tilawah Tartil Al-Qur’an',
    ],
  },
  8: {
    wudhu: [
      'Pengujian Rukun & Sunnah Wudhu Lengkap',
      'Doa Setelah Wudhu Sempurna',
    ],
    sholat: [
      'Praktek Sujud Sahwi (Sebab & Tata Cara)',
      'Praktek Sujud Tilawah (Ayat Sajdah & Doa)',
      'Dzikir Setelah Sholat',
      'Dzikir Pagi dan Petang',
    ],
    hafalan_hadist: [
      'Arbain 8-14: Darah Muslim, Taqwa, Halal-Haram (Kls 8)',
      'Hadist Sehari-hari: Berkata Benar, Menuntut Ilmu (Kls 8)',
      'Matan Tuhfatul Athfal: Mim Mati & Idgham (Kls 8)',
    ],
    hafalan_doa: [
      'Doa Sebelum & Sesudah Makan (Kls 8)',
      'Doa Masuk Kelas & Memulai Pelajaran (Kls 8)',
      'Doa Lapang Dada (Nabi Musa) & Mengakhiri KBM (Kls 8)',
      'Doa Kafarotul Majelis & Kebaikan Dunia Akhirat (Kls 8)',
      'Doa Meminta Hujan, Turun Hujan & Halilintar (Kls 8)',
      'Wafa: Tilawah & Tajwid Wafa Tingkat Lanjut',
    ],
  },
  9: {
    wudhu: [
      'Praktek Mandi Wajib: Tata Cara Runtut (Fardhu) (Kls 9)',
      'Mandi Wajib: Rukun Niat, Tertib & Menyela (Fardhu) (Kls 9)',
    ],
    sholat: [
      'Praktek Sujud Sahwi & Tilawah',
      'Sholat Sunnah Rawatib & Dhuha',
      'Dzikir Setelah Sholat & Pagi-Petang',
    ],
    hafalan_hadist: [
      'Arbain 15-21: Bicara Baik, Jangan Marah, Istiqamah (Kls 9)',
      'Hadist Sehari-hari: Silaturahmi, Menjaga Lisan (Kls 9)',
      'Matan Tuhfatul Athfal: Hukum Mad & Penutup (Kls 9-12)',
    ],
    hafalan_doa: [
      'Doa Bercermin, Masuk Pasar & Naik Kendaraan (Kls 9)',
      'Doa Ketika Mendengar Petir & Angin Kencang (Kls 9)',
      'Wafa: Penguasaan Tajwid & Bacaan Ghorib',
    ],
  },
  10: {
    wudhu: [
      'Macam-Macam Air: Mutlak & Muthayyam (Kls 10)',
      'Macam Najis: Mughallazhah, Mutawassithah, Mukhaffafah (Kls 10)',
      'Hadats Kecil & Besar serta Penghapusnya (Kls 10)',
    ],
    sholat: [
      'Praktek Sholat Jenazah & Sholat Khusyu',
      'Dzikir Setelah Sholat & Pagi-Petang',
    ],
    hafalan_hadist: [
      'Arbain 22-28: Jalan Surga, Sedekah, Sunnah Nabi (Kls 10)',
      'Hadist Sehari-hari: Akhlak & Keutamaan Amal (Kls 10-12)',
      'Matan Tuhfatul Athfal Lanjutan',
    ],
    hafalan_doa: [
      'Doa Istikharah & Doa Pilihan (Kls 10-12)',
      'Wafa: Tilawah Tingkat Lanjut (Mahir)',
    ],
  },
  11: {
    wudhu: [
      'Praktek Tayammum: Rukun & Tata Cara (Fardhu) (Kls 11)',
      'Tayammum: Syarat, Pembatal & Masa Berlaku (Kls 11)',
      'Keadaan yang Mewajibkan Mandi Wajib (Kls 11)',
    ],
    sholat: ['Sholat Tahajjud & Dzikir Maktubah'],
    hafalan_hadist: [
      'Arbain 29-35: Pintu Kebaikan, Persaudaraan Muslim (Kls 11)',
      'Hadist Sehari-hari: Amanat & Pergaulan Islami (Kls 11)',
    ],
    hafalan_doa: [
      'Doa Qunut Nazilah & Doa Keselamatan Umat (Kls 11)',
      'Wafa: Tilawah & Tartil Al-Qur’an Mutqin',
    ],
  },
  12: {
    wudhu: ['Evaluasi Akhir Thaharah: Wudhu, Mandi Wajib & Tayammum (Kls 12)'],
    sholat: ['Praktek Sholat & Dzikir Lengkap'],
    hafalan_hadist: [
      'Arbain 36-42: Menolong Muslim, Wali Allah, Taubat (Kls 12)',
      'Hadist Sehari-hari: Tujuh Golongan Naungan Allah (Kls 12)',
      'Matan Tuhfatul Athfal Tuntas',
    ],
    hafalan_doa: [
      'Doa Khatam Quran & Doa Kemudahan Urusan (Kls 12)',
      'Wafa: Kelulusan Ujian Munaqosyah Wafa',
    ],
  },
}

/** Kategori urutan tampil di tab (stabil). */
export const WORSHIP_CATEGORY_ORDER: WorshipCategory[] = [
  'wudhu',
  'sholat',
  'hafalan_hadist',
  'hafalan_doa',
]

/**
 * Memeriksa apakah suatu butir materi berlaku untuk jenjang kelas santri saat ini (kumulatif).
 * - Santri kelas 7 hanya melihat materi umum / materi (Kls 7). Materi (Kls 8+) disembunyikan.
 * - Santri kelas 8 melihat materi Kelas 7 dan Kelas 8. Materi (Kls 9+) disembunyikan.
 * - Jika tidak ada penanda kelas pada label, materi dianggap berlaku untuk semua kelas.
 */
export function isItemApplicableForGrade(label: string, currentGrade: number | null | undefined): boolean {
  if (!currentGrade || Number.isNaN(currentGrade)) return true

  // Deteksi pola penanda kelas: (Kls 7), (Kls 8), (Kls 10-12), dsb.
  const matchRange = label.match(/\(Kls\s+(\d+)\s*-\s*(\d+)\)/i)
  if (matchRange) {
    const min = Number(matchRange[1])
    return currentGrade >= min
  }

  const matchSingle = label.match(/\(Kls\s+(\d+)\)/i)
  if (matchSingle) {
    const itemGrade = Number(matchSingle[1])
    return currentGrade >= itemGrade
  }

  return true
}

/**
 * Mengambil daftar butir preset kumulatif untuk kategori dan tingkat kelas tertentu.
 * Contoh: kelas 8 akan mendapatkan preset kelas 7 + kelas 8.
 */
export function getCumulativeGradePresets(category: WorshipCategory, grade: number | null | undefined): string[] {
  if (!grade || Number.isNaN(grade)) {
    return WORSHIP_PRESETS[category]
  }

  const result: string[] = []
  const seen = new Set<string>()

  // Ambil butir dari jenjang 7 sampai jenjang kelas saat ini
  for (let g = 7; g <= grade; g++) {
    const gradeItems = WORSHIP_GRADE_PRESETS[g]?.[category] ?? []
    for (const item of gradeItems) {
      if (!seen.has(item)) {
        seen.add(item)
        result.push(item)
      }
    }
  }

  return result.length > 0 ? result : WORSHIP_PRESETS[category]
}

/**
 * Butir gabungan → komponen terpisahnya. Saat memuat preset, butir gabungan
 * DILEWATI jika semua komponennya sudah ada (di baris DB maupun di batch yang
 * sama) – mencegah padanan ganda seperti "Dzikir Setelah Sholat & Pagi-Petang"
 * menumpuk di atas "Dzikir Setelah Sholat" + "Dzikir Pagi dan Petang".
 * Kegiatan/evaluasi berbeda (Pengujian, Praktek Thaharah, Sholat Jenazah, dst.)
 * sengaja TIDAK dicatat di sini.
 */
export const COMBINED_PRESETS: Record<string, string[]> = {
  'Dzikir Setelah Sholat & Pagi-Petang': ['Dzikir Setelah Sholat', 'Dzikir Pagi dan Petang'],
  'Praktek Sujud Sahwi & Tilawah': [
    'Praktek Sujud Sahwi (Sebab & Tata Cara)',
    'Praktek Sujud Tilawah (Ayat Sajdah & Doa)',
  ],
  'Doa Setelah Wudhu Sempurna': ['Doa Setelah Wudhu (Syahadat & Taubat)'],
  'Praktek Sholat & Dzikir Lengkap': [...WORSHIP_PRESETS.sholat],
}

/**
 * Buang butir gabungan yang semua komponennya sudah tersedia.
 * `available` = label existing di DB; batch `labels` sendiri ikut dihitung
 * (komponen yang baru akan di-insert di batch yang sama sudah dianggap ada –
 * komponennya pasti ikut terkirim, jadi gabungan tak perlu lagi).
 * Label non-gabungan tidak pernah disentuh; gabungan dengan komponen
 * yang belum lengkap tetap dikirim (komponennya menyusul di batch berikutnya).
 */
export function suppressCombinedPresets(labels: string[], available: string[]): string[] {
  const present = new Set(available.map((l) => l.trim().toLowerCase()))
  for (const l of labels) present.add(l.trim().toLowerCase())
  return labels.filter((label) => {
    const components = COMBINED_PRESETS[label]
    if (!components) return true
    return !components.every((c) => present.has(c.trim().toLowerCase()))
  })
}

