-- ============================================================
-- Patch P5 (2026-11-15): perbaikan hasil verifikasi live
-- Idempoten (create or replace) — aman dijalankan berulang.
-- Sumber: bagian yang sama di 0051_ppdb_webhook.sql & 0053_student_portal.sql
-- (sudah dipatch di file tersebut).
--
-- 1) create_api_key: 'returning id' ambigu dengan kolom OUT bernama id
--    (returns table) -> qualifying api_keys.id
-- 2) _portal_check_token & portal_login: enum student_status
--    berlabel English sejak 0021 ('active', bukan 'aktif')
-- ============================================================

-- ---------- 1. create_api_key (0051) ----------
create or replace function public.create_api_key(p_name text)
returns table (id uuid, raw_key text, key_prefix text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_raw text;
  v_id uuid;
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    raise exception 'Hanya developer atau admin yang dapat membuat API key';
  end if;
  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Nama key minimal 2 karakter';
  end if;

  v_raw := 'lmk_' || encode(gen_random_bytes(24), 'hex');

  insert into public.api_keys (name, key_hash, key_prefix, created_by)
  values (
    trim(p_name),
    encode(digest(v_raw, 'sha256'), 'hex'),
    left(v_raw, 12),
    auth.uid()
  )
  -- Qualify dgn nama tabel: kolom OUT `id` dari `returns table` membayangi
  -- kolom api_keys.id (gotcha: "column reference id is ambiguous").
  returning api_keys.id into v_id;

  return query select v_id, v_raw, left(v_raw, 12);
end;
$$;

revoke execute on function public.create_api_key(text) from public, anon, authenticated;
grant execute on function public.create_api_key(text) to authenticated;

-- ---------- 2. _portal_check_token (0053) ----------
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

-- ---------- 3. portal_login (0053) ----------
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
