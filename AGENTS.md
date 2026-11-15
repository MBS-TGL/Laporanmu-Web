# Laporanmu-Web — Catatan untuk Agent

## Dev server
- **Selalu gunakan `localhost:5174` untuk proyek ini.** Server dev sudah berjalan di port tersebut (dimiliki user).
- Jangan menjalankan `npm run dev` sendiri kecuali port 5174 mati dan user memintanya.
- Port 5173 & 5199 dipakai proyek Laporanmu **versi lama (V1)** — jangan tertukar.
- Verifikasi visual/fitur: arahkan browser ke `http://localhost:5174`.

## Konteks proyek
- React 19 + Vite + AntD v6 + Supabase + TanStack Query, tanpa Tailwind (inline style + `src/index.css`).
- Library animasi: **`motion`** (`motion/react`) — primitif di `src/shared/motion.ts`; `MotionConfig reducedMotion="user"` sudah dibungkus di `core/providers.tsx`. Dial & aturan: `DESIGN.md` §Motion (ENERGY 2 / RHYTHM 2 / MOTION 2). Jangan loop `infinite`; jangan animasikan interior AntD.
- Halaman publik: `/` (landing), `/check`, `/verify`, `/suspension/:token`, `/login` — shell bersama di `src/features/public/PublicShell.tsx`, kartu portal di `PortalCard.tsx`.
- Semua copy UI berbahasa Indonesia.

## Peta arsitektur
```
src/
  core/            router.tsx (semua route + ALIAS_REDIRECTS), providers.tsx (MotionConfig), queryClient.ts
  layouts/         MainLayout, Sidebar, Topbar, ChatAssistant
  features/        <domain>/{XPage.tsx, api.ts, hooks.ts, types.ts, components/, tabs?}
  shared/          motion.ts     — primitif animasi (EASE, route/shell/bulk/rail)
                   components/   — AppModal, PageHeader, StatChip, FilterChips, ActionBar,
                                StatusTag, StudentSelect, SectionDivider, ShortcutsModal,
                                MaintenanceGate (route transition), ...
                   hooks/       — useUrlTab, useProfile, useFeatureFlags, useDebounce, useShortcuts
                   api/         — crud.ts (softDelete, softDeleteMany)
                   import/      — ImportWizard + readFile (impor Excel/CSV)
                   export/      — ExportModal + downloadXlsx
                   scan/        — ScanModal + useQrScanner (kamera QR)
                   constants/   — navItems.tsx (satu-satunya sumber menu sidebar)
                   utils/       — csv.ts, auditLogger.ts, imageCompress.ts, tableSort.ts
  lib/             supabase.ts (client)
```

## Aturan wajib (singkat)
1. **Page baru WAJIB ikut playbook `SKILLS.md`** di root — jangan mengarang pola sendiri.
2. Halaman besar multi-fungsi = **1 route + Tabs `?tab=`** (pola `useUrlTab`, contoh: `/students?tab=alumni`). JANGAN pecah jadi beberapa route terpisah untuk fungsi se-domain.
3. Detail entity = **Drawer** (`XDetailDrawer`), bukan route terpisah.
4. Pakai shared primitives: AppModal (bukan Modal mentah), PageHeader, StatChip, FilterChips, ActionBar, StatusTag, ImportWizard, ExportModal, ScanModal, `softDelete()`.
5. Soft delete via `deleted_at` — jangan pernah hard delete data operasional.
6. Mutasi react-query harus `invalidateQueries` pada key terkait (+ `['dashboard']` bila memengaruhi ringkasan), dan aksi tulis penting dicatat via `logAudit`.
7. File page jaga tetap ramping (< ±600 baris): ekstrak modal/drawer/section ke `components/`.
8. **Penamaan maksimal 2 kata** (camelCase, contoh `ImportModal`, `StudentsPage`, `useUrlTab`; untuk hook dihitung setelah prefix `use`). Suffix type tetap: `Page`, `Form`, `Modal`, `Drawer`, `Tab`, `Icon`. Prefix domain di-drop bila folder feature sudah memberi konteks (`gate/components/ExportModal`, bukan `GateExportModal`). Dua modal serumpun dalam satu feature dibedakan entity: `AlumniImport`, `ArchiveExport`. Parser murni = `importParse.ts` di folder feature masing-masing.
9. Keunikan nama komponen berlaku **per folder**, bukan global: dua `ImportModal` di folder feature berbeda sah (folder = konteks). Dilarang ada dua nama sama di SATU file/import — kalau perlu, pakai alias import (`ExportModal as SharedExportModal`).
10. Setelah perubahan signifikan (refactor, pola baru, gotcha baru), **update `MEMORY.md`**.

## Referensi
- `SKILLS.md` — playbook + snippet siap-copy untuk tugas umum.
- `MEMORY.md` — log keputusan, gotcha, utang teknis. Baca dulu sebelum kerja besar.
- `DESIGN.md` — arah desain (identitas, palet, tipografi, dial motion). **Untuk kerja UI: baca `DESIGN.md` dulu untuk arah, lalu skill `antislop` sebagai filter.**
- `docs/PRD-Sidikmu-Replacement.md` — PRD penggantian sistem lama.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read these installed skill files directly (use these paths even if a same-named global skill exists):
- Core filter, always on: `antislop`: `.opencode/skills/antislop/SKILL.md`
- UI / visual: `antislop-ui`: `.opencode/skills/antislop-ui/SKILL.md`
- Copy & text: `antislop-copywriting`: `.opencode/skills/antislop-copywriting/SKILL.md`
- People: `antislop-human`: `.opencode/skills/antislop-human/SKILL.md`
- Mobile / responsive: `antislop-layoutmobile`: `.opencode/skills/antislop-layoutmobile/SKILL.md`
- Code comments: `antislop-code`: `.opencode/skills/antislop-code/SKILL.md`
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: `npx antislop-ai --update`, or run `npx antislop-ai` and pick Overwrite them.
<!-- antislop:end -->
