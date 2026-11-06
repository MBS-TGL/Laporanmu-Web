export type RaportType = 'bulanan' | 'pondok_lisan' | 'pondok_mapel' | 'umum'

export type SemesterType = Exclude<RaportType, 'bulanan'>

export interface MonthlyReport {
  id: string
  student_id: string
  month: number
  year: number
  nilai_akhlak: number | null
  nilai_ibadah: number | null
  nilai_kebersihan: number | null
  nilai_quran: number | null
  nilai_bahasa: number | null
  berat_badan: number | null
  tinggi_badan: number | null
  ziyadah: string | null
  murojaah: string | null
  total_hafalan: string | null
  sholat: string | null
  hari_sakit: number
  hari_izin: number
  hari_alpa: number
  hari_pulang: number
  catatan: string | null
  pelanggaran: string | null
  prestasi: string | null
  musyrif_name: string | null
  created_at?: string
  updated_at?: string
}

// Baris siap upsert (kolom skor datar)
export interface MonthlyReportPayload {
  student_id: string
  month: number
  year: number
  musyrif_name: string | null
  nilai_akhlak: number | null
  nilai_ibadah: number | null
  nilai_kebersihan: number | null
  nilai_quran: number | null
  nilai_bahasa: number | null
  berat_badan: number | null
  tinggi_badan: number | null
  ziyadah: string | null
  murojaah: string | null
  total_hafalan: string | null
  sholat: string | null
  hari_sakit: number
  hari_izin: number
  hari_alpa: number
  hari_pulang: number
  catatan: string | null
  pelanggaran: string | null
  prestasi: string | null
  updated_by: string | null
}

export interface SemesterReport {
  id: string
  student_id: string
  report_type: SemesterType
  semester: 1 | 2
  academic_year_id: string
  scores: Record<string, number | null>
  extras: {
    berat_badan?: number | null
    tinggi_badan?: number | null
    sholat?: string | null
    hari_sakit?: number
    hari_izin?: number
    hari_alpa?: number
    hari_pulang?: number
    catatan?: string | null
  }
  musyrif_name: string | null
  created_at?: string
  updated_at?: string
}

export interface SemesterReportPayload {
  student_id: string
  report_type: SemesterType
  semester: 1 | 2
  academic_year_id: string
  scores: Record<string, number | null>
  extras: SemesterReport['extras']
  musyrif_name: string | null
  updated_by: string | null
}

export interface RaportStudent {
  id: string
  name: string
  registration_code: string
  gender: 'L' | 'P' | null
  dorm_id: string | null
  guardian_name: string | null
  dorms?: { name: string } | null
}

export interface RaportClass {
  id: string
  name: string
  grade: string | null
  homeroom_teacher_id: string | null
  homeroom_teacher?: { name: string } | null
  academic_year_id: string | null
}

export interface BehaviorItem {
  student_id: string
  points: number
  notes: string | null
  reported_at: string
  rule_name: string | null
}

export interface SchoolSettings {
  school_name: string
  school_address: string | null
  headmaster_name: string | null
  pengasuh_name: string | null
  color_primary: string
  color_secondary: string
}

// Baris raport yang sedang diedit di tabel input (gabungan skor + extras)
export interface MonthlyDraft {
  nilai_akhlak?: number | null
  nilai_ibadah?: number | null
  nilai_kebersihan?: number | null
  nilai_quran?: number | null
  nilai_bahasa?: number | null
  berat_badan?: number | null
  tinggi_badan?: number | null
  ziyadah?: string
  murojaah?: string
  total_hafalan?: string
  sholat?: string
  hari_sakit?: number
  hari_izin?: number
  hari_alpa?: number
  hari_pulang?: number
  catatan?: string
  pelanggaran?: string
  prestasi?: string
}

export interface SemesterDraft {
  scores: Record<string, number | null>
  berat_badan?: number | null
  tinggi_badan?: number | null
  sholat?: string
  hari_sakit?: number
  hari_izin?: number
  hari_alpa?: number
  hari_pulang?: number
  catatan?: string
}
