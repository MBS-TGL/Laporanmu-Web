# Rencana: Migrasi Legacy → Laporanmu-Web (V2)

## 0. Hasil Riset & Keputusan

### Fakta verifikasi
| Item | Status |
|---|---|
| `lucide-react` | **Tidak terinstal** → keputusan: **AntD icons saja** (`@ant-design/icons`) |
| `.env.local` | ✅ `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` terisi |
| `core/router.tsx`, `MainLayout.tsx`, `navItems.tsx` | **Belum ada** → buat dari nol |
| Yang sudah ada | `src/lib/supabase.ts` (flag `isDemoMode`), `src/main.tsx` (QueryClient+ConfigProvider inline), `src/App.tsx` (template Vite default) |
| antd | **v6.7.0** (bukan v5 — API utama kompatibel, pakai v6) |
| `@ant-design/icons` | v6.3.4 baru *transitive dep* → tambahkan sebagai direct dependency |
| `master_data.sql` | Tidak ditemukan → patokan skema: **`Laporanmu/database.md` + kode legacy** |
| tsconfig | `strict` belum aktif → **aktifkan `strict: true`**; `verbatimModuleSyntax` aktif → wajib `import type` |
| Path alias | Tidak ada → pakai **import relative** |

### Keputusan user
1. Ikon: **AntD icons saja** (tanpa lucide-react).
2. Demo mode: **Tidak** — cukup flag `isDemoMode`; tanpa mock data.
3. Skema: **database.md + legacy** → `students.status: 'aktif'|'lulus'|'pindah'|'keluar'`, `teachers.status: 'active'|'inactive'|'cuti'`.
4. Sidebar: **hanya menu yang sudah dimigrasi** (Dashboard + 5 master + Asrama).

### Patokan skema inti (database.md)
- `profiles(id, email, name, role, phone, avatar_url, spmb_role)` — role: `developer|admin|pengurus|guru|pending`
- `students(..., status: enum aktif|lulus|pindah|keluar, class_id, dorm_id, deleted_at, total_points, tags, is_pinned, ...)`
- `teachers(..., status active|inactive|cuti, nbm unique, subject, phone, deleted_at, profile_id, ...)`
- `classes(id, name, grade, major, homeroom_teacher_id, academic_year_id)` — **tanpa deleted_at** → hard delete
- `academic_years(name, semester, start_date, end_date, is_active, is_locked, curriculum, deleted_at, ...)`
- `dorms(id, building, gender, capacity, musyrif_id, status, ar)` — ⚠️ task menyebut `name`, database.md menyebut `building` → **probe `select * limit 1` saat implementasi** dan sesuaikan type/form.
- RLS: baca data butuh login + role selain `pending`; tulis dibatasi role tertentu (mis. insert/update students: `developer|admin|pengurus`, delete: `developer|admin`).

### Aturan konversi (ringkas)
- JSX→TSX, tanpa `any`; Tailwind→AntD penuh; fetch→`useQuery`, tulis→`useMutation` + `invalidateQueries`; navigasi hanya `useNavigate`/`<Link>`; notifikasi via `App.useApp().message`; form wajib `rules`; loading `Spin`/`Table loading`; error `Alert`/`message.error`.
- i18n **skip** (fokus ID).
- Import path relative (`../` konsisten).

---

## FASE 1 — Fondasi (urutan wajib, laporkan per file)

> Workflow: setiap file selesai → laporkan path + isi singkat ke user.

### 1. Persiapan config
- **`tsconfig.app.json`** — tambah `"strict": true`.
- **`package.json`** — tambah direct dependency `@ant-design/icons` (npm install). (lucide-react tidak dipasang.)
- **`src/index.css`** — ganti style template Vite jadi reset minimal (hapus hero/ticks) + `body { margin: 0 }`.

### 2. `src/lib/supabase.ts` (edit)
- Pertahankan `createClient` dengan `import.meta.env.VITE_SUPABASE_*`, persist session.
- **Hapus** `console.warn` demo & logika dummy URL (tanpa mock/demo mode); pertahankan export `isDemoMode` (true jika env kosong) untuk ditangani di level page (Alert "koneksi tidak tersedia").

### 3. `src/core/providers.tsx` (baru)
- Export `queryClient` (staleTime 5 mnt, refetchOnWindowFocus false) + komponen `AppProviders`.
- Isi: `QueryClientProvider` → `ConfigProvider` (`locale={idID}`, theme token) → `<AntdApp>` (dari `antd`, agar `App.useApp().message` tersedia) → `<AuthListener />` (efek `supabase.auth.onAuthStateChange` → `queryClient.invalidateQueries({queryKey:['session']})` & `['profile']`).

### 4. `src/shared/hooks/useProfile.ts` (baru)
- `useSession()`: `useQuery({queryKey:['session'], queryFn: getSession, staleTime: Infinity})` + sinkron dari `AuthListener`.
- `useProfile()`: `enabled: !!session?.user`, query `profiles` `.eq('id', uid).single()`, return `{ profile, role, isLoading, isAuthenticated }`.
- Helper murni: `isRoleAllowed(role)` — true untuk `developer|admin|pengurus|guru`, false untuk `pending`/null.

### 5. `src/shared/constants/navItems.tsx` (baru)
- Adaptasi `legacy navItems.js` → hanya item terimplementasi:
  - Standalone: `DASHBOARD_ITEM` (`/dashboard`, `DashboardOutlined`)
  - Grup **Master Data**: Siswa (`TeamOutlined`), Guru (`ReadOutlined`), Kelas (`BankOutlined`), Tahun Akademik (`CalendarOutlined`) — path legacy `/master/*`
  - Grup **Kesantrian**: Asrama (`ApartmentOutlined`, `/boarding/dorms`)
- Tipe `NavItem { to, label, icon, desc }`, `NAV_GROUPS`.
- `filterNavItems(items, role)`: struktur `requireRoles` disiapkan (untuk sekarang semua role aktif lihat sama).
- **Tanpa Tailwind class warna** (legacy `bg-indigo-500/10` dibuang).

### 6. `src/shared/components/ProtectedRoute.tsx` (baru)
- Cek `useSession()`: loading → `<Spin fullscreen>`; belum login → `<Navigate to="/login" replace>`; `role === 'pending'` → `<Result status="403" title="Akses Ditolak">`; else `<Outlet />`.
- Ekspor juga `PublicRoute` (sudah login → redirect `/dashboard`).

### 7. `src/shared/components/PageHeader.tsx` (baru)
- Props `title`, `subtitle?`, `extra?` → `Typography.Title` + `Space` (dipakai semua page).

### 8. `src/layouts/MainLayout.tsx` (baru)
- `<Layout>`:
  - `Layout.Sider` (desktop, `breakpoint="lg"`, `collapsedWidth={0}` di mobile, logo + `Menu` dari NAV_GROUPS, `selectedKeys` dari `useLocation`).
  - Mobile (`Grid.useBreakpoint`): tombol hamburger → `<Drawer>` berisi Menu yang sama.
  - `Layout.Header`: judul app + `Dropdown` profil (`UserOutlined`, nama+role dari `useProfile`, item: Keluar → `useLogout`) + `Badge` `BellOutlined` (dekoratif).
  - `Layout.Content`: `<Outlet />` dengan padding.
- Logout: `signOut()` + invalidate + `navigate('/login')` — **tanpa** `window.location.reload()`.

### 9. `src/features/auth/` (baru)
- **`api.ts`**: `signIn(email, pass)` → `supabase.auth.signInWithPassword`; `signOut()`.
- **`hooks.ts`**: `useLogin()` mutation (sukses → invalidate `['session']`,`['profile']`, `navigate('/dashboard')`, `message.success`); `useLogout()` mutation (invalidate + `navigate('/login')`).
- **`LoginPage.tsx`**: Card di tengah, `Form` AntD (email `required+email`, password `required min 6`), `Button type="primary" loading`, `message.error` saat gagal, redirect via `PublicRoute`. Tanpa lockout/demo drawer (tidak wajib).

### 10. `src/features/dashboard/DashboardPage.tsx` (placeholder)
- `PageHeader` + `<Empty>` "Statistik menyusul" (FASE 3).

### 11. `src/core/router.tsx` (baru)
- `createBrowserRouter`:
  ```
  /login                   → PublicRoute → LoginPage
  /                        → ProtectedRoute → MainLayout
      index                → Navigate /dashboard
      /dashboard           → DashboardPage
      /master/students     → StudentsPage      [FASE 2]
      /master/teachers     → TeachersPage      [FASE 2]
      /master/classes      → ClassesPage       [FASE 2]
      /master/academic-years → AcademicYearsPage [FASE 2]
      /boarding/dorms      → DormsPage         [FASE 2]
      *                    → NotFound (Result 404)
  ```
- FASE 1: route FASE 2 di-placeholder dulu; diaktifkan bertahap.

### 12. `src/App.tsx` & `src/main.tsx` (edit)
- `App.tsx`: hanya `<RouterProvider router={appRouter} />` (hapus template Vite & `App.css`).
- `main.tsx`: `<AppProviders><App /></AppProviders>` (provider pindah ke `core/providers.tsx`).

### ✅ FASE 1 — Test manual
`npm run dev` → login → dashboard kosong → sidebar sesuai role → logout → `npm run lint` + `npm run build` hijau.

---

## FASE 2 — Master Data (berurutan, **preview dulu ke user sebelum simpan**)

> Workflow per fitur: tulis isi file → **tampilkan preview** → user review → simpan → lanjut fitur berikutnya.

Pola per fitur (`students`, `teachers`, `classes`, `dorms`, `academic-years`):

```
features/<fitur>/
├── types.ts        # type row + form values (union literal sesuai database.md)
├── api.ts          # select/insert/update/delete via supabase, if(error) throw
├── hooks.ts        # useQuery daftar + useMutation CRUD, invalidate queryKey ['<fitur>']
├── <Fitur>Page.tsx # PageHeader + filter + Table AntD (loading, pagination, row actions)
└── components/<Fitur>Form.tsx  # Modal + Form + rules validasi
```

Konvensi bersama:
- Query key: `['students']`, `['teachers']`, dst. + filter masuk ke key (`['students', filters]`).
- Server-side pagination `.range()` + `count: 'exact'`; search `.ilike`.
- Error: `if (error) throw error` di api; page pakai `<Alert>` / `message.error`.
- Aksi destruktif: `<Popconfirm>`; role-gate (hapus: hanya `developer|admin`).
- `dayjs` + `DatePicker` → simpan ISO string saat submit.

### 2.1 Students (soft delete `deleted_at`)
- **Types**: `Student` (kolom database.md: `registration_code, pin, nisn, name, gender 'L'|'P', status enum aktif|lulus|pindah|keluar, total_points, class_id, dorm_id, phone, photo_url, tags[], is_pinned, deleted_at, ...`) + `StudentFormValues`.
- **API**: `fetchStudents({search, classId, gender, status, page, pageSize})` → `select('*, classes(name)')` + `.is('deleted_at', null)` + filter + `.range()` + order `name`; `createStudent`, `updateStudent`, `softDeleteStudent` (`update({deleted_at: now})`).
- **Hooks**: `useStudents(filters)`, `useCreateStudent`, `useUpdateStudent`, `useDeleteStudent`.
- **Page**: kolom: Siswa (nama+kode), NISN, Kelas, Gender, Status (Tag), Poin, Aksi; filter: Input.Search, Select kelas, Select gender, Segmented status; `Table loading`, pagination server.
- **Form**: required `name`, `class_id`; `registration_code` unik (validator cek API), `nisn` pattern digit, `gender` L/P, `status` Select, `phone`, `tags` multiple, `total_points` InputNumber; mode create/edit.
- **Catatan**: modal lanjutan legacy (import/export/profile/PDF) **tidak** dimigrasi sekarang.

### 2.2 Teachers
- Types `Teacher` (`nbm` unique, `subject`, `gender`, `phone`, `email`, `status 'active'|'inactive'|'cuti'`, `join_date`, `deleted_at`, `profile_id`, `nik/nip/nuptk` opsional).
- API: filter status/gender + search (name/nbm), create/update, soft delete (`deleted_at` ada di database.md).
- Page: kolom Guru, NBM, Mapel, Gender, Kontak, Status (Tag), Bergabung, Aksi.
- Form: required `name`; `nbm` unik; `status` Select; `join_date` DatePicker; `phone`.

### 2.3 Classes
- Types `ClassRow` (`name, grade, major, academic_year_id, homeroom_teacher_id, students(count)` via embed).
- API: `select('*, students(count)')`; metadata `useAcademicYearsBrief()` + `useTeachersBrief()` untuk Select.
- Page: kolom Kelas, Tingkat, Tahun Akademik, Wali Kelas, Jumlah Siswa, Aksi; badge tanpa wali kelas.
- Form: required `name`, `grade`, `academic_year_id` (default tahun aktif), `homeroom_teacher_id` (opsional), `major`.
- Delete: **hard delete** + Popconfirm (kolom `deleted_at` tidak ada).

### 2.4 Dorms
- **Probe dulu**: `select('*').limit(1)` saat dev → tentukan field (`building` vs `name`) → finalize `types.ts`.
- Types `Dorm` (`building/name, gender, capacity, musyrif_id, status, ar`).
- API: fetch + upsert + delete; `useTeachersBrief` untuk musyrif.
- Page: Kamar, Gender, Kapasitas, Musyrif, Status, Aksi.
- Form: required nama kamar, gender, capacity (InputNumber min 1), musyrif Select, status Select.

### 2.5 Academic Years
- Types `AcademicYear` (`name, semester 'Ganjil'|'Genap', start_date, end_date, is_active, is_locked, curriculum, deleted_at`).
- API: fetch (filter `deleted_at` null, order `start_date desc`), create, update, soft delete, **`setActive(id)`** = 2 update (nonaktifkan lain → aktifkan target; urutan sama seperti legacy).
- Page: Nama, Semester, Periode, Status (Tag Aktif/Terkunci), Aksi (Edit, **Set Aktif** jika belum aktif & belum lock, Hapus).
- Form: required `name`, `semester`, `start_date`; validasi `end_date > start_date`; checkbox "Jadikan aktif" saat create.

### ✅ FASE 2 — Test per fitur
CRUD jalan, filter+pagination jalan, validasi form bekerja, role `pending` terblokir, lalu `npm run lint` + `npm run build`.

---

## FASE 3 — Opsional (setelah FASE 2 disetujui)
- Dashboard statistik (count students/teachers/classes via `select('*', {count:'exact', head:true})`).
- Poin Santri (behavior/reports/point_rules), Gate Logs, Import CSV — **tunda sampai user minta**.

---

## Checklist Kualitas (dijalankan di akhir tiap fase)
- [ ] `npm run lint` & `npm run build` (`tsc -b && vite build`) hijau, strict TS, tanpa `any`
- [ ] Semua form punya `rules`; loading/error state ada
- [ ] Responsive: Sider → Drawer di mobile
- [ ] `ProtectedRoute` cek session + role `pending` → 403
- [ ] Tanpa `console.log`, tanpa `window.location.href`, tanpa fetch di `useState/useEffect`
- [ ] Legacy `Laporanmu/` tidak dimodifikasi

## Risiko / Catatan
1. **Kolom dorms** (`name` vs `building`) belum pasti → probe saat implementasi.
2. **Kolom classes `deleted_at`** tidak ada di database.md → hard delete; jika ternyata ada di DB, evaluasi saat test.
3. **antd v6** (bukan v5) — gunakan API v6; hindari API yang sudah dihapus di v6.
4. Route path memakai path legacy (`/master/*`, `/boarding/dorms`) agar konsisten dengan navItems.
