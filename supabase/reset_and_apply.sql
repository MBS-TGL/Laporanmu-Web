-- ============================================================
-- RESET: hapus semua objek Laporanmu di Supabase
-- ⚠️ Hapus SEMUA data aplikasi — hanya untuk project dev yang masih kosong!
-- Idempoten: aman dijalankan ulang (semua pakai IF EXISTS)
-- ============================================================

-- Trigger di skema auth (dibuat ulang oleh 0002)
drop trigger if exists on_auth_user_created on auth.users;

-- Tabel (anak dulu, baru induk; cascade membersihkan FK & view)
drop table if exists public.gate_logs cascade;
drop table if exists public.reports cascade;
drop table if exists public.point_rules cascade;
drop table if exists public.students cascade;
drop table if exists public.classes cascade;
drop table if exists public.dorms cascade;
drop table if exists public.teachers cascade;
drop table if exists public.academic_years cascade;
drop table if exists public.profiles cascade;

-- Fungsi
drop function if exists public.set_updated_at() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.get_my_role() cascade;
drop function if exists public.has_any_role(public.app_role[]) cascade;
drop function if exists public.is_staff() cascade;
drop function if exists public.import_students(jsonb) cascade;
drop function if exists public.adjust_student_total_points() cascade;

-- Enum types (paling akhir — bergantung pada fungsi di atas)
drop type if exists public.app_role cascade;
drop type if exists public.person_gender cascade;
drop type if exists public.semester_type cascade;
drop type if exists public.student_status cascade;
drop type if exists public.teacher_status cascade;
drop type if exists public.dorm_gender cascade;
drop type if exists public.dorm_status cascade;
drop type if exists public.gate_direction cascade;



-- ============================================================
-- 0001: Enum types Laporanmu V2
-- Project Supabase: ieckbzhpjehgwpjgdrwk (fresh)
-- ============================================================

create type public.app_role as enum ('developer', 'admin', 'pengurus', 'guru', 'pending');

create type public.person_gender as enum ('L', 'P');

create type public.semester_type as enum ('Ganjil', 'Genap');

create type public.student_status as enum ('aktif', 'lulus', 'pindah', 'keluar');

create type public.teacher_status as enum ('active', 'inactive', 'cuti');

create type public.dorm_gender as enum ('putra', 'putri', 'campur');

create type public.dorm_status as enum ('aktif', 'penuh', 'nonaktif');

create type public.gate_direction as enum ('keluar', 'masuk');
-- ============================================================
-- 0002: Profiles + helper RLS + trigger updated_at & signup
-- ============================================================

-- ------------------------------------------------------------
-- Helper: updated_at otomatis di semua tabel
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Tabel profiles (1:1 dengan auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text,
  role public.app_role not null default 'pending',
  phone text,
  avatar_url text,
  spmb_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Profil staff; kolom role menentukan akses via RLS';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Trigger: buat profil otomatis (role pending) saat user signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Helper RLS (security definer agar bisa membaca profiles
-- saat mengevaluasi policy tabel lain)
-- ------------------------------------------------------------
create or replace function public.get_my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = any (required)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(
    array['developer', 'admin', 'pengurus', 'guru']::public.app_role[]
  );
$$;
-- ============================================================
-- 0003: Master data (academic_years, teachers, classes, dorms, students)
-- Perbaikan dari skema lama:
--   * soft delete seragam (semua tabel punya deleted_at)
--   * kode unik (registration_code, nbm) hanya untuk baris aktif
--   * dorms memakai kolom "name" (bukan "building"), tanpa kolom "ar"
-- ============================================================

-- ------------------------------------------------------------
-- Tahun akademik
-- ------------------------------------------------------------
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  semester public.semester_type,
  start_date date,
  end_date date,
  is_active boolean not null default false,
  is_locked boolean not null default false,
  curriculum text,
  description text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_date_range_check check (
    start_date is null or end_date is null or end_date > start_date
  )
);

create index academic_years_start_date_idx on public.academic_years (start_date desc);
create trigger trg_academic_years_updated_at
  before update on public.academic_years
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Guru
-- ------------------------------------------------------------
create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  gender public.person_gender,
  nik text,
  nip text,
  nuptk text,
  nbm text,
  phone text,
  email text,
  subject text,
  status public.teacher_status not null default 'active',
  join_date date,
  address text,
  notes text,
  photo_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NBM unik hanya untuk guru aktif; kode guru yang di-soft-delete boleh dipakai ulang
create unique index teachers_nbm_active_unique on public.teachers (nbm)
  where deleted_at is null and nbm is not null;
create index teachers_name_active_idx on public.teachers (name) where deleted_at is null;
create index teachers_status_active_idx on public.teachers (status) where deleted_at is null;
create trigger trg_teachers_updated_at
  before update on public.teachers
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Kelas
-- ------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  major text,
  homeroom_teacher_id uuid references public.teachers (id) on delete set null,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classes_name_active_idx on public.classes (name) where deleted_at is null;
create index classes_academic_year_idx on public.classes (academic_year_id);
create trigger trg_classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Asrama — "name" adalah nama kamar/gedung resmi
-- ------------------------------------------------------------
create table public.dorms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender public.dorm_gender,
  capacity integer not null default 0,
  musyrif_id uuid references public.teachers (id) on delete set null,
  status public.dorm_status not null default 'aktif',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dorms_capacity_check check (capacity >= 0)
);

create index dorms_name_active_idx on public.dorms (name) where deleted_at is null;
create trigger trg_dorms_updated_at
  before update on public.dorms
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Siswa (santri)
-- ------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  registration_code text not null,
  pin text,
  nisn text,
  nis text,
  nik text,
  name text not null,
  gender public.person_gender,
  status public.student_status not null default 'aktif',
  total_points integer not null default 0,
  class_id uuid references public.classes (id) on delete set null,
  dorm_id uuid references public.dorms (id) on delete set null,
  phone text,
  photo_url text,
  tags text[] not null default '{}',
  is_pinned boolean not null default false,
  guardian_name text,
  guardian_relation text,
  birth_place text,
  birth_date date,
  religion text,
  address text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index students_registration_code_active_unique on public.students (registration_code)
  where deleted_at is null;
create index students_name_active_idx on public.students (name) where deleted_at is null;
create index students_class_active_idx on public.students (class_id) where deleted_at is null;
create index students_status_active_idx on public.students (status) where deleted_at is null;
create trigger trg_students_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();
-- ============================================================
-- 0004: Poin santri (aturan poin + catatan pelanggaran/prestasi)
-- ============================================================

-- ------------------------------------------------------------
-- Aturan poin
-- is_negative derived (points < 0) agar tidak pernah ganda antar kolom
-- ------------------------------------------------------------
create table public.point_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null,
  category text,
  is_negative boolean generated always as (points < 0) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index point_rules_name_active_unique on public.point_rules (name)
  where deleted_at is null;
create trigger trg_point_rules_updated_at
  before update on public.point_rules
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Catatan poin (pelanggaran & prestasi)
-- points disimpan snapshot agar riwayat tetap akurat
-- meski aturan poin diubah/dihapus
-- ------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  rule_id uuid not null references public.point_rules (id),
  reporter_id uuid references public.profiles (id) on delete set null,
  points integer not null,
  notes text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_student_idx on public.reports (student_id);
create index reports_rule_idx on public.reports (rule_id);
create index reports_reported_at_idx on public.reports (reported_at desc);
create trigger trg_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Sinkronisasi students.total_points setiap reports berubah
-- ------------------------------------------------------------
create or replace function public.adjust_student_total_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.students
      set total_points = total_points + new.points
      where id = new.student_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.students
      set total_points = total_points - old.points
      where id = old.student_id;
    return old;
  else
    if new.student_id is distinct from old.student_id
       or new.points is distinct from old.points then
      update public.students
        set total_points = total_points - old.points
        where id = old.student_id;
      update public.students
        set total_points = total_points + new.points
        where id = new.student_id;
    end if;
    return new;
  end if;
end;
$$;

create trigger trg_reports_adjust_points
  after insert or update or delete on public.reports
  for each row execute function public.adjust_student_total_points();
-- ============================================================
-- 0005: Log keluar-masuk santri (gate)
-- Log bersifat immutable: tidak ada UPDATE/DELETE policy di 0006
-- ============================================================

create table public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  direction public.gate_direction not null,
  occurred_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index gate_logs_student_idx on public.gate_logs (student_id);
create index gate_logs_occurred_at_idx on public.gate_logs (occurred_at desc);
-- ============================================================
-- 0006: Row Level Security untuk semua tabel aplikasi
-- Matrix akses:
--   SELECT  : semua staff (developer|admin|pengurus|guru) — pending terblokir
--   INSERT/UPDATE master data : developer|admin|pengurus
--   DELETE  : developer|admin
--   reports & gate_logs : INSERT juga boleh guru (pelapor/satpam)
--   gate_logs : immutable (tanpa policy UPDATE/DELETE)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.dorms enable row level security;
alter table public.students enable row level security;
alter table public.point_rules enable row level security;
alter table public.reports enable row level security;
alter table public.gate_logs enable row level security;

-- ------------------------------------------------------------
-- profiles: user boleh baca profil sendiri (agar role 'pending'
-- tetap terbaca oleh ProtectedRoute), staff baca semua
-- ------------------------------------------------------------
create policy "profiles_select_self_or_staff"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- Master data: academic_years, teachers, classes, dorms, students, point_rules
-- ------------------------------------------------------------
create policy "academic_years_select" on public.academic_years
  for select to authenticated using (public.is_staff());
create policy "academic_years_insert" on public.academic_years
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "academic_years_update" on public.academic_years
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "academic_years_delete" on public.academic_years
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "teachers_select" on public.teachers
  for select to authenticated using (public.is_staff());
create policy "teachers_insert" on public.teachers
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "teachers_update" on public.teachers
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "teachers_delete" on public.teachers
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "classes_select" on public.classes
  for select to authenticated using (public.is_staff());
create policy "classes_insert" on public.classes
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "classes_update" on public.classes
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "classes_delete" on public.classes
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "dorms_select" on public.dorms
  for select to authenticated using (public.is_staff());
create policy "dorms_insert" on public.dorms
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "dorms_update" on public.dorms
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "dorms_delete" on public.dorms
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "students_select" on public.students
  for select to authenticated using (public.is_staff());
create policy "students_insert" on public.students
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "students_update" on public.students
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "students_delete" on public.students
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "point_rules_select" on public.point_rules
  for select to authenticated using (public.is_staff());
create policy "point_rules_insert" on public.point_rules
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "point_rules_update" on public.point_rules
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "point_rules_delete" on public.point_rules
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- reports: semua staff bisa mencatat (guru = pelapor),
-- edit dibatasi pengurus ke atas, hapus developer|admin
-- ------------------------------------------------------------
create policy "reports_select" on public.reports
  for select to authenticated using (public.is_staff());
create policy "reports_insert" on public.reports
  for insert to authenticated
  with check (public.is_staff() and reporter_id = auth.uid());
create policy "reports_update" on public.reports
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "reports_delete" on public.reports
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- gate_logs: semua staff bisa mencatat; tanpa UPDATE/DELETE (immutable)
-- ------------------------------------------------------------
create policy "gate_logs_select" on public.gate_logs
  for select to authenticated using (public.is_staff());
create policy "gate_logs_insert" on public.gate_logs
  for insert to authenticated
  with check (public.is_staff());
-- ============================================================
-- 0007: RPC impor siswa massal (dipakai modul Impor CSV)
-- Input : array jsonb, tiap elemen:
--         { name, registration_code, class_id, gender?, status?, phone?, nisn?, dorm_id? }
-- Output: per-baris { row_index, ok, error }
-- ============================================================

create or replace function public.import_students(p_rows jsonb)
returns table (row_index integer, ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_index integer := 0;
  v_class_id uuid;
  v_dorm_id uuid;
begin
  if not public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau pengurus yang dapat mengimpor siswa';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows harus berupa array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      if coalesce(v_row ->> 'name', '') = '' then
        raise exception 'Nama wajib diisi';
      end if;
      if coalesce(v_row ->> 'registration_code', '') = '' then
        raise exception 'Kode registrasi wajib diisi';
      end if;

      v_class_id := null;
      if coalesce(v_row ->> 'class_id', '') = '' then
        raise exception 'Kelas wajib dipilih';
      end if;
      select c.id into v_class_id
      from public.classes c
      where c.id = (v_row ->> 'class_id')::uuid and c.deleted_at is null;
      if v_class_id is null then
        raise exception 'Kelas tidak ditemukan';
      end if;

      v_dorm_id := null;
      if coalesce(v_row ->> 'dorm_id', '') <> '' then
        select d.id into v_dorm_id
        from public.dorms d
        where d.id = (v_row ->> 'dorm_id')::uuid and d.deleted_at is null;
        if v_dorm_id is null then
          raise exception 'Asrama tidak ditemukan';
        end if;
      end if;

      insert into public.students (registration_code, name, class_id, dorm_id, gender, status, phone, nisn)
      values (
        trim(v_row ->> 'registration_code'),
        trim(v_row ->> 'name'),
        v_class_id,
        v_dorm_id,
        (v_row ->> 'gender')::public.person_gender,
        coalesce((v_row ->> 'status')::public.student_status, 'aktif'::public.student_status),
        v_row ->> 'phone',
        v_row ->> 'nisn'
      );

      row_index := v_index;
      ok := true;
      error := null;
      return next;
    exception when others then
      row_index := v_index;
      ok := false;
      error := case
        when sqlerrm like '%students_registration_code_active_unique%' then 'Kode registrasi sudah dipakai'
        when sqlerrm like '%person_gender%' then 'Gender harus L atau P'
        when sqlerrm like '%student_status%' then 'Status tidak valid'
        else sqlerrm
      end;
      return next;
    end;
  end loop;
end;
$$;

-- Hanya user terautentikasi yang boleh memanggil RPC ini
revoke execute on function public.import_students(jsonb) from public, anon;
grant execute on function public.import_students(jsonb) to authenticated;
-- ============================================================
-- 0008: View agregasi dashboard + seed aturan poin umum
-- ============================================================

-- ------------------------------------------------------------
-- View: jumlah siswa per status (dipakai widget dashboard)
-- security_invoker agar RLS students tetap berlaku
-- ------------------------------------------------------------
create or replace view public.student_status_counts
with (security_invoker = true) as
select status, count(*)::integer as count
from public.students
where deleted_at is null
group by status;

-- ------------------------------------------------------------
-- Seed aturan poin umum (idempoten — aman dijalankan ulang)
-- ------------------------------------------------------------
insert into public.point_rules (name, points, category) values
  ('Terlambat masuk kelas', -5, 'Kedisiplinan'),
  ('Tidak memakai atribut lengkap', -5, 'Kerapian'),
  ('Membolos', -10, 'Kehadiran'),
  ('Membawa HP tanpa izin', -15, 'Kedisiplinan'),
  ('Berkata kasar', -10, 'Perilaku'),
  ('Berkelahi', -30, 'Perilaku'),
  ('Merokok', -25, 'Kesehatan'),
  ('Mencuri', -40, 'Kejujuran'),
  ('Membantu teman', 5, 'Kebaikan'),
  ('Hafalan baru', 10, 'Prestasi'),
  ('Juara lomba', 20, 'Prestasi')
on conflict (name) where deleted_at is null do nothing;



-- ============================================================
-- BACKFILL: buat profil untuk user yang SUDAH ada di auth.users
-- (trigger hanya menyala untuk user baru)
-- ============================================================
insert into public.profiles (id, email, name, role)
select u.id, u.email,
       coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
       'pending'::public.app_role
from auth.users u
on conflict (id) do nothing;
