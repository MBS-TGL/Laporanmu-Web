-- ============================================================
-- 0056: P4 Document Center — kurikulum, kokurikuler, yudisium
--
-- curriculum_cps / curriculum_tps : Capaian & Tujuan Pembelajaran
--   (subject sebagai TEXT nama mapel — fleksibel lintas tahun)
-- cocurricular_dims / cocurricular_scores : dimensi kokurikuler
--   + nilai per semester (semester_type: 'Odd'/'Even' sejak 0021)
-- graduation_checks : keputusan yudisium per santri (unique per
--   santri+tahun ajaran), requirements jsonb = hasil cek saat itu
-- ============================================================

create table public.curriculum_cps (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,
  phase       text not null default 'D',
  description text not null,
  sort_order  integer not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index curriculum_cps_active_idx on public.curriculum_cps (subject, sort_order)
  where deleted_at is null;
create trigger trg_curriculum_cps_updated_at
  before update on public.curriculum_cps
  for each row execute function public.set_updated_at();

create table public.curriculum_tps (
  id          uuid primary key default gen_random_uuid(),
  cp_id       uuid not null references public.curriculum_cps (id) on delete cascade,
  description text not null,
  sort_order  integer not null default 0,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index curriculum_tps_active_idx on public.curriculum_tps (cp_id, sort_order)
  where deleted_at is null;
create trigger trg_curriculum_tps_updated_at
  before update on public.curriculum_tps
  for each row execute function public.set_updated_at();

create table public.cocurricular_dims (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cocurricular_dims_active_idx on public.cocurricular_dims (sort_order)
  where deleted_at is null;
create trigger trg_cocurricular_dims_updated_at
  before update on public.cocurricular_dims
  for each row execute function public.set_updated_at();

create table public.cocurricular_scores (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  dim_id           uuid not null references public.cocurricular_dims (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  semester         public.semester_type not null,
  predicate        text not null check (predicate in ('Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan')),
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint cocurricular_scores_unique unique (student_id, dim_id, academic_year_id, semester)
);

create index cocurricular_scores_student_idx on public.cocurricular_scores (student_id);
create trigger trg_cocurricular_scores_updated_at
  before update on public.cocurricular_scores
  for each row execute function public.set_updated_at();

create table public.graduation_checks (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  requirements     jsonb not null default '{}'::jsonb,
  status           text not null default 'pending'
    check (status in ('pending', 'lulus', 'ditahan')),
  notes            text,
  approved_by      uuid references public.profiles (id) on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint graduation_checks_unique unique (student_id, academic_year_id)
);

create index graduation_checks_year_idx on public.graduation_checks (academic_year_id);
create trigger trg_graduation_checks_updated_at
  before update on public.graduation_checks
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — pola master data
-- ------------------------------------------------------------
alter table public.curriculum_cps enable row level security;
alter table public.curriculum_tps enable row level security;
alter table public.cocurricular_dims enable row level security;
alter table public.cocurricular_scores enable row level security;
alter table public.graduation_checks enable row level security;

create policy "curriculum_cps_select" on public.curriculum_cps
  for select to authenticated using (public.is_staff());
create policy "curriculum_cps_insert" on public.curriculum_cps
  for insert to authenticated with check (public.is_staff_writer());
create policy "curriculum_cps_update" on public.curriculum_cps
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "curriculum_cps_delete" on public.curriculum_cps
  for delete to authenticated using (public.is_staff_deleter());

create policy "curriculum_tps_select" on public.curriculum_tps
  for select to authenticated using (public.is_staff());
create policy "curriculum_tps_insert" on public.curriculum_tps
  for insert to authenticated with check (public.is_staff_writer());
create policy "curriculum_tps_update" on public.curriculum_tps
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "curriculum_tps_delete" on public.curriculum_tps
  for delete to authenticated using (public.is_staff_deleter());

create policy "cocurricular_dims_select" on public.cocurricular_dims
  for select to authenticated using (public.is_staff());
create policy "cocurricular_dims_insert" on public.cocurricular_dims
  for insert to authenticated with check (public.is_staff_writer());
create policy "cocurricular_dims_update" on public.cocurricular_dims
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "cocurricular_dims_delete" on public.cocurricular_dims
  for delete to authenticated using (public.is_staff_deleter());

create policy "cocurricular_scores_select" on public.cocurricular_scores
  for select to authenticated using (public.is_staff());
create policy "cocurricular_scores_insert" on public.cocurricular_scores
  for insert to authenticated with check (public.is_staff_writer());
create policy "cocurricular_scores_update" on public.cocurricular_scores
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "cocurricular_scores_delete" on public.cocurricular_scores
  for delete to authenticated using (public.is_staff_deleter());

create policy "graduation_checks_select" on public.graduation_checks
  for select to authenticated using (public.is_staff());
create policy "graduation_checks_insert" on public.graduation_checks
  for insert to authenticated with check (public.is_staff_writer());
create policy "graduation_checks_update" on public.graduation_checks
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "graduation_checks_delete" on public.graduation_checks
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- Flag module.documents
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.documents', 'Modul Pusat Dokumen', 'module',
   'Raport Kurmer, KHS, transkrip, buku induk, dan yudisium kelulusan', true, 30)
on conflict (key) do nothing;
