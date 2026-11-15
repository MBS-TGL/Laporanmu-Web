-- ============================================================
-- 0024: Fondasi Akademik — Fase 0 PRD
--   * Perluas subjects      : kkm, phase, curriculum_group, sort_order
--   * class_subjects        : relasi guru-mapel-kelas per tahun ajaran
--   * RLS helpers           : is_homeroom_teacher(), is_class_subject_teacher()
--
-- Konvensi: mengikuti 0022 (helper teks, soft delete, trigger, RLS matrix)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Perluas tabel subjects
-- ------------------------------------------------------------
alter table public.subjects
  add column if not exists kkm smallint default 50,
  add column if not exists phase text,
  add column if not exists curriculum_group text,
  add column if not exists sort_order smallint not null default 0;

-- Constraint kkm range
alter table public.subjects
  add constraint subjects_kkm_check check (kkm is null or (kkm >= 0 and kkm <= 100));

-- Constraint curriculum_group values
alter table public.subjects
  add constraint subjects_curriculum_group_check check (
    curriculum_group is null or curriculum_group in ('A', 'B')
  );

-- Constraint phase values (Fase Kurikulum Merdeka)
alter table public.subjects
  add constraint subjects_phase_check check (
    phase is null or phase in ('A', 'B', 'C', 'D', 'E', 'F')
  );

-- Index sort_order untuk tampilan rapor/leger terurut
create index if not exists subjects_sort_order_idx
  on public.subjects (sort_order, name) where deleted_at is null;

-- ------------------------------------------------------------
-- 2. Tabel class_subjects — guru mengajar mapel apa di kelas apa
-- ------------------------------------------------------------
create table public.class_subjects (
  id               uuid primary key default gen_random_uuid(),
  class_id         uuid not null references public.classes (id) on delete cascade,
  subject_id       uuid not null references public.subjects (id) on delete cascade,
  teacher_id       uuid references public.teachers (id) on delete set null,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  kkm_override     smallint,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint class_subjects_kkm_override_check check (
    kkm_override is null or (kkm_override >= 0 and kkm_override <= 100)
  )
);

-- Satu mapel per kelas per tahun ajaran (tidak boleh duplikat)
create unique index class_subjects_active_unique
  on public.class_subjects (class_id, subject_id, academic_year_id)
  where deleted_at is null;

-- Lookup cepat: kelas mana saja yang diampu guru tertentu
create index class_subjects_teacher_idx
  on public.class_subjects (teacher_id)
  where deleted_at is null;

-- Lookup cepat: mapel apa saja di satu kelas
create index class_subjects_class_idx
  on public.class_subjects (class_id)
  where deleted_at is null;

-- Lookup cepat: tahun ajaran
create index class_subjects_year_idx
  on public.class_subjects (academic_year_id)
  where deleted_at is null;

create trigger trg_class_subjects_updated_at
  before update on public.class_subjects
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. RLS class_subjects — pola matrix standar
-- ------------------------------------------------------------
alter table public.class_subjects enable row level security;

create policy "class_subjects_select" on public.class_subjects
  for select to authenticated using (public.is_staff());

create policy "class_subjects_insert" on public.class_subjects
  for insert to authenticated with check (public.is_staff_writer());

create policy "class_subjects_update" on public.class_subjects
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "class_subjects_delete" on public.class_subjects
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 4. RLS helper: is_homeroom_teacher(p_class_id)
--    Cek apakah user saat ini adalah wali kelas dari class_id tertentu
-- ------------------------------------------------------------
create or replace function public.is_homeroom_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.homeroom_teacher_id
    join public.profiles p on p.id = t.id
    where c.id = p_class_id
      and c.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 5. RLS helper: is_class_subject_teacher(p_class_id, p_subject_id)
--    Cek apakah user saat ini mengajar mapel tertentu di kelas tertentu
-- ------------------------------------------------------------
create or replace function public.is_class_subject_teacher(
  p_class_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.teachers t on t.id = cs.teacher_id
    join public.profiles p on p.id = t.id
    where cs.class_id = p_class_id
      and cs.subject_id = p_subject_id
      and cs.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 6. RPC: save_class_subjects — bulk upsert mapel per kelas
--    Menerima array rows, upsert by (class_id, subject_id, academic_year_id),
--    soft-delete yang tidak terkirim
-- ------------------------------------------------------------
create or replace function public.save_class_subjects(
  p_class_id uuid,
  p_academic_year_id uuid,
  p_rows jsonb  -- array of {subject_id, teacher_id, kkm_override}
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_subject_ids uuid[] := '{}';
begin
  -- Validasi role
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('developer', 'admin', 'pengurus', 'manager')
  ) then
    raise exception 'Hanya staff tertentu yang boleh mengatur mapel kelas';
  end if;

  -- Validasi kelas exists
  if not exists (
    select 1 from public.classes
    where id = p_class_id and deleted_at is null
  ) then
    raise exception 'Kelas tidak ditemukan';
  end if;

  -- Upsert setiap baris
  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    insert into public.class_subjects (class_id, subject_id, teacher_id, academic_year_id, kkm_override, deleted_at)
    values (
      p_class_id,
      (v_row->>'subject_id')::uuid,
      nullif(v_row->>'teacher_id', '')::uuid,
      p_academic_year_id,
      (v_row->>'kkm_override')::smallint,
      null  -- ensure active
    )
    on conflict (class_id, subject_id, academic_year_id) where deleted_at is null
    do update set
      teacher_id   = excluded.teacher_id,
      kkm_override = excluded.kkm_override,
      deleted_at   = null;

    v_subject_ids := v_subject_ids || (v_row->>'subject_id')::uuid;
  end loop;

  -- Soft-delete mapel yang tidak ada di payload (untuk kelas+tahun ini)
  update public.class_subjects
  set deleted_at = now()
  where class_id = p_class_id
    and academic_year_id = p_academic_year_id
    and deleted_at is null
    and subject_id <> all(v_subject_ids);
end;
$$;

revoke execute on function public.save_class_subjects(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.save_class_subjects(uuid, uuid, jsonb)
  to authenticated;
