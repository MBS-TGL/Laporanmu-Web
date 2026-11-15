import type { EvalQuestion, InstrumentKind } from './types'

/**
 * Template angket bawaan 1-klik — struktur Sidikmu (AKPD/Sosiometri/MBTI)
 * + EDOM (bonus). Semuanya tetap bisa disunting di builder.
 */

export interface InstrumentTemplate {
  kind: InstrumentKind
  title: string
  description: string
  questions: EvalQuestion[]
}

const likert = (id: string, text: string, dimension: string): EvalQuestion => ({
  id,
  text,
  type: 'skala',
  dimension,
  max: 5,
})

const AKPD_DIMENSIONS = ['Akademik', 'Seni & Kreativitas', 'Olahraga', 'Keagamaan', 'Sosial & Kepemimpinan', 'Teknologi']

export const TEMPLATES: Record<Exclude<InstrumentKind, 'custom'>, InstrumentTemplate> = {
  akpd: {
    kind: 'akpd',
    title: 'Angket Kecenderungan Pendidikan & Minat (AKPD)',
    description: 'Memetakan minat dan kecenderungan santri per dimensi.',
    questions: [
      likert('ak1', 'Saya senang membaca dan mengerjakan tugas pelajaran', AKPD_DIMENSIONS[0]),
      likert('ak2', 'Saya mudah memahami materi pelajaran baru', AKPD_DIMENSIONS[0]),
      likert('sn1', 'Saya senang menggambar, menyanyi, atau ber seni', AKPD_DIMENSIONS[1]),
      likert('sn2', 'Saya berani tampil di depan umum', AKPD_DIMENSIONS[1]),
      likert('or1', 'Saya aktif dalam kegiatan olahraga', AKPD_DIMENSIONS[2]),
      likert('or2', 'Saya memiliki stamina dan tenaga berlebih', AKPD_DIMENSIONS[2]),
      likert('ag1', 'Saya rajin beribadah berjamaah', AKPD_DIMENSIONS[3]),
      likert('ag2', 'Saya senang mengikuti kegiatan keagamaan', AKPD_DIMENSIONS[3]),
      likert('so1', 'Saya mudah bergaul dengan teman baru', AKPD_DIMENSIONS[4]),
      likert('so2', 'Saya senang memimpin kegiatan kelompok', AKPD_DIMENSIONS[4]),
      likert('tk1', 'Saya penasaran dengan komputer dan teknologi', AKPD_DIMENSIONS[5]),
      likert('tk2', 'Saya senang merakit/membuat sesuatu', AKPD_DIMENSIONS[5]),
    ],
  },
  sosiometri: {
    kind: 'sosiometri',
    title: 'Angket Sosiometri Kelas',
    description: 'Memetakan hubungan sosial antar santri dalam kelas.',
    questions: [
      {
        id: 'so1',
        text: 'Teman mana yang paling kamu sukai untuk belajar bersama?',
        type: 'teman',
        maxChoices: 3,
      },
      {
        id: 'so2',
        text: 'Teman mana yang paling kamu hindari untuk satu kelompok?',
        type: 'teman',
        maxChoices: 3,
      },
    ],
  },
  mbti: {
    kind: 'mbti',
    title: 'Angket Kepribadian (MBTI Sederhana)',
    description: 'Menghitung preferensi kepribadian dari 4 dimensi.',
    questions: [
      likert('ei1', 'Saya memperoleh energi dari bertemu banyak orang', 'I-E'),
      likert('ei2', 'Saya lebih banyak bicara daripada mendengarkan saat berkumpul', 'I-E'),
      likert('sn1', 'Saya lebih suka hal konkret dan nyata daripada abstrak', 'N-S'),
      likert('sn2', 'Saya percaya pengalaman lebih daripada intuisi', 'N-S'),
      likert('tf1', 'Saya mengambil keputusan dengan logika, bukan perasaan', 'F-T'),
      likert('tf2', 'Kritik jujur tidak membuat saya tersinggung', 'F-T'),
      likert('jp1', 'Saya senang rencana yang sudah pasti daripada spontan', 'P-J'),
      likert('jp2', 'Saya menyelesaikan tugas jauh sebelum tenggat', 'P-J'),
    ],
  },
  edom: {
    kind: 'edom',
    title: 'Evaluasi Pengajaran Guru (EDOM)',
    description: 'Penilaian santri atas pengajaran guru per semester.',
    questions: [
      likert('ed1', 'Guru menjelaskan materi dengan jelas', 'Kejelasan Materi'),
      likert('ed2', 'Guru tepat waktu hadir dan mengajar', 'Ketepatan Waktu'),
      likert('ed3', 'Metode mengajar membuat saya paham', 'Metode'),
      likert('ed4', 'Guru disiplin dan adil menilai', 'Disiplin'),
      likert('ed5', 'Guru terbuka menerima pertanyaan', 'Keterbukaan'),
    ],
  },
}
