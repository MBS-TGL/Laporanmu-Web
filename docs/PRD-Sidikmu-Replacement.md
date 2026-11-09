# PRD — Laporanmu sebagai Pengganti Sidikmu

> **Versi:** v1.13 (acuan build — boleh dikembangkan/di-improve selama build) · **Tanggal:** 9 November 2026
> **Perubahan v1.13:** serap sisa temuan `sidikmu-trace.md` yang belum masuk PRD — **keputusan: Pembagian Kelas Sidikmu = penempatan siswa ke kelas (bukan guru→mapel)** (Lampiran F/G, §6.1); Prosentase Nilai KM & halaman User ditandai **menyusul, tidak blocker** (grade_configs configurable, RBAC dirancang dari Lampiran B).
> **Perubahan v1.12:** keputusan navigasi — **AKADEMIK = grup sidebar tersendiri** (Lampiran G).
> **Perubahan v1.11:** Lampiran G — pemetaan menu Master Sidikmu ↔ sidebar Laporanmu + usulan struktur navigasi untuk modul baru.
> **Perubahan v1.10:** struktur sidebar Master Sidikmu aktual → Lampiran F (menu baru terlihat: Prosentase Nilai KM, Mapping Siswa ekskul, Jadwal Ekskul, Jadwal ICP, Hafalan Surah/Hadist/Doa; Pembagian Kelas & Deskripsi CP/TP dipecah per tingkat).
> **Perubahan v1.9:** nama tabel final `student_guardians` (satu baris per orang per siswa); Lampiran F = daftar data yang masih dibutuhkan dari tab Master Sidikmu.
> **Perubahan v1.8:** §6.7 diberi pemetaan eksplisit konversi `admissions` → `students` + `student_guardians` (keputusan: **memperluas `students`**, bukan memetakan terbatas); temuan kode `StudentsPage`/`StudentFormValues` (form lebih sempit dari tabel: `nik`/`photo_url` ada di tabel, tidak di form).
> **Perubahan v1.7 (koreksi + membalik keputusan v1.5):** `database.md` menunjukkan tabel `students` hanya 25 kolom (bukan 66 kolom Dapodik) → data ayah/ibu, KK, anak ke, sekolah asal, dll. belum ada di DB. `student_guardians` **kembali dipakai** (alasan RLS, §6.1b); temuan skema aktual → Lampiran E.
> **Perubahan v1.6:** temuan halaman Profil Siswa Laporanmu (NIK sudah ada, indikator kelengkapan %, model satu wali utama) → §6.1b.
> **Perubahan v1.5 (koreksi):** data siswa Laporanmu sudah diimpor dari **Dapodik** (66 kolom, termasuk ayah/ibu/wali) → §6.1b ditulis ulang: gap utama ada di **form UI**, bukan skema; `student_guardians` tidak lagi default; Dapodik = sumber master, Sidikmu hanya untuk data yang tidak ada di Dapodik.
> **Perubahan v1.4:** sampel form Edit siswa terisi (NIS 512, IX A) → Lampiran D; field baru di §6.1b wajib nullable; pengumpulan ulang data wali.
> **Perubahan v1.3:** temuan ekspor "Download Data" Sidikmu + QR siswa → Lampiran D, §13 #3 terjawab sebagian, §10 risiko migrasi.
> **Perubahan v1.2:** tambah gap **Master Siswa** (perbandingan form Tambah Siswa Laporanmu vs Sidikmu) → §4.2, §5 #19, §6.1b baru, §7 Fase 0, §8, §10, §13 #7–9.
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

Kolom master siswa dari Dapodik yang belum punya tujuan di DB (ayah/ibu, KK, anak ke, sekolah asal, dll.) — lihat §6.1b; tabel mata pelajaran, jadwal pelajaran, pembagian kelas per mapel, nilai akademik per jenis (formatif/sumatif/PTS/PAS), leger & peringkat, kenaikan kelas, presensi guru + guru pengganti, tabungan, SPMB, CBT, surat resmi BK, instrumen BK lanjutan, ekstrakurikuler & prestasi terstruktur.

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
| 19 | Master Siswa: selaraskan form dengan data Dapodik yang sudah diimpor (orang tua/wali, NIK/KK, alamat, anak ke, sekolah asal, foto) | 🟡 | **P0** | Skema `students` (25 kolom) baru memuat sebagian Dapodik: tambah `student_guardians` + kolom nullable, backfill dari ekspor Dapodik, tampilkan di form. Wajib sebelum rekonsiliasi Sidikmu dan SPMB. Detail §6.1b |
| 18 | BK TPA (bank soal/setting ujian/hasil TPA) | ❌ | P2 | Modul TPA di BK (7 jenis soal) — **konfirmasi intensitas pemakaian dulu** sebelum dibangun; jika dipakai, ikut modul CBT (#16) |

---

## 6. Fitur yang Diusulkan (Detail)

Format per modul: Deskripsi → User story kunci → Skema data → Reuse pattern.

### 6.1 Fondasi: Mapel, Pembagian Kelas, RBAC (P0, effort M)

**Deskripsi.** Tabel mata pelajaran menjadi tulang punggung seluruh modul akademik. Pembagian kelas = siapa mengajar mapel apa di kelas apa.

> **Klarifikasi v1.13 (dari trace §3J):** menu "Pembagian Kelas" Sidikmu **bukan** guru→mapel→kelas — strukturnya `NO|NAMA SISWA|JK|INPUT NIS BARU` + pesan "siswa yang menunggu pembagian kelas" + upload Excel, artinya **penempatan siswa ke kelas** (terutama siswa baru/masuk). Fitur ini sudah setara dengan pindah/kelas massal di `StudentsPage` Laporanmu. Konsekuensinya: relasi guru→mapel→kelas **tidak punya padanan di Sidikmu** — `class_subjects` tetap tabel baru murni, dirancang dari kebutuhan Laporanmu (RLS granular §6.1), bukan ditiru dari Sidikmu.

**User story kunci.**
- Sebagai admin, saya mengelola daftar mapel (kode, nama, kelompok KurMer A/B, KKM, fase).
- Sebagai admin, saya menetapkan guru pengampu per mapel per kelas per tahun ajaran.
- Sebagai wali kelas, saya hanya melihat kelas yang saya amanakan (untuk raport/leger).
- Sebagai guru, saya hanya bisa menginput nilai pada mapel+kelas yang saya amanakan.

**Skema.** `subjects` (name, code, kelompok, kkm, fase, kurikulum) · `class_subjects` (class_id, subject_id, teacher_id, academic_year_id, kkm_override) — sumber RLS granular.

**RBAC.** Tambah enum role: `kepala_sekolah` (read-all + approval), `tukeu` (keuangan), `operator_spmb`. Konsep **wali kelas & guru mapel bukan role, tapi relasi data** (`classes.homeroom_teacher_id` sudah ada; `class_subjects` baru). Helper RLS baru: `is_homeroom_teacher(class_id)`, `is_class_subject_teacher(...)`.

**Reuse:** soft-delete + partial unique index (konvensi migration existing), audit log, impor mapel via CSV.

---

### 6.1b Perluasan Master Siswa dari Data Dapodik (P0, effort M — bagian Fase 0)

**Koreksi v1.7.** Skema aktual (`database.md`) menunjukkan `students` hanya berisi 25 kolom: identitas (`nisn`, `nis`, `nik`, `name`, `gender`, `birth_place`, `birth_date`, `religion`, `address`), penempatan (`class_id`, `dorm_id`, `status`, `graduated_at`, `graduation_year`, `last_class_id`), kontak (`phone`, satu wali: `guardian_name` + `guardian_relation`), dan fitur app (`registration_code`, `pin`, `total_points`, `tags`, `is_pinned`, `photo_url`). Impor Dapodik (66 kolom) jadi hanya memetakan **sebagian**; sisanya tidak punya kolom tujuan. File ekspor Dapodik asli masih ada → **dapat di-backfill** setelah skema diperluas.

**Sumber kebenaran master siswa: Dapodik.** Data siswa Sidikmu terlalu tipis (Lampiran D); Sidikmu hanya untuk pemetaan NIS, rekonsiliasi, dan data di luar Dapodik (tabungan, nilai).

**Peta field (form Sidikmu + Lampiran A + Dapodik vs DB aktual).**

| Kelompok | Status DB | Tindakan |
|----------|-----------|----------|
| NIS, NISN, **NIK**, nama, JK, tempat/tgl lahir, agama, alamat (teks tunggal), HP, foto (`photo_url`), kelas, asrama, status | ✅ ada | Tampilkan **NIK** di form (sudah ada di DB & profil, belum di form Tambah) |
| Wali: `guardian_name`, `guardian_relation`, `phone` | 🟡 satu kontak | Tetap sebagai **kontak utama** WA/portal |
| Ayah & ibu terpisah (nama, NIK, tahun lahir, pendidikan, pekerjaan, penghasilan, HP, alamat); wali detail | ❌ | Tabel **`student_guardians`** (lihat keputusan 1) |
| Nama panggilan, no. KK, anak ke, jumlah saudara, status anak, telepon rumah, sekolah asal, tahun lulus SMP, tanggal masuk/diterima, ukuran seragam | ❌ | Kolom baru **nullable** di `students` |
| Alamat bertingkat (provinsi–kelurahan) | ❌ | Opsional (`address_detail jsonb`) — hanya jika SPMB/pelaporan membutuhkan |
| RFID | ❌ | Ditunda (§13 #7) |
| Berkas (KK, akte, foto) | 🟡 | `photo_url` ada; dokumen lain lewat Storage (§9), tabel dokumen ikut SPMB (§6.7) |

**Keputusan.**
1. **`student_guardians`** — nama tabel final (awalan `student_` tunggal mengikuti `student_attendance`/`student_*_reports`). Data orang tua disimpan **per siswa**, bukan entitas wali bersama antar siswa (kakak-adik berbagi satu data wali = di luar scope); partial unique index (`student_id`, `relation`) where `deleted_at is null`. Kolom: (`student_id`, `relation` `father/mother/guardian` — label UI tetap Ayah/Ibu/Wali, `name`, `nik`, `birth_year`, `education`, `occupation`, `income_range`, `phone`, `address`, `deleted_at`). Alasan utama: **RLS bekerja per baris, bukan per kolom**, dan `students_select` saat ini `is_staff()` → semua staff (termasuk guru) membaca semua kolom `students`. Memisahkan NIK/penghasilan orang tua ke tabel sendiri memungkinkan policy `admin/pengurus` saja. Pengunpivotan dari kolom datar Dapodik ke baris ayah/ibu/wali dilakukan di skrip impor. `guardian_name/relation/phone` tetap sebagai kontak utama (bukan duplikasi: dipakai WA/portal).
2. **Kolom sensitif di `students`** (`nik`, dan `kk_number` bila ditambah): putuskan pembatasan akses (view `students_basic` tanpa NIK/KK untuk role guru, atau column privilege). Lihat §13 #9.
3. **Impor Dapodik ulang** (upsert by NISN/NIK) untuk backfill kolom baru + `student_guardians`, dengan laporan perubahan sebelum menimpa; skrip yang sama dipakai tiap tahun ajaran.
4. **Form:** section Data Pribadi · Penempatan · Orang Tua · Wali · Berkas; field jarang dipakai (NIK, KK, penghasilan) di bagian bisa dibuka-tutup; alamat orang tua opsi "sama dengan siswa". Indikator kelengkapan (%) yang sudah ada di profil dihitung ulang dari field baru dan dipakai untuk rekap per kelas.
5. **Foto:** `photo_url` sudah ada — pastikan menunjuk Storage (private + signed URL), bukan data base64 (§9 poin 1).
6. **Pemetaan status:** enum `student_status` (aktif/lulus/pindah/keluar) vs opsi Status Siswa Sidikmu dibuat eksplisit (§13 #8).
7. **Tanggal diterima** = tanggal masuk Dapodik; saat SPMB diisi otomatis dari `admissions` (§6.7).

**Tindak lanjut.** Daftar header 66 kolom ekspor Dapodik → tabel pemetaan final (kolom Dapodik → kolom DB → perlu migration?) + fill-rate per kolom.

**Reuse:** impor siswa CSV/XLSX, audit log, soft-delete + partial unique index (NIK/NISN), signed URL Storage (§9).

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

#### Konversi `admissions` → `students` (keputusan v1.8)

**Keputusan: perluas `students` + `student_guardians` (§6.1b), bukan memetakan terbatas.** Konversi "diterima & daftar ulang" harus tanpa input ulang (T4); kalau `students` tetap sempit (satu wali, tanpa KK/anak ke/sekolah asal), data ayah/ibu dan berkas dari formulir SPMB akan hilang atau harus diketik ulang. Skema `admissions` sengaja memakai nama/tipe yang sama dengan target agar konversi 1:1.

| Dari formulir SPMB (Lampiran A) | Ke | Catatan |
|---|---|---|
| nisn, nik, nama, jk, agama, tempat/tgl lahir, alamat siswa, hp siswa | `students.nisn/nik/name/gender/religion/birth_place/birth_date/address/phone` | sudah ada kolomnya |
| status anak, anak ke, jumlah saudara, sekolah asal, tahun lulus SMP, ukuran seragam | kolom baru nullable di `students` (§6.1b) | |
| alamat bertingkat siswa (prov–kel) | `students.address_detail` (jsonb, opsional) | hanya jika dipakai |
| data ayah (12 field), data ibu (12 field) | `student_guardians` baris `ayah` / `ibu` | email, kondisi, gaji, kewarganegaraan ikut |
| nama wali + HP wali (opsional) | `student_guardians` baris `wali` + `guardian_name/guardian_relation/phone` (kontak utama) | bila wali kosong, kontak utama = ayah/ibu |
| foto siswa | `students.photo_url` (Storage) | |
| foto KK, foto akte | dokumen siswa di Storage (tabel dokumen) | KK juga mengisi `students.kk_number` jika diisi |
| rekomendasi, lokasi sekolah asal (4 field), foto bukti bayar, riwayat tahap | tetap di `admissions` / `admission_stage_logs` | tidak dipindah |
| `registration_no` | `students.source_admission_id` (nullable) | `students.registration_code` + PIN portal di-generate baru saat konversi |

Konversi dijalankan sebagai **satu RPC security-definer** (transaksi tunggal: buat `students` + `student_guardians` + pindah berkas + tandai `admissions.status = daftar_ulang`), tercatat di audit log, dan idempoten (cek `source_admission_id`).

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
| **0 — Fondasi** (S–M, ±2 mgg) | Tabel mapel + class_subjects + pembagian kelas; role baru & helper RLS; Storage bucket; restrukturisasi kriteria raport umum ke mapel; **perluasan master siswa dari data Dapodik (`student_guardians` + kolom baru + backfill + form, §6.1b) + rekonsiliasi NIS Sidikmu** | M | Segera (pondasi semua fase) | Guru mapel bisa ditetapkan; migrasi data master dari ekspor Sidikmu selesai |
| **1 — Akademik Nilai** (P0) | Penilaian formatif/sumatif/PTS/PAS + monitoring progress; rapor semester berbasis mapel + generate nilai; leger + peringkat; kenaikan kelas | XL | **Sebelum PTS/PAS terdekat** | 1 kelas pilot input nilai end-to-end → cetak rapor & leger tanpa Sidikmu |
| **2 — Operasional Harian** (P1) | Jadwal + presensi guru + guru pengganti + upload materi; tabungan + PIN; dashboard analisis BK + surat resmi; perluasan konseling | L | Selesai sebelum semester genap berjalan stabil | Kepala sekolah melihat kehadiran guru & progress nilai; tukeu bertransaksi tabungan harian |
| **3 — Portal & SPMB** (P1) | Portal wali satu pintu + notifikasi WA event; SPMB end-to-end + dashboard SPMB + informasi publik | L | **Sebelum buka SPMB** (musim Feb–Mei) | Calon bisa mendaftar → OTP WA → lulus → masuk data siswa tanpa input ulang |
| **4 — Pelengkap/Opsional** (P2) | CBT; instrumen AKPD/Sosiometri/MBTI; ekskul & prestasi terstruktur; deskriptor CP/TP; dashboard kepala sekolah peran-berbasis | XL (CBT) | Setelah SPMB / tahun berikutnya | Sesuai keputusan review ulang |

**Strategi cut-over per modul:** paralel run 2–4 minggu per modul (input di Laporanmu, Sidikmu masih baca-saja cadangan) → Sidikmu di-freeze untuk modul tsb → modul berikutnya. Sidikmu diputuskan mati total hanya setelah: fase 1–3 selesai **dan** satu siklus penuh (PAS + SPMB) berjalan di Laporanmu.

**Urutan prioritas bila kapasitas terbatas:** 6.1 → 6.2 → 6.3 (garis nilai-raport) → 6.5 (tabungan, paling diminta petugas) → 6.4 → 6.7 → 6.6 → 6.9 → 6.8.

---

## 8. Skema Data Baru — Ringkasan

± 19 tabel baru / perluasan (semua mengikuti konvensi existing: `deleted_at`, trigger `updated_at`, partial unique index, RLS + helper, audit log):

| Kelompok | Tabel |
|----------|-------|
| Akademik | `subjects`, `class_subjects`, `grade_configs`, `assessments`, `assessment_scores`, `class_promotions`, `time_slots`, `schedules` |
| Master Siswa | `student_guardians` (baru) + ± 10 kolom nullable baru di `students` (§6.1b) |
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
| Ekspor data Sidikmu tidak lengkap/berformat aneh (**terbukti**: ekspor siswa hanya 10 kolom, file `.xls` sebenarnya HTML, HP ayah/ibu kosong) | Migrasi kotor | Migrasi hanya: master data + saldo tabungan + data siswa aktif. Nilai historis fresh-start per tahun ajaran |
| Resistensi guru (interface baru saat musim input nilai) | Input nilai mentok | Grid input satu-layar ala absensi; sesi pelatihan singkat; masa paralel run; progress monitoring per guru terlihat kepala sekolah |
| Data anak & sensitif (PIN, tabungan, dokumen SPMB, **NIK/KK, penghasilan orang tua**) | Keamanan/privasi | RLS ketat (NIK/KK/penghasilan hanya role yang perlu),  PIN hash, token sha256 + rate limit, audit log semua modul, dokumen di Storage dengan policy private + signed URL |
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
3. Format & akses ekspor data dari Sidikmu (apa yang bisa diexport vendor? per modul?). *Terjawab sebagian (9 Nov): ekspor **Data Siswa** sudah dianalisis (Lampiran D) — hanya 10 kolom, jauh dari lengkap. **Masih belum ada contoh** ekspor Arsip Nilai/DKN, 7 KAIH, Data Formulir SPMB, Data Pegawai, Pembagian Kelas, tabungan.*
4. Kapan tepatnya PTS/PAS dan buka SPMB tahun depan — untuk anchoring Fase 1 & 3.
5. Apakah perlu akun untuk kepala sekolah terpisah dari admin, atau cukup admin + dashboard? *Catatan trace: di Sidikmu, Kepsek ditolak di BK inti + Keuangan (Lampiran B) — indikasi izin dipisah per role. Update v1.13: daftar role di halaman User Sidikmu **boleh menyusul** (Lampiran F) — RBAC Laporanmu dirancang dari Lampiran B, bukan meniru role Sidikmu.*
7. Apakah sekolah benar-benar memakai **pembaca RFID** untuk presensi (field RFID Sidikmu)? Jika tidak, `rfid_uid` tidak dibuat (§6.1b).
8. Daftar opsi **Status Siswa** dan **Status Anak** di Sidikmu apa saja? Perlu untuk pemetaan impor master. *Update v1.13: **menyusul, tidak blocker** — semua kolom baru §6.1b nullable, opsi bisa dilengkapi saat form dibangun; hanya butuh screenshot dropdown.*
9. Siapa yang boleh melihat **NIK, KK, dan penghasilan orang tua** di Laporanmu? Saat ini `students_select` = semua staff (termasuk guru), jadi NIK siswa sudah terbaca semua staff.
10. Kirim **daftar header 66 kolom ekspor Dapodik** + konfirmasi file ekspor aslinya masih ada (untuk backfill dan tabel pemetaan final).
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

## Lampiran D — Temuan Ekspor & QR Data Siswa Sidikmu (9 Nov 2026)

Sumber: `Data_Siswa_Kelas_VII_A_2026-11-09.xls` (tombol **Download Data**, kelas VII A, 14 siswa) + screenshot halaman Master → Pendidikan → Siswa.

**Format file.** Berekstensi `.xls` tetapi isinya **tabel HTML** (bukan Excel asli). Judul `DATA SISWA KELAS: VII A`; kolom NIS/NISN/HP memakai `mso-number-format:"\@"` agar nol depan tidak hilang. Konsekuensi untuk impor: parser harus membaca sebagai HTML (atau pengguna menyimpan ulang sebagai .xlsx/.csv) dan **semua kolom ID/HP dibaca sebagai teks**.

**Kolom ekspor (hanya 10):** `No, NIS, NISN, Nama Siswa, Kelas, Nama Ayah, Nama Ibu, HP Siswa, HP Ayah, HP Ibu`.
- **Tidak ada:** jenis kelamin, tempat/tanggal lahir, agama, alamat, status siswa/anak, anak ke, jumlah saudara, sekolah asal, tanggal diterima, nama/HP/alamat wali, foto, RFID. Ekspor ini **tidak cukup** untuk migrasi master — dan tidak diperlukan, karena master siswa Laporanmu sudah berasal dari Dapodik (§6.1b).
- **Kualitas data:** NIS 3 digit (658–667…), NISN 10 digit berawalan `0` (hilang jika dibaca sebagai angka), HP Siswa berformat `62…` (12–13 digit, tanpa `0`/`+`), tanpa duplikat. **HP Ayah dan HP Ibu kosong di 14/14 siswa** → data kontak wali di Sidikmu sangat mungkin tidak terisi; jangan mengandalkannya untuk WA/portal tanpa pengumpulan ulang.
- Daftar siswa juga punya kolom **HP Ibu** dan **Tanggungan** (kosong di semua baris yang terlihat; arti "Tanggungan" belum terverifikasi — kemungkinan tagihan/kewajiban).

**Aksi per baris (3 tombol):** Edit (form Tambah/Edit Siswa, ±35 field) · **Reset Password** (siswa punya password login — fungsinya belum terverifikasi, kemungkinan portal siswa/presensi; **CBT memakai NIS + Kode Ujian, bukan password ini**) · Download QR. Tombol massal: **Download All QR**, **Download Data**.

**QR siswa.** Hasil dekode 3 sampel: payload berupa **token acak 64 karakter** (base64url), **bukan NIS**. Artinya pemetaan QR → siswa hanya ada di database Sidikmu. Implikasi: kartu/QR Sidikmu yang sudah tercetak **tidak bisa dipakai di Laporanmu** kecuali tabel token diekspor; rencana default = **cetak ulang kartu QR Laporanmu** saat cut-over presensi, dengan masa paralel (kedua QR hidup) selama transisi.

**Sampel form Edit siswa terisi (NIS 512, kelas IX A, Aktif).** Hanya terisi: NIS, NISN (nol depan utuh), Nama, Nama Panggilan, Jenis Kelamin, Kelas, Status Siswa, Tempat Lahir, Agama. **Kosong:** Tanggal Lahir, Tanggal Diterima, RFID, Status Anak, Telepon Rumah, Sekolah Asal, HP Siswa, Anak Ke, Jumlah Saudara, seluruh data ayah/ibu/wali (nama, HP, alamat), Foto. Tanggal lahir kosong padahal tempat lahir terisi → data tidak konsisten.
- **Pola (hipotesis dari 2 sampel):** siswa VII A (ekspor) punya Nama Ayah/Ibu terisi 14/14 tetapi HP kosong; siswa IX A (form) bahkan nama orang tua kosong → kelengkapan data kemungkinan **turun untuk angkatan lebih lama**. Perlu audit kelengkapan per kelas (unduh Download Data semua kelas, hitung fill-rate per kolom).
- **Implikasi desain:** (a) semua kolom baru di §6.1b **nullable**, hanya NIS/NISN/nama/JK/kelas/status yang wajib; (b) Sidikmu **bukan sumber isi master**; Dapodik sudah mengisinya — Sidikmu dipakai untuk pemetaan NIS dan rekonsiliasi; (c) bila setelah impor Dapodik masih ada kolom kosong (HP wali, dll.), **dikumpulkan ulang**, mis. lewat form lengkapi-data di portal wali (`/check`, PIN registrasi) atau saat daftar ulang, dengan dashboard "kelengkapan data" per kelas.

**Tindak lanjut.** (1) Ekspor lengkap vendor tetap dibutuhkan **hanya** untuk modul yang tidak ada di Dapodik (tabungan, nilai, SPMB), bukan untuk data siswa; (2) konfirmasi fungsi Reset Password & kolom Tanggungan; (3) tambahkan ke §13 #3.

---

## Lampiran E — Temuan dari Skema Aktual (`database.md`, 9 Nov 2026)

Perbandingan skema Supabase aktual dengan asumsi PRD. Status: ✅ sesuai · ⚠️ perlu tindakan · ℹ️ info.

| # | Temuan | Status | Tindakan |
|---|--------|--------|----------|
| 1 | `students` hanya 25 kolom; data ayah/ibu, KK, anak ke, sekolah asal, status anak, tel. rumah, tanggal masuk, nama panggilan tidak ada | ⚠️ | §6.1b |
| 2 | `students_select` = `is_staff()` → semua staff (termasuk `guru`) membaca semua kolom termasuk `nik`; RLS tidak bisa membatasi per kolom | ⚠️ | Pisahkan data sensitif (tabel/view); putuskan §13 #9 |
| 3 | `audit_logs_insert` dengan `WITH CHECK (true)` → user terautentikasi manapun bisa menulis entri audit dengan `user_id`/`actor_name` sembarang (audit bisa dipalsukan) | ⚠️ | Paksa `user_id = auth.uid()` atau isi via trigger/RPC security-definer |
| 4 | `students.pin` bertipe `text` | ⚠️ | Verifikasi sudah hash atau belum; PRD sudah mencatat harus hash (§6.5) |
| 5 | `is_staff()` tidak terlihat di dokumen; enum `app_role` memuat `pending` | ⚠️ | Pastikan `is_staff()` **tidak** meloloskan `pending` |
| 6 | `profiles.spmb_role` (text) sudah ada, sementara PRD merencanakan enum `operator_spmb` | ℹ️ | Satukan: pakai satu mekanisme role SPMB (§6.1/§6.7) |
| 7 | `photo_url` (students, teachers) sudah ada | ℹ️ | Gunakan nama itu (bukan `photo_path`); cek isinya Storage vs base64 |
| 8 | `suspension_task_submissions.photo_data` (`_text`) menyimpan foto base64 | ℹ️ | Sesuai catatan §4.3/§9: jangan diteruskan; migrasi ke Storage |
| 9 | `gate_logs` hanya punya policy SELECT/INSERT (immutable) | ✅ | Pola dipakai ulang untuk `savings_transactions` |
| 10 | `classes.homeroom_teacher_id` ada; `academic_years.is_locked` ada; `teachers` punya `nik/nip/nuptk/nbm` | ✅ | Sesuai §6.1 dan §9 poin 6 |
| 11 | `student_semester_reports.scores/extras` bertipe `jsonb`; belum ada tabel mapel | ✅ | Sesuai §4.3 (restrukturisasi di §6.2) |
| 12 | `student_status` hanya `aktif/lulus/pindah/keluar` | ℹ️ | Petakan ke opsi Status Siswa Sidikmu (§13 #8) |
| 13 | `health_logs`/`counseling_logs` menyimpan `student_name`/`class_name` (denormalisasi) | ℹ️ | Bisa basi saat nama/kelas berubah; terima atau tampilkan via join |

---

## Lampiran F — Data yang Masih Dibutuhkan dari Tab Master Sidikmu

Untuk tiap halaman: **screenshot daftar** (baris terlihat) + **form Tambah/Edit** + **file ekspor** bila ada tombolnya. Cukup 1 contoh per halaman.

> **Update v1.13:** sebagian besar struktur P0 sudah terekam di `sidikmu-trace.md` §3J (Batas Semester, Kelas, Mapel, Pegawai, Wali Kelas, Pembagian Kelas) — yang benar-benar tersisa hanya: pola penamaan kelas, isi daftar Mata Pelajaran, file ekspor, dan 2 halaman yang ditandai **menyusul** (Prosentase Nilai KM, User). Tidak ada yang memblokir Fase 0.

| Prioritas | Halaman Master | Yang dibutuhkan | Dipakai untuk |
|-----------|----------------|-----------------|---------------|
| **P0** | Pendidikan → Kelas | 🟡 **Struktur terekam** (trace §3J: 10 baris, modal Jenjang/Nama Kelas/Jadwal Presensi). Tersisa: pola penamaan kelas (Sidikmu "VII A" vs Laporanmu "9C Reguler Putra") | Tabel pemetaan kelas Sidikmu ↔ Laporanmu (rekonsiliasi §6.1b) |
| **P0** | Pendidikan → Batas Semester | ✅ **Struktur terekam** (trace §3J: field tanggal awal/tengah/akhir × Gasal & Genap, tombol Simpan Perubahan) | `academic_years` (semester, tanggal mulai/tengah/akhir per semester, `is_locked`) |
| **P0** | Jadwal & Pelajaran → Mata Pelajaran | 🟡 **Struktur modal terekam** (trace §3J: kode, nama, no_urut_kurmer, flag "guru boleh mengajar kelas lain pada jam yang sama"). Tersisa: daftar isi + ekspor | `subjects` (kode, nama, kelompok, KKM, fase, no_urut_kurmer) — §6.1. Flag "boleh mengajar kelas lain pada jam sama" → catatan untuk modul jadwal §6.4 |
| P0 → **menyusul** | Jadwal & Pelajaran → **Prosentase Nilai KM** | ⏸️ **Boleh dilewati (v1.13)** — halaman baru (v1.10), belum pernah dibuka saat audit | Bobot nilai tetap dibuat configurable di `grade_configs` (§6.2) dengan default 30/20/20/30 yang **sudah terverifikasi** dari home Sidikmu; halaman ini hanya memperkuat, bukan menentukan |
| **P0** | Pembagian Kelas (submenu Kelas VII / VIII / IX) | ✅ **TERJAWAB (v1.13, trace §3J)** — artinya **penempatan siswa ke kelas**: `NO\|NAMA SISWA\|JK\|INPUT NIS BARU` + "siswa menunggu pembagian kelas" + Upload Excel, **bukan** guru→mapel→kelas | Setara fitur pindah/kelas massal `StudentsPage`; `class_subjects` tetap tabel baru tanpa padanan Sidikmu — §6.1 |
| **P0** | Kepegawaian → Data Pegawai + Wali Kelas | 🟡 **Struktur terekam** (trace §3J: modal 21 field utuh; Wali Kelas 13 baris `NAMA GURU\|KELAS`). Tersisa: file ekspor | Bandingkan dengan `teachers` (19 kolom); `classes.homeroom_teacher_id` |
| P0 → **menyusul** | User | ⏸️ **Boleh menyusul (v1.13)** — halaman belum diuji terpisah saat audit; perlu akun admin untuk melihat daftar role | Desain RBAC (`kepala_sekolah`, `tukeu`, konselor, `operator_spmb`) dirancang dari Lampiran B, **bukan meniru role Sidikmu** — daftar role Sidikmu hanya pembanding — §6.1 |
| P1 | Jam Pelajaran, Jadwal | Daftar + form | `time_slots`, `schedules` — §6.4 |
| P1 | Setting Presensi → Shift, Titik Lokasi (QRPoint), Dashboard; Data Presensi Mesin | Form shift + QRPoint; contoh ekspor Data Presensi Mesin | Presensi guru/geofence — §6.4 |
| P1 | Ekstrakurikuler → Data Ekskul, Jadwal Ekskul, Mapping Siswa | Daftar + form + isi Mapping Siswa | Roster ekskul + nilai predikat raport — §5 #6 |
| P2 | Kokurikuler (Pengaturan Nilai, Dimensi, Kegiatan), 7 KAIH (Master, Data Rekap), Deskripsi CP/TP (per tingkat VII/VIII/IX), Jadwal & Materi ICP (English, Mathematics, Science, Jadwal ICP), Materi Praktek (Range Nilai, BTA, Wudhu, Sholat, Hafalan Surah/Hadist/Doa), Rekap Prestasi | 1 screenshot daftar per halaman + jawaban: **dipakai rutin atau tidak, oleh siapa** | Keputusan "kriteria nilai configurable" vs modul (§5 #2, #6) — jangan dibangun spekulatif |

**Struktur sidebar Master Sidikmu (aktual, 9 Nov 2026) dan catatannya.**

| Menu | Submenu | Catatan untuk desain |
|------|---------|----------------------|
| User | — | Tampil sebagai item aktif; bila halaman terbuka, daftar role di sini bahan RBAC |
| Setting Presensi | Setting Dashboard, Titik Lokasi QRCode, Shift Presensi, Data Presensi Mesin | §6.4 / gap #7 |
| Face Recognition | Registrasi Wajah, Data Wajah | Tidak direplikasi (§11) |
| Pendidikan | Batas Semester, Kelas, Siswa | P0 |
| Jadwal & Pelajaran | Mata Pelajaran, Jam Pelajaran, Jadwal Pelajaran, **Prosentase Nilai KM** | Prosentase Nilai KM = kandidat konfigurasi bobot |
| Ekstrakurikuler | Data Ekskul, Jadwal Ekskul, Mapping Siswa | Roster siswa per ekskul |
| Kepegawaian | Data Pegawai, Wali Kelas | P0 |
| Jadwal & Materi ICP | English, Mathematics, Science, Jadwal ICP | Tiga mapel khusus program ICP dengan jadwal sendiri; modelkan sebagai mapel + kelompok "ICP" di `subjects`, bukan modul terpisah (§6.2) |
| Materi Praktek | Range Nilai, BTA, Wudhu, Sholat, Hafalan Surah, Hafalan Hadist, Hafalan Doa | **Beririsan** dengan raport bulanan pondok Laporanmu (`nilai_quran`, `sholat`, `ziyadah`, `murojaah`, `total_hafalan`); periksa overlap sebelum membuat tabel baru |
| Kokurikuler | Pengaturan Nilai, Dimensi, Kegiatan | Kriteria nilai configurable (§5 #2) |
| 7 KAIH | Master, Data Rekap | Idem |
| Pembagian Kelas | Kelas VII, Kelas VIII, Kelas IX | Dipecah per tingkat; artinya **terkonfirmasi** (v1.13): penempatan siswa ke kelas (trace §3J) |
| Deskripsi CP / Deskripsi TP | Kelas VII, VIII, IX (masing-masing) | Deskriptor per tingkat/mapel (§5 #2) |
| Rekap Prestasi | — | §5 #6 |

**Pertanyaan yang hanya bisa dijawab pengguna:** (1) siapa yang benar-benar mengisi Kokurikuler/7 KAIH/Materi Praktek tiap semester; (2) apakah Setting Presensi (geofence/QR) dipakai untuk guru, siswa, atau keduanya; (3) apakah ada akun role selain Kepala Sekolah yang bisa dipakai untuk audit read-only lanjutan.

---

## Lampiran G — Peta Navigasi: Sidikmu ↔ Laporanmu

**Sidebar Laporanmu saat ini:** Dashboard · MASTER DATA (Data Siswa, Alumni, Data Guru, Data Kelas, Tahun Akademik) · POIN SANTRI (Aturan Poin, Catatan Poin) · KESANTRIAN (Absensi Santri, Asrama, Kesehatan, Bimbingan Konseling, Izin Pulang, Skorsing) · RAPORT (Raport, Arsip Raport) · GERBANG (Gate Santri) · PENGATURAN (Informasi, Pengguna, Audit Log, Profil Sekolah). Header menampilkan tahun ajaran aktif (mis. TA 2026/2027 Ganjil).

**Pemetaan menu Master Sidikmu.**

| Sidikmu (Master) | Laporanmu | Status |
|------------------|-----------|--------|
| User | Pengaturan → Pengguna | ✅ (role perlu diperluas, §6.1) |
| Pendidikan → Siswa | Master Data → Data Siswa | ✅ (perluasan §6.1b) |
| Pendidikan → Kelas | Master Data → Data Kelas | ✅ |
| Pendidikan → Batas Semester | Master Data → Tahun Akademik | ✅ (`semester`, tanggal, `is_locked`) |
| Kepegawaian → Data Pegawai / Wali Kelas | Master Data → Data Guru / `classes.homeroom_teacher_id` | ✅ / 🟡 (bandingkan field) |
| Pembagian Kelas | `students.class_id` | 🟡 artinya terkonfirmasi = penempatan siswa (v1.13, trace §3J) — setara fitur pindah kelas `StudentsPage`; yang belum ada di Laporanmu hanya riwayat kelas per tahun ajaran |
| Jadwal & Pelajaran (Mata Pelajaran, Jam, Jadwal, Prosentase Nilai KM) | — | ❌ (§6.1, §6.2, §6.4) |
| Ekstrakurikuler, Kokurikuler, 7 KAIH, Deskripsi CP/TP, ICP, Materi Praktek, Rekap Prestasi | — (Materi Praktek beririsan dengan Raport pondok; Rekap Prestasi sebagian dengan Catatan Poin positif) | ❌ / 🟡 |
| Setting Presensi (Shift, QRPoint, Mesin) | Kesantrian → Absensi Santri, Gerbang → Gate Santri | 🟡 (tanpa shift/geofence) |
| Face Recognition | — | Tidak direplikasi (§11) |

**Usulan struktur navigasi untuk modul baru** (prinsip: jangan meniru ±30 submenu Master Sidikmu; konfigurasi digabung ke halaman bertab, dan menu tampil menurut role):

| Grup sidebar | Isi | Fase |
|--------------|-----|------|
| MASTER DATA (tambah) | **Mata Pelajaran** (+ kelompok mis. ICP, KKM, fase). Pembagian guru-mapel-kelas sebagai **tab "Mapel & Guru" di detail Data Kelas** (`class_subjects`), bukan menu sendiri | 0 |
| **AKADEMIK** (grup baru, di antara KESANTRIAN dan RAPORT) — **keputusan: grup tersendiri, tidak digabung ke RAPORT** (input nilai rutin mingguan oleh guru; RAPORT hanya dibuka akhir semester) | Input Nilai · Monitoring Nilai (progress per kelas/mapel/guru) · Leger & Peringkat · Kenaikan Kelas | 1 |
| RAPORT (perluas) | Raport PTS/PAS umum (berbasis mapel) di samping raport pondok; Arsip Raport tetap | 1 |
| **KEUANGAN** (grup baru, hanya role `tukeu` + admin) | Tabungan Santri (setor/tarik, mutasi, cetak buku) | 2 |
| **GURU** atau tab di Data Guru | Jadwal & Jam Pelajaran · Presensi Guru · Guru Pengganti · Materi | 2 |
| KESANTRIAN → Bimbingan Konseling (perluas) | Tab: Konseling (individu/kelompok/klasikal/home visit) · Surat (panggilan/peringatan/pujian) · Dashboard analisis | 2 |
| **SPMB** (grup baru, role `operator_spmb`) | Pendaftar · Seleksi · Hasil · Informasi SPMB · Pengaturan Periode | 3 |
| PENGATURAN (perluas) | **Pengaturan Akademik** (satu halaman bertab: bobot nilai, kriteria tambahan ICP/kokurikuler/ekskul, template surat) menggantikan menu-menu konfigurasi terpisah Sidikmu | 1 |
| Portal wali (publik, di luar sidebar) | `/check` diperluas (§6.9), `/spmb`, `/verify` | 3 |

**Catatan.** Sidebar difilter per role (mis. `tukeu` hanya melihat Keuangan; `operator_spmb` hanya SPMB; guru hanya Akademik pada kelas/mapel yang diampu).

---

*Dokumen ini disusun dari inventarisasi codebase Laporanmu-Web (19 folder feature, migrations 0001–0019) dan audit trace read-only `sidikmu-trace.md` (9 Nov 2026) + tangkapan layar Sidikmu v2.0. PRD ini **acuan build** — fleksibel, boleh di-improve/diubah selama build berjalan; perubahan keputusan arah (khususnya §11 dan §13) sebaiknya dikommit bersama dokumen ini.*
