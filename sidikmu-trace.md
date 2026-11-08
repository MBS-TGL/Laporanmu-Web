# sidikmu-trace.md — Inventaris Fitur Internal (read-only)

## 1. Identitas sesi & metode

- **Target**: https://mbstanggul.sidikmu.com/ — aplikasi internal "SidikMu" (Sidikmu v2.0, © 2017-2026).
- **Login**: sukses 1 percobaan (akun uji; kredensial TIDAK dicatat). **Role aktif: Kepala Sekolah** di SMP Muhammadiyah 4 Tanggul (satu-satunya sekolah pada workspace).
- **Grid aplikasi (nine-dots, 9 item)**: Master · Akademik · Keuangan · Monev Guru · Monev Nilai (`#`) · SPMB · Elearning (`#`) · CBT · BK. Dua item `href=#` = tanpa halaman terpisah.
- **Metode**: Playwright + Chrome headless, **strict read-only** — hanya navigasi, buka modal untuk melihat field, lalu tutup via Escape/Batal; **tidak ada form disubmit, tidak ada tombol simpan/generate/terima ditekan**. 0 screenshot (teks saja, batas maks 5). Login dipakai ulang dari `storageState` (1x login total).
- **URL**: setiap halaman berupa `?<TOKEN>` opaque (tidak dicatat penuh); sebagian menu hanya anchor (`#...`) di halaman dashboard modul. Anchor stabil dan dicatat.
- **Ekstrak**: heading, header tabel (`th`), label field, tombol, jumlah baris (strukturnya saja — **tanpa isi baris/nama/NIS/nilai individual**).

## 2. Peta menu per dashboard (ringkas)

- **Dashboard home (`index.php`)** — kartu cepat: Input Nilai Formatif · Input Nilai Sumatif · Edit Nilai Kurmer · Input/Edit Nilai ICP · Pelanggaran Siswa · Tabungan · **PIN Transaksi** ("Atur PIN pembayaran") · Logout. Panel: Statistik Singkat · Data Nilai Dalam 1 Semester (bobot: Formative 30 / Sumatif 20 / Sum Tengah 20 / Sum Akhir 30) · Data Progress Nilai Mapel (tabel Mapel|Progress).
- **Master**: User · Setting Presensi (Setting Dashboard, Titik Lokasi QRCode, Shift Presensi, Data Presensi Mesin) · Face Recognition (Registrasi Wajah, Data Wajah) · Pendidikan (Batas Semester, Kelas, Siswa) · Jadwal & Pelajaran (Mata Pelajaran, Jam Pelajaran) · Ekstrakurikuler (Data Ekskul, Jadwal Ekskul) · Kepegawaian (Data Pegawai, Wali Kelas) · Jadwal & Materi ICP · Materi Praktek (Range Nilai, BTA, Wudhu, Sholat, Hafalan Surah/Hadist/Doa) · Kokurikuler (Pengaturan Nilai, Dimensi, Kegiatan) · 7 KAIH (Master, Data Rekap) · Pembagian Kelas (per kelas) · Deskripsi CP (per kelas×mapel) · Deskripsi TP (per kelas×mapel) · Rekap Prestasi.
- **Akademik**: Dashboard Presensi (Asrama Bambu Kuning, SMP Muh 4 Tanggul → `dashboard_presensi.php`) · Monitoring Nilai KM · Generate Nilai · Penilaian Kokurikuler · Nilai KM (Input Formatif, Input Sumatif, Edit Nilai) · Nilai Ekstrakurikuler · Prestasi Siswa · Peringkat Siswa · Presensi Siswa (Input, Data, Per Mapel) · Catatan Siswa · Raport PTS (TA 2018/2019–2026/2027 → kelas) · Kenaikan Kelas (2026/2027 → kelas) · Raport PAS (TA sama) · Arsip Nilai (DKN Kurmer).
- **Keuangan**: Master Data (Siswa Aktif/Non Aktif; Keuangan: Rekening, Satuan, Pos Penerimaan→Anggaran/Sub Anggaran, Pos Pengeluaran→Program/Sub Program, Kewajiban Per Kelas/Siswa/Siswa Inden, Suplier) · Master RAPBS (per TA) · Transaksi Tunai (Pembayaran Siswa, Pengeluaran Tunai) · Transaksi Bank · Data Transaksi · Tabungan Siswa (Masuk/Keluar/Data, Mutasi Antar Akun, Lap Tabungan Harian/Bulanan) · Tabungan Non Siswa · Laporan (per TA: Lap RAPBS, Rekap Transaksi Tunai/Bank, Rekap Per Komponen, Lap Keu Harian/Bulanan/Semester/Tahunan).
- **Monev Guru**: Materi & Perangkat (`#menu_perangkat`) · Index Penilaian (per TA→kelas) · Analisis Nilai Mapel (per mapel) · Buku Induk KurMer (per TA→kelas) · Request Guru Pengganti · Pantau Guru Kelas · Setting Jam · Data Guru & Jadwal · Laporan Monev Guru (Prosentase Kinerja, Presensi Umum→by Bulan/by Nama, Presensi By Jadwal).
- **SPMB**: Input Formulir · Data Formulir · Data Calon Siswa · Data Unregister · Data Hasil Seleksi · Data Sarana · Data Rekap Sarana · Data Rekomendasi · Informasi Umum/Dokumen/Pendaftaran · Proses Seleksi · Jadwal SPMB · Master.
- **CBT**: Deskripsi CP · Upload File · Input Soal (PG, PG Multi, True-False, Matching, Essay, Polygon Hotspot, Video Reaction) · Bank Soal (`#banksoal`) · Setting ujian · Data Ujian (Aktif/Belum/Selesai, Master).
- **BK**: Ganti Password · Pengaturan & Poin (Kategori Pelanggaran, Tingkat Sanksi/SP) · Pelanggaran Siswa · Prestasi Siswa · Rekap Poin Siswa · Data Presensi Mesin · Data Presensi · Konseling Individu/Kelompok · Bimbingan Kelompok/Klasikal · Home Visit · AKPD (Angket, Hasil) · Sosiometri (Angket, Hasil) · MBTI (Angket, Hasil) · Surat Panggilan Ortu · Surat Peringatan/Perjanjian · Laporan Rekap BK · Kategori Materi · Upload File Audio · Input Soal TPA (7 jenis) · Setting Ujian (TPA) · Bank Soal (TPA) · Hasil TPA (Aktif/Belum/Selesai) · Data User (`#`).

## 3. Tracing halaman kunci (status per item)

### A. Keuangan — modul rusak + ditolak untuk role ini
| Halaman | Status | Struktur / catatan |
|---|---|---|
| Dashboard Keuangan | **ERROR SQL** | `Fatal error: Unknown column 'file_bukti' in 'SELECT'` di `home_keuangan.php:4` (mysqli) |
| Tabungan Masuk (Siswa) | KOSONG | hanya footer; tidak ada field/tabel |
| Tabungan Keluar (Siswa) | KOSONG | sama |
| Data Tabungan | **DITOLAK** | `ACCESS DENIED` (`k_data_transaksi_tabungan.php`) |
| Pembayaran Siswa | KOSONG | hanya footer |
| Pengeluaran Tunai | KOSONG | hanya footer |
| Rekening (Master Data) | KOSONG | hanya footer |
| Kewajiban Per Siswa | **DITOLAK** | `NO ACCESS` (`m_set_kewajiban_persiswa.php`) |
| Master RAPBS / Transaksi Bank / Tabungan Non Siswa / Laporan Tabungan Harian | anchor | kembali ke dashboard Keuangan (yang error SQL) |
| **PIN Transaksi** | kartu home | "Atur PIN pembayaran"; kartu `menu-card` tanpa href/onclick — klik TIDAK berpindah halaman |
| **Money Nilai** | **TIDAK DITEMUKAN** | tidak ada label "Money" di seluruh menu/dashboard; kandidat terdekat: **Monitoring Nilai KM**, **Generate Nilai**, kartu "Data Nilai Dalam 1 Semester" (bobot 30/20/20/30) |

### B. Nilai (Akademik) — semua AKSES, pola filter 2 tahap
| Halaman | Field filter / aksi | Tabel |
|---|---|---|
| Input Nilai Formatif | TA, Semester, Kelas, Mapel, Kode CP, Kode TP → `Proses Selanjutnya` | muncul setelah proses (0 baris awal) |
| Input Nilai Sumatif | TA, Semester, **Jenis Nilai**, Kelas, Mapel → `Proses Selanjutnya` | idem |
| Edit Nilai KM | TA, Semester, Kelas, Mapel → `Proses Selanjutnya` | idem |
| Generate Nilai | TA, Semester → tombol `Generate Nilai` \| `Reset Nilai` (TIDAK ditekan) | — |
| Monitoring Nilai KM | — | **12 baris**: Kelas\|Mapel\|Aspek\|Jenis\|Kategori\|Nilai Ke\|Siswa Aktif\|Tercatat\|Selisih\|Status |
| Penilaian Kokurikuler | 1 select | 0 baris |
| Arsip Nilai → DKN Kurmer | TA, Semester, Kelas; `Pilih Semua`/`Reset`/`Export Excell` | 0 baris |
| Bobot | **tidak ada field bobot** di halaman input | bobot hanya tampil di home (30/20/20/30) |

### C. Raport (contoh: VII A TA 2026/2027, struktur saja)
- **Raport PTS**: judul "Raport PTS VII A"; tabel **28 baris**: `No | NIS | Nama Siswa | MENU` + 3 tabel ringkas pendukung.
- **Raport PAS**: judul "Raport PAS VII A | TA : 2026/2027"; tabel **28 baris**: `No | NIS | Nama Siswa | R. Akademik` + 3 tabel ringkas.
- (Nilai per siswa tidak disalin — hanya header & jumlah baris.)

### D. Kenaikan Kelas
- **Kenaikan Kelas VII A 2026/2027**: tabel **14 baris**: `No | NIS | Nama Siswa | Naik / Tinggal | Status`; select per baris (`kenaikan[id]`); tombol **Simpan** — TIDAK ditekan.

### E. Presensi & wajah
| Halaman | Status | Struktur |
|---|---|---|
| Input Presensi | AKSES | "Input/Edit Presensi Siswa"; filter TA/Semester/Kelas/Tanggal; 0 baris awal |
| Data Presensi | AKSES | filter TA/Kelas/Bulan/Tahun |
| **Presensi Per Mapel** | **404 Not Found** | menu ada, halaman tidak ada |
| Dashboard Presensi SMP | AKSES | `dashboard_presensi.php?…`; field `Scan QR / Tempel RFID…`; tabel log `ID/NIS\|NAMA ANGGOTA\|KELAS\|WAKTU LOG` (0 baris malam hari); tombol `Tes Suara`; panel "SINKRON SERVER", "Inteligensia Kamera Wajah" |
| Shift Presensi (Master) | AKSES | tabel `MENU\|NAMA JADWAL\|SENIN-KAMIS\|JUMAT\|SABTU-MINGGU`; pesan "Belum ada data master jadwal presensi"; modal: Nama Jadwal, jam telat/pulang-awal per hari (SK/Jumat/akhir pekan) |
| Data Presensi Mesin | AKSES | **169 baris**: `No.\|NIS\|Nama Siswa\|Kelas\|Status\|Total Scan\|Total Datang\|Total Pulang\|Presensi Pertama\|Presensi Terakhir\|Telat`; filter kelas/tanggal/status/cari |
| Titik Lokasi QRCode | AKSES | **2 baris**: `MENU\|KATEGORI\|NAMA LOKASI\|LATITUDE\|LONGITUDE\|RADIUS (M)\|MIN PULANG (MENIT)\|WA WALAS\|WA ORTU\|QR CODE`; modal: kategori, lokasi, lat/long, radius, min durasi, checkbox WA walas/ortu, jam presensi |
| Registrasi Wajah | AKSES | "Registrasi Wajah Baru"; 2 select; tombol `Memuat AI…` \| `Simpan Registrasi` |
| **Data Wajah** | **404 Not Found** | menu ada, halaman tidak ada |

### F. Monev Guru
- **Materi & Perangkat**: section di dashboard — kartu statistik (Jumlah Request Guru Pengganti, Guru Pengganti Hari Ini, Guru Tidak Hadir Hari Ini, Request Menunggu Persetujuan, Guru Pengganti Bulan Ini, Persentase Kehadiran) + tabel **Data Materi Hari Ini** `Mapel | Download File` (1 baris) + pencarian dokumen.
- **Request Guru Pengganti**: tabel **1 baris** `Tanggal\|Jam Ke\|Guru Asli\|Mapel\|Kelas\|Status\|Guru Pengganti\|Aksi`; filter status + rentang tanggal; `Terapkan`/`Export`; indikator "0 data".
- **Buku Induk KurMer VII A 2026/2027**: "Daftar Buku Induk Siswa"; ringkasan (Total Siswa/L/P); tabel **14 baris** `No\|NIS/NISN\|Nama Lengkap Siswa\|JK\|Status Akademik\|Aksi Berkas`; tombol `Buka Portofolio`.
- **Pantau Guru Kelas**: grid per kelas (VII A–D, VIII A–D, IX A–C) dengan jam/waktu realtime + `Refresh`.
- **Prosentase Kinerja**: "Lap Kinerja Guru"; 0 baris.
- **Index Penilaian / Analisis Nilai Mapel**: anchor per TA/mapel (struktur mirip Raport PTS).

### G. SPMB
| Halaman | Status | Struktur |
|---|---|---|
| Input Formulir | AKSES | "Input Calon Siswa Baru (Reguler Bukan Inden) TA 2027/2028"; section Data Ayah/Ibu/Wali (Opsional); ±55 field: nisn, nik, nama, jk, agama, status_anak, alamat (prov/kab/kec/kel), tempat/tgl lahir, hp, ukuran seragam, rekomendasi, sekolah asal, kondisi+data ortu, foto_siswa/kk/akte/payment; tombol `Simpan Data` (TIDAK ditekan) |
| Data Formulir | AKSES | tabel `No. Reg\|Nama\|Tgl Daftar\|Periode\|Status\|Aksi` (1 baris); `Export Excel`/`Hapus` |
| Data Calon Siswa | AKSES | `…\|HP Ibu\|Status\|Aksi` (1 baris); `Terima sbg siswa`/`Batalkan Verifikasi` (TIDAK ditekan) |
| Data Unregister | AKSES | `…\|Jurusan\|HP Ibu\|Status\|Aksi`; `Re-register Terpilih` |
| Data Hasil Seleksi | AKSES | `No. Reg\|Nama\|Tgl Daftar\|Periode\|HP Ibu\|Status\|Aksi` (1 baris); `Batalkan Penerimaan`/`Excel`/`Print` |
| Data Rekomendasi | **RUSAK** | hanya PHP warning bertumpuk (`headers already sent`, `spmb_data_rekomendasi.php:5`) — tanpa konten |
| Informasi Umum/Dokumen/Pendaftaran, Proses Seleksi, Jadwal SPMB | AKSES | masing-masing editor rich-text **"Kelola Informasi PPDB"** (toolbar Bold/Paragraph/dll) + `Simpan Perubahan` |
| **OTP SPMB** | di portal publik | `/spmb` (→ `/spmb/index.php`): field `no registrasi`, `16 digit NIK`, `NISN`, `no HP`, **`Masukkan 6 digit OTP`**; `/spmb/registrasi.php`: "Form Pre-Registrasi" — **"Isi Nomor WhatsApp untuk menerima kode verifikasi"** (OTP via WA) |

### H. CBT
| Halaman | Status | Struktur |
|---|---|---|
| Input Soal → Pilihan Ganda | AKSES | filter TA/Semester/Kelas/Mapel/Kode CP → `Proses Selanjutnya` |
| Upload File | AKSES | "Bank Media Audio CBT / Daftar Media": `Judul\|Preview\|Status\|Tanggal\|Aksi` (1 baris); `Upload Media` |
| Setting ujian | AKSES | "Setting Ujian By Admin": tipe_setting, sumber_materi, Mapel, Jenis Nilai, use_proctor, jumlah soal, `start/stop_ujian` (datetime), durasi; konfigurasi jumlah+nilai per jenis soal (PG/PGM/Matching/Essay/Hotspot/Video × Mudah/Sedang/Sulit); tabel `Jenis Soal\|Mudah\|Sedang\|Sulit` (7 baris); `Simpan` (TIDAK ditekan) |
| Bank Soal / Data Ujian Aktif | section dashboard | kartu **Ujian Aktif**: Total Peserta Aktif, Selesai Mengerjakan, Belum Mengerjakan, **Token Pending**, "Grafik Pelanggaran Ujian Aktif (Real-time)" |
| **Cara siswa masuk** | halaman publik `/cbt` | "CBT Sidikmu" — **Username (NIS) + Password (Kode Ujian)** → tombol `Mulai Ujian`; CBT Version 3.0. (kata "token" di admin = Token Pending pada kartu ujian aktif) |

### I. BK — status lengkap (role Kepala Sekolah)
**DITOLAK eksplisit** (`Akses Ditolak! Anda tidak memiliki izin mengakses modul BK.`, 15 halaman): Konseling Individu · Konseling Kelompok · Bimbingan Kelompok · Bimbingan Klasikal · Home Visit · Angket AKPD · Hasil & Analisis AKPD · Angket Sosiometri · Hasil & Sosiogram · Angket MBTI · Hasil MBTI · Surat Panggilan Ortu · Surat Peringatan/Perjanjian · Laporan Rekap BK · Rekap Poin Siswa.

**AKSES / ADA**:
- **Pelanggaran Siswa**: tabel `NO\|TANGGAL\|NAMA SISWA & NIS\|JENIS PELANGGARAN\|KATEGORI\|POIN\|PELAPOR\|AKSI` (1 baris); tombol `Catat Pelanggaran`.
- **Data Presensi Mesin**: 169 baris (tabel sama dengan Master).
- **Data Presensi**: filter TA/Kelas/Bulan/Tahun + **PHP warning** `Undefined array key "skelaswali"` (`a_presensi_data.php:2`).
- **Bank Soal TPA**: `No\|Jenis\|Materi\|Subtes\|Isi Soal\|Level\|Media\|Aksi` (1 baris); `Tambah Soal`.
- **Upload File Audio**: Bank Media Audio CBT (1 baris).
- **Ganti Password**: `pass_lama`, `pass_baru`, `pass_baru2`.
- **Dashboard BK**: "Laporan & Analisis Bimbingan Konseling" — Proporsi Kategori Pelanggaran, 5 Pelanggaran Paling Sering Terjadi, 5 Siswa dengan Akumulasi Poin Tertinggi; filter 2 tanggal. (Hasil TPA → anchor yang menampilkan dashboard ini.)

**KOSONG (footer saja, kemungkinan ditolak tanpa pesan)**: Kategori Materi · Setting Ujian (TPA).
**404**: **Prestasi Siswa** (BK).
**`href=#`**: Data User (klik → dashboard BK). **Surat Pujian: TIDAK ADA** di menu BK.
Belum diuji terpisah: Kategori Pelanggaran, Tingkat Sanksi/SP, Input Soal TPA (7 jenis), Hasil TPA per status.

### J. Master
| Halaman | Status | Struktur |
|---|---|---|
| Batas Semester | AKSES | field tanggal awal/tengah/akhir × Gasal & Genap; `Simpan Perubahan` |
| Kelas | AKSES | **10 baris** `MENU\|KELAS\|NAMA KELAS\|JADWAL PRESENSI\|QR CODE`; modal: Jenjang, Nama Kelas, Jadwal Presensi; `Download All QR` |
| Siswa (Pendidikan) | AKSES (0 baris default) | header `MENU\|NIS\|NAMA\|KELAS\|HP IBU\|TANGGUNGAN\|QR CODE`; cari NIS/nama; `Tambah Siswa`/`Download All QR`/`Download Data` |
| Data Pegawai | AKSES (0 baris default) | header `MENU\|NIP/NBM\|NUPTK\|NAMA\|HP\|QR CODE`; **modal 21 field**: nip, nbm, nuptk, nik, nama, jk, ttl, agama, status_nikah, jenis_staf, jabatan, status_staf, hp, email, alamat_ktp/domisili, foto, username, password, rfid |
| Wali Kelas | AKSES | **13 baris** `NAMA GURU\|KELAS`; select wali per kelas; `Simpan Semua` |
| Data Ekskul | AKSES | **10 baris** `Menu\|Nama Ekstrakurikuler`; modal nama; `Tambah Ekstrakurikuler` |
| Jadwal Ekskul | AKSES | **1 baris** `Menu\|Ekstrakurikuler\|Hari\|Jam\|Guru Pembina\|Kelas`; `Tambah Jadwal` |
| Pengaturan Nilai Kokurikuler | AKSES | radio: Per Semester (1 catatan/siswa) / Per Pertemuan; `Simpan` |
| Dimensi (Kokurikuler) | AKSES | **8 baris** `Kode\|Nama Resmi\|Deskripsi Singkat\|Aktif\|Sub Dimensi`; edit inline 7 dimensi (keimanan…penalaran_kritis); `Simpan Perubahan`/`Kelola` |
| Kegiatan (Kokurikuler) | AKSES (0 baris) | header `No\|Nama Kegiatan\|Sub Kelas\|Sub Dimensi\|Aktif\|Aksi`; modal: nama, keterangan, checklist subkelas, checklist subdimensi, status |
| 7 KAIH Master | AKSES | Master Kebiasaan **7 baris** (`Urut\|Kebiasaan\|Status\|Aksi`) + Master Subkegiatan **15 baris** (`…\|Poin\|…`); form inline (nama, urutan, poin, aktif) |
| 7 KAIH Data Rekap | AKSES | **167 baris** `No\|NIS\|Nama Siswa\|Kelas\|Hari Mengisi\|Kebiasaan\|Kegiatan\|Total Poin\|Status\|Aksi`; filter tanggal + subkelas; `Tampilkan`/`Export Excel`/`Detail` |
| Deskripsi CP (contoh: BTA Kelas 7) | AKSES | **1 baris** `Menu\|Kode CP\|Materi Pokok\|Keterangan\|Semester`; modal: kode, materi_pokok, keterangan, cek Gasal/Genap |
| Deskripsi TP (contoh: BTA Kelas 7) | AKSES | **5 baris** `Menu\|Kode CP\|Kode TP\|Deskripsi`; modal: pilih CP, kode, deskripsi, cek Semester |
| Pembagian Kelas VII A | AKSES | **1 baris** `NO\|NAMA SISWA\|JK\|INPUT NIS BARU`; pesan "Tidak ada data siswa yang menunggu pembagian kelas"; `Upload Data Siswa via Excel` |
| Mata Pelajaran | AKSES (0 baris) | header `MENU\|KODE\|NAMA MAPEL\|NO URUT KURMER`; modal: kode, nama, no_urut_ikm, cek "Guru boleh mengajar kelas lain pada jam yang sama" |
| User · Jam Pelajaran · Jadwal & Materi ICP · Materi Praktek (Range Nilai dst.) · Rekap Prestasi | ada di menu | belum diuji terpisah |

## 4. Temuan & catatan

1. **Bug berat — modul Keuangan**: dashboard `home_keuangan.php` fatal SQL (`Unknown column 'file_bukti'`); 2 halaman menampilkan `ACCESS DENIED`/`NO ACCESS`; 5 halaman transaksi kosong total → modul Keuangan tidak berfungsi untuk role Kepala Sekolah (permission + schema).
2. **Matriks izin**: role Kepala Sekolah **tidak memiliki akses modul BK inti** (15 halaman "Akses Ditolak") maupun transaksi Keuangan; yang bisa dibuka: Pelanggaran Siswa, presensi, TPA sebagian, Ganti Password, dan seluruh Akademik/SPMB/Master/Monev/CBT.
3. **404**: Akademik→Presensi Per Mapel, Master→Data Wajah, BK→Prestasi Siswa.
4. **PHP warning terlihat** di banyak halaman (`headers already sent` di `index.php:230`; `Undefined array key "skelaswali"` di `a_presensi_data.php`) — indikasi output buffer/sesi bermasalah; Data Rekomendasi SPMB isinya warning saja.
5. **Item hilang / tidak ada**: "Money Nilai" (tak ditemukan; terdekat = Monitoring Nilai KM), "Surat Pujian" (tak ada di menu BK), Elearning & Monev Nilai (`href=#`, tanpa halaman), PIN Transaksi (kartu tanpa aksi), Data User BK (`href=#`), Data Wajah & Presensi Per Mapel (menu ada, halaman 404).
6. **Alur siswa**: CBT publik `/cbt` = NIS + Kode Ujian; SPMB publik `/spmb` = OTP 6 digit via WhatsApp + verifikasi no registrasi/NIK/NISN.
7. **Pola UI**: input nilai/CBT/CP-TP selalu filter 2 tahap (`Proses Selanjutnya` dulu baru tabel); halaman data punya filter+search+ekspor; form = modal dengan Escape/Batal (tidak disubmit selama audit).
8. **Angka agregat (bukan PII)**: Buku Induk VII A 14 siswa · Data Presensi Mesin 169 · 7 KAIH Rekap 167 · Wali Kelas 13 · Kelas 10 · Ekskul 10 · Raport PTS/PAS 28 baris · Kenaikan 14 baris.

---
*Audit read-only selesai: 1 login, 0 submit, 0 screenshot, tanpa PII. Token URL tidak dicatat. File kerja mentah: folder temp `sidikmu/` (menus/, pages/) di luar repo.*
