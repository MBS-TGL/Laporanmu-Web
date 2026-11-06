# Laporanmu V2

Sistem Manajemen Perilaku Siswa (platform pesantren/sekolah) — rebuild dari Laporanmu V1 dengan UI yang konsisten (Ant Design v6) dan skema Supabase yang rapi sebagai source of truth di repo ini.

## Teknologi

- React 19 + TypeScript (strict) + Vite
- Ant Design v6 (`@ant-design/icons`)
- TanStack Query v5 (server state)
- Supabase (auth + database + RLS)
- react-router-dom v7

## Persiapan

1. Install dependencies:

   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env.local`, lalu isi kredensial project Supabase:

   ```bash
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-public-key>
   ```

3. Terapkan skema database — jalankan file di `supabase/migrations/` **berurutan** (0001 → 0008) lewat Supabase SQL Editor, atau `supabase db push` jika Supabase CLI sudah ter-link:

   | File | Isi |
   | --- | --- |
   | `0001_enums.sql` | Enum types (role, status, gender, dll.) |
   | `0002_profiles.sql` | Tabel profiles, trigger signup, helper RLS |
   | `0003_master_data.sql` | academic_years, teachers, classes, dorms, students |
   | `0004_behavior.sql` | point_rules, reports + trigger total_points |
   | `0005_gate.sql` | gate_logs |
   | `0006_rls.sql` | Row Level Security semua tabel |
   | `0007_import_rpc.sql` | RPC `import_students` (impor CSV) |
   | `0008_seed.sql` | View dashboard + seed aturan poin umum |

4. Buat user di Supabase Auth (Email provider). User baru otomatis dapat role `pending`. Promosikan akunmu:

   ```sql
   update profiles set role = 'developer' where email = 'emailmu@contoh.com';
   ```

## Menjalankan

```bash
npm run dev      # dev server
npm run build    # typecheck + production build
npm run lint     # eslint
npm run preview  # preview hasil build
```

## Struktur

```
src/
├── core/            # router, providers (QueryClient + antd theme), entry
├── layouts/         # MainLayout (Sider + Drawer mobile + Header)
├── lib/             # supabase client
├── shared/
│   ├── components/  # PageHeader, ProtectedRoute
│   ├── constants/   # navItems (sidebar)
│   └── hooks/       # useProfile, usePermissions
└── features/        # pola per fitur: types.ts / api.ts / hooks.ts / XPage.tsx / components/XForm.tsx
    ├── academic-years/  classes/  dorms/  students/  teachers/
    ├── auth/        dashboard/
    ├── behavior/    # poin santri (aturan + catatan)
    └── gate/        # log keluar-masuk
```

## Konvensi

- Semua tulisan UI berbahasa Indonesia; notifikasi via `App.useApp().message`.
- Server state hanya lewat TanStack Query (queryKey `['<fitur>', filters]`); tulis via `useMutation` + `invalidateQueries`.
- Akses menulis: role `developer|admin|pengurus`; menghapus: `developer|admin` (dicek di UI via `usePermissions()` dan di database via RLS).
- Master data memakai soft delete (`deleted_at`); kode unik (registration_code, nbm) hanya terkunci untuk baris aktif.
- `gate_logs` bersifat immutable (tanpa edit/hapus).

## Catatan migrasi dari V1

- Proyek legacy `Laporanmu/` hanya jadi referensi dan tidak boleh dimodifikasi.
- Kolom `dorms` kini resmi bernama `name` (bukan `building`), gender asrama memakai nilai `putra|putri|campur`.
- i18n (id/en/ar) tidak dibawa ke V2 — fokus Bahasa Indonesia.
