# PLAN — Fase 5: 6 Capability Centers (Beyond Sidikmu)

> Single source of truth across sessions. Goal: **200% beyond Sidikmu** by leveraging
> infrastructure Sidikmu lacks: realtime, public token portals, WA automation,
> analytics + AI, approval flows, RBAC + audit.
> Convention: 1 batch = migration (0050+) + `module.*`/`system.*` flag + RBAC module
> (`shared/rbac/permissions.ts` — include `READ_ONLY_MODULES`) + playbook SKILLS.md.
> **System naming (routes, folders, flags, tables, permissions) is English. UI copy
> stays Bahasa Indonesia** per AGENTS.md.

## Status

| Batch | Flag | Migration | Status |
|---|---|---|---|
| A — Finance SPP (`/finance`) | `module.finance_spp` | 0046 ✅ run | ✅ core done |
| B — CBT Advanced (5 question types, difficulty mix, essay grading) | `module.cbt_lanjutan` | 0047 ✅ run | ✅ core done |
| R — Naming Normalization | — | 0050 ✅ run | ✅ done |
| P6 — CBT Elite (item analysis, answer review, remedial, leaderboard, realtime, WA score) | `module.cbt_elite` | 0048 ✅ run | ✅ done |
| P1 — Evaluation Center (`/instruments`, `/survey/:token`) | `module.evaluation` | 0049 ✅ run | ✅ done (e2e verified) |
| P5 — Connectivity (PPDB webhook / multi-entity / PWA portal) | `system.api` / `system.multi_entity` / `system.student_portal` | 0051–0053 ✅ run | ✅ done (e2e verified) |
| P2 — Attendance Center (`/attendance?tab=subjects`) | `module.subject_attendance` | 0054 ✅ run | ✅ done (live verified) |
| P3 — Spiritual Center (`/worship`) | `module.spiritual` | 0055 ✅ run | ✅ done (live verified) |
| P4 — Document Center (`/documents`) | `module.documents` | 0056 ✅ run | ✅ done (data verified; klik cetak/yudisium konfirmasi user) |

Execution order approved by user: **P6 → P1 → P5 → P2 → P3 → P4**.

## Session-inherited gotchas (mandatory read)

- upsert `onConflict` needs a plain unique index — SPP `period` must be `not null default ''` (expression index `coalesce()` is NOT inferred by PostgREST).
- pgcrypto lives in schema `extensions` on Supabase → security-definer functions using `digest()` need `set search_path = public, extensions`.
- PL/pgSQL `found` is reset by `select count(*) into` — save it to a boolean variable first.
- `jsonb_array_elements_text` only has the `(jsonb)` overload — use `->`, not `->>`.
- antd v6: `InputNumber<number>` for parser typecheck; `Popconfirm` uses `description`; wrap disabled buttons in `<span>` inside `<Tooltip>`; use `AppModal`, not raw `Modal`.
- New RBAC module: `MODULE_REGISTRY` + `READ_ONLY_MODULES` (permissions.ts), route `guarded('x:read', ...)`.
- Old DDL check constraints: `drop constraint if exists` before `add constraint`.
- Migration numbering collisions across parallel sessions happened (0039) — `ls supabase/migrations` first.
- Run migrations manually via Supabase SQL Editor, collected per batch.
- **English naming sweep done (0050)**: route `/discipline` (alias `/disiplin`), flags `module.finance_spp`/`module.evaluation`, RBAC `finance:*`/`discipline:*`/`evaluation:*`. Deep links `/disiplin?tab=` → `/discipline?tab=` (tab keys: rules/notes/suspension).

## R — Naming Normalization (migration 0050)

- feature_flags renames: `keuangan_spp→finance_spp`, `evaluasi→evaluation`, `presensi_mapel→subject_attendance`, `rohani→spiritual`, `ibadah→worship`, `disiplin→discipline`.
- role_permissions renames: `keuangan:%→finance:%`, `evaluasi:%→evaluation:%`, `disiplin:%→discipline:%`.
- Code sweep: route `/discipline`, registry keys, flags, deep links (dashboard, router aliases).

## P6 — CBT Elite (migration 0048, flag `module.cbt_elite`)

1. **Item analysis**: pure helpers `features/cbt/itemAnalysis.ts` + `grading.ts` (✅ 8 tests); table in `ExamDrawer` (question, % correct, discrimination index, verdict mudah/sulit/beda-rendah) — ✅ done.
2. **Answer review after exam**: `cbt_exams.show_explanations` toggle + RPC `cbt_review_answers` — ✅ done (modal in result phase of `/exam`).
3. **1-click remedial**: from attempts < KKM → duplicate exam + new token (`is_remedial_of`) — ✅ done (`RemedialModal`).
4. **Anonymous leaderboard**: `show_leaderboard` toggle + RPC `cbt_leaderboard` (top-10 initials) — ✅ done.
5. **Realtime proctor monitor**: postgres_changes on `cbt_attempts` in ExamDrawer — ✅ done.
6. **WA score to guardian**: toggle `auto_cbt_wa`; fired after grading/force-submit — ✅ done.

## P1 — Evaluation Center (migration 0049, flag `module.evaluation`)

- Generic questionnaire engine: `instruments` (kind `akpd|sosiometri|mbti|edom|custom`, questions jsonb: skala/pilihan/teks/teman + dimension), `instrument_responses` (unique instrument+student).
- RPC `eval_start/eval_submit` public (token hash pattern, class-guarded).
- **One-click built-in templates**: AKPD (6 dimensions), Sosiometri (pilih teman), MBTI (I-E/N-S/F-T/P-J skala pairs), EDOM (teaching dimensions), Custom — seed TS in `features/evaluation/templates.ts`.
- Auto-analysis: AKPD/EDOM dimension averages + class recap; **Sosiometry: interactive SVG sociogram + cohesion index + Moreno auto-flag (stars/isolated)**; MBTI letter type + distribution.
- Staff `/instruments` (tabs kelola/hasil), public `/survey/:token`; "Buat Sesi BK" via global student drawer.
- ✅ core done (migration 0049 ⏳ run).

## P5 — Connectivity (migrations 0051–0053)

- **P5a PPDB webhook** (0051): `api_keys` (name, key_hash, last_used_at); Edge Function `ppdb-webhook` (validate key → upsert `admissions` dedupe registration_number → rate limit); admin UI `/admin?tab=integrations` (CRUD key + endpoint + sample payload). — ✅ done
- **P5b Multi-entity** (0052): `entities` (name, code, type, is_active) + seed 1 default; `entity_id` on root tables (students, teachers, classes, academic_years, inventory, spp_components); RLS helper `current_entity_id()` (from `app.current_entity` request header); EntitySwitcher in Topbar; school profile per entity. — ✅ done (profil sekolah per-entity menunggu restrukturisasi PK school_settings — lihat MEMORY)
- **P5c PWA Student Portal** (0053): RPC `portal_login(p_code, p_pin)` → hashed session token 12h (suspension pattern); manifest + service worker (hand-rolled, tanpa vite-plugin-pwa); `/portal` (today schedule, grades, attendance, points, SPP balance+bills, tahfidz progress); web push: `push_subscriptions` + VAPID via app_settings `push.vapid_public` + Edge `push-send` (students; guardian via `/check` menyusul). — ✅ done
- Flags: `system.api`, `system.multi_entity`, `system.student_portal`; admin toggle. — ✅

## P2 — Attendance Center (migration 0054, flag `module.subject_attendance`)

- `subject_attendance` (student_id, class_subject_id, time_slot_id, date, status H/S/I/A, note; unique santri+cs+slot+date) + recap RPC.
- Tab `?tab=subjects` in `/attendance`: class+date → santri × slot grid (time_slots + schedule), all-present quick fill; teacher of the hour auto-recorded (schedule + substitution_logs).
- WA to guardian on absence (toggle `auto_absen_mapel_wa`, debounce 1/day/santri).
- Analytics: weekly trend, class heat map, early warning ≥N absences/month → BK watchlist; per-student section in DetailDrawer.

## P3 — Spiritual Center (migration 0055, flag `module.spiritual`)

- `worship_items` (category wudhu/sholat/hafalan_hadist/hafalan_doa, label, order, preset bool) + **one-click built-in presets** (seed TS).
- `worship_mastery` (santri, item, status terampil/belum, date; unique) — item progression.
- `worship_scores` (santri, item, month, grade; unique) — monthly grid (attendance-grid pattern).
- `/worship` tabs per category; class progress board (stars, light gamification); WA on item mastery (toggle `auto_rohani_wa`); import/export; reads existing tahfidz/halaqah data for a unified spiritual profile.

## P4 — Document Center (migration 0056, flag `module.documents`)

- `curriculum_cps` (subject, phase, description), `curriculum_tps` (cp_id, description, order), `cocurricular_dims` (name, order), `cocurricular_scores` (santri, dim, semester, year, predicate, description), `graduation_checks` (santri, requirements jsonb, status, approved_by/at).
- `/documents` tabs `?tab=rapor|khs|transcript|buku-induk|yudisium`:
  - Full Kurmer report print (grades + KKM + auto description from leger + **AI sentence polish** via `callGemini` — teacher-reviewed) + per-student achievement radar (recharts).
  - KHS per semester & Transcript grade 7–9 per student (leger aggregation) + letterhead print.
  - Digital Buku Induk per class (print + XLSX).
  - Yudisium: requirements checklist (grades complete / tahfidz target / SPP paid from spp / discipline points) → decision → graduation document.
- Permission `documents`; all documents letterhead + QR verification (official letters pattern).

## Sisa sub-item per batch (kecil, belum dibangun — 2026-11-18)

Hasil audit ulang: status besar done, tapi sub-spesifikasi berikut belum terealisasi. Urut prioritas:

| Batch | Sub-item | Catatan |
|---|---|---|
| P4 | Per-student achievement radar (recharts) di rapor | grafik capaian per santri |
| P4 | QR verification pada dokumen (pola surat resmi) | kop sudah ada, QR belum |
| P3 | Unified spiritual profile (integrasi tahfidz/halaqah di /worship) | data tahfidz sudah ada di DetailDrawer |
| P3 | Import kemahiran (ImportWizard) | preset + manual dianggap cukup v1 |
| P1 | Class recap angket (rekap per kelas di tab Hasil) | dimensi per santri sudah ada |
| P5 | Push wali via /check + auto-fire push (pengumuman/SPP/rapor) | butuh VAPID + prod dulu |
| P5 | Profil sekolah per-entity | tunggu restrukturisasi PK school_settings |
| P2 | URL sync pilihan kelas/tanggal di tab Mapel | deep-link grid |

## Definition of done per batch

Migration run + tsc clean + vitest + build + main flow tested at 5174 + flag OFF hides menu/route + MEMORY/PRD updated.

## Excluded (documented, needs on-device ML / separate platform)

AI camera proctoring, face recognition attendance, elearning.
