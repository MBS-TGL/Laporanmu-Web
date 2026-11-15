# DESIGN.md — Arah Desain Laporanmu

> File ini adalah **data arah desain** untuk agent (dibaca bersama `AGENTS.md` dan skill `antislop`).
> Isinya identitas, palet, tipografi, mood, dan dial lively. Bukan instruksi untuk agent.

## Identitas

- **Produk**: Laporanmu, sistem informasi sekolah berbasis web (laporan, presensi, nilai, perizinan, asrama, gate) untuk sekolah di Indonesia.
- **Pengguna**: guru & staf administrasi (dashboard harian), siswa/wali (portal publik: cek status, verifikasi, surat penggantungan).
- **Karakter**: sekolah yang rapi dan terpercaya. Bukan startup, bukan produk hype. Tenang, terstruktur, dapat dipercaya, tetapi tidak kaku.
- **Bahasa seluruh UI**: Bahasa Indonesia.

## Palet (dari theme token `src/core/providers.tsx`)

| Peran | Warna | Alasan (satu baris) |
|---|---|---|
| Primer / aksen utama | `#4f46e5` (indigo) | Warna identitas produk; dipakai untuk CTA, active state, fokus. |
| Neutral teks | `#0f172a` / `#475569` / `#64748b` (slate) | Hierarki teks utama, sekunder, tersier. |
| Background layout | `#f8fafc` | Permukaan halaman agar kartu putih menonjol tanpa bayangan berlebih. |
| Border | `#e2e8f0` / `#ef2f7` | Pemisah tipis, bukan dekorasi. |
| Status | success `#10b981`, warning `#f59e0b`, error `#ef4444` | Semantik status data (hanya untuk status nyata). |

- **Batas palet**: maksimal 2-3 warna inti + 1 aksen. Netral (putih/slate) tidak dihitung. Jangan tambah warna baru tanpa alasan hierarki.
- **Gradient**: hanya di panel brand `PortalCard` dan hero landing (memisahkan area brand dari area kerja), bukan treatment default halaman.

## Tipografi

- **Font**: Plus Jakarta Sans Variable (alasan: sans humanis yang bersahabat tapi cukup tegas untuk data & tabel sekolah; bukan font default AI seperti Inter).
- **Skala**: mengikuti AntD token. Tabel memakai header uppercase 11px (sudah jadi ciri aplikasi ini).
- **Angka**: `tabular-nums` untuk kolom nilai/keuangan agar sejajar.

## Komponen & permukaan

- **Library**: Ant Design v6 (kartu, tabel, modal, drawer). Radius 10/14, kontrol 40px.
- **Bayangan**: kartu memakai bayangan halus bawaan (elevasi = kartu di atas background, bukan semua elemen melayang).
- **Glass**: tidak dipakai.
- **Ikon**: `@ant-design/icons` (set resmi produk, relevan dengan konten; bukan ikon dekoratif generik).

## Motion (dial)

> Dial: **ENERGY 2 / RHYTHM 2 / MOTION 2** (subtil & profesional).

| Dial | Nilai | Arti di produk ini |
|---|---|---|
| ENERGY | 2 | Sapaan cukup hidup (hero landing punya entrance), tapi dashboard tetap tenang. |
| RHYTHM | 2 | Konsisten sebagai aplikasi kerja, dengan variasi pada halaman publik (landing) vs halaman data. |
| MOTION | 2 | Transisi ganti halaman, entrance teratur, micro-interaction hover. Bukan parallax/choreography. |

**Aturan motion (tujuan tertulis, lihat R-19):**

1. **Transisi route** (fade + slide pendek, ~0.15-0.2s): tujuan = orientasi, pengguna tahu halaman berganti.
2. **Entrance PageHeader/kartu** (fade-up pendek, stagger ≤60ms): tujuan = hierarki baca, judul dulu lalu konten.
3. **Micro-interaction hover** (0.15-0.2s): tujuan = umpan balik sentuhan.
4. **Larangan**: loop tanpa henti, bounce, parallax, animasi pada setiap elemen, dan animasi interior komponen AntD (sudah punya motion sendiri, token sudah dikecepatkan).
5. **Aksesibilitas**: semua animasi patuhi `prefers-reduced-motion` (matikan/menjadi instan).
6. **Durasi**: maksimal 0.25s per animasi UI. Elemen yang bergerak >5 detik wajib punya kontrol jeda (tidak ada di produk ini).

## Mood / energi

- **Tenang-terstruktur**: aplikasi harian yang dipakai staf sekolah selama berjam-jam → gerakan halus, tidak mengganggu.
- **Fokus**: satu titik fokus per layar (aksi utama / data utama). Sisanya memihak.
- **Identitas motif**: rail indigo aktif di sidebar + aksen indigo pada CTA. Konsisten di seluruh aplikasi.

## Referensi rasa (bukan template)

- Rasanya mendekati **administrasi modern yang rapi** (mis. Linear untuk ketenangan struktur) tapi dengan bahasa & konten Indonesia sekolah yang nyata. Jangan kloning produk lain (R-30): identitas datang dari palet indigo + data sekolah nyata + bahasa Indonesia.

## Catatan konten (jujur)

- Semua angka di dashboard berasal dari data Supabase nyata. Tidak ada statistik karangan, testimoni karangan, atau klaim tanpa sumber (R-17, R-18, R-36).
- Tidak ada aset visual baru (logo/avatar/ilustrasi) yang dibuat tanpa konfirmasi pemilik (R-23).
