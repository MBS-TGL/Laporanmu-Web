-- ============================================================
-- 0066: Security hardening (P0/P1)
--
-- 1. PIN santri dipindah dari students.pin ke tabel student_pins
--    yang hanya bisa dibaca manager ke atas. Semua staf sebelumnya
--    bisa membaca PIN lewat select students.
-- 2. audit_logs: insert tidak lagi menerima identitas palsu
--    (trigger menimpa actor/user, policy user_id = auth.uid()).
-- 3. profiles: admin tidak bisa menaikkan diri/akun lain ke developer.
-- 4. RPC admin (0062) + helper suspension di-revoke dari anon/public.
-- 5. Storage teacher-photo: tulis/hapus hanya staff writer/deleter.
-- 6. Storage bucket listing hanya admin.
-- 7. RPC monitor portal (sesi & percobaan login) untuk tab admin.
--
-- Penerapan: dashboard SQL Editor, JANGAN `supabase db push`
-- (catatan 0059/0061). Jalankan setelah 0062 dan 0065.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PIN santri: tabel terpisah + has_pin di students
-- ------------------------------------------------------------
create table if not exists public.student_pins (
  student_id uuid primary key references public.students (id) on delete cascade,
  pin        text not null check (pin ~ '^[0-9]{4,8}$'),
  updated_at timestamptz not null default now()
);

comment on table public.student_pins is
  'PIN portal wali/santri. Dipisah dari students agar guru tidak bisa membaca PIN semua santri.';

alter table public.student_pins enable row level security;

drop policy if exists "student_pins_select" on public.student_pins;
create policy "student_pins_select" on public.student_pins
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]));

-- Tidak ada policy insert/update/delete: hanya RPC security definer
-- (generate_student_pins / reset_student_pin) yang boleh menulis.

-- Backfill PIN lama (kolom students.pin masih ada pada titik ini)
insert into public.student_pins (student_id, pin)
select id, pin
from public.students
where pin is not null and pin ~ '^[0-9]{4,8}$'
on conflict (student_id) do nothing;

alter table public.students
  add column if not exists has_pin boolean not null default false;

update public.students s
set has_pin = exists (select 1 from public.student_pins p where p.student_id = s.id);

create or replace function public.sync_student_has_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := coalesce(new.student_id, old.student_id);
  update public.students s
  set has_pin = exists (select 1 from public.student_pins p where p.student_id = v_id)
  where s.id = v_id;
  return null;
end;
$$;

drop trigger if exists trg_student_pins_sync on public.student_pins;
create trigger trg_student_pins_sync
  after insert or update or delete on public.student_pins
  for each row execute function public.sync_student_has_pin();

-- RPC generate PIN massal — sekarang menulis student_pins
create or replace function public.generate_student_pins(p_ids uuid[])
returns table (student_id uuid, new_pin text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pin text;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat membuat PIN siswa';
  end if;

  if p_ids is null or array_length(p_ids, 1) = 0 then
    raise exception 'Pilih minimal satu siswa';
  end if;

  for v_id in select unnest(p_ids) loop
    if not exists (
      select 1 from public.students
      where id = v_id and deleted_at is null
    ) then
      continue;
    end if;

    loop
      v_pin := lpad((floor(random() * 1000000))::integer::text, 6, '0');
      exit when not exists (
        select 1 from public.student_pins
        where student_id = v_id and pin = v_pin
      );
    end loop;

    insert into public.student_pins (student_id, pin, updated_at)
    values (v_id, v_pin, now())
    on conflict (student_id)
    do update set pin = excluded.pin, updated_at = now();

    student_id := v_id;
    new_pin := v_pin;
    return next;
  end loop;
end;
$$;

revoke execute on function public.generate_student_pins(uuid[]) from public, anon;
grant execute on function public.generate_student_pins(uuid[]) to authenticated;

-- RPC reset PIN satu siswa (dipakai tombol "Atur ulang PIN")
create or replace function public.reset_student_pin(p_student_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat mengatur ulang PIN';
  end if;

  if not exists (
    select 1 from public.students where id = p_student_id and deleted_at is null
  ) then
    raise exception 'Santri tidak ditemukan';
  end if;

  loop
    v_pin := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (
      select 1 from public.student_pins where student_id = p_student_id and pin = v_pin
    );
  end loop;

  insert into public.student_pins (student_id, pin, updated_at)
  values (p_student_id, v_pin, now())
  on conflict (student_id)
  do update set pin = excluded.pin, updated_at = now();

  return v_pin;
end;
$$;

revoke execute on function public.reset_student_pin(uuid) from public, anon;
grant execute on function public.reset_student_pin(uuid) to authenticated;

-- check_student: bandingkan dengan student_pins, bukan students.pin
create or replace function public.check_student(p_code text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_result jsonb;
  v_prefix text;
  v_failures integer;
begin
  if p_code is null or p_pin is null or length(trim(p_code)) = 0 or length(trim(p_pin)) = 0 then
    return jsonb_build_object('error', 'Kode registrasi dan PIN wajib diisi');
  end if;

  v_prefix := upper(trim(p_code));

  select count(*) into v_failures
  from public.guardian_login_attempts
  where code_prefix = v_prefix
    and attempted_at > now() - interval '10 minutes';

  if v_failures >= 10 then
    return jsonb_build_object(
      'error', 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.'
    );
  end if;

  select s.id, s.name, s.registration_code, s.nisn, s.gender, s.status,
         s.total_points, s.photo_url,
         c.name as class_name,
         d.name as dorm_name
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.dorms d on d.id = s.dorm_id
  where upper(trim(s.registration_code)) = v_prefix
    and exists (
      select 1 from public.student_pins sp
      where sp.student_id = s.id and sp.pin = trim(p_pin)
    )
    and s.deleted_at is null
  limit 1;

  if not found then
    perform public._guardian_log_failure(p_code);
    return jsonb_build_object('error', 'Kode registrasi atau PIN salah');
  end if;

  delete from public.guardian_login_attempts where code_prefix = v_prefix;

  select jsonb_build_object(
    'student', to_jsonb(v_student),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'points', r.points, 'notes', r.notes,
        'reported_at', r.reported_at, 'rule_name', pr.name
      ) order by r.reported_at desc), '[]'::jsonb)
      from public.reports r
      left join public.point_rules pr on pr.id = r.rule_id
      where r.student_id = v_student.id
    ),
    'report_cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month, 'year', m.year,
        'character_score', m.character_score, 'worship_score', m.worship_score,
        'cleanliness_score', m.cleanliness_score, 'quran_score', m.quran_score,
        'language_score', m.language_score, 'notes', m.notes
      ) order by m.year desc, m.month desc), '[]'::jsonb)
      from public.student_monthly_reports m
      where m.student_id = v_student.id
    ),
    'semester_reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'semester', sr.semester,
        'academic_year', ay.name,
        'scores', sr.scores,
        'extras', sr.extras
      ) order by ay.name desc, sr.semester desc), '[]'::jsonb)
      from public.student_semester_reports sr
      join public.academic_years ay on ay.id = sr.academic_year_id
      where sr.student_id = v_student.id
        and sr.report_type = 'general'
    ),
    'attendance', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'year', a.year, 'month', a.month,
        'hadir', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'H'),
        'sakit', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'S'),
        'izin', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'I'),
        'alpa', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'A'),
        'pulang', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'P')
      ) order by a.year desc, a.month desc), '[]'::jsonb)
      from (
        select * from public.student_attendance sa
        where sa.student_id = v_student.id
        order by sa.year desc, sa.month desc
        limit 3
      ) a
    ),
    'suspensions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sp.id, 'jenjang', sp.jenjang,
        'start_date', sp.start_date, 'end_date', sp.end_date,
        'status', sp.status
      ) order by sp.start_date desc), '[]'::jsonb)
      from public.suspensions sp
      where sp.student_id = v_student.id
    ),
    'savings', (
      select jsonb_build_object(
        'balance', sa.balance,
        'status', sa.status,
        'opened_at', sa.opened_at,
        'transactions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'kind', t.kind, 'amount', t.amount,
            'balance_after', t.balance_after, 'note', t.note,
            'occurred_at', t.occurred_at
          ) order by t.occurred_at desc, t.created_at desc)
          from (
            select st.id, st.kind, st.amount, st.balance_after,
                   st.note, st.occurred_at, st.created_at
            from public.savings_transactions st
            where st.account_id = sa.id
            order by st.occurred_at desc, st.created_at desc
            limit 30
          ) t
        ), '[]'::jsonb)
      )
      from public.savings_accounts sa
      where sa.student_id = v_student.id
        and sa.deleted_at is null
      order by sa.opened_at desc
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;

-- portal_login: bandingkan dengan student_pins
create or replace function public.portal_login(p_code text, p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_pin text;
  v_student record;
  v_raw text;
  v_token text;
  v_expires timestamptz;
  v_flag boolean;
begin
  select enabled into v_flag from public.feature_flags where key = 'system.student_portal';
  if coalesce(v_flag, true) = false then
    raise exception 'Portal santri sedang dinonaktifkan. Hubungi staf sekolah.';
  end if;

  v_code := nullif(trim(coalesce(p_code, '')), '');
  v_pin := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  if v_code is null or length(v_pin) < 4 then
    raise exception 'Kode registrasi dan PIN wajib diisi';
  end if;

  delete from public.portal_login_attempts where attempted_at < now() - interval '1 day';
  insert into public.portal_login_attempts (code_prefix) values (lower(left(v_code, 12)));
  if (
    select count(*) from public.portal_login_attempts
    where code_prefix = lower(left(v_code, 12))
      and attempted_at > now() - interval '15 minutes'
  ) > 5 then
    raise exception 'Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.';
  end if;

  select s.id, s.name, sp.pin, c.name as class_name
    into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.student_pins sp on sp.student_id = s.id
  where lower(regexp_replace(s.registration_code, '\s', '', 'g')) = lower(regexp_replace(v_code, '\s', '', 'g'))
    and s.deleted_at is null
    and s.status = 'active'
  limit 1;

  if v_student.id is null or v_student.pin is null or v_student.pin <> v_pin then
    raise exception 'Kode registrasi atau PIN salah';
  end if;

  delete from public.portal_sessions
  where student_id = v_student.id and expires_at < now();

  v_raw := encode(gen_random_bytes(24), 'hex');
  v_token := v_raw;
  v_expires := now() + interval '12 hours';

  insert into public.portal_sessions (student_id, token_hash, token_prefix, expires_at)
  values (v_student.id, encode(digest(v_token, 'sha256'), 'hex'), left(v_token, 8), v_expires);

  return jsonb_build_object(
    'token', v_token,
    'expires_at', v_expires,
    'student', jsonb_build_object('name', v_student.name, 'class_name', v_student.class_name)
  );
end;
$$;

revoke execute on function public.portal_login(text, text) from public;
grant execute on function public.portal_login(text, text) to anon, authenticated;

-- Kolom lama dihapus supaya tidak ada jalan baca PIN massal
alter table public.students drop column if exists pin;

-- ------------------------------------------------------------
-- 2. audit_logs: identitas penulis ditentukan server
-- ------------------------------------------------------------
create or replace function public.set_audit_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_role text;
begin
  if auth.uid() is not null then
    select name, role::text into v_name, v_role
    from public.profiles where id = auth.uid();

    new.user_id := auth.uid();
    new.actor_name := v_name;
    new.actor_role := v_role;
  end if;

  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_audit_actor on public.audit_logs;
create trigger trg_audit_actor
  before insert on public.audit_logs
  for each row execute function public.set_audit_actor();

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- 3. profiles: cegah eskalasi ke developer / ubah role sendiri
-- ------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_dev boolean;
begin
  if new.role is distinct from old.role then
    v_is_dev := public.has_any_role(array['developer']::public.app_role[]);

    if auth.uid() is not null then
      if new.id = auth.uid() and not v_is_dev then
        raise exception 'Tidak boleh mengubah role akun sendiri';
      end if;

      if new.role = 'developer' and not v_is_dev then
        raise exception 'Hanya developer yang dapat menetapkan role developer';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ------------------------------------------------------------
-- 4. Revoke RPC yang sebelumnya terbuka ke anon/public
-- ------------------------------------------------------------
revoke execute on function public.admin_table_stats() from public, anon;
grant execute on function public.admin_table_stats() to authenticated;

revoke execute on function public.admin_integrity_checks() from public, anon;
grant execute on function public.admin_integrity_checks() to authenticated;

revoke execute on function public.admin_trash_items(text[]) from public, anon;
grant execute on function public.admin_trash_items(text[]) to authenticated;

revoke execute on function public.admin_last_logins() from public, anon;
grant execute on function public.admin_last_logins() to authenticated;

revoke execute on function public.admin_storage_refs() from public, anon;
grant execute on function public.admin_storage_refs() to authenticated;

revoke execute on function public._suspension_log_attempt(text) from public, anon, authenticated;
revoke execute on function public._suspension_check_token(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Storage: tulis/hapus foto guru hanya writer/deleter
-- ------------------------------------------------------------
drop policy if exists teacher_photo_insert on storage.objects;
create policy teacher_photo_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'teacher-photo' and public.is_staff_writer());

drop policy if exists teacher_photo_update on storage.objects;
create policy teacher_photo_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'teacher-photo' and public.is_staff_writer())
  with check (bucket_id = 'teacher-photo' and public.is_staff_writer());

drop policy if exists teacher_photo_delete on storage.objects;
create policy teacher_photo_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'teacher-photo' and public.is_staff_deleter());

-- ------------------------------------------------------------
-- 6. Daftar bucket hanya untuk admin/developer
-- ------------------------------------------------------------
drop policy if exists buckets_select_authenticated on storage.buckets;
create policy buckets_select_authenticated
  on storage.buckets for select
  to authenticated
  using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 7. Monitor portal (sesi + percobaan login) untuk tab Admin
-- ------------------------------------------------------------
create or replace function public.admin_portal_sessions()
returns table (
  id uuid,
  student_id uuid,
  student_name text,
  class_name text,
  created_at timestamptz,
  expires_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    raise exception 'Hanya developer atau admin yang dapat melihat sesi portal';
  end if;

  return query
  select ps.id, ps.student_id, s.name, c.name,
         ps.created_at, ps.expires_at, ps.last_seen_at, ps.revoked_at,
         (ps.revoked_at is null and ps.expires_at > now())
  from public.portal_sessions ps
  join public.students s on s.id = ps.student_id
  left join public.classes c on c.id = s.class_id
  order by ps.last_seen_at desc
  limit 200;
end;
$$;

revoke execute on function public.admin_portal_sessions() from public, anon;
grant execute on function public.admin_portal_sessions() to authenticated;

create or replace function public.admin_revoke_portal_session(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    raise exception 'Hanya developer atau admin yang dapat mencabut sesi portal';
  end if;

  update public.portal_sessions
  set revoked_at = now()
  where id = p_id and revoked_at is null;
end;
$$;

revoke execute on function public.admin_revoke_portal_session(uuid) from public, anon;
grant execute on function public.admin_revoke_portal_session(uuid) to authenticated;

create or replace function public.admin_portal_attempts()
returns table (code_prefix text, attempted_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    raise exception 'Hanya developer atau admin yang dapat melihat percobaan login';
  end if;

  return query
  select pa.code_prefix, pa.attempted_at
  from public.portal_login_attempts pa
  where pa.attempted_at > now() - interval '7 days'
  order by pa.attempted_at desc
  limit 500;
end;
$$;

revoke execute on function public.admin_portal_attempts() from public, anon;
grant execute on function public.admin_portal_attempts() to authenticated;
