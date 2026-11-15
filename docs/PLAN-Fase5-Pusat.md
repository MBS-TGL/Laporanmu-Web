# PLAN — Fase 5: 6 Pusat Kemampuan (Paritas+ & Melampaui Sidikmu)

> Sumber kebenaran lintas sesi. Tujuan: **melampaui Sidikmu 200%** dengan menggandakan
> infrastruktur yang Sidikmu tidak punya: realtime, portal token publik, WA otomatis,
> analitik + AI, alur persetujuan, RBAC + audit.
> Pola tetap: 1 batch = migrasi (0048+) + flag `module.*`/`system.*` + RBAC `MODULE_REGISTRY`
> (`shared/rbac/permissions.ts` — ingat juga `READ_ONLY_MODULES`) + playbook SKILLS.md.

## Status

| Batch | Flag | Migrasi | Status |
|---|---|---|---|
| A — Keuangan SPP (`/finance`… dibuat sebagai `/keuangan`, normalisasi English menyusul) | `module.keuangan_spp` | 0046 ✅ dijalankan | ✅ inti selesai |
| B — CBT Lanjutan (5 tipe soal, sebaran kesulitan, grading essay) | `module.cbt_lanjutan` | 0047 ⏳ menunggu dijalankan | ✅ inti selesai; analitik butir masuk P6 |
| P6 — CBT Elit | `module.cbt_elite` | 0048 | ⬜ berikutnya |
| P1 — Pusat Evaluasi | `module.evaluasi` | 0049 | ⬜ |
| P5 — Konektivitas (webhook/multi-lembaga/PWA) | `system.api` / `system.multi_entity` / `system.student_portal` | 0050–0053 | ⬜ |
| P2 — Pusat Kehadiran | `module.presensi_mapel` | 0054 | ⬜ |
| P3 — Pusat Kerohanian | `module.rohani` | 0055 | ⬜ |
| P4 — Pusat Dokumen | `module.documents` | 0056 | ⬜ |

Urutan eksekusi disetujui user: **P6 → P1 → P5 → P2 → P3 → P4**.

## Gotcha warisan sesi ini (wajib baca)

- upsert `onConflict` butuh unique index kolom biasa — `period` SPP `not null default ''` (index ekspresi coalesce TIDAK ter-infer PostgREST).
- pgcrypto di Supabase hidup di schema `extensions` → fungsi security-definer wajib `set search_path = public, extensions`.
- PL/pgSQL `found` ter-reset oleh `select count(*) into` — simpan ke variabel boolean dulu.
- `jsonb_array_elements_text` hanya overload `(jsonb)` — pakai `->` bukan `->>`.
- antd v6: `InputNumber<number>` agar parser lolos typecheck; `Popconfirm` pakai `description`; disabled button di Tooltip bungkus `<span>`.
- RBAC modul baru: `MODULE_REGISTRY` + `READ_ONLY_MODULES` (permissions.ts), route `guarded('x:read', ...)`.
- Kolisi nomor migrasi antar-sesi pernah terjadi (0039) — cek `ls supabase/migrations` sebelum menentukan nomor.
- DDL constraint lama: `drop constraint if exists` dulu.
- CRLF: edit file lama via Edit tool (bukan script regex `\n` telanjang).
- Jalankan migrasi manual via SQL Editor Supabase; kumpulkan per batch.

## P6 — CBT Elit (migrasi 0048, flag `module.cbt_elite`)

1. **Analitik butir soal**: helper murni `features/cbt/itemAnalysis.ts` (input: questions + attempts; output: % benar per soal, indeks daya beda kelompok atas-bawah, flag terlalu sulit/terlalu mudah) + tes vitest; tampil sebagai tabel/tab di `ExamDrawer` (soal, % benar, status). Klik soal → taut ke bank.
2. **Review jawaban pasca-ujian**: kolom `cbt_exams.show_explanations bool default false`; RPC publik `cbt_review_answers(p_token, p_code)` → untuk attempt `submitted`/`grading`: daftar soal + jawaban santri + kunci + pembahasan (hanya jika toggle on). UI: hasil di `public/ExamPage.tsx` fase result (tab "Review Jawaban").
3. **Remedial 1-klik**: dari daftar attempt < KKM → dialog "Terbitkan Remedial" (duplikat exam, `is_remedial_of` = exam asal, judul + " (Remedial)", token baru) — kolom `cbt_exams.is_remedial_of uuid`.
4. **Papan peringkat anonim**: kolom `show_leaderboard bool default false`; jika on, hasil di ExamPage menampilkan peringkat (inisial + skor) dari RPC status.
5. **Realtime monitoring**: `ExamDrawer` langganan `postgres_changes` (`cbt_attempts`, filter exam_id) — upgrade/pendamping polling.
6. **WA skor ke wali**: toggle `auto_cbt_wa` (extend RPC wa_settings); finalisasi skor (submitted) → client-side fire-and-forget WA (pola `waAuto`) di tempat grading/finalize terdeteksi — perlu hooks di ExamDrawer setelah gradeEssays/forceSubmit.

## P1 — Pusat Evaluasi (migrasi 0049, flag `module.evaluasi`)

- Engine kuesioner generik: `instruments` (jenis `akpd|sosiometri|mbti|edom|custom`, judul, pertanyaan jsonb: tipe skala/pilihan/teks + dimensi, token hash ala CBT, target kelas, window), `instrument_responses` (instrument_id, student_id, answers jsonb, submitted_at, unique).
- RPC `eval_start/eval_submit` publik (pola CBT: token → pertanyaan tanpa kunci; submit sekali).
- **Template bawaan 1-klik**: AKPD (dimensi minat), Sosiometri (pilih teman), MBTI (pairs preferensi), EDOM (dimensi pengajaran) — data seed TS di `features/evaluasi/templates.ts`.
- Analisis: AKPD profil minat + chart; Sosiometri sosiogram SVG + kohesi + Moreno (terpopuler/terisolasi) + tindak lanjut 1-klik "Buat Sesi BK"; MBTI tipe + distribusi; EDOM skor per guru/semester → laporan kepala sekolah.
- Halaman staf `/instruments` (tab builder/hasil/analisis), publik `/survey/:token`; permission `evaluasi`; recharts untuk grafik; ekspor.

## P5 — Konektivitas (migrasi 0050–0053)

- **P5a Webhook PPDB** (0050): `api_keys` (name, key_hash, last_used_at); Edge Function `ppdb-webhook` (validasi key → upsert `admissions` dedupe registration_number → rate limit); UI admin `/admin?tab=integrasi` (CRUD key + endpoint + contoh payload).
- **P5b Multi-lembaga** (0051–0052): `entities` (name, code, type, is_active); seed 1 default; `entity_id` pada tabel akar (students, teachers, classes, academic_years, inventory, spp_components); helper RLS `current_entity_id()` (header `app.current_entity`); EntitySwitcher Topbar (persist per perangkat); profil sekolah per entitas.
- **P5c PWA Portal Santri** (0053): RPC `portal_login(p_code, p_pin)` → token sesi ber-hash 12 jam (pola suspension); manifest + service worker (vite-plugin-pwa); `/portal` (jadwal hari ini, nilai/leger, presensi, poin, saldo+tagihan SPP, progres hafalan); web push: VAPID + tabel `push_subscriptions` + Edge Function `web-push` (pengumuman/tagihan/rapor) — untuk santri & wali (via `/check`).
- Flag: `system.api`, `system.multi_entity`, `system.student_portal`; admin toggle.

## P2 — Pusat Kehadiran (migrasi 0054, flag `module.presensi_mapel`)

- `subject_attendance` (student_id, class_subject_id, time_slot_id, date, status H/S/I/A, note; unique santri+cs+slot+tanggal).
- Tab `?tab=subjects` di `/attendance`: pilih kelas+tanggal → grid santri × slot jam (time_slots + jadwal), hadir-semua per jam/santri; guru jam tercatat otomatis (jadwal + substitution_logs).
- WA wali saat absen (toggle `auto_absen_mapel_wa`, debounce 1/hari/santri).
- Statistik: tren mingguan, heat map kelas, early warning ≥N absen/bulan → daftar perhatian BK; seksi presensi mapel di DetailDrawer siswa.

## P3 — Pusat Kerohanian (migrasi 0055, flag `module.rohani`)

- `ibadah_items` (kategori wudhu/sholat/hafalan_hadist/hafalan_doa, label, urutan, preset bool) + **preset 1-klik** (data seed TS).
- `ibadah_mastery` (santri, item, status terampil/belum, tanggal; unique) — kenaikan butir.
- `ibadah_scores` (santri, item, bulan, grade; unique) — grid bulanan pola attendance.
- `/worship` tab per kategori; papan kemajuan kelas (progress + bintang); WA kelulusan butir (toggle `auto_rohani_wa`); impor/ekspor; membaca data tahfidz/halaqah yang ada untuk profil kerohanian utuh.

## P4 — Pusat Dokumen (migrasi 0056, flag `module.documents`)

- `kurmer_cps` (mapel, fase, deskripsi), `kurmer_tps` (cp_id, deskripsi, urutan), `kokurikuler_dims` (nama, urutan), `kokurikuler_scores` (santri, dim, semester, tahun, predikat, deskripsi), `graduation_checks` (santri, syarat jsonb, status, disahkan_by/at).
- `/documents` tab `?tab=rapor|khs|transkrip|buku-induk|yudisium`:
  - Rapor Kurmer cetak penuh (nilai + KKM + deskripsi otomatis dari leger + **AI merapikan kalimat** via `callGemini` — direview guru) + radar capaian per santri (recharts).
  - KHS semester & Transkrip 7–9 per santri (agregasi leger) + cetak ber-kop.
  - Buku Induk digital per kelas (cetak + XLSX).
  - Yudisium: checklist (nilai lengkap / hafalan target dari tahfidz / SPP lunas dari spp / poin disiplin) → penetapan → dokumen.
- Permission `documents`; semua dokumen ber-kop + QR verifikasi (pola official letters).

## Definisi selesai per batch

Migrasi jalan + tsc bersih + vitest + build + alur utama teruji di 5174 + flag OFF menyembunyikan menu/route + MEMORY/PRD ter-update.
