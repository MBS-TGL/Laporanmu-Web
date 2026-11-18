# PLAN-Students-Improvements — Peningkatan Kualitas StudentsPage

> Tanggal: 2026-11-18 · Mode: antislop DURING (session override)
> Sumber: audit 2 agent (data-layer + UX) diverifikasi manual terhadap file.
> Status: SELESAI & TERVERIFIKASI (tsc 0 error, vitest 267 pass, build sukses). Migrasi 0058_students_has_photo.sql siap dieksekusi manual ke Supabase.

## Konteks

- Volume: "ratusan" siswa; fetch daftar dipatok `pageSize: 1000` dengan banner truncation jujur (`StudentsPage.tsx:1118-1126`); import per-kali 500 baris.
- Tujuan: boost performa (jaringan + render + bundle), tambah fitur & detail, perkuat states/a11y/mobile, rapikan konsistensi & struktur.
- Konvensi playbook tetap berlaku: `useUrlTab`, Drawer detail, `useTablePagination`, AppModal, soft delete, `logAudit`, file page <600 baris.

## Jangan diregresi (sudah bagus)

- Search/filter/sort sepenuhnya klien, debounce 350ms, tanpa query per ketikan (`StudentsPage.tsx:183,244-302`).
- Pagination client 10/25/50 via `useTablePagination`; `rowKey="id"`.
- Bulk write lewat RPC/batch: `graduate_students`, `promote_students`, `import_students`, `.in()` soft-delete.
- Mode privasi + masking identitas; statistik nyata dari DB, bukan angka karangan.
- Pola error state `ArchivePage.tsx:418-431` (Alert + "Coba lagi") = benchmark fitur ini.
- `DetailProvider` lazy-load `DetailDrawer` (recharts terpisah dari entry); xlsx & papaparse sudah dynamic di jalur CSV.
- Shortcut dengan typing-guard & Escape berurutan; `ShortcutsModal`.
- Destructive flow berlapis (ResetModal ketik "RESET", pratinjau pindah/keluar, undo-toast arsip).

---

## Paket A — Performa data (prioritas tinggi)

| # | Temuan | Bukti | Arah fix |
|---|--------|-------|----------|
| A1 | Query daftar pakai `*` → ikut menarik `photo_url` (base64 data-URL ≤500KB per baris) × s.d. 1000 baris. Tiga pemanggil `pageSize: 1000`. | `api.ts:19-20` (`SELECT_STR`), `StudentsPage.tsx:222`, `PromotePage.tsx:103`, `PhotoModal.tsx:67` | Select kolom eksplisit tanpa `photo_url`; foto baru di-fetch saat drawer/butuh tampil |
| A2 | PromoteModal & PhotoModal ikut mount → unduh tabel 1000 baris **kedua** setiap kali `/students` dibuka, modal tidak pernah dibuka | `useStudents` tidak punya opsi `enabled` (`hooks.ts:103-108`) | Tambah `enabled` di `useStudents`, gate `enabled: open` (pola benar sudah ada: `hooks.ts:125-131`) |
| A3 | 21 `invalidateQueries({queryKey:['students']})` → list + stats + alumni + arsip refetch serentak (stampede s.d. 4 fetch paralel setelah tab Arsip/Alumni pernah dikunjungi) | `hooks.ts` (41 total, 21 prefix) | Kunci granular `['students','list'\|'stats'\|'alumni'\|'archived'\|…]`, invalidasi per concern |
| A4 | Stats memakai key di bawah prefix sama → re-download + re-aggregate setiap 1 edit; `trend7d` menarik semua baris `reports` 7 hari hanya untuk rata-rata | `hooks.ts:110-115`, `api.ts:391,466-470` | Key `['student-stats']` sendiri + staleTime panjang; agregasi avg pindah ke SQL/RPC |
| A5 | N+1: revert kelulusan & restore snapshot loop `UPDATE` per id berurutan; impor alumni gagal → fallback insert baris demi baris | `hooks.ts:326-329,412-415`, `api.ts:771-779` | Bulk `.in('id', ids)` (pola `restoreStudentsBulk` `api.ts:509-513`) / retry split-biner |
| A6 | Ekspor "Hasil filter" ≠ tabel: (a) `dormId` tidak ada di `StudentFilters` sehingga filter asrama diabaikan server; (b) `missing:'any'` server cek 3 field vs klien 13 (`completeness.ts`); (c) tanpa `status:'active'` → lulusan bocor; (d) search server tanpa NIS/telepon/wali; (e) `fetchAllStudents` tanpa `.range()` → potensi potong diam-diam oleh `db-max-rows` vs klaim banner "Ekspor tetap mencakup seluruh data" | `types.ts:141-154`, `api.ts:27-48`, `StudentsPage.tsx:247-270`, `api.ts:107-118`, `ExportModal.tsx:61` | Satukan logika filter klien/server (satu fungsi), fetch export chunked `.range()`, verifikasi `db-max-rows` |
| A7 | `staleTime` global 5 menit berlaku sama untuk query 1000 baris dan lookup kecil | `queryClient.ts:6` | staleTime khusus 30-60 menit untuk key list/stats students |

## Paket B — Performa render & bundle

| # | Temuan | Bukti | Arah fix |
|---|--------|-------|----------|
| B1 | `columns` (9 kolom + render closure), `headerMenu`, `tabActions` JSX, `allFilteredSelected` (scan 1000 baris), `advFilterCount` dihitung tiap render; `toggleSelectAll` O(n²) via `includes` | `StudentsPage.tsx:754-931,581-605,934,400-404` | `useMemo`/`useCallback`; Set-difference untuk select-all |
| B2 | `StudentsPage.tsx:84` import `DetailDrawer` **static** → recharts ikut route chunk, membatalkan pemisahan yang sudah dilakukan `DetailProvider` | `StudentsPage.tsx:84` vs `DetailProvider.tsx:9-11`, MEMORY:313-321 | `React.lazy` + Suspense di halaman ini |
| B3 | 13 modal selalu mount; `ImportModal` bawa papaparse, `CardModal` bawa qrcode.react ke route chunk | `ImportModal.tsx:37`, `importParse.ts:1`, `CardModal.tsx:5` | Lazy-mount saat pertama dibuka (pola `drawerMounted` `DetailProvider.tsx:23-24`) |
| B4 | `StatsRow` & `DetailDrawer` (953 baris + recharts) re-render setiap ketikan search di halaman | `StatsRow.tsx:33`, `DetailDrawer.tsx:246`, props inline `StudentsPage.tsx:991-999,1282-1286` | `React.memo` + `useCallback` props |

## Paket C — Kualitas, states, a11y, mobile (prioritas tinggi)

| # | Temuan | Bukti | Arah fix |
|---|--------|-------|----------|
| C1 | Tabel utama & StatsRow **tanpa error state**: query gagal → "Belum ada siswa" (klaim palsu) dan stats `–` selamanya. `AlumniPage` celah sama | `StudentsPage.tsx:1128-1144`, `AlumniPage.tsx:946-1001` | Alert error + "Coba lagi" mengikuti `ArchivePage.tsx:418-431`; varian error `StatsRow` |
| C2 | Icon-only button tanpa `aria-label` (header menu, aksi baris, refresh, toggle privasi, tombol bersih di `ActionBar`) — hanya 1 `aria-label` di seluruh fitur | `StudentsPage.tsx:944-974,895-927`, `ActionBar.tsx:108-115`, satu-satunya: `ArchivePage.tsx:367` | `aria-label` = teks tooltip yang sama |
| C3 | Shortcut window tidak di-gate `!active`: tab Alumni terbuka, teks `A`/`N`/`Esc` tetap memicu tab Aktif (dua `ShortcutsModal` bisa kebuka). `promoteOpen` tidak ada di `isBlocked` → Esc menghapus filter di belakang Popconfirm | `StudentsPage.tsx:611-730`, `AlumniPage.tsx:538-599`; pola benar `WaliTab.tsx:136` | `isBlocked: !active \|\| …`; tambahkan `promoteOpen` (perlu prop dari parent) |
| C4 | Mobile: kolom Aksi `width:170` lima ikon tetap → scroll horizontal di 390px; hanya `Poin` yang `responsive:['md']` | `StudentsPage.tsx:886-930` | Aksi jadi Dropdown `MoreOutlined` `<md` (pola `AttendancePage.tsx:1110-1180`) |
| C5 | `DetailDrawer` di HP: rail 148px tetap + enam blok grid 2-kolom → sisa ~180px konten | `DetailDrawer.tsx:371,479,539-686`; banding `AppModal.tsx:63-66` | Grid 1 kolom <768px, rail ikon saja |
| C6 | Empty state tanpa langkah lanjut ("Belum ada siswa" polos) | `StudentsPage.tsx:1137-1144`; pola baik `AlumniPage.tsx:954-976` | + CTA "Tambah Siswa" / "Import Data" bila 0 data |
| C7 | `WaliTab` tidak pakai `useTablePagination` → di halaman 3 dengan ≤10 hasil tabel kosong (tanpa auto-clamp); melanggar SKILLS §Tabel | `tabs/WaliTab.tsx:316` | Ganti ke `useTablePagination` |
| C8 | Drawer rail tanpa semantik ARIA; badge menampilkan batas fetch (100 raport / 20 gerbang), bukan total; 4 query cross-module jalan walau hanya tab Info dibuka | `DetailDrawer.tsx:477-527,356-359`, `useStudentOverview.ts:12-35` | `role="tab"`/`aria-selected`; badge `100+`/`20+`; `enabled` per tab aktif |

## Paket D — Fitur & detail (pilih nomor)

| # | Ide | Dasar |
|---|-----|-------|
| D1 | Chip stats baru: "Belum ada PIN", "Tanpa asrama", "Tanpa kelas" → klik-filter; seragamkan sembunyi-nol ke `hideIfZero` (kondisi ad-hoc `StatsRow.tsx:81,89`) | Angka sudah ada di memori; `missingPin` sudah dihitung `CardsModal.tsx:59` → loop tertutup dgn bulk "Buat PIN" |
| D2 | Tags ikut haystack pencarian + chip filter (sekarang hanya tampil & edit) | `StudentsPage.tsx:251` belum memasukkan tags; `updateStudentTags` sudah ada |
| D3 | Deep-link `?student=` membuka drawer (share/bookmark, tahan refresh) | Standar proyek: state UI bisa dibagikan via URL (`useUrlTab`) |
| D4 | Upload foto per-siswa dari avatar drawer | `updateStudentPhoto` + `compressImage` sudah ada; "Foto" salah satu dari 13 field kelengkapan |
| D5 | Riwayat kelas di Info drawer + aksi undo promosi terakhir | `previous_class_id`, `promoted_at`, `promotion_batch_id` sudah di type, belum pernah ditampilkan; `undoPromotion` RPC ada |
| D6 | Recap kehadiran H/S/I/A/P per santri di drawer | Helper `summarizeDays` (`portal/api.ts:124-131`) format hari sama |
| D7 | Aksi Scan QR → buka siswa | `shared/scan/ScanModal` sudah dipakai attendance/gate/leave-permit (SKILLS §4) |

## Paket E — Konsistensi & hygiene (rendah)

- **E1** Copy: aturan "siswa" (chrome/label/menu) vs "santri" (narasi pesantren) lalu catat di MEMORY; "Import Data"/"Export Data" → "Impor Data"/"Ekspor Data" (`StudentsPage.tsx:588-589,664`); langkah wizard `Upload/Mapping/Review` → Indonesia (sentuh `shared/ImportWizard` sekali agar semua fitur ikut); placeholder pencarian menyebut field yang benar-benar dicari (`StudentsPage.tsx:1031`).
- **E2** Dead code: `registrationCodeExists` (`api.ts:277`, 0 pemanggil), `Student.is_pinned` (`types.ts:29`), ekspor `FIELD_CHECKS` yang hanya dipakai internal.
- **E3** `rowSelection` belum digate `canWrite` (`StudentsPage.tsx:1145`) — SKILLS §Tabel mewajibkan; `ArchivePage.tsx:546-553` sudah benar. (Putuskan: gate, atau kecualikan "Ekspor terpilih" dan dokumentasikan.)
- **E4** `StatsRow` hardcode `#dc2626/#f59e0b/#16a34a` → token tema DESIGN.md (`StatsRow.tsx:158-176`).

## Paket F — Struktur (utang tercatat di MEMORY)

- **F1** Pecah `StudentsPage.tsx` (1372 baris) → `tabs/ActiveTab.tsx` + `columns.ts` + `headerMenu.ts` agar <600 (AGENTS #7). Catatan: `shortcutItems` sengaja tidak di-memo (MEMORY:320, stale closure).
- **F2** Pecah saat file disentuh: `AlumniPage.tsx` 1087, `components/ImportModal.tsx` 1015, `components/DetailDrawer.tsx` 953, `components/AlumniImport.tsx` 703.

---

## Urutan eksekusi

1. **Fase 1**: Paket A + C (beban jaringan, error state, mobile, a11y).
2. **Fase 2**: Paket B (render & bundle).
3. **Fase 3**: Paket D (nomor dipilih user).
4. **Fase 4**: Paket E + F.

## Verifikasi tiap fase

1. `npx tsc -b` → 0 error.
2. `npm run build` sukses.
3. `npx vitest run` hijau (266 tes saat baseline).
4. Smoke `http://localhost:5174/students`: desktop + 390px tanpa overflow; klik-through elemen interaktif (Delivery Gate antislop R-35) dicatat per elemen.
5. Perubahan copy/struktur: update `MEMORY.md` bila ada keputusan/gotcha baru.

## Cek di luar kode (saat eksekusi Fase 1)

- Nilai Supabase `db-max-rows` (menentukan urgensi A6e).
- Sebaran ukuran `students.photo_url` live (menentukan urgensi A1).
