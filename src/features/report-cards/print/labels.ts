export const BULAN = [
  { id: 1, ar: 'يناير', id_str: 'Januari' },
  { id: 2, ar: 'فبراير', id_str: 'Februari' },
  { id: 3, ar: 'مارس', id_str: 'Maret' },
  { id: 4, ar: 'أبريل', id_str: 'April' },
  { id: 5, ar: 'مايو', id_str: 'Mei' },
  { id: 6, ar: 'يونيو', id_str: 'Juni' },
  { id: 7, ar: 'يوليو', id_str: 'Juli' },
  { id: 8, ar: 'أغسطس', id_str: 'Agustus' },
  { id: 9, ar: 'سبتمبر', id_str: 'September' },
  { id: 10, ar: 'أكتوبر', id_str: 'Oktober' },
  { id: 11, ar: 'نوفمبر', id_str: 'November' },
  { id: 12, ar: 'ديسمبر', id_str: 'Desember' },
] as const

export const MONTH_NAMES = BULAN.map((bulan) => bulan.id_str)

export const LIST_KAMAR = [
  { id: 'Fachruddin', ar: 'فخر الدين' },
  { id: 'Ibrahim', ar: 'إبراهيم' },
  { id: 'Ahmad Dahlan', ar: 'أحمد دحلان' },
  { id: 'Mas Mansyur', ar: 'ماس منصور' },
  { id: 'Buya Hamka', ar: 'بويا هامكا' },
]

export const toArabicNum = (value: string | number): string =>
  String(value).replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])

export const LABEL = {
  ar: {
    studentName: 'اسم الطالب',
    room: 'الغرفة',
    class: 'الفصل',
    year: 'العام الدراسي',
    subject: 'جوانب التقييم',
    score: 'النقاط',
    grade: 'التقدير',
    num: 'الرقم',
    weight: 'وزن البدن',
    height: 'طول البدن',
    ziyadah: 'الزيادة',
    murojaah: 'المراجعة',
    totalHafalan: 'المحفوظات',
    sick: 'للمرض',
    home: 'للرجوع',
    izin: 'الإذن',
    alpa: 'بلا إذن',
    gradeScale: 'نظام التقدير',
    musyrif: 'مربي الفصل',
    guardian: 'ولي الأمر',
    reportTitle: 'تقرير شهري',
    month: 'شهر',
    subjectLisan: 'المواد الدراسية',
    totalLisan: 'المجموع الإجمالي',
    avgLisan: 'المعدّل',
    guardianLisan: 'ولي الأمر',
    practicalTitle: 'الاختبار التطبيقي',
    practicalSubject: 'المواد التطبيقية',
    practicalPredicate: 'التقدير التطبيقي',
    gradeSystem: 'نظام التقدير',
    hafalanLisan: 'الحفظ',
  },
  id: {
    studentName: 'Nama Santri',
    room: 'Kamar',
    class: 'Kelas',
    year: 'Tahun Ajaran',
    subject: 'Aspek Penilaian',
    score: 'Nilai',
    grade: 'Predikat',
    num: 'No',
    weight: 'Berat Badan',
    height: 'Tinggi Badan',
    ziyadah: 'Ziyadah',
    murojaah: "Muroja'ah",
    totalHafalan: 'Hafalan',
    sick: 'Sakit',
    home: 'Pulang',
    izin: 'Izin',
    alpa: 'Alpa',
    gradeScale: 'Skala Penilaian',
    musyrif: 'Wali Kelas',
    guardian: 'Wali Santri',
    reportTitle: 'Rapor Bulanan',
    month: 'Bulan',
    subjectLisan: 'Mata Pelajaran',
    totalLisan: 'Jumlah Nilai',
    avgLisan: 'Rata-rata',
    guardianLisan: 'Orang Tua/Wali Murid',
    practicalTitle: 'Ujian Praktik',
    practicalSubject: 'Materi Praktik',
    practicalPredicate: 'Predikat Praktik',
    gradeSystem: 'Sistem Penilaian',
    hafalanLisan: 'Hafalan',
  },
} as const

export interface ReportLabelPair {
  id: string
  ar: string
}

export interface ReportLabels {
  section_physical: ReportLabelPair
  section_hafalan: ReportLabelPair
  section_attendance: ReportLabelPair
  catatan_label: ReportLabelPair
  total_label: ReportLabelPair
  avg_label: ReportLabelPair
  kkm_label: ReportLabelPair
  ujian_lisan_report: ReportLabelPair
  ujian_pondok_report: ReportLabelPair
  semester_ganjil: ReportLabelPair
  semester_genap: ReportLabelPair
  period_prefix_lisan: ReportLabelPair
  period_prefix_pondok: ReportLabelPair
  period_prefix_general: ReportLabelPair
  section_perilaku: ReportLabelPair
  pelanggaran_label: ReportLabelPair
  prestasi_label: ReportLabelPair
  sholat_label: ReportLabelPair
  report_number_prefix: string
}

export const DEFAULT_REPORT_LABELS: ReportLabels = {
  section_physical: { id: 'PERKEMBANGAN FISIK', ar: 'التطور البدني' },
  section_hafalan: { id: 'PERKEMBANGAN HAFALAN', ar: 'تطور الحفظ' },
  section_attendance: { id: 'ABSENSI', ar: 'الغياب' },
  catatan_label: { id: 'Catatan Wali Kelas', ar: 'ملاحظة' },
  total_label: { id: 'Jumlah Nilai', ar: 'المجموع الإجمالي' },
  avg_label: { id: 'Rata-rata', ar: 'المعدل' },
  kkm_label: { id: 'KKM', ar: 'KKM' },
  ujian_lisan_report: { id: 'Rapor Ujian Lisan', ar: 'تقرير الاختبار الشفهي' },
  ujian_pondok_report: { id: 'Rapor Ujian Tulis', ar: 'تقرير الاختبار التحريري' },
  semester_ganjil: { id: 'Ganjil', ar: 'الأول' },
  semester_genap: { id: 'Genap', ar: 'الثاني' },
  period_prefix_lisan: { id: 'Semester', ar: 'للفصل الدراسي' },
  period_prefix_pondok: { id: 'Semester', ar: 'للفصل الدراسي' },
  period_prefix_general: { id: 'Semester', ar: 'الفصل الدراسي' },
  section_perilaku: { id: 'KETERTIBAN', ar: 'ملاحظات السلوك' },
  pelanggaran_label: { id: 'Pelanggaran', ar: 'المخالفات' },
  prestasi_label: { id: 'Prestasi', ar: 'الإنجازات' },
  sholat_label: { id: 'Sholat', ar: 'الصلاة' },
  report_number_prefix: 'RPT',
}

export function getReportLabels(settings: {
  report_labels?: Partial<ReportLabels> | null
}): ReportLabels {
  return {
    ...DEFAULT_REPORT_LABELS,
    ...(settings.report_labels ?? {}),
  }
}
