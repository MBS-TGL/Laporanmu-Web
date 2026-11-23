# GLOSSARY — Istilah UI Laporanmu

Sumber tunggal istilah yang tampil di sidebar, judul halaman, deskripsi, tombol, dan notifikasi.
Kalau ingin memakai istilah baru, tambahkan di sini dulu.

## Prinsip

1. Satu konsep, satu istilah. Jangan berganti kata di halaman berbeda.
2. Copy UI berbahasa Indonesia. Nama file, route, dan tipe tetap English.
3. Deskripsi halaman menjawab "untuk apa halaman ini", bukan tutorial klik.
4. Tanpa em dash. Tanpa titik di akhir deskripsi pendek.
5. Istilah domain pesantren yang tidak punya padanan tetap dipakai (tahfidz, halaqah, musyrif, ziyadah, murojaah), tetapi jangan dijadikan judul halaman.

## Istilah baku

| Konsep | Pakai | Jangan pakai |
|---|---|---|
| Peserta didik | **Santri** | Siswa, Murid |
| Data induk peserta didik | **Santri** | Data Siswa |
| Pengajar | **Guru** | Pengajar, Tenaga Pengajar |
| Rombongan belajar | **Kelas** | Data Kelas, Rombel |
| Laporan hasil belajar | **Rapor** | Raport |
| Kehadiran | **Absensi** | Presensi (untuk label modul) |
| Layanan konseling | **Bimbingan Konseling** | BK, Bimbingan & Konseling |
| Asesmen/angket | **Evaluasi** | Pusat Evaluasi |
| Arsip dokumen akademik | **Dokumen Akademik** | Pusat Dokumen |
| Pengumuman sekolah | **Pengumuman** | Informasi |
| Area teknis | **Administrasi** | Dashboard Admin, Admin Panel |
| Jadwal dan agenda | **Jadwal & Kalender** | Jadwal KBM (bila halaman juga memuat kalender) |
| Tagihan SPP | **Keuangan SPP** | Keuangan, SPP saja |
| Rekening santri | **Tabungan** | Tabungan Santri (judul halaman) |
| Aset sekolah | **Inventaris** | Inventori |
| Berkas terhapus | **Sampah** | Recycle Bin, Trash |
| Riwayat perubahan | **Jejak Audit** | Audit Log |
| Bukti pembayaran | **Kwitansi** | Kuitansi, Receipt, Invoice |
| Tagihan belum dibayar | **Tunggakan** | Piutang, Arrears |
| Aksi setelah temuan | **Tindak lanjut** | Follow up, Follow-up |
| Perubahan stok barang | **Mutasi stok** | Stock movement, Ledger |
| Denda keterlambatan buku | **Denda** | Fine, Penalti |

## Istilah teknis yang tidak boleh muncul di copy pengguna

- `webhook`, `API key`, `bucket`, `storage`, `orphan`, `soft delete`, `payload`, `endpoint`.
- Ganti dengan bahasa kerja: `penerimaan otomatis`, `kunci akses`, `berkas`, `penyimpanan`, `berkas yatim`, `data terhapus`.

## Istilah domain yang dipertahankan

`tahfidz`, `halaqah`, `setoran`, `musyrif`, `ziyadah`, `murojaah`, `wudhu`, `sholat`, `hadis`.
Ejaan yang dipakai: **hadis** (bukan hadist), **sholat** (konsisten di seluruh UI).

## Contoh

- Benar: `Santri · Data induk santri aktif`
- Salah: `Data Siswa · Pusat database seluruh santri aktif`
- Benar: `Rapor · Rapor bulanan dan semester per kelas`
- Salah: `Raport · Input raport bulanan & semester per kelas`
- Benar: `Gerbang · Catatan keluar-masuk santri`
- Salah: `Laporan Gerbang · Log keluar-masuk santri di gerbang`
