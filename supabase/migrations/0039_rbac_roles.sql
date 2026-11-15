-- ============================================================
-- 0039: RBAC — tabel roles + role_permissions
--
-- Sumber kebenaran PERMISSION DEFAULT tetap di kode aplikasi
-- (src/shared/rbac/permissions.ts, MODULE_REGISTRY) supaya
-- migrasi tidak perlu diulang setiap kali aksi modul bertambah.
-- Tabel ini menyimpan:
--   roles            : daftar role (key, label, warna, urutan)
--   role_permissions : OVERRIDE permission per role. Baris kosong
--                      berarti role memakai default dari kode
--                      (fallback per-role di useRbac.ts).
-- Tulis ke tabel ini hanya developer|admin (cek teks, tahan
-- rename enum seperti pola is_staff_writer di 0022).
-- ============================================================

-- ------------------------------------------------------------
-- Helper: admin RBAC berbasis teks role
-- ------------------------------------------------------------
create or replace function public.is_rbac_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('developer', 'admin')
  );
$$;

-- ------------------------------------------------------------
-- roles
-- ------------------------------------------------------------
create table public.roles (
  key text primary key,
  label text not null,
  color text not null default 'default',
  description text,
  sort_order integer not null default 100,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_key_format check (key ~ '^[a-z][a-z0-9_]*$')
);

create trigger trg_roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- role_permissions — override permission per role
-- ------------------------------------------------------------
create table public.role_permissions (
  role_key text not null references public.roles (key) on delete cascade,
  permission text not null,
  primary key (role_key, permission)
);

create index role_permissions_role_idx on public.role_permissions (role_key);

-- ------------------------------------------------------------
-- Seed role — harus konsisten dengan enum app_role pasca-rename 0021
-- (developer, admin, manager, teacher, pending).
-- developer terkunci: selalu dapat SEMUA permission (dipaksa
-- juga di sisi aplikasi saat simpan matrix).
-- ------------------------------------------------------------
insert into public.roles (key, label, color, description, sort_order, is_locked) values
  ('developer', 'Developer', 'purple',    'Akses penuh seluruh sistem, tidak bisa dikurangi', 10, true),
  ('admin',     'Admin',     'geekblue',  'Kelola seluruh data dan administrasi sekolah',     20, false),
  ('manager',   'Pengurus',  'cyan',      'Operasional harian santri dan kegiatan',           30, false),
  ('teacher',   'Guru',      'green',     'Modul mengajar dan pendampingan santri',           40, false),
  ('pending',   'Pending',   'default',   'Akun baru menunggu ditetapkan rolenya',            50, false)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- RLS
-- Baca: semua staff authenticated (matrix & guard butuh data
-- ini di banyak tempat). Tulis: developer|admin saja.
-- ------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;

create policy "roles_select_staff" on public.roles
  for select to authenticated
  using (true);

create policy "roles_insert_admin" on public.roles
  for insert to authenticated
  with check (public.is_rbac_admin());

create policy "roles_update_admin" on public.roles
  for update to authenticated
  using (public.is_rbac_admin())
  with check (public.is_rbac_admin());

create policy "roles_delete_admin" on public.roles
  for delete to authenticated
  using (public.is_rbac_admin() and not is_locked);

create policy "role_permissions_select_staff" on public.role_permissions
  for select to authenticated
  using (true);

create policy "role_permissions_insert_admin" on public.role_permissions
  for insert to authenticated
  with check (public.is_rbac_admin());

create policy "role_permissions_delete_admin" on public.role_permissions
  for delete to authenticated
  using (public.is_rbac_admin());
