-- ============================================================
-- 0051: P5a Connectivity — PPDB webhook + API keys
--
-- Pendaftar dari formulir publik sekolah masuk lewat webhook:
--   POST /functions/v1/ppdb-webhook  (header x-api-key)
-- Alur: Edge Function memvalidasi key (raw ditampilkan SEKALI,
-- DB simpan sha256) → rate limit per key → RPC upsert dedupe
-- registration_number → catat pemakaian di api_request_log.
--
-- Konvensi penamaan English (0050). UI tetap Bahasa Indonesia.
-- Jalankan via Supabase SQL Editor (pola migrasi manual).
-- ============================================================

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references public.profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index api_keys_prefix_idx on public.api_keys (key_prefix) where revoked_at is null;
create trigger trg_api_keys_updated_at
  before update on public.api_keys
  for each row execute function public.set_updated_at();

-- Log pemakaian webhook: sumber rate limit + jejak audit. Tanpa
-- update/delete (append-only); pembersihan retensi via tab Otomasi.
create table public.api_request_log (
  id uuid primary key default gen_random_uuid(),
  key_id uuid not null references public.api_keys (id) on delete cascade,
  path text,
  status smallint,
  source_ip text,
  created_at timestamptz not null default now()
);

create index api_request_log_key_time_idx on public.api_request_log (key_id, created_at desc);

-- ------------------------------------------------------------
-- RLS — kredensial hanya dilihat developer|admin
-- ------------------------------------------------------------
alter table public.api_keys enable row level security;
alter table public.api_request_log enable row level security;

create policy "api_keys_select" on public.api_keys
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "api_keys_insert" on public.api_keys
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "api_keys_update" on public.api_keys
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Cabut (revoke) = tindakan keamanan utama; hard delete tidak dibuka
-- supaya jejak kredensial tetap ada.
create policy "api_request_log_select" on public.api_request_log
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- RPC buat key: raw ditampilkan sekali ke UI, DB simpan hash sha256
-- (pgcrypto di schema extensions — wajib masuk search_path)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- RPC upsert pendaftar PPDB — dipanggil Edge Function dengan
-- service_role (bukan anon): dedupe registration_number aktif.
-- Payload: registration_number* , full_name* , gender (L|P),
-- birth_place, birth_date (YYYY-MM-DD), origin_school, target_grade,
-- parent_name, parent_phone, address, stage (enum admission_stage), notes
-- ------------------------------------------------------------
create or replace function public.ppdb_admission_upsert(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reg text;
  v_name text;
  v_stage text;
  v_existing uuid;
  v_result jsonb;
begin
  v_reg := nullif(trim(coalesce(p_payload->>'registration_number', '')), '');
  v_name := nullif(trim(coalesce(p_payload->>'full_name', '')), '');
  if v_reg is null or v_name is null then
    raise exception 'registration_number dan full_name wajib diisi';
  end if;

  v_stage := lower(nullif(trim(coalesce(p_payload->>'stage', '')), ''));
  if v_stage is not null and v_stage not in
    ('registered', 'selection', 'accepted', 'rejected', 'enrolled') then
    raise exception 'stage tidak dikenal: %', v_stage;
  end if;
  v_stage := coalesce(v_stage, 'registered');

  select id into v_existing
  from public.admissions
  where registration_number = v_reg and deleted_at is null
  limit 1;

  if v_existing is not null then
    update public.admissions set
      full_name = v_name,
      gender = case when p_payload->>'gender' in ('L', 'P')
                    then (p_payload->>'gender')::public.person_gender
                    else gender end,
      birth_place = coalesce(nullif(trim(p_payload->>'birth_place'), ''), birth_place),
      birth_date = coalesce(nullif(trim(p_payload->>'birth_date'), '')::date, birth_date),
      origin_school = coalesce(nullif(trim(p_payload->>'origin_school'), ''), origin_school),
      target_grade = coalesce(nullif(trim(p_payload->>'target_grade'), ''), target_grade),
      parent_name = coalesce(nullif(trim(p_payload->>'parent_name'), ''), parent_name),
      parent_phone = coalesce(nullif(trim(p_payload->>'parent_phone'), ''), parent_phone),
      address = coalesce(nullif(trim(p_payload->>'address'), ''), address),
      stage = v_stage::public.admission_stage,
      notes = coalesce(nullif(trim(p_payload->>'notes'), ''), notes)
    where id = v_existing;
    v_result := jsonb_build_object('duplicated', true, 'id', v_existing, 'stage', v_stage);
    return v_result;
  end if;

  insert into public.admissions (
    registration_number, full_name, gender, birth_place, birth_date,
    origin_school, target_grade, parent_name, parent_phone, address,
    stage, notes
  ) values (
    v_reg, v_name,
    case when p_payload->>'gender' in ('L', 'P')
         then (p_payload->>'gender')::public.person_gender end,
    nullif(trim(p_payload->>'birth_place'), ''),
    nullif(trim(p_payload->>'birth_date'), '')::date,
    nullif(trim(p_payload->>'origin_school'), ''),
    nullif(trim(p_payload->>'target_grade'), ''),
    nullif(trim(p_payload->>'parent_name'), ''),
    nullif(trim(p_payload->>'parent_phone'), ''),
    nullif(trim(p_payload->>'address'), ''),
    v_stage::public.admission_stage,
    nullif(trim(p_payload->>'notes'), '')
  )
  returning id into v_existing;

  return jsonb_build_object('duplicated', false, 'id', v_existing, 'stage', v_stage);
end;
$$;

revoke execute on function public.ppdb_admission_upsert(jsonb) from public, anon, authenticated;
grant execute on function public.ppdb_admission_upsert(jsonb) to service_role;

-- ------------------------------------------------------------
-- Flag system.api — mematikan flag tidak memblokir endpoint (Edge
-- cek flag sendiri via service client), hanya menyembunyikan UI
-- integrasi & menandai fitur dinonaktifkan.
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('system.api', 'API Publik / Webhook', 'system',
   'API key dan webhook PPDB untuk pendaftar dari formulir publik', true, 3)
on conflict (key) do nothing;
