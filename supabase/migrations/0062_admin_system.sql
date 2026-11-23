-- ============================================================
-- 0062: Admin system — RPC agregat + riwayat eksekusi server-side
--
-- Masalah yang diselesaikan:
-- 1. fetchTableStats menembak ±78 HTTP request per refresh (2 count +
--    1 latest per tabel, dulu 26 tabel). Sekarang 1 RPC.
-- 2. fetchIntegrityIssues men-download tabel santri penuh + 7 query
--    tambahan. Sekarang 1 RPC (hitungan server-side, RLS tetap jalan).
-- 3. fetchTrashItems 13 query paralel. Sekarang 1 RPC (payload jsonb,
--    nama FK yang dibutuhkan judul di-resolve server-side).
-- 4. Riwayat eksekusi task hanya localStorage (per perangkat).
--    Sekarang tabel task_runs + insight_logs (snapshot AI Insights).
--
-- Penerapan: dashboard SQL editor, JANGAN `supabase db push`
-- (catatan 0059/0061).
-- Semua RPC security invoker → RLS per-tabel tetap berlaku untuk
-- caller; UI admin sudah di-gerbang admin:access di sisi aplikasi.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabel task_runs — riwayat eksekusi task Otomasi (server-side)
-- ------------------------------------------------------------
create table if not exists public.task_runs (
  id            uuid primary key default gen_random_uuid(),
  task_key      text not null,
  status        text not null default 'success'
                  check (status in ('success', 'error')),
  duration_ms   integer,
  affected_rows jsonb,
  detail        text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

comment on table public.task_runs is
  'Riwayat eksekusi task pemeliharaan admin (tab Otomasi) - pengganti localStorage';

create index if not exists task_runs_created_at_idx
  on public.task_runs (created_at desc);

alter table public.task_runs enable row level security;

drop policy if exists "task_runs_select" on public.task_runs;
create policy "task_runs_select" on public.task_runs
  for select to authenticated using (public.is_staff_deleter());

drop policy if exists "task_runs_insert" on public.task_runs;
create policy "task_runs_insert" on public.task_runs
  for insert to authenticated with check (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 2. Tabel insight_logs — riwayat snapshot AI Insights
-- ------------------------------------------------------------
create table if not exists public.insight_logs (
  id         uuid primary key default gen_random_uuid(),
  prompt     text not null,
  result     jsonb not null,
  model      text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.insight_logs is
  'Riwayat snapshot analisis AI Insights agar persist lintas perangkat';

create index if not exists insight_logs_created_at_idx
  on public.insight_logs (created_at desc);

alter table public.insight_logs enable row level security;

drop policy if exists "insight_logs_select" on public.insight_logs;
create policy "insight_logs_select" on public.insight_logs
  for select to authenticated using (public.is_staff_deleter());

drop policy if exists "insight_logs_insert" on public.insight_logs;
create policy "insight_logs_insert" on public.insight_logs
  for insert to authenticated with check (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 3. RPC admin_table_stats() — hitungan semua tabel dalam 1 call.
--    Daftar tabel HARUS sinkron dengan TABLE_CONFIG di
--    src/features/admin/api.ts (kolom soft_delete = ada kolom
--    deleted_at di skema).
-- ------------------------------------------------------------
create or replace function public.admin_table_stats()
returns table ("key" text, total bigint, active bigint, latest_created_at timestamptz)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  t        record;
  v_total  bigint;
  v_active bigint;
  v_latest timestamptz;
begin
  for t in
    select * from (values
      ('students', true),
      ('teachers', true),
      ('classes', true),
      ('dorms', true),
      ('academic_years', true),
      ('point_rules', false),
      ('reports', false),
      ('gate_logs', false),
      ('student_attendance', false),
      ('announcements', false),
      ('profiles', false),
      ('audit_logs', false),
      ('subjects', true),
      ('schedules', true),
      ('tahfidz_records', true),
      ('halaqah_groups', true),
      ('extracurriculars', true),
      ('books', true),
      ('book_loans', false),
      ('savings_accounts', true),
      ('savings_transactions', false),
      ('inventory_items', true),
      ('leave_permits', false),
      ('health_logs', false),
      ('counseling_logs', false),
      ('suspensions', false),
      ('subject_attendance', false),
      ('instruments', true),
      ('instrument_responses', false),
      ('api_keys', false),
      ('api_request_log', false),
      ('entities', true),
      ('portal_sessions', false),
      ('portal_login_attempts', false),
      ('push_subscriptions', false),
      ('worship_items', true),
      ('worship_mastery', false),
      ('worship_scores', false),
      ('curriculum_cps', true),
      ('curriculum_tps', true),
      ('cocurricular_dims', true),
      ('graduation_checks', false)
    ) as cfg(key, soft_delete)
  loop
    begin
      if t.soft_delete then
        execute format(
          'select count(*), count(*) filter (where deleted_at is null), max(created_at) from public.%I',
          t.key
        ) into v_total, v_active, v_latest;
      else
        execute format(
          'select count(*), null::bigint, max(created_at) from public.%I',
          t.key
        ) into v_total, v_active, v_latest;
      end if;
      "key" := t.key;
      total := v_total;
      active := v_active;
      latest_created_at := v_latest;
      return next;
    exception when undefined_table or undefined_column then
      continue; -- tabel belum ada di deployment ini → dilewati
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 4. RPC admin_integrity_checks() — hitungan 7 cek integritas
--    server-side. Label/detail/fixable tetap di klien (api.ts)
--    agar copy UI tidak tersebar ke SQL.
-- ------------------------------------------------------------
create or replace function public.admin_integrity_checks()
returns table (id text, count bigint)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_dead_class   bigint;
  v_dead_dorm    bigint;
  v_year_conflict bigint;
  v_over_cap     bigint;
  v_no_homeroom  bigint;
  v_no_account   bigint;
  v_no_nis       bigint;
begin
  -- Santri aktif menunjuk kelas/asrama terarsip (unique ref, seperti
  -- findOrphanIds di klien)
  select count(distinct s.class_id) into v_dead_class
  from public.students s
  join public.classes c on c.id = s.class_id and c.deleted_at is not null
  where s.deleted_at is null and s.class_id is not null;

  select count(distinct s.dorm_id) into v_dead_dorm
  from public.students s
  join public.dorms d on d.id = s.dorm_id and d.deleted_at is not null
  where s.deleted_at is null and s.dorm_id is not null;

  -- Tahun akademik aktif ganda (hanya boleh satu)
  select greatest(count(*) - 1, 0) into v_year_conflict
  from public.academic_years where is_active;

  -- Penghuni melebihi kapasitas asrama aktif
  select count(*) into v_over_cap
  from public.dorm_occupancy o
  join public.dorms d on d.id = o.dorm_id and d.deleted_at is null
  where o.occupied > d.capacity;

  select count(*) into v_no_homeroom
  from public.classes
  where deleted_at is null and homeroom_teacher_id is null;

  select count(*) into v_no_account
  from public.teachers
  where deleted_at is null and profile_id is null;

  select count(*) into v_no_nis
  from public.students
  where deleted_at is null and (nis is null or btrim(nis) = '');

  return query values
    ('refs_dead_class', v_dead_class),
    ('refs_dead_dorm', v_dead_dorm),
    ('years_active_conflict', v_year_conflict),
    ('dorms_over_capacity', v_over_cap),
    ('classes_no_homeroom', v_no_homeroom),
    ('teachers_no_account', v_no_account),
    ('students_no_nis', v_no_nis);
end;
$$;

-- ------------------------------------------------------------
-- 5. RPC admin_trash_items(p_tables) — baris soft-deleted lintas
--    tabel dalam 1 call. Payload = seluruh baris (to_jsonb); untuk
--    tabel ber-judul-relasional, nama FK di-inject agar pembentuk
--    judul di klien tetap bekerja tanpa query tambahan.
-- ------------------------------------------------------------
create or replace function public.admin_trash_items(p_tables text[])
returns table (table_name text, id uuid, deleted_at timestamptz, payload jsonb)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  t text;
begin
  for t in select unnest(p_tables)
  loop
    begin
      if t = 'schedules' then
        return query execute format($f$
          select 'schedules'::text, x.id, x.deleted_at,
            to_jsonb(x) || jsonb_build_object(
              'classes', jsonb_build_object('name', c.name),
              'subjects', jsonb_build_object('name', s.name))
          from public.schedules x
          left join public.classes c on c.id = x.class_id
          left join public.subjects s on s.id = x.subject_id
          where x.deleted_at is not null
          order by x.deleted_at desc limit 200 $f$);
      elsif t = 'tahfidz_records' then
        return query execute format($f$
          select 'tahfidz_records'::text, x.id, x.deleted_at,
            to_jsonb(x) || jsonb_build_object(
              'students', jsonb_build_object('name', st.name))
          from public.tahfidz_records x
          left join public.students st on st.id = x.student_id
          where x.deleted_at is not null
          order by x.deleted_at desc limit 200 $f$);
      elsif t = 'savings_accounts' then
        return query execute format($f$
          select 'savings_accounts'::text, x.id, x.deleted_at,
            to_jsonb(x) || jsonb_build_object(
              'students', jsonb_build_object('name', st.name))
          from public.savings_accounts x
          left join public.students st on st.id = x.student_id
          where x.deleted_at is not null
          order by x.deleted_at desc limit 200 $f$);
      else
        return query execute format(
          'select %L::text, x.id, x.deleted_at, to_jsonb(x)
             from public.%I x
            where x.deleted_at is not null
            order by x.deleted_at desc limit 200',
          t, t);
      end if;
    exception when undefined_table or undefined_column then
      continue; -- tabel/kolom belum ada → dilewati
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 6. RPC admin_last_logins() — login terakhir per akun (dari audit
--    trail) untuk kolom "Login Terakhir" di tab Pengguna.
-- ------------------------------------------------------------
create or replace function public.admin_last_logins()
returns table (user_id uuid, last_login timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (l.user_id) l.user_id, l.created_at
  from public.audit_logs l
  where l.action = 'LOGIN' and l.user_id is not null
  order by l.user_id, l.created_at desc
$$;

-- ------------------------------------------------------------
-- 7. RPC admin_storage_refs() — referensi `bucket/path` dari seluruh
--    kolom URL storage yang dipakai aplikasi. Pengganti 3 full-column
--    select di sisi klien yang men-download base64 foto (photo_url
--    bisa berupa data-URL ~450 KB/baris) — dengan RPC, hanya pasangan
--    bucket/path hasil regex yang keluar dari DB. Path dikembalikan
--    apa adanya (bisa URL-encoded); klien yang melakukan decode.
--    Perluas UNION ALL saat ada modul baru dengan kolom URL storage.
-- ------------------------------------------------------------
create or replace function public.admin_storage_refs()
returns table (bucket text, path text)
language sql
stable
security invoker
set search_path = public
as $$
  select m[1], m[2]
  from (
    select regexp_match(url, '/storage/v1/object/(?:public|sign)/([^/]+)/([^?]+)') as m
    from (
      select avatar_url as url from public.profiles
      union all
      select photo_url from public.students
      union all
      select photo_url from public.teachers
    ) src
    where url like '%/storage/v1/object/%'
  ) matched
$$;
