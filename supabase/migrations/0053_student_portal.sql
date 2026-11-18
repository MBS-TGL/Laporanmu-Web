-- ============================================================
-- 0053: P5c Connectivity — Portal Santri (PWA /portal) + push
--
-- Login santri: kode registrasi + PIN (students.pin, migration 0021)
-- → RPC portal_login mengembalikan token sesi raw (DITAMPILKAN di
-- layar perangkat santri, DB simpan sha256) berlaku 12 jam — pola
-- suspension_tokens. Semua data portal lewat SATU RPC portal_data
-- (jsonb) supaya halaman publik tidak pernah menyentuh tabel langsung
-- (semua tabel akar hanya terbaca staff via RLS).
--
-- Push: push_subscriptions (endpoint unik per santri) + VAPID public
-- key dibaca dari app_settings 'push.vapid_public' via RPC bertoken.
-- ============================================================

create table public.portal_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index portal_sessions_student_idx on public.portal_sessions (student_id);
create index portal_sessions_expiry_idx on public.portal_sessions (expires_at)
  where revoked_at is null;

-- Rate limit login: per kode registrasi (prefix), 5 percobaan / 15 menit
create table public.portal_login_attempts (
  code_prefix text not null,
  attempted_at timestamptz not null default now()
);
create index portal_login_attempts_idx on public.portal_login_attempts (code_prefix, attempted_at);

-- Web push subscription: satu endpoint unik per santri (perangkat)
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  user_agent text,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index push_subscriptions_student_idx on public.push_subscriptions (student_id);

-- Ketiga tabel ini hanya disentuh security-definer RPC; tanpa policy
-- = ditolak untuk semua akses langsung (anon & authenticated).
alter table public.portal_sessions enable row level security;
alter table public.portal_login_attempts enable row level security;
alter table public.push_subscriptions enable row level security;

-- ------------------------------------------------------------
-- Helper token sesi (volatile: update last_seen setiap dipanggil).
-- search_path includes extensions untuk digest() (gotcha pgcrypto).
-- ------------------------------------------------------------
create or replace function public._portal_check_token(p_token text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Sesi tidak valid. Silakan masuk kembali.';
  end if;

  select ps.student_id into v_student
  from public.portal_sessions ps
  join public.students s on s.id = ps.student_id
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and ps.revoked_at is null
    and ps.expires_at > now()
    and s.deleted_at is null
    and s.status = 'active'
  limit 1;

  if v_student is null then
    raise exception 'Sesi berakhir. Silakan masuk kembali.';
  end if;

  update public.portal_sessions
  set last_seen_at = now()
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  return v_student;
end;
$$;

revoke execute on function public._portal_check_token(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- RPC login: kode registrasi + PIN → token sesi 12 jam
-- ------------------------------------------------------------
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
  -- Gate flag server-side: halaman publik tidak bisa membaca
  -- feature_flags (RLS staff-only), jadi saklar dicek di sini.
  select enabled into v_flag from public.feature_flags where key = 'system.student_portal';
  if coalesce(v_flag, true) = false then
    raise exception 'Portal santri sedang dinonaktifkan. Hubungi staf sekolah.';
  end if;

  v_code := nullif(trim(coalesce(p_code, '')), '');
  v_pin := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  if v_code is null or length(v_pin) < 4 then
    raise exception 'Kode registrasi dan PIN wajib diisi';
  end if;

  -- Rate limit per kode: bersihkan attempt lama lalu hitung
  delete from public.portal_login_attempts where attempted_at < now() - interval '1 day';
  insert into public.portal_login_attempts (code_prefix) values (lower(left(v_code, 12)));
  if (
    select count(*) from public.portal_login_attempts
    where code_prefix = lower(left(v_code, 12))
      and attempted_at > now() - interval '15 minutes'
  ) > 5 then
    raise exception 'Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.';
  end if;

  select s.id, s.name, s.pin, c.name as class_name
    into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  where lower(regexp_replace(s.registration_code, '\s', '', 'g')) = lower(regexp_replace(v_code, '\s', '', 'g'))
    and s.deleted_at is null
    -- Enum student_status berlabel English sejak 0021 ('active', bukan 'aktif')
    and s.status = 'active'
  limit 1;

  -- Pesan generik: jangan bocorkan kode yang benar/salah terpisah
  if v_student.id is null or v_student.pin is null or v_student.pin <> v_pin then
    raise exception 'Kode registrasi atau PIN salah';
  end if;

  -- Bersihkan sesi kedaluwarsa milik santri ini (housekeeping)
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

-- ------------------------------------------------------------
-- RPC logout: cabut sesi
-- ------------------------------------------------------------
create or replace function public.portal_logout(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
begin
  update public.portal_sessions
  set revoked_at = now()
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null;
end;
$$;

revoke execute on function public.portal_logout(text) from public;
grant execute on function public.portal_logout(text) to anon, authenticated;

-- ------------------------------------------------------------
-- RPC data portal: SATU panggilan, agregat jsonb semua modul
-- ------------------------------------------------------------
create or replace function public.portal_data(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
  v_student_row record;
  v_ay uuid;
  v_result jsonb;
begin
  v_student := public._portal_check_token(p_token);

  select s.*, c.name as class_name into v_student_row
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = v_student;

  select id into v_ay from public.academic_years
  where is_active and deleted_at is null
  order by start_date desc nulls last limit 1;

  v_result := jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student_row.id,
      'name', v_student_row.name,
      'class_name', v_student_row.class_name,
      'photo_url', v_student_row.photo_url,
      'status', v_student_row.status,
      'total_points', v_student_row.total_points
    ),
    -- Jadwal hari ini (isodow: 1=Senin .. 7=Minggu)
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'start_time', sch.start_time, 'end_time', sch.end_time,
        'subject', sub.name, 'teacher', t.name, 'room', sch.room
      ) order by sch.start_time)
      from public.schedules sch
      left join public.subjects sub on sub.id = sch.subject_id
      left join public.teachers t on t.id = sch.teacher_id
      where sch.class_id = v_student_row.class_id
        and sch.day_of_week = extract(isodow from current_date)
        and sch.deleted_at is null
    ), '[]'::jsonb),
    -- Nilai tahun ajaran aktif (60 terbaru)
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', sub.name, 'type', a.type, 'title', a.title,
        'score', sc.score, 'max_score', a.max_score, 'date', a.assessment_date
      ) order by a.assessment_date desc nulls last, a.created_at desc)
      from (
        select * from public.assessment_scores
        where student_id = v_student
        order by created_at desc limit 60
      ) sc
      join public.assessments a on a.id = sc.assessment_id and a.deleted_at is null
      join public.class_subjects cs on cs.id = a.class_subject_id
        and cs.deleted_at is null
        and cs.class_id = v_student_row.class_id
        and (v_ay is null or cs.academic_year_id = v_ay)
      left join public.subjects sub on sub.id = cs.subject_id
    ), '[]'::jsonb),
    -- Absensi: 3 bulan terakhir tahun berjalan (days jsonb bulanan)
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('year', sa.year, 'month', sa.month, 'days', sa.days)
        order by sa.year desc, sa.month desc)
      from (
        select * from public.student_attendance
        where student_id = v_student
          and year = extract(year from current_date)
        order by month desc limit 3
      ) sa
    ), '[]'::jsonb),
    -- Poin & catatan perilaku (10 terakhir)
    'points', jsonb_build_object(
      'total', v_student_row.total_points,
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rule', pr.name, 'points', r.points, 'notes', r.notes, 'reported_at', r.reported_at
        ) order by r.reported_at desc)
        from (
          select * from public.reports
          where student_id = v_student
          order by reported_at desc limit 10
        ) r
        join public.point_rules pr on pr.id = r.rule_id
      ), '[]'::jsonb)
    ),
    -- SPP: kewajiban tahun ajaran aktif + total terbayar
    'spp', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'component', comp.name, 'period', o.period, 'amount', o.amount,
          'paid', coalesce(pay.total, 0), 'due_date', o.due_date
        ) order by o.due_date nulls last, o.created_at)
        from public.spp_obligations o
        join public.spp_components comp on comp.id = o.component_id
        left join (
          select obligation_id, sum(amount) as total
          from public.spp_payments group by obligation_id
        ) pay on pay.obligation_id = o.id
        where o.deleted_at is null and o.student_id = v_student
          and (v_ay is null or o.academic_year_id = v_ay)
      ), '[]'::jsonb),
      'total_due', coalesce((
        select sum(o.amount)
        from public.spp_obligations o
        where o.deleted_at is null and o.student_id = v_student
          and (v_ay is null or o.academic_year_id = v_ay)
      ), 0),
      'total_paid', coalesce((
        select sum(p.amount)
        from public.spp_payments p
        join public.spp_obligations o on o.id = p.obligation_id
        where o.deleted_at is null and o.student_id = v_student
          and (v_ay is null or o.academic_year_id = v_ay)
      ), 0)
    ),
    -- Tahfidz terakhir (10 setoran)
    'tahfidz', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', tr.kind, 'surah', tr.surah, 'from_ayat', tr.from_ayat,
        'to_ayat', tr.to_ayat, 'quality', tr.quality,
        'recorded_at', tr.recorded_at
      ) order by tr.recorded_at desc, tr.created_at desc)
      from (
        select * from public.tahfidz_records
        where student_id = v_student and deleted_at is null
        order by recorded_at desc, created_at desc limit 10
      ) tr
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

revoke execute on function public.portal_data(text) from public;
grant execute on function public.portal_data(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Web push: konfigurasi VAPID publik + simpan/hapus subscription
-- ------------------------------------------------------------
create or replace function public.portal_push_config(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
  v_key text;
begin
  v_student := public._portal_check_token(p_token);
  select value->>'public' into v_key
  from public.app_settings where key = 'push.vapid_public';
  return jsonb_build_object('vapid_public', v_key);
end;
$$;

create or replace function public.portal_save_push(p_token text, p_subscription jsonb)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
  v_endpoint text;
begin
  v_student := public._portal_check_token(p_token);
  v_endpoint := p_subscription->>'endpoint';
  if v_endpoint is null or v_endpoint = '' then
    raise exception 'Subscription tidak valid';
  end if;

  insert into public.push_subscriptions (student_id, endpoint, keys, user_agent)
  values (
    v_student, v_endpoint,
    coalesce(p_subscription->'keys', '{}'::jsonb),
    nullif(left(p_subscription->>'user_agent', 200), '')
  )
  on conflict (endpoint) do update
    set student_id = excluded.student_id,
        keys = excluded.keys,
        last_used_at = now();
end;
$$;

create or replace function public.portal_delete_push(p_token text, p_endpoint text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
begin
  v_student := public._portal_check_token(p_token);
  delete from public.push_subscriptions
  where student_id = v_student and endpoint = p_endpoint;
end;
$$;

revoke execute on function public.portal_push_config(text) from public;
revoke execute on function public.portal_save_push(text, jsonb) from public;
revoke execute on function public.portal_delete_push(text, text) from public;
grant execute on function public.portal_push_config(text) to anon, authenticated;
grant execute on function public.portal_save_push(text, jsonb) to anon, authenticated;
grant execute on function public.portal_delete_push(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Flag system.student_portal
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('system.student_portal', 'Portal Santri (PWA)', 'system',
   'Halaman /portal untuk santri: jadwal, nilai, absensi, poin, SPP, tahfidz, notifikasi push', true, 5)
on conflict (key) do nothing;
