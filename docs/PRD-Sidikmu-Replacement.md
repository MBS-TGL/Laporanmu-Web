# PRD — Laporanmu sebagai Pengganti Sidikmu

> **Versi:** v1.17 (Fase 5 — 6 Pusat Kemampuan) · **Tanggal:** 15 November 2026  
> **Perubahan v1.16 (Fase 3):**  
> 1. **Notifikasi WA otomatis diperluas ke 3 modul (Migration 0045):** toggle global baru di Pengaturan WA (`wa_settings`):
>    - **Surat resmi BK diterbitkan** → WA ke wali memuat jenis & nomor surat + link verifikasi QR `/verify?token=...` (sama dengan yang tercetak di kop).
>    - **Mutasi tabungan** (setor/tarik) → WA ke wali memuat jenis, nominal, saldo akhir, dan tanggal pencatatan.
>    - Pelanggaran (existing sejak 0026) tetap berjalan; ketiganya fire-and-forget — kegagalan kirim tidak pernah memblokir pencatatan, target `students.phone` via Edge Function `wa-broadcast`.
> 2. **Pipeline PPDB internal SENGAJA DI-SKIP (keputusan arsitektur):** form pendaftaran sudah ditangani web resmi sekolah (`smpmuh4tanggul.sch.id/admission`); konversi pendaftar ke santri cukup lewat impor Excel/CSV di Data Siswa yang sudah ada; volume musiman = ROI rendah. Tabel `public.admissions` di DB **tetap dipertahankan** (tanpa frontend) bila suatu saat panitia membutuhkan pipeline digital.  
> **Perubahan v1.15 (Fase 4 — CBT):**  
> 1. **Modul CBT SELESAI PENUH (Migration 0038):** Modul CBT terakhir dari Sidikmu kini digantikan:
>    - **Bank Soal** (`cbt_questions`): soal pilihan ganda per kelas-mapel, tiga jalur input — form per soal, **Impor Excel/CSV** (ImportWizard), **Input Cepat Teks** (paste format bebas), dan **Buat Draf Soal dengan AI** (Gemini: dari materi/CP-TP, file teks, atau normalisasi soal existing — draf selalu lewat pratinjau guru).
>    - **Sesi Ujian** (`cbt_exams`): durasi, jenis penilaian (formatif/sumatif/PTS/PAS), jumlah soal diacak, shuffle soal & opsi, penerbitan token ber-hash SHA-256 (tampil sekali, berlaku 7 hari, bisa diperbarui/dicabut).
>    - **Ujian santri tanpa akun** (`/exam`): token + NIS/NISN/kode registrasi; token TIDAK pernah lewat URL (sesi di sessionStorage, refresh otomatis resume); deadline & penilaian diputuskan server; autosave; layar tinjau sebelum kumpulkan; ragu-ragu; pintasan keyboard; ukuran font; fullscreen.
>    - **Anti-curang terintegrasi**: validasi kelas santri vs kelas ujian (lintas kelas ditolak), satu attempt per santri, rate limit 10 gagal/10 menit, deteksi pindah tab/blur/salin-tempel → peringatan inline untuk santri + `client_meta` attempt + **audit_logs source SECURITY** otomatis.
>    - **Monitoring pengawas** (`ExamDetailDrawer`): polling 15 detik, status per santri, sisa waktu, skor, jumlah peringatan, "Selesaikan Paksa", ekspor rekap.
>    - **Integrasi nilai**: publish ujian membuat entri `assessments`; skor submit otomatis upsert ke `assessment_scores` → mengalir ke `generate_semester_grade`, leger, dan portal wali tanpa kerja tambahan.
> 2. **Pengalaman UI ujian ditingkatkan**: shell fullscreen khusus ujian (header sticky + progress + countdown kritis), navigasi soal berwarna dengan legenda, transisi antar soal (MOTION 2), banner offline + retry autosave, notifikasi sisa waktu 10/5/1 menit.  
> **Perubahan v1.14 (Koreksi & Status Aktual Build):**  
> 1. **Klarifikasi Portal SPMB:** Formulir pendaftaran publik calon santri **sudah ada di website resmi sekolah** (`https://smpmuh4tanggul.sch.id/admission`), bukan di aplikasi Laporanmu-Web. Oleh karena itu, Laporanmu-Web **hanya menangani pipeline administrasi internal** (seleksi, status verifikasi, berkas, dan konversi otomatis menjadi data santri aktif tanpa formulir publik baru).  
> 2. **Fase 0 (Fondasi Akademik) SELESAI PENUH (Migration 0024 & 0025):**  
>    - Tabel `subjects` diperluas (`kkm`, `phase`, `curriculum_group`, `sort_order`).  
>    - Tabel `class_subjects` aktif dengan RLS granular (`is_class_subject_owner`, `is_homeroom_teacher`).  
>    - Tab **"Mapel & Guru"** di `ClassDrawer.tsx` untuk kelola guru mapel per kelas.  
>    - Fitur **Bulk Assign dari sisi Guru** (`TeacherAssignModal.tsx`) dan penampil **Beban Mengajar** di `TeacherDrawer.tsx`.  
>    - Halaman baru **Beban Mengajar Lintas Guru** (`/teaching-load`).  
>    - Restrukturisasi `student_semester_reports` agar skor umum membaca ID mapel dinamis.  
> 3. **Fase 1 (Penilaian Akademik & Leger) SELESAI PENUH (Migration 0028):**  
>    - Tabel `grade_configs` (bobot dinamis Formatif/Sumatif/PTS/PAS default 30/20/20/30).  
>    - Tabel `assessments` & `assessment_scores` dengan validasi kepemilikan guru mapel.  
>    - Halaman **Penilaian Akademik** (`/grades`), grid input nilai per ulangan (`/grades/:classSubjectId`), dan perhitungan ketuntasan KKM.  
>    - RPC `generate_semester_grade` untuk akumulasi nilai akhir terboboti langsung ke rapor semester umum.  
>    - Halaman **Leger Nilai** (`/grades/leger`) dengan matriks santri × mapel, ranking otomatis, status KKM, cetak & ekspor CSV.  
> 4. **Pengganti Sidik (Mesin Presensi) SELESAI PENUH (Migration 0029):**  
>    - Tabel `attendance_machines` & `machine_attendance_logs`.  
>    - RPC `ingest_machine_attendance` untuk menerima push scan mesin (sidik jari/RFID/waktu) dan auto-match ke NIS/NISN/Kode Registrasi santri.  
>    - RPC `sync_machine_to_daily_attendance` untuk memindahkan scan ke kehadiran harian (H).  
>    - Halaman **Mesin Presensi** (`/attendance/machines`) dengan log scan realtime & manajemen alat.  
> 5. **Fase 2 (Operasional Harian) SELESAI PENUH (Migration 0030, 0031, 0032):**  
>    - **Presensi Guru:** Tabel `teacher_attendance` + Halaman `/teachers/attendance` dengan mini-dashboard monev kehadiran.  
>    - **Jadwal v2 & Guru Pengganti:** Integrasi tabel `time_slots` (slot jam ke-1, dst.) pada form jadwal dan tabel `substitution_logs` + modal penunjukan guru pengganti hari ini di `/schedules`.  
>    - **Tabungan Santri Ber-PIN:** Otorisasi PIN petugas via tabel `profile_pins` + RPC `verify_staff_pin` di `/savings`, serta fitur cetak buku tabungan resmi santri (`SavingsPrintModal.tsx`).  
>    - **BK Lanjutan & Surat Resmi:** Tabel `official_letters` + Halaman `/counseling/letters` (Panggilan/Peringatan/Pujian) lengkap dengan penomoran surat, kop resmi, dan **QR Code Verifikasi**.  
> 6. **Fase 4 (CBT) SELESAI PENUH (Migration 0038):** Tabel `cbt_questions`/`cbt_exams`/`cbt_attempts`/`cbt_login_attempts`, RPC publik `cbt_start_attempt`/`cbt_save_answers`/`cbt_submit_attempt`/`cbt_report_event` + staf `cbt_force_submit`, halaman staf `/cbt` (Bank Soal & Sesi Ujian), halaman publik `/exam` untuk santri tanpa akun, anti-curang (validasi kelas, satu attempt, deadline server, deteksi tab/blur/salin-tempel → audit log SECURITY), dan skor yang mengalir otomatis ke pipeline nilai (`assessments` → `assessment_scores` → leger & portal wali).  
>    - **Verifikasi Dokumen Publik:** Halaman `/verify?token=...` aktif untuk memeriksa keaslian surat resmi via scan QR.  
>    - **Konseling Kelompok:** Tabel `counseling_participants` untuk sesi BK multi-santri/klasikal.  
>    - **Portal Wali Terpadu (`/check`):** Menampilkan poin, skorsing, presensi 3 bulan, saldo & riwayat tabungan, serta tab baru **Rapor Akademik Semester**.

---

## 1. Ringkasan Eksekutif

Sidikmu v2.0 (aplikasi vendor) saat ini menangani **sisi akademik formal sekolah**: nilai & raport Kurikulum Merdeka, presensi, tabungan keuangan, SPMB (PPDB), CBT, BK, dan monitoring evaluasi guru. Laporanmu (aplikasi internal buatan sendiri, React 19 + Vite + Supabase) sudah jauh lebih kuat di **sisi kesekretariatan pondok**: poin perilaku + skorsing berbasis token wali, asrama, UKS, izin pulang, raport bulanan pondok, portal wali publik, dan broadcast WhatsApp.

Per November 2026, ekspansi Laporanmu telah berhasil menggantikan **seluruh modul inti akademik, penilaian, presensi mesin/guru, dan tabungan keuangan** yang sebelumnya bergantung pada Sidikmu. Sekolah kini berada pada tahap siap melakukan penghentian lisensi vendor (cut-over).

**Prinsip utama yang telah terbukti dalam build:**

1. **Replikasi perilaku, bukan replikasi fitur** — fitur Sidikmu yang setara di Laporanmu (pelanggaran, presensi, catatan siswa) ditingkatkan dengan keamanan RLS Supabase dan integrasi audit log.
2. **Pola yang sudah terbukti dipakai ulang** — token publik security-definer (dari skorsing & surat resmi), halaman publik + kartu portal (`/check`, `/verify`), Fonnte Edge Function untuk notifikasi WA, impor/ekspor CSV/Excel, dan RPC atomik.
3. **Wali & santri tetap tanpa akun** — akses via PIN/token publik, sesuai pola yang sudah ada (`/check`, `/verify`, `/suspension/:token`). Ini pembeda penting dan menghemat manajemen akun.
4. **Modul berat ditunda/dikeluarkan secara sadar** — CBT (pilihan ganda) kini SUDAH digantikan (v1.15); yang tetap out-of-scope: soal uraian/CBT essay, proctoring kamera/AI, dan instrumen BK kompleks (MBTI/Sosiometri); portal pendaftaran publik SPMB tidak dibuat di Laporanmu karena **sudah ada di website resmi sekolah**.

---

## 2. Latar Belakang & Tujuan

### 2.1 Masalah

- Dua aplikasi berjalan paralel: data siswa/guru/kelas diinput dan dirawat dua kali, angka sering tidak sinkron.
- Sidikmu berbasis vendor: kustomisasi terbatas, biaya berulang, infrastruktur vendor sering mengalami kendala teknis (SQL error di keuangan, 404 menu terpasang).
- Modul internal Laporanmu sebelumnya belum meng-cover kebutuhan harian guru akademik (input nilai, leger, presensi guru, tabungan ber-PIN).

### 2.2 Status Capaian Tujuan Produk (Realita Saat Ini)

| # | Tujuan | Cara mengukur | Status Aktual |
|---|--------|----------------|---------------|
| T1 | Seluruh alur nilai → raport → leger → kenaikan kelas dikerjakan di Laporanmu | 100% kelas menginput nilai di Laporanmu pada PTS/PAS | ✅ **Siap 100%** (Modul Nilai, Leger, KKM, dan Promosi Kelas selesai) |
| T2 | Wali mendapat laporan lengkap via satu portal | Poin + nilai + presensi + tabungan + izin tersedia di `/check` | ✅ **Selesai** (`/check` mencakup poin, presensi, tabungan, dan rapor semester) |
| T3 | Keuangan tabungan santri pindah ke Laporanmu | Mutasi tabungan terekam 100% di Laporanmu dengan PIN petugas | ✅ **Selesai** (`/savings` ber-PIN, saldo realtime, cetak buku tabungan) |
| T4 | SPMB berjalan tanpa input ulang | Administrasi pendaftar → seleksi → menjadi data siswa aktif | 🟡 **Tersedia internal** (Formulir publik tetap di web resmi sekolah) |
| T5 | Sidikmu berhenti dipakai (lisensi dicabut) | Tidak ada aktivitas login di Sidikmu selama 1 bulan penuh | 🎯 **Target Cut-over Semester Berjalan** |

### 2.3 Non-tujuan (out of scope)

- Membuat form pendaftaran SPMB publik baru (portal resmi sekolah di `https://smpmuh4tanggul.sch.id/admission` tetap menjadi pintu utama).
- Membuat LMS/e-learning penuh atau aplikasi ujian berbasis AI proctoring.
- Multi-tenancy antar sekolah (satu institusi saja).
- Migrasi riwayat nilai historis lama dari Sidikmu (fresh-start per tahun ajaran).

---

## 3. Inventarisasi Komparasi: Sidikmu vs Kondisi Nyata Laporanmu

| Domain | Fitur Sidikmu | Status Aktual di Laporanmu (v1.14) |
|--------|---------------|------------------------------------|
| **Master Akademik** | Mata Pelajaran, Jam Pelajaran, Pembagian Kelas, Wali Kelas | ✅ **Selesai Penuh:** `subjects` (KKM, Fase, Kelompok), `time_slots`, `class_subjects` (Wali & Pengampu), `/teaching-load`. |
| **Penilaian & Raport** | Nilai Formatif/Sumatif, Bobot Nilai, Generate Nilai, Leger, Raport PTS/PAS | ✅ **Selesai Penuh:** `/grades`, Bobot dinamis (`grade_configs`), RPC `generate_semester_grade`, `/grades/leger` + ranking otomatis. |
| **Presensi & Mesin** | Presensi Siswa, Setting Jam, Data Presensi Mesin (Fingerprint/RFID) | ✅ **Selesai Penuh:** Presensi harian santri, master mesin & log scan realtime `/attendance/machines`, RPC `ingest_machine_attendance`. |
| **Kepegawaian / Monev** | Presensi Guru, Guru Pengganti, Beban Mengajar | ✅ **Selesai Penuh:** Presensi harian `/teachers/attendance`, penunjukan guru pengganti di `/schedules` (`substitution_logs`), analisis beban jam di `/teaching-load`. |
| **Keuangan** | Tabungan Siswa, PIN Pembayaran (Rusak di Sidikmu) | ✅ **Selesai Penuh:** `/savings`, mutasi atomik, proteksi hash PIN staf (`profile_pins`), cetak buku tabungan resmi. |
| **Bimbingan Konseling (BK)** | Pelanggaran, Prestasi, Konseling Kelompok, Surat Resmi | ✅ **Selesai Penuh:** Catatan poin pelanggaran/prestasi, konseling kelompok (`counseling_participants`), surat resmi ber-QR `/counseling/letters`, verifikasi publik `/verify`. |
| **SPMB / PPDB** | Form Publik, OTP WA, Seleksi, Konversi Siswa | 🔄 **Disesuaikan:** Form publik ada di website sekolah; Laporanmu mengelola pipeline seleksi internal (`admissions`) hingga konversi santri. |
| **CBT** | Bank Soal, Ujian Token, Monitoring Ujian | ✅ **Selesai Penuh:** Bank soal multi-jalur input (form/impor/paste/AI), ujian ber-token tanpa akun `/exam`, anti-curang + audit log, monitoring pengawas, skor mengalir ke pipeline nilai. |

---

## 4. Arsitektur & Skema Database Aktual

Hingga migrasi `0032_daily_ops_v2.sql`, struktur database Laporanmu mencakup seluruh modul penting:

### 4.1 Tabel Baru yang Telah Diterapkan

1. **Akademik & Nilai (Fase 0 & 1):**
   - `subjects`: Master mapel + KKM, fase, kelompok kurikulum, dan sort order.
   - `class_subjects`: Plotting mapel-kelas-guru per tahun ajaran + override KKM.
   - `grade_configs`: Konfigurasi bobot penilaian per tahun ajaran.
   - `assessments`: Ulangan formatif, sumatif, PTS, dan PAS per mapel kelas.
   - `assessment_scores`: Nilai angka santri per ulangan.
   - `students.previous_class_id` & `promotion_batch_id`: Pelacakan kenaikan kelas (promosi massal yang bisa di-undo).

2. **Mesin Presensi (Pengganti Sidik Jari):**
   - `attendance_machines`: Master alat mesin presensi fisik beserta API key token.
   - `machine_attendance_logs`: Log scan mentah dari mesin + status auto-match ke santri.

3. **Operasional Harian & Kepegawaian (Fase 2):**
   - `time_slots`: Slot jam KBM per tahun ajaran.
   - `teacher_attendance`: Log harian absensi guru (Hadir, Sakit, Izin, Tugas Luar).
   - `substitution_logs`: Pencatatan penunjukan guru pengganti jadwal hari berjalan.

4. **Keamanan & Keuangan:**
   - `profile_pins`: Hash bcrypt/blowfish PIN petugas keuangan untuk otorisasi transaksi kas.
   - `savings_accounts` & `savings_transactions`: Rekening tabungan santri dan mutasi setor/tarik saldo atomik.

5. **Bimbingan Konseling & Persuratan Resmi:**
   - `official_letters`: Arsip surat resmi (panggilan, peringatan, pujian) dengan token unik.
   - `counseling_participants`: Relasi multi-santri untuk sesi konseling kelompok/klasikal.

---

## 5. Rincian Fitur Utama yang Sudah Berjalan

### 5.1 Penilaian Akademik & Leger Nilai (`/grades` & `/grades/leger`)
- **Konfigurasi Bobot:** Bebas disesuaikan per tahun ajaran (default: Formatif 30%, Sumatif 20%, PTS 20%, PAS 30%).
- **Input Grid Cepat:** Memilih jenis penilaian, menambah ulangan tak terbatas, input skor santri dalam format tabel ringkas dengan deteksi perubahan belum tersimpan (draft mode).
- **Ketuntasan KKM Otomatis:** Perhitungan nilai akhir terboboti secara instan dengan indikator Tuntas / Belum Tuntas berdasarkan KKM mapel atau override kelas.
- **Generate ke Rapor Semester:** Sekali klik menuliskan nilai akhir terboboti ke tabel `student_semester_reports` tipe `general` tanpa menimpa mapel lain.
- **Leger Lengkap:** Menampilkan matriks santri × seluruh mata pelajaran, peringkat kelas otomatis (berdasarkan rata-rata), cetak lembar nilai, dan ekspor CSV.

### 5.2 Integrasi Mesin Presensi Fisik (`/attendance/machines`)
- **Ingest API Publik:** Endpoint RPC `ingest_machine_attendance` menerima payload dari perangkat fingerprint/RFID lokal via HTTP PostgREST.
- **Pencocokan Otomatis:** Mesin mengirimkan nomor ID santri yang otomatis dipetakan ke NIS, NISN, atau Kode Registrasi.
- **Sinkronisasi Absensi:** Tombol "Sinkronkan ke Absensi" sekali klik menandai Hadir (H) pada modul Absensi Santri harian untuk semua santri yang terdeteksi melakukan scan pada tanggal tersebut.

### 5.3 Presensi Guru & Guru Pengganti (`/teachers/attendance` & `/schedules`)
- **Pencatatan Kehadiran Guru:** Input status guru harian (Hadir, Sakit, Izin, Tugas Luar) dengan fitur cepat "Set Semua Hadir" dan mini dashboard monev kehadiran.
- **Penunjukan Pengganti:** Di halaman Jadwal KBM, staf kurikulum/piket dapat menunjuk guru pengganti untuk jadwal yang pengampunya sedang absen hari ini. Tampilan jadwal otomatis mencoret guru utama dan menandai guru pengganti.

### 5.4 Keuangan Tabungan Ber-PIN & Cetak Buku (`/savings`)
- **Validasi Keamanan Transaksi:** Setiap aksi setor atau tarik tabungan mewajibkan input PIN petugas kas (terverifikasi via RPC `verify_staff_pin`).
- **Cetak Buku Tabungan Resmi:** Format cetak rapi ber-kop sekolah dengan rincian debit/kredit, saldo akhir, tanggal transaksi, dan nama petugas pencatat.

### 5.5 Persuratan Resmi BK & Verifikasi QR (`/counseling/letters` & `/verify`)
- **Penerbitan Surat Cepat:** Template otomatis untuk Surat Panggilan Wali Santri, Surat Peringatan (SP), dan Piagam Apresiasi Prestasi dengan nomor surat otomatis.
- **Cetak Ber-Kop & QR Code:** Surat dicetak lengkap dengan QR Code yang menunjuk ke URL publik `/verify?token=...`.
- **Portal Verifikasi Publik:** Siapa pun (wali murid / instansi) yang men-scan QR Code dapat melihat rincian keaslian dokumen tanpa perlu login ke sistem.

### 5.6 Portal Wali Terpadu (`/check`)
Wali murid cukup memasukkan Kode Registrasi Santri + PIN untuk melihat:
- Poin perilaku & riwayat pelanggaran/prestasi.
- Status pembinaan / skorsing rumah (bila ada).
- Rekap kehadiran 3 bulan terakhir.
- Rapor bulanan pondok (aspek ibadah, akhlak, kebersihan, quran, bahasa).
- **Rapor Akademik Semester:** Nilai angka seluruh mata pelajaran formal.
- **Buku Tabungan:** Saldo kas santri dan riwayat mutasi setor/tarik terakhir.

---

## 6. Penyesuaian Ruang Lingkup SPMB / PPDB

> **Koreksi Penting Berdasarkan Kondisi Nyata:**  
> Website resmi sekolah (`https://smpmuh4tanggul.sch.id/admission`) telah beroperasi melayani pendaftaran publik online calon siswa baru.

Dengan demikian, arsitektur SPMB di Laporanmu disesuaikan menjadi **Modul Administrasi Internal PPDB**:
1. **Tidak Membangun Formulir Publik Baru:** Pendaftar mengisi data di website resmi sekolah.
2. **Impor / Sinkronisasi Data Calon Siswa:** Data pendaftar dari website resmi diimpor ke tabel `admissions` Laporanmu-Web.
3. **Pipeline Seleksi & Verifikasi Berkas:** Panitia PPDB memverifikasi kelengkapan berkas fisik, hasil tes wawancara, dan penetapan status kelulusan (Lulus / Cadangan / Ditolak).
4. **Konversi Otomatis Menjadi Santri Aktif:** Calon santri yang berstatus "Daftar Ulang" dapat dikonversi menjadi data master santri (`students`) lengkap dengan penempatan kelas dan nomor registrasi hanya dengan satu klik.

---

## 7. Status Roadmap & Langkah Selanjutnya

| Fase | Scope | Status Aktual |
|------|-------|---------------|
| **Fase 0 — Fondasi Akademik** | Mapel, Class Subjects, Beban Mengajar, Perluasan Master Siswa | ✅ **100% Selesai** |
| **Fase 1 — Penilaian Akademik** | Penilaian Formatif/Sumatif/PTS/PAS, KKM, Leger Nilai, Promosi Kelas | ✅ **100% Selesai** |
| **Pengganti Sidik** | Ingest Log Mesin Presensi Fisik, Pencocokan Otomatis, Sinkronisasi Harian | ✅ **100% Selesai** |
| **Fase 2 — Operasional Harian** | Presensi Guru, Guru Pengganti, Tabungan Ber-PIN, Surat Resmi BK + QR, Konseling Kelompok, Portal Wali Lengkap | ✅ **100% Selesai** |
| **Fase 3 — Notifikasi WA Otomatis** | WA otomatis surat resmi BK (+link verifikasi) & mutasi tabungan | ✅ **100% Selesai** |
| **Fase 3 — Pipeline PPDB Internal** | Impor pendaftar web resmi, seleksi, konversi santri | ⏭️ **Sengaja di-Skip** (form publik ada di web resmi; konversi via impor Data Siswa; tabel `admissions` tetap ada di DB) |
| **Fase 4 — CBT** | Computer Based Test (bank soal, ujian token, anti-curang, monitoring) | ✅ **100% Selesai** |
| **Fase 4 — Pelengkap** | Instrumen Lanjutan BK (AKPD/MBTI/Sosiometri) | ⏸️ **Ditunda (Opsional)** |

---

## 8. Panduan Migrasi Database Baru

Pengguna harus memastikan seluruh file migrasi berikut telah dieksekusi di SQL Editor Supabase:

1. `0024_academic_foundation.sql` (Fondasi Mapel & Relasi Kelas)
2. `0025_teacher_assignments.sql` (Bulk Assign Guru Mapel)
3. `0028_grades.sql` (Penilaian, Ulangan, KKM, dan Rapor Semester)
4. `0029_attendance_machines.sql` (Mesin Presensi Fisik & Log Scan)
5. `0030_promotion.sql` (Fitur Naik Kelas Massal)
6. `0031_daily_ops.sql` (Time Slots, Absensi Guru, Surat Resmi BK, PIN Kas, Rapor di Portal)
7. `0032_daily_ops_v2.sql` (Time Slot Jadwal, Guru Pengganti, Konseling Kelompok)
8. `0038_cbt.sql` (CBT: bank soal, ujian ber-token, anti-curang, integrasi nilai)
9. `0045_wa_automation.sql` (WA otomatis surat BK & tabungan: kolom toggle + extend RPC `wa_settings`)

---

*Dokumen ini diperbarui secara berkala agar selalu mencerminkan kondisi kode program dan database yang aktif di Laporanmu-Web. Per November 2026: seluruh modul inti Sidikmu telah digantikan. Tahap lanjutan: **Fase 5 — 6 Pusat Kemampuan** (Evaluasi, Kehadiran, Kerohanian, Dokumen, Konektivitas, CBT Elit) — rencana lengkap di `docs/archive/PLAN-Fase5-Pusat.md`. Status: Evaluasi (0049), CBT Elit (0048), dan **Konektivitas P5** (0051-0053: webhook PPDB + API key, multi-entity + switcher Topbar, portal santri PWA `/portal` + web push) sudah dijalankan dan **terverifikasi end-to-end dengan data nyata**. **Kehadiran P2 (0054), Kerohanian P3 (0055), dan Dokumen P4 (0056) sudah code-done** (absensi per jam pelajaran + WA + analitik; kemahiran ibadah per butir + preset + nilai bulanan; raport Kurmer + KHS + transkrip + buku induk + yudisium) — migrasi 0054-0056 menunggu eksekusi.*
