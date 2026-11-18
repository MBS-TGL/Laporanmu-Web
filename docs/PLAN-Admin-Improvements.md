# PLAN: Perbaikan & Pengembangan Tab Admin (`/admin`)

> Katalog saran lengkap untuk semua tab di `src/features/admin/AdminPage.tsx` + saran khusus `src/features/admin/DashboardPage.tsx`.
> Status ditandai: `[ ]` belum, `[x]` selesai, `[~]` sedang. Prioritas: **P0** bug nyata, **P1** penting, **P2** penyempurnaan, **P3** nice-to-have.

## Bug nyata (P0, lintas tab)

| # | Bug | Lokasi | Fix |
|---|-----|--------|-----|
| 1 | QUICK_LINKS memakai URL legacy `/admin/database` dll (redirection hop) | `DashboardPage.tsx` | Ganti ke `onNavigateTab()` |
| 2 | `system.debug_mode` di-seed tapi tidak ada konsumen (flag mati) | DB seed 0023 | Buat panel dev yang membacanya |
| 3 | MaintenanceGate hanya menutup route di `MainLayout`; route publik & `/login` lolos | `MaintenanceGate.tsx`, `router.tsx` | Gate level router |
| 4 | Alert error menyebut "migration 0020", migrasi sebenarnya `0023_feature_flags.sql` | `FeatureFlagsPage.tsx` | Perbaiki teks |
| 5 | Sidebar/Topbar tidak membaca flag; kategori "Modul" hanya 1 flag | `navItems.tsx` | `NavItem.flag` + seed `module.*` |
| 6 | Maintenance hanya boolean; tanpa pesan kustom/estimasi selesai | flag saja | Tabel `app_settings` |

## Tab Ringkasan / `DashboardPage.tsx` (AdminDashboardTab)

1. `[x]` **P0** Perbaiki QUICK_LINKS legacy → `onNavigateTab`.
2. `[ ]` **P1** RPC Supabase untuk table stats (saat ini ±36 request per refresh di `fetchTableStats`; kini ±78 dengan 26 tabel — makin penting).
3. `[ ]` **P1** Skeleton loading untuk StatChip (bukan nilai "–" saat loading).
4. `[ ]` **P2** Pie chart distribusi baris: buang slice dominan (audit_logs), tampilkan persen + tooltip.
5. `[ ]` **P2** Konsistenkan navigasi chip (semua via `onNavigateTab`).
6. `[ ]` **P1** Widget "Kesehatan Sistem": latency DB, status maintenance, storage terpakai, task terakhir.
7. `[ ]` **P1** Toggle maintenance cepat di ringkasan (developer only, Popconfirm).
8. `[ ]` **P3** Grafik audit-activity: marker saat task dijalankan.
9. `[ ]` **P2** Range 7/14/30 hari persist ke URL (`?range=`).
10. `[ ]` **P2** Pembanding minggu ini vs minggu lalu (delta ±%) di StatChip.
11. `[ ]` **P1** Widget Temuan Integritas: 3 teratas + tombol "Perbaiki" inline (reuse `runDetachRefs`).
12. `[ ]` **P2** Audit terbaru: baris expandable forensik seperti AuditPage.
13. `[ ]` **P3** Realtime Supabase untuk aktivitas audit (live ticker).
14. `[ ]` **P2** Widget "Tabel Paling Aktif" (group by `table_name` dari audit_logs).
15. `[ ]` **P2** Widget "Pengguna Aktif per Hari" (distinct actor).
16. `[ ]` **P1** Quick actions dropdown: buang cache, jalankan sync_stats, muat ulang.
17. `[ ]` **P3** Ringkasan pengumuman sistem terbaru.
18. `[ ]` **P3** Checklist onboarding setup sekolah (profil, kelas, guru, flag) dengan progress.
19. `[ ]` **P2** Export ringkasan ke XLSX (reuse `downloadXlsx`).
20. `[ ]` **P3** Search global lintas tab (audit/users/tabel).
21. `[ ]` **P1** Empty/error state + retry per widget (antislop R-27).
22. `[ ]` **P1** Responsif mobile untuk grid chart (R-03).
23. `[ ]` **P3** Prefetch tab admin lain saat hover QUICK_LINKS.
24. `[ ]` **P2** Indikator freshness data ("diperbarui x mnt lalu").
25. `[ ]` **P3** Persist state collapse kartu ke localStorage.

## Tab Pengaturan / `FeatureFlagsPage.tsx`

1. `[x]` **P0** Perbaiki teks "migration 0020" → 0023.
2. `[x]` **P1** CRUD flag penuh: modal buat/edit/hapus, bukan hanya toggle.
3. `[x]` **P0** Maintenance menutup route publik `/`, `/check`, `/verify` (gate level router). `/login` & `/suspension/:token` sengaja tetap terbuka (akses developer saat maintenance; surat resmi wali).
4. `[x]` **P1** Pesan maintenance kustom + estimasi selesai (tabel `app_settings` key/value JSON).
5. `[ ]` **P2** Konfigurasi role bypass maintenance (bukan hardcoded developer).
6. `[ ]` **P2** Penjadwalan maintenance otomatis (mulai/selesai datetime).
7. `[x]` **P0** Konsumen `system.debug_mode`: panel dev (query keys aktif, cache size).
8. `[x]` **P1** Seed flag `module.*` untuk semua modul (dorms, gate, tahfidz, halaqah, library, savings, inventory, ekskul, health, counseling, leave-permit, report-cards, grades, schedules, insights AI) — migrasi 0037.
9. `[x]` **P1** `navItems.tsx` konsumsi flag (`NavItem.flag`), menu tersembunyi saat modul off.
10. `[x]` **P1** Guard route level router untuk modul nonaktif (halaman "Modul dinonaktifkan").
11. `[ ]` **P2** Peta konsumsi flag per file (statis) ditampilkan di tiap baris flag.
12. `[ ]` **P2** Badge "fallback" pada flag belum di-seed (fail-open terlihat jelas).
13. `[ ]` **P2** Tampilkan `updated_by` + `updated_at` di tiap baris flag.
14. `[ ]` **P2** Riwayat perubahan flag (link ke audit tab terfilter `table_name=feature_flags`).
15. `[ ]` **P2** Ganti `qc.invalidateQueries()` blanket dengan invalidasi ter-target.
16. `[ ]` **P2** Popconfirm untuk mematikan flag system kritis (bukan hanya maintenance).
17. `[ ]` **P3** Batch toggle per kategori (aktifkan semua modul).
18. `[ ]` **P3** Export/import konfigurasi flag sebagai JSON (backup).
19. `[ ]` **P2** Info Sistem lanjutan: latency DB, versi supabase-js, session user, build time.
20. `[ ]` **P3** Daftar env `VITE_*` dengan masking nilai sensitif.
21. `[ ]` **P3** Realtime refresh flag via Supabase Realtime.
22. `[ ]` **P2** Cari flag berdasarkan key + label, sort by `updated_at`.
23. `[ ]` **P3** Preferensi admin (pageSize default, privacy mode default) di `app_settings`.
24. `[ ]` **P2** Error/empty state + retry, skeleton list flag.
25. `[ ]` **P3** Hapus `hideForRoles` yang tidak terpakai di `NavGroup` atau gunakan.

## Tab Pengguna / `UsersPage.tsx`

1. `[~]` **P1** Pagination + filter server-side untuk profiles (jumlah akun masih kecil; modal link guru kini 2 jalur: buat akun baru / existing).
2. `[~]` **P1** Edge Function invite user baru — frontend + `supabase/functions/create-user` SELESAI (modal buat-akun: email/nama/role, guru auto-link, hasilkan link set-password); **menunggu deploy**: `supabase functions deploy create-user`.
3. `[ ]` **P2** Edge Function hapus/nonaktifkan user.
4. `[x]` **P1** Guard keras: role akun sendiri tidak bisa diubah (Select disabled + blokir di handler).
5. `[ ]` **P2** Bulk action: ganti role massal, link guru massal (reuse `BulkActionBar`).
6. `[ ]` **P2** Filter persist ke URL (`?q=`, `?role=`).
7. `[ ]` **P2** Kolom login terakhir (dari audit LOGIN).
8. `[ ]` **P3** Force logout semua sesi (admin API via Edge Function).
9. `[ ]` **P2** Ekspor daftar pengguna XLSX (reuse `ExportModal`).
10. `[ ]` **P2** Toggle status aktif/nonaktif per akun.
11. `[ ]` **P3** Kolom status verifikasi email.
12. `[ ]` **P3** Tooltip deskripsi per role (`ROLE_META`).
13. `[ ]` **P2** Alert akun pending: aksi "kirim ulang reset" per baris.
14. `[ ]` **P2** Drawer detail: link ke audit tab terfilter user tersebut.
15. `[ ]` **P2** Filter `user_id` diekspos di UI AuditPage.
16. `[x]` **P1** Link guru: modal dari sisi guru kini default "Buat akun baru" (email/nama/role) — alur lama pilih-akun-existing jadi opsi kedua.
17. `[ ]` **P3** Deteksi duplikat nama/email saat edit.
18. `[ ]` **P2** Sorting server-side + virtualisasi tabel.
19. `[ ]` **P3** Avatar awal + warna konsisten.
20. `[ ]` **P2** RBAC per aksi (manager lihat saja, admin edit, developer penuh).
21. `[x]` **P2** Skeleton loading baris tabel (panel guru) + loading state tabel.
22. `[x]` **P1** Empty/error state + retry (Alert error profiles/teachers + tombol coba lagi).
23. `[ ]` **P2** Pindahkan mutasi reset password onSuccess/onError ke hook.
24. `[ ]` **P3** Uji unit untuk logika linking + matriks peran.
25. `[ ]` **P3** Panduan keamanan akun (kartu tips kebijakan password).

> **Redesain layout 2026-11-14 (feedback user "layout jelek")**: kartu filter digabung ke toolbar tabel; kartu "Guru Belum Punya Akun" di-extract ke `components/UnlinkedTeachersCard.tsx` dan berdampingan dengan tabel (Col xl=16/8, stack di mobile); header privasi ikon+tooltip sesuai konvensi; kolom "Terdaftar" & "Guru Terhubung" dilipat ke sel Pengguna (densitas, kolom penentu maju); `scroll.x max-content` memperbaiki overflow horizontal mobile (554→382px, terverifikasi).

## Tab AI Insights / `InsightsPage.tsx`

1. `[ ]` **P1** Hapus cap `students.limit(1000)`, `savings.limit(1000)`, `book_loans.limit(500)` (paginate loop atau RPC agregat).
2. `[ ]` **P1** RPC agregat server-side (poin per kelas/asrama) mengganti agregasi client.
3. `[ ]` **P2** Riwayat insight persist (tabel `insight_logs`) + daftar hasil sebelumnya.
4. `[ ]` **P3** Streaming respons Gemini.
5. `[ ]` **P2** Deteksi error AI terstruktur (bukan sniffing prefix "Maaf").
6. `[ ]` **P3** Tampilkan usage token/cost + retry dengan backoff.
7. `[ ]` **P2** Input prompt kustom yang bisa diedit user dari preset.
8. `[ ]` **P2** Selector periode snapshot (7/14/30/90 hari).
9. `[ ]` **P2** Drill-down klik chart → navigasi ke halaman relevan (santri berisiko).
10. `[ ]` **P2** Export insight ke docx/PDF.
11. `[ ]` **P3** Insight mingguan terjadwal (Edge Function cron) diposting ke pengumuman.
12. `[x]` **P1** Flag `insights.ai_enabled` dihormati (modul off → halaman mati).
13. `[ ]` **P3** Pilihan model (flash/pro) di pengaturan.
14. `[ ]` **P2** Sertakan data behavior rules & counseling dalam snapshot.
15. `[ ]` **P1** Tabel top-N santri berisiko dengan alasan (bukan hanya donut).
16. `[ ]` **P2** Loading skeleton chart, bukan Spin tunggal.
17. `[ ]` **P3** Download chart sebagai PNG.
18. `[ ]` **P2** Perbandingan periode (delta minggu ke minggu).
19. `[ ]` **P2** Renderer markdown lebih baik (bold, tabel, heading lain).
20. `[ ]` **P2** Indikator freshness data snapshot.
21. `[ ]` **P3** Rate limit pemakaian AI per user/hari (`app_settings`).
22. `[ ]` **P1** Empty state jujur per chart saat data kosong.
23. `[ ]` **P3** Anchor nav per bagian insight panjang.
24. `[ ]` **P2** staleTime tuning + background refetch snapshot.
25. `[ ]` **P2** Simpan hasil saat ganti tab (persist).

## Tab Otomatisasi / `TasksPage.tsx`

1. `[ ]` **P1** Progress bar nyata: proses per-chunk dengan progress proporsional.
2. `[ ]` **P1** Riwayat eksekusi persist server-side (tabel `task_runs`), bukan localStorage.
3. `[ ]` **P1** Gunakan `chunk()` di `runDetachRefs` (saat ini hanya dipakai test).
4. `[ ]` **P2** `rotate_logs`: arsip/ekspor ke Storage sebelum delete.
5. `[ ]` **P1** Mode dry-run untuk task destruktif (preview baris terdampak).
6. `[ ]` **P2** Konfirmasi ketik "JALANKAN" untuk task destruktif.
7. `[ ]` **P2** Task baru: pembersih file orphan Storage (reuse orphan scan).
8. `[ ]` **P3** Task baru: recompute rekap kelas/asrama.
9. `[ ]` **P3** Task baru: deteksi & anonimisasi guardian token kedaluwarsa.
10. `[ ]` **P3** Task baru: pengingat buku terlambat.
11. `[ ]` **P3** Scheduler harian via pg_cron/Edge Function.
12. `[ ]` **P3** Undo window untuk task destruktif (arsip dulu).
13. `[ ]` **P1** RBAC per task (destruktif = developer saja).
14. `[ ]` **P2** Drawer detail eksekusi (baris terdampak, durasi, error stack).
15. `[ ]` **P2** Retry run gagal.
16. `[ ]` **P2** Badge kesehatan task (status terakhir, durasi rata-rata).
17. `[ ]` **P3** Ekspor riwayat CSV.
18. `[ ]` **P2** Migrasi riwayat localStorage → server saat load pertama.
19. `[ ]` **P3** Status realtime via Supabase Realtime pada `task_runs`.
20. `[ ]` **P3** Notifikasi browser saat selesai.
21. `[ ]` **P2** Izinkan task aman paralel, destruktif tetap eksklusif.
22. `[ ]` **P2** Audit log menyertakan jumlah baris terdampak di `newData`.
23. `[ ]` **P3** Definisi task versioned dengan estimasi durasi.
24. `[ ]` **P3** Test unit untuk helper baru.
25. `[ ]` **P2** Empty/error state riwayat + retry.

## Tab Database / `DatabasePage.tsx`

1. `[ ]` **P1** Pindahkan 7 cek integritas ke Postgres RPC (tanpa download tabel penuh).
2. `[ ]` **P2** Skor integritas berbobot per tingkat keparahan.
3. `[ ]` **P2** Cek integritas config-driven (tambah cek via migrasi, tanpa ubah kode).
4. `[x]` **P1** Ganti setInterval manual dengan `refetchInterval` react-query (hapus stale closure).
5. `[ ]` **P2** Alur remediasi untuk 5 temuan yang kini hanya informatif (isi NIS, merge duplikat, dll).
6. `[ ]` **P2** Bulk fix dengan modal dry-run (preview sebelum eksekusi).
7. `[ ]` **P2** Drawer detail tabel: kolom skema, policy RLS, index, estimasi baris.
8. `[ ]` **P3** Sparkline pertumbuhan baris (simpan riwayat stats).
9. `[x]` **P1** Tambah tabel modul 0022 ke `TABLE_CONFIG` (tahfidz, savings, books, inventory, dll — kini 26 tabel).
10. `[ ]` **P2** Ekspor stats tabel XLSX.
11. `[ ]` **P3** Viewer sampel 5 baris terbaru per tabel (PII dimasking).
12. `[ ]` **P2** Peringatan selisih aktif vs total per tabel.
13. `[ ]` **P3** Peta relasi foreign key (diagram statis).
14. `[ ]` **P3** Kartu retensi data per tabel + link task rotate.
15. `[ ]` **P2** Cek constraint unik (NIS duplikat).
16. `[ ]` **P3** Integrasi task cleanup soft-delete tua.
17. `[ ]` **P3** Indikator perubahan row count realtime.
18. `[ ]` **P2** Skeleton loading per kartu.
19. `[ ]` **P1** Empty/error state + retry.
20. `[ ]` **P2** Persist search & auto-refresh ke URL.
21. `[ ]` **P3** Sort kolom persist.
22. `[ ]` **P3** Masking PII konsisten dengan `auditLogger`.
23. `[ ]` **P2** Test unit untuk pure function integritas.
24. `[ ]` **P3** Navigasi keyboard tabel.
25. `[ ]` **P3** Responsif mobile untuk tabel.

## Tab Penyimpanan / `StoragePage.tsx`

1. `[ ]` **P1** Listing rekursif folder untuk file terbesar & orphan scan (gap terbesar tab ini).
2. `[ ]` **P2** Progress scan chunked.
3. `[ ]` **P2** Total ukuran per bucket + estimasi kuota.
4. `[ ]` **P1** Orphan scan mencakup semua kolom URL (admissions, inventory, dll).
5. `[ ]` **P3** Opsi scan termasuk referensi soft-deleted.
6. `[ ]` **P1** Orphan dipindah ke folder `_trash` alih-alih hard remove.
7. `[ ]` **P3** Restore dari trash.
8. `[ ]` **P2** Preview thumbnail gambar (modal).
9. `[ ]` **P2** Filter file terbesar per bucket/folder.
10. `[ ]` **P3** Kolom tipe, dibuat, path; breadcrumb path.
11. `[ ]` **P3** Kartu policy bucket (public/private, limit).
12. `[ ]` **P2** Peringatan bucket publik berisi foto PII.
13. `[ ]` **P3** Delta scan (hanya file baru sejak scan terakhir).
14. `[ ]` **P3** CSV ekspor daftar orphan.
15. `[ ]` **P3** Integrasi auto-scan sebagai task Otomatisasi.
16. `[ ]` **P2** Konfirmasi ketik untuk hapus massal.
17. `[ ]` **P3** Jumlah file per bucket + ringkasan pohon folder.
18. `[ ]` **P1** Skeleton/empty/error state per kartu bucket.
19. `[ ]` **P2** Test `extractStorageRef` untuk varian URL.
20. `[ ]` **P3** Navigasi keyboard tabel.
21. `[ ]` **P3** Responsif mobile.
22. `[ ]` **P2** Invalidate query ter-target setelah delete.
23. `[ ]` **P3** StatChip bucket klik → filter tabel.
24. `[ ]` **P2** Freshness indikator hasil scan.
25. `[ ]` **P3** Link dari widget Kesehatan Sistem Ringkasan.

## Tab Audit Log / `AuditPage.tsx`

1. `[x]` **P1** Filter persist ke URL (`?q=`, `?source=`, `?action=`, `?table=`, `?user=`, `?from=`, `?to=`, `?p=`).
2. `[ ]` **P2** Ekspor CSV/JSON hasil filter (tercatat sebagai action EXPORT).
3. `[x]` **P1** Filter pengguna (select actor) di UI (param `user_id` sudah ada di api).
4. `[ ]` **P2** Input deep-link `record_id`.
5. `[ ]` **P2** Tampilkan `user_agent` di forensik (ada di tipe, tak pernah ditampilkan).
6. `[ ]` **P3** Mode live via Supabase Realtime (stream INSERT).
7. `[ ]` **P2** PageSize opsional 20/50/100.
8. `[ ]` **P2** Preset tanggal cepat (hari ini/7/30 hari).
9. `[ ]` **P3** Preset filter tersimpan per user (localStorage).
10. `[ ]` **P3** Deteksi anomali sederhana (lonjakan DELETE massal).
11. `[ ]` **P3** Ringkasan chip group by tabel/aksi.
12. `[ ]` **P2** Diff JSON terstruktur old vs new (bukan `<pre>` mentah).
13. `[ ]` **P3** Tombol copy JSON.
14. `[ ]` **P2** Masking nilai sensitif konsisten dengan `auditLogger`.
15. `[ ]` **P3** Filter berdasarkan role pelaku.
16. `[ ]` **P3** Lompat ke halaman pagination.
17. `[ ]` **P2** Info retensi + link ke task rotate_logs.
18. `[ ]` **P3** Sticky header tabel.
19. `[ ]` **P2** Forensik jadi Drawer di mobile (bukan expanded row).
20. `[ ]` **P2** Skeleton loading baris.
21. `[ ]` **P1** Error state + retry.
22. `[~]` **P2** Shortcut R untuk refetch (konsisten tab lain).

> **Redesain layout 2026-11-14 (batch tab lain)**: kartu filter & tabel audit digabung 1 kartu; Otomatisasi jadi 2 kolom (tugas kiri, riwayat kanan); Storage bedakan error vs kosong bucket + Alert retry file; Database & Ringkasan dapat Alert error + retry; semua tabel diberi `scroll.x max-content` — cek overflow mobile 390px lolos di 5 tab (382=382).
23. `[ ]` **P2** Kelengkapan `TABLE_LABELS` (validasi terhadap tabel nyata).
24. `[ ]` **P3** Test unit mapping filter → query.
25. `[ ]` **P3** Responsif mobile.

## Fase implementasi

- **Fase 1 (P0)**: QUICK_LINKS, teks 0020→0023, gate publik maintenance, konsumen debug_mode, seed `module.*`, `NavItem.flag`.
- **Fase 2 (P1 sistem flag)**: migrasi `app_settings` + `task_runs` + `insight_logs`, CRUD flag, guard router modul, maintenance kustom.
- **Fase 3 (per-tab P1→P2)**: urutan Pengaturan → Pengguna → Database → Penyimpanan → Audit → Otomatisasi → Insights → Ringkasan.
- **Fase 4 (P3 + performa)**: RPC stats/integrity/aggregate, pagination server, storage rekursif, realtime.

Setiap fase ditutup dengan update `MEMORY.md`.

---

## Re-plan 2026-11-18 — dampak Fase 5 (0051–0056)

Fase 5 menambah ±14 tabel baru + modul baru. Item di bawah TIDAK ada di katalog lama dan perlu dikerjakan setelah eksekusi berjalan (sesi lain) selesai:

| # | Item | Lokasi |
|---|------|--------|
| N1 | `TABLE_CONFIG` tambah tabel baru: instruments, instrument_responses, api_keys, api_request_log, entities, portal_sessions, portal_login_attempts, push_subscriptions, subject_attendance, worship_items/mastery/scores, curriculum_cps/tps, cocurricular_dims/scores, graduation_checks | `admin/api.ts` (kini 26 → ±40) |
| N2 | `TABLE_LABELS` audit untuk tabel-tabel di atas (saat ini audit menampilkan nama mentah) | `admin/AuditPage.tsx` |
| N3 | `TRASH_TABLES` tambah tabel soft-delete baru: worship_items, entities, instruments, curriculum_cps/tps, cocurricular_dims (softDelete tersedia di semua) | `admin/trash.ts` |
| N4 | QUICK_LINKS/pintasan dashboard menunjuk modul baru (Pusat Dokumen, Evaluasi, Ibadah) — opsional | `admin/DashboardPage.tsx` |
| N5 | Kesehatan Sistem: cek integritas baru (API key aktif tanpa pemakaian, push_subscriptions yatim, sesi portal kedaluwarsa) — opsional | RPC integritas (Fase berjalan) |

Status sweep katalog lama (stale vs relevan):
- Sudah usang/terlewati oleh batch lain: Fase 1 semua [x]; `NavItem.flag` [x]; guard router modul [x]; seed module.* [x]; audit URL persist + filter user [x]; flags CRUD [x]; maintenance kustom [x].
- Masih relevan penuh: seluruh item Insights (limit cap, RPC agregat, top-N berisiko), Otomatisasi (task_runs, dry-run, RBAC per task), Storage (listing rekursif, orphan _trash), Database (RPC integritas — sedang dikerjakan), sebagian Pengguna & Audit (ekspor, diff JSON, user_agent).
