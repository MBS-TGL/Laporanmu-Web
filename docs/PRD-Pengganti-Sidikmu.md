# PRD — Laporanmu sebagai Pengganti Sidikmu

> **Versi:** v1.1 (acuan build — boleh dikembangkan/di-improve selama build) · **Tanggal:** 9 November 2026
> **Sumber Sidikmu:** tangkapan layar (v1.0) + **audit read-only penuh `sidikmu-trace.md` (9 Nov 2026, role Kepala Sekolah, 1 login, 0 submit)** — SMP Muhammadiyah 4 Tanggul
> **Sumber Laporanmu:** inventarisasi langsung codebase (`src/features`, `supabase/migrations 0001–0019`)
> **Catatan cakupan audit trace:** satu role (Kepala Sekolah); halaman yang ditolak untuk role ini **tidak terverifikasi** (lihat Lampiran B). Belum ada contoh file ekspor Sidikmu (§13.3).

---

## 1. Ringkasan Eksekutif

Sidikmu v2.0 (aplikasi vendor) saat ini menangani **sisi akademik formal sekolah**: nilai & raport Kurikulum Merdeka, presensi, tabungan keuangan, SPMB (PPDB), CBT, BK, dan monitoring evaluasi guru. Laporanmu (aplikasi internal buatan sendiri, React + Supabase) sudah lebih kuat di **sisi kesekretariatan pondok**: poin perilaku + skorsing berbasis token wali, asrama, UKS, izin pulang, raport bulanan pondok, portal wali publik, dan broadcast WhatsApp.

PRD ini merencanakan ekspansi Laporanmu agar mencakup seluruh modul Sidikmu yang benar-benar dipakai, sehingga sekolah cukup menjalankan **satu sistem**. Strateginya adalah migrasi per modul yang mengikuti kalender akademik (deadline nyata: PTS/PAS dan musim SPMB), dengan paralel run singkat per modul sebelum Sidikmu dimatikan.

**Prinsip utama:**

1. **Replikasi perilaku, bukan replikasi fitur** — fitur Sidikmu yang setara di Laporanmu (pelanggaran, presensi, catatan siswa) tidak dibuat ulang; yang ada ditingkatkan.
2. **Pola yang sudah terbukti dipakai ulang** — token publik security-definer (dari skorsing), halaman publik + kartu portal, WA broadcast via Edge Function, impor CSV/Excel, audit log, RPC sebagai lapisan keamanan.
3. **Wali & santri tetap tanpa akun** — akses via PIN/token publik, sesuai pola yang sudah ada (`/check`, `/verify`, `/suspension/:token`). Ini pembeda penting dan menghemat manajemen akun.
4. **Modul berat ditunda secara sadar** — CBT dan instrumen BK kompleks (MBTI/Sosiometri) masuk fase akhir/opsional; face recognition tidak direplikasi.

**Estimasi total:** 4 fase kerja (± 1 kuartal kerja efektif, sizing solo-dev; lihat §7).

---

## 2. Latar Belakang & Tujuan

### 2.1 Masalah

- Dua aplikasi berjalan paralel: data siswa/ guru/ kelas diinput dan dirawat dua kali, angka sering tidak sinkron.
- Sidikmu berbasis vendor: kustomisasi terbatas, biaya berulang, data tersimpan di infrastruktur vendor (portabilitas perlu dicek).
- Modul Laporanmu (skorsing, UKS, izin pulang, WA broadcast) jauh lebih dalam daripada yang dimiliki Sidikmu, tetapi belum meng-cover kebutuhan harian guru akademik (input nilai, leger, presensi guru, tabungan).

### 2.2 Tujuan produk

| # | Tujuan | Cara mengukur |
|---|--------|----------------|
| T1 | Seluruh alur nilai → raport → leger → kenaikan kelas dikerjakan di Laporanmu | 100% kelas menginput nilai di Laporanmu pada PTS/PAS berikutnya |
| T2 | Wali mendapat laporan lengkap via satu portal | Poin + nilai + presensi + tabungan + izin tersedia di `/check` |
| T3 | Keuangan tabungan santri pindah ke Laporanmu | Mutasi tabungan terekam 100% di Laporanmu, saldo awal dimigrasi |
| T4 | SPMB tahun ajaran berikutnya jalan di Laporanmu end-to-end | Pendaftar → OTP WA → seleksi → hasil → menjadi data siswa (tanpa input ulang) |
| T5 | Sidikmu berhenti dipakai (lisensi dicabut) | Tidak ada aktivitas login di Sidikmu selama 1 bulan penuh |

### 2.3 Non-tujuan (out of scope)

- Membuat LMS/e-learning penuh atau aplikasi ujian berbasis AI proctoring.
- Multi-tenancy antar sekolah (satu institusi saja).
- Migrasi riwayat nilai historis dari Sidikmu secara lengkap (disarankan fresh-start per tahun ajaran; lihat §10).

---

## 3. Inventaris Sidikmu (as-is)

Berdasarkan tangkapan layar (v1.0) **dan audit trace read-only** (`sidikmu-trace.md`). Status per halaman (AKSES/DITOLAK/404/RUSAK) untuk role Kepala Sekolah ada di **Lampiran B**; halaman rusak di **Lampiran C**. Fitur yang belum terverifikasi ditandai eksplisit.

| Domain | Modul yang terlihat |
|--------|---------------------|
| **Master** | User, Setting Presensi (Dashboard, Titik Lokasi QRCode geofence + notifikasi WA walas/ortu, Shift Presensi, Data Presensi Mesin), Face Recognition (Registrasi Wajah jalan dengan AI · **Data Wajah 404**), Pendidikan (Batas Semester, Kelas, Siswa), Jadwal & Pelajaran (Mata Pelajaran, Jam Pelajaran), Ekstrakurikuler, Kepegawaian (Data Pegawai ±21 field, Wali Kelas), Jadwal & Materi ICP, Materi Praktek (Range Nilai, BTA, Wudhu, Sholat, Hafalan), Kokurikuler (Pengaturan, Dimensi 8 baris, Kegiatan), 7 KAIH (Master 7+15 baris, Data Rekap 167 baris), Pembagian Kelas, Deskripsi CP, Deskripsi TP, Rekap Prestasi |
| **Akademik / Nilai** | Input Nilai Formatif, Input Nilai Sumatif, Edit Nilai Kurmer, Input/Edit Nilai ICP, Monitoring Nilai KM (kolom: Kelas\|Mapel\|Aspek\|Jenis\|Kategori\|Nilai Ke\|Siswa Aktif\|Tercatat\|**Selisih**\|**Status**), Generate Nilai (Generate \| Reset per TA/Semester), Penilaian Kokurikuler, Nilai KM, Nilai Ekstrakurikuler, Prestasi Siswa, Peringkat Siswa, Catatan Siswa, Raport PTS, Raport PAS, Kenaikan Kelas (Naik/Tinggal per baris), Arsip Nilai (DKN Kurmer + Export Excel). **Bobot default:** Formatif 30 · Sumatif 20 · Sum. Tengah 20 · Sum. Akhir 30 (tampil di home; **tidak ada field bobot di input**; progress pengisian per kelas/mapel — tangkapan layar: 59% completed). **Presensi Per Mapel = 404.** Pola input: filter 2 tahap (`Proses Selanjutnya` dulu → tabel) |
| **Presensi** | Dashboard Presensi (`dashboard_presensi.php`: Scan QR/Tempel RFID, log realtime, Tes Suara, sinkron server), Input/Data Presensi Siswa, **Data Presensi Mesin** (169 baris: total scan/datang/pulang, telat), Setting Presensi (Shift + QRPoint geofence), Face Recognition |
| **Keuangan** | **Modul rusak untuk role Kepsek** — dashboard fatal SQL (`Unknown column 'file_bukti'`); yang terlihat hanya: Tabungan Siswa (Masuk/Keluar/Data — halaman kosong), Tabungan Non Siswa, Master Data (Rekening, Satuan, Pos Penerimaan/Pengeluaran, Kewajiban, Suplier — sebagian kosong/DITOLAK), Master RAPBS, Transaksi Tunai/Bank, Data Transaksi, Laporan. **Kartu PIN Transaksi** ("Atur PIN pembayaran") = kartu home **tanpa href/aksi — klik tidak berpindah**. **Tidak ada "Money Nilai"/SPP/tagihan** (tidak ditemukan di seluruh menu — lihat §11) |
| **Monev Guru** | Materi & Perangkat (kartu statistik: request/guru hadir/tidak hadir/persentase + "Data Materi Hari Ini"), Index Penilaian, Analisis Nilai Mapel, Buku Induk KurMer (14 baris + Buka Portofolio), Request Guru Pengganti (filter status+tanggal, approval, Export), Pantau Guru Kelas (grid realtime per kelas), Setting Jam, Data Guru & Jadwal, Laporan Monev Guru (Prosentase Kinerja, Presensi Umum/by Bulan/by Nama, Presensi By Jadwal) |
| **SPMB** | Input Formulir (**±55 field** — lihat Lampiran A), Data Formulir, Data Calon Siswa (Terima sbg siswa / Batalkan Verifikasi), Data Unregister (Re-register), Data Hasil Seleksi (Excel/Print), Data Sarana & Rekap Sarana, Data Rekomendasi (**rusak** — isinya PHP warning), Informasi Umum/Dokumen/Pendaftaran + Proses Seleksi + Jadwal SPMB (editor "Kelola Informasi PPDB"), Master. **OTP publik `/spmb`: 6 digit via WhatsApp** (`registrasi.php`: "Isi Nomor WhatsApp untuk menerima kode verifikasi"); verifikasi no registrasi/NIK/NISN/no HP |
| **CBT** | Deskripsi CP, Upload File (Bank Media Audio), Input Soal (PG, PG Multi, True-False, Matching, Essay, Polygon Hotspot, Video Reaction), Bank Soal, Setting Ujian (proctor, jumlah+nilai per jenis soal × Mudah/Sedang/Sulit, start/stop datetime), Data Ujian Aktif/Belum/Selesai/Master. **Masuk siswa: `/cbt` = Username (NIS) + Password (Kode Ujian) → "Mulai Ujian"** (tanpa akun); admin memantau **Token Pending** + grafik pelanggaran real-time |
| **BK** | Pengaturan & Poin (Kategori Pelanggaran, Tingkat Sanksi/SP — belum diuji), Pelanggaran Siswa (Catat Pelanggaran), Prestasi Siswa (**404**), Rekap Poin Siswa, Data Presensi Mesin, Data Presensi (PHP warning), Konseling Individu/Kelompok, Bimbingan Kelompok/Klasikal, Home Visit, AKPD (Angket, Hasil), Sosiometri (Angket, Hasil), MBTI (Angket, Hasil), Surat Panggilan Ortu, Surat Peringatan/Perjanjian (**Surat Pujian TIDAK ADA**), Laporan Rekap BK, dashboard analisis BK (filter 2 tanggal, proporsi kategori, top-5 pelanggaran, top-5 poin). **Modul TPA** (belum tercatat di v1.0): Input Soal TPA (7 jenis), Setting Ujian TPA, Bank Soal TPA, Hasil TPA (Aktif/Belum/Selesai), Upload File Audio, Kategori Materi. **15 halaman inti DITOLAK untuk role Kepsek** (Lampiran B); Data User = `href=#` |

---

## 4. Kondisi Laporanmu Saat Ini (as-is)

### 4.1 Yang sudah ada dan kuat

| Modul | Status terhadap Sidikmu |
|-------|--------------------------|
| Master data siswa/guru/kelas/asrama/tahun ajaran | ✅ Lengkap, bahkan lebih (arsip, alumni, kelulusan, kartu QR, impor/ekspor) |
| Poin perilaku (aturan + catatan) | ✅ Setara "Pelanggaran Siswa + Rekap Poin" Sidikmu |
| Skorsing + token wali publik + tugas + followup | ✅ **Tidak ada di Sidikmu** |
| Raport bulanan pondok (skala 1–9) & semester pondok | ✅ **Tidak ada di Sidikmu** |
| Raport semester umum (0–100, KKM 50) | ⚠️ Ada strukturnya, tapi mata pelajaran **hardcode di `raport/constants.ts`** — belum ada tabel mapel, belum ada nilai per jenis ulangan |
| Presensi santri harian per kelas/bulan (H/S/I/A/P) | ⚠️ Setara "Presensi Siswa" Sidikmu (tanpa sesi/jam) |
| BK log konseling (kategori, urgensi) | ⚠️ Setara "Konseling Individu" saja |
| Izin pulang + gate log + kartu QR | ✅ Lebih dari Sidikmu |
| UKS + stok obat | ✅ **Tidak ada di Sidikmu** |
| Pengumuman + portal publik + WA broadcast (Fonnte Edge Function) | ✅ Setara / lebih |
| Portal wali `/check` — poin, raport bulanan, **presensi H/S/I/A/P 3 bulan + status skorsing** | ✅ Sudah masuk RPC `check_student` (0019_portal_wali) — tinggal nilai akademik, saldo tabungan, izin |
| Audit log, RBAC 5 role, impor siswa CSV/XLSX | ✅ Fondasi siap |

### 4.2 Yang belum ada sama sekali (gap utama)

Tabel mata pelajaran, jadwal pelajaran, pembagian kelas per mapel, nilai akademik per jenis (formatif/sumatif/PTS/PAS), leger & peringkat, kenaikan kelas, presensi guru + guru pengganti, tabungan, SPMB, CBT, surat resmi BK, instrumen BK lanjutan, ekstrakurikuler & prestasi terstruktur.

### 4.3 Batasan teknis yang harus diangkat

- **Tidak ada Storage bucket** (foto skorsing disimpan base64 di DB — pola ini tidak boleh diteruskan ke dokumen SPMB/materi/audio CBT).
- **Tidak ada realtime** (wajib untuk monitoring CBT & dashboard presensi live).
- **RBAC belum granular** — 5 role global; belum ada konsep "wali kelas dari kelas X" atau "guru mapel Y kelas Z".
- Skema raport semester berbasis **jsonb dengan kriteria hardcode** — perlu restrukturisasi ke tabel mapel sebelum fitur nilai dibangun.

### 4.4 Kualitas vendor Sidikmu (bahan komunikasi ke pemilik sekolah)

Temuan audit trace 9 Nov 2026 (role Kepsek) — modul inti yang **rusak/tidak berfungsi di sisi vendor sendiri**:

- **Keuangan hampir mati total**: fatal SQL di dashboard (`home_keuangan.php`, kolom `file_bukti` tidak ada di schema), 2 halaman ACCESS DENIED, 5 halaman transaksi kosong.
- **3× 404** pada menu yang terpasang (Presensi Per Mapel, Data Wajah, BK Prestasi Siswa).
- **PHP warning** `headers already sent` & `Undefined array key "skelaswali"` di banyak halaman; Data Rekomendasi SPMB isinya warning saja.
- **15 halaman BK** ditolak untuk role Kepala Sekolah sendiri (termasuk Surat & Konseling) — tanpa konfigurasi izin yang jelas.
- **Kartu PIN Transaksi** di home tidak punya aksi (dead UI).

Daftar lengkap: **Lampiran C**. Implikasi: cut-over per modul jadi lebih mendesak; sementara modul yang masih jalan (Akademik, Master, CBT, SPMB) tetap dipakai sampai gantinya siap.

---

## 5. Matriks Gap Analysis

Legenda status: ✅ sudah ada · 🟡 sebagian/perlu ditingkatkan · ❌ belum ada. Prioritas: **P0** fondasi+akademik inti · **P1** operasional harian · **P2** pelengkap/opsional.

| # | Domain Sidikmu | Status | Prioritas | Strategi |
|---|----------------|--------|-----------|----------|
| 1 | Master: User, Pegawai, Pembagian Kelas | ✅/🟡 | P0 | Sudah ada; tambah tabel `subjects` + `class_subjects` (guru mapel per kelas) + role wali kelas |
| 2 | Deskripsi CP/TP, Kurikulum, 7 KAIH, ICP, Kokurikuler | ❌ | P2 | Buat sebagai *bank deskriptor* konfigurable per mapel/fase; ICP & kokurikuler = kriteria nilai tambahan yang bisa diaktifkan/nonaktifkan |
| 3 | Nilai Formatif/Sumatif/Kurmer/ICP + Monitoring/Generate Nilai | ❌ | **P0** | Modul baru "Penilaian": input per kelas per mapel per jenis; bobot konfigurable (default 30/20/20/30); progress pengisian per mapel |
| 4 | Raport PTS/PAS + Arsip Nilai | 🟡 | **P0** | Restrukturisasi raport semester "umum" ke tabel mapel; leger otomatis; arsip sudah ada |
| 5 | Peringkat Siswa, Kenaikan Kelas | ❌ | **P0** | Peringkat dihitung dari leger; kenaikan kelas = proses batch naik/kelas ulang/tidak lulus (pola RPC `graduate_students`) |
| 6 | Prestasi Siswa, Nilai Ekstrakurikuler | ❌ | P1 | Prestasi = catatan poin positif + tabel prestasi (tingkat: sekolah…nasional); ekskul = roster + nilai predikat untuk raport |
| 7 | Presensi Siswa + Dashboard Presensi + Setting/Mesin Presensi | 🟡 | P1 | Yang ada cukup; tambah dashboard rekap live per kelas + integrasi gate scan QR (opsional). Face recognition **tidak direplikasi** |
| 8 | Keuangan: Tabungan + PIN Transaksi | ❌ | **P1** | Modul baru: buku tabungan per santri, setor/tarik, PIN petugas, mutasi + cetak; saldo awal dimigrasi. **(Modul Keuangan Sidikmu sendiri rusak — cut-over jadi lebih mendesak)** |
| 9 | Monev Guru: kehadiran, guru pengganti, Setting Jam, Data Materi | ❌ | P1 | Presensi guru harian (hadir/sakit/izin/tugas luar) + alur request guru pengganti dengan approval; upload materi per jadwal (bukan LMS) |
| 10 | Analisis Nilai Mapel, Buku Induk KurMer, Index Penilaian | ❌ | P1 | Turunan otomatis dari data nilai P0 — laporan per mapel/kelas/guru, buku induk = profil siswa + riwayat nilai |
| 11 | BK: Pelanggaran/Prestasi/Rekap Poin | ✅ | — | Sudah ada; hanya perlu dashboard analisis (top-5, proporsi kategori, filter tanggal) |
| 12 | BK: Konseling Individu/Kelompok, Bimbingan Klasikal, Home Visit | 🟡 | P1 | Perluas `counseling_logs` dengan jenis layanan + peserta (individu/kelompok/kelas) |
| 13 | BK: AKPD, Sosiometri, MBTI | ❌ | P2 | Instrumen formulir generik (bank pertanyaan + skoring sederhana); **opsional** — konfirmasi intensitas pemakaian. *Catatan trace: semua halaman ini ditolak untuk Kepsek (Lampiran B) — indikasi pemakaian hanya oleh konselor* |
| 14 | BK: Surat Panggilan/Peringatan (Pujian = value-add baru, tidak ada di Sidikmu) | ❌ | **P1** | Template surat + nomor surat + cetak + **token verifikasi QR** (pakai pola `/verify`). *Trace: Sidikmu hanya punya Panggilan + Peringatan/Perjanjian* |
| 15 | SPMB (PPDB) end-to-end | ❌ | **P1** | Formulir publik + OTP WA **6 digit** + seleksi bertahap + informasi publik + dashboard; lulus → otomatis masuk `students` |
| 16 | CBT (bank soal, ujian token, monitoring) | ❌ | P2 | Modul terbesar & paling berat operasionalnya; bangun belakangan; masuk siswa terkonfirmasi: `/cbt` = NIS + Kode Ujian (tanpa akun) |
| 17 | E-learning / Materi Praktek | ❌ | P2 | Cukup upload materi per jadwal di monev guru (#9); LMS penuh tidak dibuat |
| 18 | BK TPA (bank soal/setting ujian/hasil TPA) | ❌ | P2 | Modul TPA di BK (7 jenis soal) — **konfirmasi intensitas pemakaian dulu** sebelum dibangun; jika dipakai, ikut modul CBT (#16) |

---

## 6. Fitur yang Diusulkan (Detail)

Format per modul: Deskripsi → User story kunci → Skema data → Reuse pattern.

### 6.1 Fondasi: Mapel, Pembagian Kelas, RBAC (P0, effort M)

**Deskripsi.** Tabel mata pelajaran menjadi tulang punggung seluruh modul akademik. Pembagian kelas = siapa mengajar mapel apa di kelas apa.

**User story kunci.**
- Sebagai admin, saya mengelola daftar mapel (kode, nama, kelompok KurMer A/B, KKM, fase).
- Sebagai admin, saya menetapkan guru pengampu per mapel per kelas per tahun ajaran.
- Sebagai wali kelas, saya hanya melihat kelas yang saya amanakan (untuk raport/leger).
- Sebagai guru, saya hanya bisa menginput nilai pada mapel+kelas yang saya amanakan.

**Skema.** `subjects` (name, code, kelompok, kkm, fase, kurikulum) · `class_subjects` (class_id, subject_id, teacher_id, academic_year_id, kkm_override) — sumber RLS granular.

**RBAC.** Tambah enum role: `kepala_sekolah` (read-all + approval), `tukeu` (keuangan), `operator_spmb`. Konsep **wali kelas & guru mapel bukan role, tapi relasi data** (`classes.homeroom_teacher_id` sudah ada; `class_subjects` baru). Helper RLS baru: `is_homeroom_teacher(class_id)`, `is_class_subject_teacher(...)`.

**Reuse:** soft-delete + partial unique index (konvensi migration existing), audit log, impor mapel via CSV.

---

### 6.2 Penilaian Akademik (P0, effort XL — modul terbesar Fase 1)

**Deskripsi.** Pengganti langsung "Input Nilai Formatif/Sumatif/Kurmer". Guru menginput nilai per kelas per mapel per jenis penilaian; sistem menghitung nilai raport dan progress.

**User story kunci.**
- Sebagai guru, saya memilih kelas→mapel→jenis penilaian, lalu input grid nilai per santri (satu layar, seperti pola grid absensi yang sudah ada).
- Sebagai guru, saya melihat progress pengisian nilai mapel saya (persen terisi, seperti "59% completed" di Sidikmu).
- Sebagai kepala sekolah, saya melihat progress pengisian semua kelas/mapel/guru (Monitoring Nilai).
- Sebagai sistem, nilai raport dihitung otomatis: `formatif×30% + sumatif×20% + PTS×20% + PAS×30%` dengan bobot konfigurable per tahun ajaran.
- Sebagai guru, saya bisa "Generate Nilai" → sistem mengisi rapor semester dari rata-rata nilai terboboti (bisa di-overwrite manual).

**Skema.** `grade_configs` (academic_year_id, bobot jsonb default `{formatif:30,sumatif:20,pts:20,pas:30}`) · `assessments` (class_subject_id, type: formatif/sumatif/pts/pas/icp, title, date, max_score) · `assessment_scores` (assessment_id, student_id, score) — detail per ulangan, lalu agregat ke rapor.

**Keputusan penting.** Raport semester "umum" yang sekarang menyimpan skor di `jsonb` dengan mapel hardcode **dimigrasi** ke struktur berbasis `subjects`. Nilai ICP/kokurikuler/ekskul/KAIH dibuat sebagai **kriteria tambahan yang bisa diaktifkan** (mapping ke enum type), bukan modul terpisah — sesuai prinsip "konfigurasi, bukan hardcode".

**Reuse:** pola grid input + upsert bulk (attendance), sync otomatis antar laporan (syncAttendanceToRaport), audit log untuk perubahan nilai (edit nilai pasca-lock harus tercatat — setara "Edit Nilai Kurmer" Sidikmu), `is_locked` tahun ajaran untuk freeze nilai.

---

### 6.3 Leger, Peringkat, Kenaikan Kelas (P0, effort M)

**Deskripsi.** Leger = matriks santri × mapel untuk satu semester, dihitung dari penilaian. Peringkat = sorting leger. Kenaikan kelas = proses batch akhir tahun.

**User story kunci.**
- Sebagai wali kelas, saya melihat/mencetak leger kelas saya + peringkat + rata-rata.
- Sebagai kepala sekolah, saya memproses kenaikan kelas per kelas: naik / tinggal kelas / tidak lulus (dengan nilai akhir sebagai acuan), lalu sistem membuat pembagian kelas tahun berikutnya.
- Sebagai admin, kenaikan kelas otomatis memindahkan `students.class_id` dan mengarsipkan riwayatnya.

**Skema.** `student_grade_summary` (view atau tabel materialisasi) · `class_promotions` (from_class, student_id, decision, target_class_id, academic_year_id).

**Reuse:** pola RPC batch `graduate_students` (0018) & pindah kelas massal di `StudentsPage`.

---

### 6.4 Jadwal, Presensi Guru & Guru Pengganti (P1, effort L)

**Deskripsi.** Jadwal pelajaran per kelas (jam ke-, hari) menjadi referensi presensi guru dan "Materi Hari Ini".

**User story kunci.**
- Sebagai admin, saya atur jam belajar (Setting Jam) + jadwal per kelas per hari dari `class_subjects`.
- Sebagai guru, saya presensi diri (hadir/sakit/izin/tugas luar) atau staff merekapnya; dashboard kepala sekolah menampilkan persentase kehadiran guru, guru tidak hadir hari ini (seperti dashboard Monev Sidikmu).
- Sebagai admin, saya memproses Request Guru Pengganti: guru mengajukan, kepala sekolah approve, sistem menandai jadwal tergantikan.
- Sebagai guru, saya upload materi/perangkat per sesi jadwal (Storage bucket) sehingga "Data Materi Hari Ini" bisa dicari & diunduh.

**Skema.** `schedules` (class_subject_id, day, period_start/end, room) · `time_slots` (jam mulai/selesai per jam ke) · `teacher_attendance` (teacher_id, date, status, note, source) · `substitution_requests` (schedule_id, date, reason, substitute_teacher_id, status pending/approved/rejected/done) · `teaching_materials` (schedule_id, title, file_path).

**Reuse:** dashboard card pattern, audit log, WA broadcast untuk notify guru pengganti.

---

### 6.5 Keuangan: Tabungan Santri (P1, effort L)

**Deskripsi.** Buku tabungan per santri: setoran & penarikan, mutasi, saldo, cetak buku. Pengganti "Tabungan + PIN Transaksi" Sidikmu.

**User story kunci.**
- Sebagai petugas keuangan (role `tukeu`), saya input setoran/tarikan per santri; saldo dihitung dari transaksi (bukan diinput manual).
- Sebagai petugas, setiap transaksi butuh **PIN transaksi** (konsep Sidikmu) — PIN petugas keuangan, disimpan hash.
- Sebagai wali, saldo + 10 mutasi terakhir muncul di portal `/check`.
- Sebagai petugas, saya mengimpor saldo awal dari ekspor Sidikmu (CSV) sekali saat cut-over.

**Skema.** `savings_accounts` (student_id unique, opened_at, status) · `savings_transactions` (account_id, type setor/tarik, amount, balance_after, note, recorded_by, occurred_at) — immutable seperti `gate_logs`.

**Reuse:** pola PIN portal santri (`students.pin` — dibenahi ke hash), RPC security-definer, audit log, print/preview pattern dari raport.

---

### 6.6 BK Lanjutan: Layanan & Surat Resmi (P1, effort M)

**Deskripsi.** Dua peluasan: (a) jenis layanan konseling — individu, kelompok, klasikal, home visit — dengan peserta; (b) surat resmi berNomor Surat: panggilan orang tua, peringatan (dua ini ada di Sidikmu), **pujian (value-add baru — tidak ada di Sidikmu)**, dengan cetak + QR verifikasi publik.

**User story kunci.**
- Sebagai konselor, saya catat sesi kelompok (pilih beberapa santri) atau klasikal (pilih kelas), bukan hanya individu.
- Sebagai konselor, saya terbitkan Surat Panggilan Ortu dari sebuah catatan pelanggaran → nomor surat otomatis → cetak → wali memverifikasi keaslian surat via QR/`/verify`.
- Sebagai kepala sekolah, saya melihat dashboard analisis BK: proporsi kategori, top-5 pelanggaran, tren per periode (setara dashboard BK Sidikmu).

**Skema.** Perluasan `counseling_logs` (+service_type, +participants jsonb ATAU tabel `counseling_participants`) · `letters` (student_id, type panggilan/peringatan/pujian, letter_no, body_template, related_report_id, verify_token_hash).

**Reuse:** `point_rules`/`reports` (sudah ada), pola token sha256 + rate limit (skorsing), `/verify` page, template WA untuk pemberitahuan ortu (sudah ada template "laporan perilaku").

**Instrumen AKPD/Sosiometri/MBTI (P2, opsional):** dibuat sebagai formulir generik (bank pertanyaan + skala + rekap) bila ternyata benar-benar rutin dipakai — konfirmasi dulu, jangan dibangun spekulatif.

---

### 6.7 SPMB / PPDB (P1, effort L — deadline musiman)

**Deskripsi.** Penerimaan murid baru end-to-end: formulir publik, verifikasi OTP via WA, seleksi bertahap, pengumuman hasil, dan kelulusan → otomatis menjadi data siswa.

**User story kunci.**
- Sebagai calon siswa/orang tua, saya mengisi formulir publik di landing page (kartu portal baru "SPMB"), menerima nomor registrasi, dan memverifikasi nomor HP via **OTP WhatsApp 6 digit** (Sidikmu: `/spmb` + `registrasi.php` — "Isi Nomor WhatsApp untuk menerima kode verifikasi"; Fonnte sudah terintegrasi).
- Sebagai operator SPMB (role baru), saya memantau pendaftar (hari ini/minggu ini/total, OTP verified/pending, tren, demografi — setara dashboard SPMB Sidikmu).
- Sebagai operator, saya memindahkan calon antar tahap seleksi (administrasi → tes → wawancara → hasil), merekam hasil seleksi & rekomendasi, dan memproses unregister.
- Sebagai operator, saya mempublish informasi SPMB (umum, dokumen, jadwal) sebagai halaman publik.
- Sebagai operator, calon yang diterima dinyatakan "diterima & mendaftar" → ter-generate sebagai `students` dengan kode registrasi + PIN portal (integrasi T4 di §2).

**Skema.** `admissions` (registration_no, name, gender, birth, asal_sekolah, parent data, phone, status: baru/otp_verified/seleksi/lulus/tidak_lulus/unregister/daftar_ulang, stage history) · `admission_documents` (storage path, type) · `admission_settings` (period tahun ajaran, kuota, jadwal seleksi, is_open) · `admission_stages`/results. **Daftar field lengkap formulir Sidikmu (±55 field) → Lampiran A** (referensi desain kolom; boleh disederhanakan saat build).

**Reuse (kuat sekali):** halaman publik + PortalCard, RPC security-definer + rate limit, Edge Function Fonnte (OTP 6 digit), announcements `is_public`, impor/ekspor CSV, audit log.

---

### 6.8 CBT (P2, effort XL — opsional, fase terakhir)

**Deskripsi.** Ujian berbasis komputer: bank soal, ujian dengan token, pelaksanaan siswa tanpa akun (masuk via token ujian), monitoring real-time.

**User story kunci.**
- Sebagai guru, saya mengelola bank soal (PG + esai, gambar/audio via Storage) dan menyusun paket ujian dari bank soal (durasi, acak soal/opsi, token aktif).
- Sebagai santri, saya membuka halaman publik `/cbt` (atau `/:token`), memasukkan **NIS + Kode Ujian** (konsep Sidikmu: Username = NIS, Password = Kode Ujian), dan mengerjakan; jawaban tersimpan otomatis (autosave).
- Sebagai pengawas, saya melihat monitor real-time: belum mulai / sedang / selesai (Supabase Realtime), termasuk log anomali (ganti tab/fokus hilang — setara "Grafik Pelanggaran Ujian" Sidikmu).
- Sebagai sistem, PG dinilai otomatis; esai dinilai guru di layar koreksi.

**Skema.** `question_banks` · `questions` (type, options jsonb, answer_key, media) · `exams` (class_subject_id, config jsonb, status draft/token aktif/selesai) · `exam_participants` (exam_id, student_id, token, started/finished, status) · `exam_answers` (participant_id, question_id, answer, is_correct, score) · `exam_anomalies`.

**Risiko spesifik.** Butuh jaringan lab yang stabil + perangkat; real-time adalah infrastruktur baru; autentikasi tanpa akun untuk ujian rawan (token = kartu peserta). **Rekomendasi: bangun hanya jika CBT benar-benar akan dipakai pada semester berjalan** — kalau masih jarang, tetap pakai Sidikmu modul CBT lebih lama atau lakukan ujian konvensional. Ini keputusan dengan ROI paling rendah di seluruh PRD.

---

### 6.9 Portal Wali & Notifikasi (P1, effort M — pengikat semua modul)

**Deskripsi.** `/check` diperluas dari "cek poin" menjadi **portal wali satu pintu**: poin perilaku + raport bulanan (sudah ada) + nilai akademik & rapor semester + presensi + saldo tabungan + izin pulang + surat terbit. Ditambah notifikasi WA event-driven (bukan hanya broadcast manual).

**User story kunci.**
- Sebagai wali, satu PIN (kode registrasi) membuka semua informasi putra/putri saya, dalam bentuk kartu ringkas.
- Sebagai sistem, WA otomatis terkirim pada event penting: nilai semester terbit, skorsing terbit (sudah ada), izin pulang diterbitkan (telepon sudah direkam), surat panggilan terbit, saldo tabungan masuk.
- Sebagai admin, saya mengatur event mana yang mengirim WA (biaya/kewajaran notifikasi).

**Reuse:** CheckPage + RPC `check_student`, wa.ts templates + BroadcastModal, Edge Function Fonnte (perluas untuk single-send event-driven).

---

## 7. Roadmap Bertahap

Anchoring pakai kalender akademik, bukan kalender biasa. Sizing solo-dev: S <1 minggu · M 1–2 · L 2–4 · XL >4.

| Fase | Scope | Effort | Deadline kalender | Kriteria keluar (exit) |
|------|-------|--------|-------------------|------------------------|
| **0 — Fondasi** (S–M, ±2 mgg) | Tabel mapel + class_subjects + pembagian kelas; role baru & helper RLS; Storage bucket; restrukturisasi kriteria raport umum ke mapel | M | Segera (pondasi semua fase) | Guru mapel bisa ditetapkan; migrasi data master dari ekspor Sidikmu selesai |
| **1 — Akademik Nilai** (P0) | Penilaian formatif/sumatif/PTS/PAS + monitoring progress; rapor semester berbasis mapel + generate nilai; leger + peringkat; kenaikan kelas | XL | **Sebelum PTS/PAS terdekat** | 1 kelas pilot input nilai end-to-end → cetak rapor & leger tanpa Sidikmu |
| **2 — Operasional Harian** (P1) | Jadwal + presensi guru + guru pengganti + upload materi; tabungan + PIN; dashboard analisis BK + surat resmi; perluasan konseling | L | Selesai sebelum semester genap berjalan stabil | Kepala sekolah melihat kehadiran guru & progress nilai; tukeu bertransaksi tabungan harian |
| **3 — Portal & SPMB** (P1) | Portal wali satu pintu + notifikasi WA event; SPMB end-to-end + dashboard SPMB + informasi publik | L | **Sebelum buka SPMB** (musim Feb–Mei) | Calon bisa mendaftar → OTP WA → lulus → masuk data siswa tanpa input ulang |
| **4 — Pelengkap/Opsional** (P2) | CBT; instrumen AKPD/Sosiometri/MBTI; ekskul & prestasi terstruktur; deskriptor CP/TP; dashboard kepala sekolah peran-berbasis | XL (CBT) | Setelah SPMB / tahun berikutnya | Sesuai keputusan review ulang |

**Strategi cut-over per modul:** paralel run 2–4 minggu per modul (input di Laporanmu, Sidikmu masih baca-saja cadangan) → Sidikmu di-freeze untuk modul tsb → modul berikutnya. Sidikmu diputuskan mati total hanya setelah: fase 1–3 selesai **dan** satu siklus penuh (PAS + SPMB) berjalan di Laporanmu.

**Urutan prioritas bila kapasitas terbatas:** 6.1 → 6.2 → 6.3 (garis nilai-raport) → 6.5 (tabungan, paling diminta petugas) → 6.4 → 6.7 → 6.6 → 6.9 → 6.8.

---

## 8. Skema Data Baru — Ringkasan

± 18 tabel baru / perluasan (semua mengikuti konvensi existing: `deleted_at`, trigger `updated_at`, partial unique index, RLS + helper, audit log):

| Kelompok | Tabel |
|----------|-------|
| Akademik | `subjects`, `class_subjects`, `grade_configs`, `assessments`, `assessment_scores`, `class_promotions`, `time_slots`, `schedules` |
| Guru | `teacher_attendance`, `substitution_requests`, `teaching_materials` |
| Keuangan | `savings_accounts`, `savings_transactions` |
| BK | `counseling_participants` (atau kolom), `letters` |
| SPMB | `admissions`, `admission_documents`, `admission_settings`, `admission_stage_logs` |
| CBT (P2) | `question_banks`, `questions`, `exams`, `exam_participants`, `exam_answers`, `exam_anomalies` |
| Migration enum | `app_role` += `kepala_sekolah`, `tukeu`, `operator_spmb` (+ helper RLS `is_homeroom_teacher`, `is_class_subject_teacher`) |

**Restrukturisasi:** `student_semester_reports.scores` (jsonb hardcode) → tabel mapel. Nilai historis pondok (bulanan) **tidak disentuh** — formatnya tetap relevan.

---

## 9. Keputusan Teknis

1. **Storage bucket Supabase diaktifkan** — untuk dokumen SPMB, materi guru, media soal CBT. Base64-in-DB (pola foto skorsing) tidak diteruskan; pertimbangkan memigrasi yang lama juga.
2. **Supabase Realtime diaktifkan** — untuk monitoring CBT & dashboard presensi live. Mulai dari scope kecil (exam_participants + teacher_attendance hari ini).
3. **Autentikasi tetap dua-lapis:** staff = akun Supabase; wali/santri = PIN/token publik dengan RPC security-definer + rate limit (pola skorsing). Token CBT & token verifikasi surat memakai pola identik.
4. **Konfigurasi di atas hardcode:** bobot nilai, kriteria rapor, jenis penilaian tambahan (ICP/kokurikuler), template surat — semuanya tabel konfigurasi, bukan konstanta TS.
5. **RLS granular berbasis relasi:** wali kelas/guru mapel dicek lewat relasi `classes`/`class_subjects`, bukan role baru — menghindari ledakan jumlah role.
6. **Audit trail untuk nilai:** setiap perubahan nilai pasca-sinkronisasi rapor dicatat (setara "Edit Nilai Kurmer" Sidikmu, tapi teraudit).

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Format rapor KurMer/ICP berubah tiap tahun (kebijakan) | Skema nilai salah bentuk | Bobot & kriteria di tabel konfigurasi; pilot 1 kelas sebelum rollout penuh |
| Ekspor data Sidikmu tidak lengkap/berformat aneh | Migrasi kotor | Migrasi hanya: master data + saldo tabungan + data siswa aktif. Nilai historis fresh-start per tahun ajaran |
| Resistensi guru (interface baru saat musim input nilai) | Input nilai mentok | Grid input satu-layar ala absensi; sesi pelatihan singkat; masa paralel run; progress monitoring per guru terlihat kepala sekolah |
| Data anak & sensitif (PIN, tabungan, dokumen SPMB) | Keamanan/privasi | RLS ketat, PIN hash, token sha256 + rate limit, audit log semua modul, dokumen di Storage dengan policy private + signed URL |
| CBT jaringan/perangkat lab tidak andal | Ujian kacau | CBT di-P2; fallback ujian kertas; autosave jawaban; token per-sesi |
| Kapasitas solo-dev meleset dari deadline kalender | Modul ketinggalan musim | Prioritas hard (§7); modul yang meleset tetap jalan di Sidikmu 1 siklus lagi — bukan kegagalan |
| OTP/WA bergantung Fonnte (rate limit, biaya) | SPMB & notifikasi terganggu | Antrean + delay (pola edge function existing), fallback tampilkan OTP di dashboard operator |

---

## 11. Yang Sengaja TIDAK Direplikasi (keputusan sadar)

| Fitur Sidikmu | Keputusan | Alasan |
|---------------|-----------|--------|
| Face Recognition presensi | ❌ Tidak dibuat | Kompleksitas tinggi, nilai praktis rendah; kartu QR santri (sudah ada) + presensi manual/mesin cukup |
| E-learning penuh / Materi Praktek sebagai LMS | ❌ → upload materi per jadwal | Laporanmu bukan LMS; monev guru cukup |
| Money menu lain / SPP-tagihan | ✅ **Terjawab (audit 9 Nov)** | **Tidak ada** "Money Nilai"/SPP/tagihan di seluruh menu Sidikmu — hanya Tabungan; kartu PIN Transaksi mati. Scope keuangan = tabungan saja (§6.5) |
| AKPD/MBTI/Sosiometri | ⏸️ P2 opsional | Instrumen berat, konfirmasi intensitas pemakaian dulu (semua ditolak untuk Kepsek — jarang dipakai?) |
| ICP/7 KAIH/Kokurikuler sebagai modul terpisah | ♻️ → kriteria nilai configurable | Prinsip "konfigurasi, bukan modul" |

---

## 12. Metrik Keberhasilan & Cut-over Total

- **Adopsi:** ≥95% guru mapel input nilai di Laporanmu pada siklus PTS/PAS pertama setelah Fase 1.
- **Portal:** ≥60% wali aktif membuka portal minimal 1× per bulan.
- **Operasional:** 0 transaksi tabungan & 0 pendaftar SPMB baru yang dicatat di Sidikmu setelah cut-over modul tsb.
- **Retirement:** lisensi Sidikmu diputus berhenti hanya setelah metrik di atas + 1 bulan tanpa login (T5).

---

## 13. Pertanyaan Terbuka (perlu konfirmasi sebelum eksekusi)

1. ~~Apakah benar tidak ada SPP/tagihan di modul "Money" Sidikmu (hanya tabungan)?~~ ✅ **TERJAWAB (audit 9 Nov)** — tidak ada "Money Nilai"/SPP/tagihan di seluruh menu; hanya Tabungan (+ PIN Transaksi kartu mati). Lihat §11.
2. Modul Sidikmu mana yang **benar-benar rutin** dipakai guru hari ini? (Kandidat wawancara: wali kelas, guru mapel, petugas UKS/tukeu, operator SPMB, konselor BK.) Ini bisa menurunkan scope CBT/instrumen BK drastis. *Catatan: audit trace tidak bisa menjawab ini — butuh wawancara pengguna.*
3. Format & akses ekspor data dari Sidikmu (apa yang bisa diexport vendor? per modul?). *Catatan: tombol Export Excel terlihat di banyak halaman (Arsip Nilai, 7 KAIH, Data Formulir, dll), tapi **belum ada contoh file** untuk dianalisis formatnya.*
4. Kapan tepatnya PTS/PAS dan buka SPMB tahun depan — untuk anchoring Fase 1 & 3.
5. Apakah perlu akun untuk kepala sekolah terpisah dari admin, atau cukup admin + dashboard? *Catatan trace: di Sidikmu, Kepsek ditolak di BK inti + Keuangan (Lampiran B) — indikasi izin dipisah per role.*
6. Tahun ajaran berikutnya mulai dengan fresh-start nilai (rekomendasi) atau wajib bawa riwayat nilai dari Sidikmu?

---

## Lampiran A — Field Input Formulir SPMB Sidikmu (55 field)

Dari trace `G_Input_Formulir` — "Input Calon Siswa Baru (Reguler Bukan Inden) TA 2027/2028". **Referensi desain kolom `admissions` (§6.7); boleh disederhanakan/di-improve saat build.**

**Data Siswa (25 field)**

| # | Field (nama asli) | Tipe |
|---|-------------------|------|
| 1 | `nisn` | text |
| 2 | `nik` | text |
| 3 | `nama` | text |
| 4 | `jk` | select |
| 5 | `agama_siswa` | select |
| 6 | `status_anak` | select |
| 7 | `anak_ke` | number |
| 8 | `jumlah_saudara` | number |
| 9–12 | `provinsi`, `kabupaten`, `kecamatan`, `kelurahan` | select (alamat) |
| 13 | `alamat_siswa` | textarea |
| 14 | `tempat_lahir` | text |
| 15 | `tgl_lahir` | date |
| 16 | `hp_siswa` | number |
| 17 | `ukuran_seragam` | select |
| 18 | `rekomendasi` | select |
| 19 | `sekolah_asal` | text |
| 20 | `tahun_lulus_smp` | text |
| 21 | *(label "Opsional" — field tanpa nama jelas, kemungkinan keterangan)* | text |
| 22–25 | `provinsi_sekolah`, `kabupaten_sekolah`, `kecamatan_sekolah`, `kelurahan_sekolah` | select (asal sekolah) |

**Data Ayah (12 field):** `kondisi_ayah` (select), `nama_ayah`, `tempat_lahir_ayah`, `tgl_lahir_ayah` (date), `alamat_ayah` (textarea), `hp_ayah` (number), `agama_ayah`, `pendidikan_ayah` (select), `kerja_ayah`, `gaji_ayah` (select), `warganegara_ayah` (select), email

**Data Ibu (12 field):** pola identik ayah — `kondisi_ibu`, `nama_ibu`, `tempat_lahir_ibu`, `tgl_lahir_ibu`, `alamat_ibu`, `hp_ibu`, `agama_ibu`, `pendidikan_ibu`, `kerja_ibu`, `gaji_ibu`, `warganegara_ibu`, email

**Data Wali — Opsional (2 field):** `Nama Wali` (text), `HP Wali` (number)

**Berkas upload (4 field):** `foto_siswa`, `foto_kk`, `foto_akte`, `fotopayment` (file)

Aksi: `Simpan Data` (tidak ditekan selama audit). Total: **55 field**.

---

## Lampiran B — Matriks Izin Role Kepala Sekolah di Sidikmu

Hasil trace read-only 9 Nov 2026. **Bahan desain RBAC Laporanmu (§6.1)** — role `kepala_sekolah` / `tukeu` / konselor harus jelas sejak awal, jangan mengulang kebingungan izin Sidikmu.

> ⚠️ **Hanya untuk role Kepala Sekolah.** Tidak ada akun role lain saat audit → halaman DITOLAK **tidak terverifikasi** isinya. Status: ✅ AKSES · ⛔ DITOLAK · 💥 404 · 🔧 RUSAK · ⚠️ KOSONG (footer saja)

| Modul | Halaman | Status | Catatan |
|-------|---------|--------|---------|
| Home | Kartu cepat (Input Nilai, Pelanggaran, Tabungan, PIN Transaksi) | ✅ / 🔧 | PIN Transaksi = kartu tanpa aksi |
| Akademik | Seluruh menu (Nilai, Raport PTS/PAS, Kenaikan, Presensi Siswa, Generate, Monitoring, Arsip) | ✅ | Presensi Per Mapel = 💥 404 |
| Master | Seluruh menu kecuali Data Wajah | ✅ | Data Wajah = 💥 404 |
| Monev Guru | Seluruh menu | ✅ | — |
| SPMB | Seluruh menu | ✅ | Data Rekomendasi = 🔧 |
| CBT | Seluruh menu | ✅ | — |
| BK | Pelanggaran Siswa, Data Presensi, Data Presensi Mesin, Bank Soal TPA, Upload File Audio, Ganti Password, Dashboard Laporan & Analisis | ✅ | Data Presensi = PHP warning |
| BK | Kategori Materi, Setting Ujian TPA | ⚠️ | footer saja, kemungkinan ditolak tanpa pesan |
| BK | Prestasi Siswa | 💥 | 404 |
| BK | Data User | — | `href=#` |
| BK | Konseling Individu · Konseling Kelompok · Bimbingan Kelompok · Bimbingan Klasikal · Home Visit · AKPD (Angket + Hasil) · Sosiometri (Angket + Hasil) · MBTI (Angket + Hasil) · Surat Panggilan Ortu · Surat Peringatan/Perjanjian · Laporan Rekap BK · Rekap Poin Siswa | ⛔ ×15 | "Akses Ditolak! Anda tidak memiliki izin mengakses modul BK." |
| Keuangan | Dashboard Keuangan | 🔧 | Fatal SQL `file_bukti` (`home_keuangan.php`) |
| Keuangan | Data Tabungan, Kewajiban Per Siswa | ⛔ | ACCESS DENIED / NO ACCESS |
| Keuangan | Tabungan Masuk/Keluar, Pembayaran, Pengeluaran, Rekening | ⚠️ | kosong (footer saja) |
| Keuangan | Master RAPBS, Transaksi Bank, Tabungan Non Siswa, Laporan Tabungan | — | anchor → kembali ke dashboard yang error |
| Grid | Elearning, Monev Nilai | — | `href=#`, tanpa halaman |
| Publik | `/cbt`, `/spmb` | ✅ | tanpa login (NIS+kode ujian / OTP 6 digit) |

**Implikasi desain RBAC Laporanmu:** tentukan role `kepala_sekolah` (read-all + approval), `tukeu` (keuangan saja), konselor (BK saja), `operator_spmb` — beserta helper RLS `is_homeroom_teacher` / `is_class_subject_teacher` (§6.1) **sebelum** modul Keuangan/BK dibangun.

---

## Lampiran C — Halaman Rusak di Sidikmu (bahan komunikasi stakeholder)

| # | Halaman | Gejala | Lokasi (file PHP bila diketahui) |
|---|---------|--------|----------------------------------|
| 1 | Dashboard Keuangan | Fatal SQL: `Unknown column 'file_bukti' in 'SELECT'` | `home_keuangan.php:4` (mysqli) |
| 2 | Data Tabungan | `ACCESS DENIED` | `k_data_transaksi_tabungan.php` |
| 3 | Kewajiban Per Siswa | `NO ACCESS` | `m_set_kewajiban_persiswa.php` |
| 4 | Presensi Per Mapel (menu Akademik) | 404 Not Found | — |
| 5 | Data Wajah (menu Master) | 404 Not Found | — |
| 6 | Prestasi Siswa (menu BK) | 404 Not Found | — |
| 7 | Data Rekomendasi (SPMB) | Isinya PHP warning bertumpuk (`headers already sent`) | `spmb_data_rekomendasi.php:5` |
| 8 | Banyak halaman | PHP warning `headers already sent` (output buffer/sesi bermasalah) | `index.php:230` |
| 9 | Data Presensi (BK) | `Undefined array key "skelaswali"` | `a_presensi_data.php:2` |
| 10 | Kartu PIN Transaksi (home) | Kartu `menu-card` tanpa href/onclick — klik tidak berpindah | — |
| 11 | 15 halaman BK inti | "Akses Ditolak" untuk role Kepala Sekolah (Lampiran B) | — |

---

*Dokumen ini disusun dari inventarisasi codebase Laporanmu-Web (19 folder feature, migrations 0001–0019) dan audit trace read-only `sidikmu-trace.md` (9 Nov 2026) + tangkapan layar Sidikmu v2.0. PRD ini **acuan build** — fleksibel, boleh di-improve/diubah selama build berjalan; perubahan keputusan arah (khususnya §11 dan §13) sebaiknya dikommit bersama dokumen ini.*
