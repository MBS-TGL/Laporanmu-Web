-- ============================================================
-- 0026: Penilaian Akademik — Fase 1 PRD (§6.2, §6.3)
--   * grade_configs       : bobot nilai per tahun ajaran (default 30/20/20/30)
--   * assessments         : ulangan per class_subject (formatif/sumatif/pts/pas)
--   * assessment_scores   : nilai per santri per ulangan
--   * RPC generate_semester_grade : nilai akhir terboboti -> rapor semester
--   * Helper is_class_subject_owner + RLS granular guru mapel
--
-- Konvensi: mengikuti 0022/0024 (soft delete, trigger, RLS matrix,
-- helper role teks, helper relasi via teachers.profile_id)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: pemilik class_subject (guru pengampu)
-- ------------------------------------------------------------
create or replace function public.is_class_subject_owner(p_class_subject_id uuid)
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
    join public.profiles p on p.id = t.profile_id
    where cs.id = p_class_subject_id
      and cs.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

create or replace function public.is_assessment_owner(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assessments a
    where a.id = p_assessment_id
      and a.deleted_at is null
      and public.is_class_subject_owner(a.class_subject_id)
  );
$$;

-- ------------------------------------------------------------
-- 2. grade_configs — bobot nilai per tahun ajaran
-- ------------------------------------------------------------
create table public.grade_configs (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  bobot            jsonb not null default '{"formatif":30,"sumatif":20,"pts":20,"pas":30}'::jsonb,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index grade_configs_year_unique
  on public.grade_configs (academic_year_id)
  where deleted_at is null;

create trigger trg_grade_configs_updated_at
  before update on public.grade_configs
  for each row execute function public.set_updated_at();

alter table public.grade_configs enable row level security;

create policy "grade_configs_select" on public.grade_configs
  for select to authenticated using (public.is_staff());

create policy "grade_configs_insert" on public.grade_configs
  for insert to authenticated with check (public.is_staff_writer());

create policy "grade_configs_update" on public.grade_configs
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "grade_configs_delete" on public.grade_configs
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 3. assessments — ulangan per (kelas, mapel, tahun ajaran)
--    class_subjects sudah membawa academic_year_id
-- ------------------------------------------------------------
create table public.assessments (
  id               uuid primary key default gen_random_uuid(),
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  type             text not null check (type in ('formatif', 'sumatif', 'pts', 'pas')),
  title            text not null,
  assessment_date  date,
  max_score        numeric(5,1) not null default 100 check (max_score > 0),
  sort_order       smallint not null default 0,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index assessments_class_subject_idx
  on public.assessments (class_subject_id, type)
  where deleted_at is null;

create trigger trg_assessments_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

alter table public.assessments enable row level security;

create policy "assessments_select" on public.assessments
  for select to authenticated using (public.is_staff());

create policy "assessments_insert" on public.assessments
  for insert to authenticated with check (
    public.is_staff_writer() or public.is_class_subject_owner(class_subject_id)
  );

create policy "assessments_update" on public.assessments
  for update to authenticated
  using (public.is_staff_writer() or public.is_class_subject_owner(class_subject_id))
  with check (public.is_staff_writer() or public.is_class_subject_owner(class_subject_id));

create policy "assessments_delete" on public.assessments
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_class_subject_owner(class_subject_id));

-- ------------------------------------------------------------
-- 4. assessment_scores — nilai per santri per ulangan
--    (upsert by unique (assessment_id, student_id); score null = belum)
-- ------------------------------------------------------------
create table public.assessment_scores (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  score         numeric(5,1) check (score >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint assessment_scores_unique unique (assessment_id, student_id)
);

create index assessment_scores_student_idx
  on public.assessment_scores (student_id);

create trigger trg_assessment_scores_updated_at
  before update on public.assessment_scores
  for each row execute function public.set_updated_at();

alter table public.assessment_scores enable row level security;

create policy "assessment_scores_select" on public.assessment_scores
  for select to authenticated using (public.is_staff());

create policy "assessment_scores_insert" on public.assessment_scores
  for insert to authenticated with check (
    public.is_staff_writer() or public.is_assessment_owner(assessment_id)
  );

create policy "assessment_scores_update" on public.assessment_scores
  for update to authenticated
  using (public.is_staff_writer() or public.is_assessment_owner(assessment_id))
  with check (public.is_staff_writer() or public.is_assessment_owner(assessment_id));

create policy "assessment_scores_delete" on public.assessment_scores
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_assessment_owner(assessment_id));

-- ------------------------------------------------------------
-- 5. RPC generate_semester_grade — nilai akhir terboboti ke rapor
--    final = Σ(bobot_t × rata_t) / Σ(bobot_t)  utk jenis yang punya nilai
--    (jenis tanpa nilai di-skip, bobot dinormalisasi — bukan dianggap 0)
--    Hasil ditulis ke student_semester_reports (type 'general', merge
--    jsonb by subject_id — mapel lain tidak tersentuh)
--    Return: jumlah santri yang mendapat nilai
-- ------------------------------------------------------------
create or replace function public.generate_semester_grade(
  p_class_subject_id uuid,
  p_semester smallint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cs record;
  v_bobot jsonb;
  v_rec record;
  v_final numeric;
  v_num   numeric;
  v_den   numeric;
  v_count integer := 0;
begin
  if p_semester not in (1, 2) then
    raise exception 'Semester harus 1 atau 2';
  end if;

  -- Akses: staff writer atau guru pemilik class_subject
  if not (public.is_staff_writer() or public.is_class_subject_owner(p_class_subject_id)) then
    raise exception 'Anda tidak berhak meng-generate nilai untuk mapel ini';
  end if;

  select cs.*, cs.subject_id, cs.class_id, cs.academic_year_id
    into v_cs
  from public.class_subjects cs
  where cs.id = p_class_subject_id and cs.deleted_at is null;
  if not found then
    raise exception 'Mapel kelas tidak ditemukan';
  end if;

  -- Bobot dari grade_configs (fallback default)
  select gc.bobot into v_bobot
  from public.grade_configs gc
  where gc.academic_year_id = v_cs.academic_year_id and gc.deleted_at is null
  limit 1;
  v_bobot := coalesce(v_bobot, '{"formatif":30,"sumatif":20,"pts":20,"pas":30}'::jsonb);

  for v_rec in
    select s.student_id,
           coalesce(avg(s.score) filter (where a.type = 'formatif'), null) as formatif,
           coalesce(avg(s.score) filter (where a.type = 'sumatif'), null)  as sumatif,
           coalesce(avg(s.score) filter (where a.type = 'pts'), null)      as pts,
           coalesce(avg(s.score) filter (where a.type = 'pas'), null)      as pas
    from public.assessment_scores s
    join public.assessments a on a.id = s.assessment_id
    where a.class_subject_id = p_class_subject_id
      and a.deleted_at is null
      and s.score is not null
      and exists (
        select 1 from public.students st
        where st.id = s.student_id and st.class_id = v_cs.class_id and st.status = 'active'
      )
    group by s.student_id
  loop
    v_num := 0;
    v_den := 0;
    if v_rec.formatif is not null then
      v_num := v_num + v_rec.formatif * coalesce((v_bobot->>'formatif')::numeric, 0);
      v_den := v_den + coalesce((v_bobot->>'formatif')::numeric, 0);
    end if;
    if v_rec.sumatif is not null then
      v_num := v_num + v_rec.sumatif * coalesce((v_bobot->>'sumatif')::numeric, 0);
      v_den := v_den + coalesce((v_bobot->>'sumatif')::numeric, 0);
    end if;
    if v_rec.pts is not null then
      v_num := v_num + v_rec.pts * coalesce((v_bobot->>'pts')::numeric, 0);
      v_den := v_den + coalesce((v_bobot->>'pts')::numeric, 0);
    end if;
    if v_rec.pas is not null then
      v_num := v_num + v_rec.pas * coalesce((v_bobot->>'pas')::numeric, 0);
      v_den := v_den + coalesce((v_bobot->>'pas')::numeric, 0);
    end if;
    if v_den = 0 then
      continue; -- tidak ada nilai sama sekali
    end if;
    v_final := round(v_num / v_den, 2);

    insert into public.student_semester_reports
      (student_id, report_type, semester, academic_year_id, scores, updated_at)
    values (
      v_rec.student_id, 'general', p_semester, v_cs.academic_year_id,
      jsonb_build_object(v_cs.subject_id::text, v_final), now()
    )
    on conflict (student_id, report_type, semester, academic_year_id)
    do update set
      scores     = public.student_semester_reports.scores || excluded.scores,
      updated_at = now();
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.generate_semester_grade(uuid, smallint)
  from public, anon;
grant execute on function public.generate_semester_grade(uuid, smallint)
  to authenticated;
