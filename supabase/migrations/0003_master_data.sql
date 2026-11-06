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
