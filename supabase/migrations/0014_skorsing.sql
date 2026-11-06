-- ============================================================
-- 0014: Modul Skorsing & Pembinaan di Rumah
-- Adaptasi dari migration V1 (20261103000000_suspension.sql)
-- ke konvensi V2: helper role & trigger sudah ada, tanpa feature flag
--
-- Alur: admin terbitkan suspensi → generate token (raw ditampilkan
-- sekali, DB simpan sha256) → wali buka /skorsing/<token> (publik,
-- hanya via RPC security-definer) → isi checklist harian + kirim
-- bukti tugas → guru menilai → pembina mencatat verifikasi
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 8 tabel
-- ------------------------------------------------------------
-- Template checklist harian (dikonfigurasi admin, bukan hardcode)
create table public.suspension_log_templates (
  id uuid primary key default gen_random_uuid(),
  block_key text not null check (block_key in ('dinihari', 'pagi', 'sore', 'malam')),
  item_key text not null,
  label_id text not null,
  input_type text not null default 'check'
    check (input_type in ('check', 'choice', 'text', 'surah', 'wafa', 'tugas_ref')),
  options jsonb not null default '[]',
  day_type text not null default 'both'
    check (day_type in ('weekday', 'weekend', 'both')),
  monday_thursday_only boolean not null default false,
  jenjang text not null default 'both'
    check (jenjang in ('SMP', 'SMA', 'both')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (block_key, item_key, jenjang)
);

-- Data skorsing. reason_summary INTERNAL — tidak pernah dikirim ke wali
create table public.suspensions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  jenjang text not null check (jenjang in ('SMP', 'SMA')),
  start_date date not null,
  end_date date not null,
  reason_summary text not null,
  violation_report_id uuid references public.reports (id) on delete set null,
  status text not null default 'aktif'
    check (status in ('aktif', 'selesai', 'dibatalkan')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suspensions_period_check check (end_date >= start_date)
);
comment on column public.suspensions.reason_summary
  is 'INTERNAL kesiswaan/BK. Tidak boleh dikembalikan oleh RPC publik mana pun.';

-- Token akses wali — hanya HASH yang disimpan
create table public.suspension_tokens (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.suspensions (id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  last_used_at timestamptz,
  use_count int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tugas dari guru mapel / tahfidz / koordinator Wafa
create table public.suspension_tasks (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.suspensions (id) on delete cascade,
  subject text not null,
  title text not null,
  description text,
  due_date date,
  attachment_url text,
  target_tahfidz jsonb,
  target_wafa jsonb,
  created_by uuid not null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bukti pengerjaan tugas oleh wali/siswa + penilaian guru
-- v1: foto disimpan sebagai base64 terkompresi (<500 KB/foto di client)
create table public.suspension_task_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.suspension_tasks (id) on delete cascade,
  suspension_id uuid not null references public.suspensions (id) on delete cascade,
  photo_urls text[] not null default '{}',
  photo_data text[] not null default '{}',
  note text,
  status text not null default 'dikerjakan'
    check (status in ('belum', 'dikerjakan', 'dinilai')),
  score int check (score between 0 and 100),
  teacher_comment text,
  graded_by uuid references public.profiles (id) on delete set null,
  graded_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, suspension_id)
);

-- Log harian wali (satu baris per skorsing per tanggal)
create table public.suspension_daily_logs (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.suspensions (id) on delete cascade,
  log_date date not null,
  entries jsonb not null default '{}',
  note_optional text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (suspension_id, log_date)
);

-- Verifikasi pembina (telepon / WA / kunjungan mingguan)
create table public.suspension_followups (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null references public.suspensions (id) on delete cascade,
  contacted_at timestamptz not null default now(),
  method text not null check (method in ('call', 'wa', 'visit')),
  notes text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Rate limiting RPC publik (per prefix token per 10 menit)
create table public.suspension_token_attempts (
  token_prefix text not null,
  attempted_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Helper: pemilik tugas — dibuat SETELAH tabelnya (SQL function
-- divalidasi saat pembuatan, jadi tabel harus sudah ada)
-- ------------------------------------------------------------
create or replace function public.is_suspension_task_owner(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $
  select exists (
    select 1 from public.suspension_tasks
    where id = p_task_id and created_by = auth.uid()
  );
$;

-- ------------------------------------------------------------
-- Index
-- ------------------------------------------------------------
create index idx_sus_student on public.suspensions (student_id, status);
create index idx_sus_active on public.suspensions (status) where status = 'aktif';
create index idx_sustok_sus on public.suspension_tokens (suspension_id) where revoked_at is null;
create index idx_sustask_sus on public.suspension_tasks (suspension_id, due_date);
create index idx_suslog_sus on public.suspension_daily_logs (suspension_id, log_date);
create index idx_susatt_prefix on public.suspension_token_attempts (token_prefix, attempted_at);

-- ------------------------------------------------------------
-- Trigger updated_at (pakai helper V2 dari 0002)
-- ------------------------------------------------------------
create trigger trg_suspensions_updated_at
  before update on public.suspensions
  for each row execute function public.set_updated_at();
create trigger trg_suspension_tasks_updated_at
  before update on public.suspension_tasks
  for each row execute function public.set_updated_at();
create trigger trg_suspension_submissions_updated_at
  before update on public.suspension_task_submissions
  for each row execute function public.set_updated_at();
create trigger trg_suspension_daily_logs_updated_at
  before update on public.suspension_daily_logs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: deny-by-default untuk publik — wali hanya lewat RPC
-- ------------------------------------------------------------
alter table public.suspension_log_templates enable row level security;
alter table public.suspensions enable row level security;
alter table public.suspension_tokens enable row level security;
alter table public.suspension_tasks enable row level security;
alter table public.suspension_task_submissions enable row level security;
alter table public.suspension_daily_logs enable row level security;
alter table public.suspension_followups enable row level security;
alter table public.suspension_token_attempts enable row level security;

-- Templates: baca semua staff, kelola hanya admin
create policy tpl_select on public.suspension_log_templates
  for select to authenticated using (public.is_staff());
create policy tpl_admin_all on public.suspension_log_templates
  for all to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Suspensions: baca semua staff, tulis hanya admin
create policy sus_select on public.suspensions
  for select to authenticated using (public.is_staff());
create policy sus_admin_all on public.suspensions
  for all to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Tokens: hanya admin (wali lewat RPC security definer)
create policy tok_select on public.suspension_tokens
  for select to authenticated using (public.is_staff());
create policy tok_admin_all on public.suspension_tokens
  for all to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Tasks: baca semua staff; tulis staff; ubah/hapus pemilik atau admin
create policy task_select on public.suspension_tasks
  for select to authenticated using (public.is_staff());
create policy task_insert on public.suspension_tasks
  for insert to authenticated with check (public.is_staff());
create policy task_owner_update on public.suspension_tasks
  for update to authenticated
  using (created_by = auth.uid() or public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (created_by = auth.uid() or public.has_any_role(array['developer', 'admin']::public.app_role[]));
create policy task_owner_delete on public.suspension_tasks
  for delete to authenticated
  using (created_by = auth.uid() or public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Submissions: baca semua staff; buat staff; nilai = pemilik tugas/admin
create policy sub_select on public.suspension_task_submissions
  for select to authenticated using (public.is_staff());
create policy sub_insert_staff on public.suspension_task_submissions
  for insert to authenticated with check (public.is_staff());
create policy sub_grade_update on public.suspension_task_submissions
  for update to authenticated
  using (
    public.has_any_role(array['developer', 'admin']::public.app_role[])
    or public.is_suspension_task_owner(task_id)
  )
  with check (
    public.has_any_role(array['developer', 'admin']::public.app_role[])
    or public.is_suspension_task_owner(task_id)
  );
create policy sub_delete on public.suspension_task_submissions
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Daily logs: baca semua staff, tulis hanya admin (wali lewat RPC)
create policy log_select on public.suspension_daily_logs
  for select to authenticated using (public.is_staff());
create policy log_admin_all on public.suspension_daily_logs
  for all to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Followups: baca semua staff; catat staff; ubah/hapus admin
create policy fol_select on public.suspension_followups
  for select to authenticated using (public.is_staff());
create policy fol_insert on public.suspension_followups
  for insert to authenticated with check (public.is_staff());
create policy fol_manage on public.suspension_followups
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));
create policy fol_delete on public.suspension_followups
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- Attempts: hanya admin (ditulis oleh RPC definer yang bypass RLS)
create policy att_admin_all on public.suspension_token_attempts
  for all to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- RPC publik (SECURITY DEFINER — satu-satunya jalan wali).
-- Halaman /skorsing/:token dilarang query tabel langsung.
-- ------------------------------------------------------------

-- Rate limit: maksimal 30 percobaan per prefix per 10 menit
create or replace function public._suspension_log_attempt(p_prefix text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.suspension_token_attempts
    where attempted_at < now() - interval '1 day';
  insert into public.suspension_token_attempts (token_prefix)
    values (substr(p_prefix, 1, 8));
  if (
    select count(*) from public.suspension_token_attempts
    where token_prefix = substr(p_prefix, 1, 8)
      and attempted_at > now() - interval '10 minutes'
  ) > 30 then
    raise exception 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.'
      using errcode = 'P0001';
  end if;
end $$;

-- Validasi token terpusat: hash cocok + belum dicabut + belum kedaluwarsa + aktif
create or replace function public._suspension_check_token(p_token text)
returns public.suspensions
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Tautan tidak valid.' using errcode = 'P0001';
  end if;

  select s.* into v
  from public.suspensions s
  join public.suspension_tokens t on t.suspension_id = s.id
  where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null
    and now() <= t.expires_at;

  if not found then
    raise exception 'Tautan tidak valid atau sudah kedaluwarsa.' using errcode = 'P0001';
  end if;
  if v.status <> 'aktif' then
    raise exception 'Masa pembinaan sudah selesai atau dibatalkan.' using errcode = 'P0001';
  end if;

  update public.suspension_tokens
  set last_used_at = now(), use_count = use_count + 1
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  return v;
end $$;

-- RPC 1: validasi token → ringkasan TANPA reason_summary (privasi)
create or replace function public.validate_suspension_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_student_name text;
  v_class_name text;
  v_days text[];
begin
  perform public._suspension_log_attempt(substr(coalesce(p_token, ''), 1, 8));
  v := public._suspension_check_token(p_token);

  select s.name, c.name into v_student_name, v_class_name
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = v.student_id;

  select array_agg(to_char(d, 'YYYY-MM-DD') order by d) into v_days
  from generate_series(v.start_date, v.end_date, interval '1 day') d;

  return jsonb_build_object(
    'suspension_id', v.id,
    'student_name', coalesce(v_student_name, '-'),
    'class_name', v_class_name,
    'jenjang', v.jenjang,
    'start_date', v.start_date,
    'end_date', v.end_date,
    'days', coalesce(to_jsonb(v_days), '[]'::jsonb)
  );
end $$;

-- RPC 2: data satu hari (template terfilter + tugas + log + submission)
create or replace function public.get_suspension_day(p_token text, p_date date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_dow int;
  v_daytype text;
  v_templates jsonb;
  v_tasks jsonb;
  v_log jsonb;
  v_subs jsonb;
begin
  perform public._suspension_log_attempt(substr(coalesce(p_token, ''), 1, 8));
  v := public._suspension_check_token(p_token);

  if p_date is null or p_date < v.start_date or p_date > v.end_date then
    raise exception 'Tanggal di luar masa pembinaan.' using errcode = 'P0001';
  end if;

  v_dow := extract(dow from p_date)::int;
  v_daytype := case when v_dow in (0, 6) then 'weekend' else 'weekday' end;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.ord, t.sort_order), '[]'::jsonb)
  into v_templates
  from (
    select id, block_key, item_key, label_id, input_type, options, sort_order,
      array_position(array['dinihari', 'pagi', 'sore', 'malam'], block_key) as ord
    from public.suspension_log_templates
    where is_active
      and (jenjang = 'both' or jenjang = v.jenjang)
      and (day_type = 'both' or day_type = v_daytype)
      and (not monday_thursday_only or v_dow in (1, 4))
  ) t;

  select coalesce(
    jsonb_agg(to_jsonb(t) order by t.due_date nulls last, t.created_at),
    '[]'::jsonb)
  into v_tasks
  from (
    select id, subject, title, description, due_date,
      created_at
    from public.suspension_tasks
    where suspension_id = v.id
  ) t;

  select to_jsonb(l) into v_log
  from (
    select entries, note_optional, submitted_at, updated_at
    from public.suspension_daily_logs
    where suspension_id = v.id and log_date = p_date
  ) l;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.task_id), '[]'::jsonb)
  into v_subs
  from (
    select task_id, status, score, teacher_comment,
      coalesce(array_length(photo_data, 1), 0)
        + coalesce(array_length(photo_urls, 1), 0) as photo_count,
      note, submitted_at
    from public.suspension_task_submissions
    where suspension_id = v.id
  ) s;

  return jsonb_build_object(
    'templates', v_templates,
    'tasks', v_tasks,
    'log', coalesce(v_log, 'null'::jsonb),
    'submissions', v_subs
  );
end $$;

-- RPC 3: simpan log harian (upsert) + audit actor wali
create or replace function public.save_suspension_log(
  p_token text, p_date date, p_entries jsonb, p_note text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_id uuid;
  v_prefix text := substr(coalesce(p_token, ''), 1, 8);
begin
  perform public._suspension_log_attempt(v_prefix);
  v := public._suspension_check_token(p_token);

  if p_date is null or p_date < v.start_date or p_date > v.end_date then
    raise exception 'Tanggal di luar masa pembinaan.' using errcode = 'P0001';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'object' then
    raise exception 'Format isian tidak valid.' using errcode = 'P0001';
  end if;

  insert into public.suspension_daily_logs (suspension_id, log_date, entries, note_optional)
  values (v.id, p_date, p_entries, nullif(p_note, ''))
  on conflict (suspension_id, log_date)
  do update set entries = excluded.entries,
    note_optional = excluded.note_optional,
    updated_at = now()
  returning id into v_id;

  insert into public.audit_logs (action, source, table_name, record_id, new_data,
    actor_name, actor_role, created_at)
  values ('UPDATE', 'OPERATIONAL', 'suspension_daily_logs', v_id,
    jsonb_build_object('suspension_id', v.id, 'log_date', p_date),
    'Wali (' || v_prefix || ')', 'wali', now());

  return jsonb_build_object('ok', true, 'log_id', v_id);
end $$;

-- RPC 4: kirim bukti tugas (base64 terkompresi) + upsert submission
-- Batas: maks 6 foto/kirim, 2 MB/foto, 10 MB total, 12 foto tersimpan
create or replace function public.submit_suspension_task(
  p_token text, p_task_id uuid, p_photos_base64 text[], p_note text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_prefix text := substr(coalesce(p_token, ''), 1, 8);
  v_found uuid;
  v_photo text;
  v_clean text;
  v_bytes int;
  v_total int := 0;
  v_kept text[] := '{}';
  v_sub_id uuid;
begin
  perform public._suspension_log_attempt(v_prefix);
  v := public._suspension_check_token(p_token);

  select id into v_found from public.suspension_tasks
  where id = p_task_id and suspension_id = v.id;
  if not found then
    raise exception 'Tugas tidak ditemukan.' using errcode = 'P0001';
  end if;

  if (p_photos_base64 is null or coalesce(array_length(p_photos_base64, 1), 0) = 0)
     and (p_note is null or length(trim(p_note)) = 0) then
    raise exception 'Lampirkan minimal satu foto atau catatan.' using errcode = 'P0001';
  end if;

  if p_photos_base64 is not null then
    if coalesce(array_length(p_photos_base64, 1), 0) > 6 then
      raise exception 'Maksimal 6 foto per pengiriman.' using errcode = 'P0001';
    end if;
    foreach v_photo in array p_photos_base64 loop
      v_clean := v_photo;
      if v_clean like 'data:%;base64,%' then
        v_clean := split_part(v_clean, ',', 2);
      end if;
      if v_clean is null or length(v_clean) = 0 then
        raise exception 'Foto yang dikirim kosong.' using errcode = 'P0001';
      end if;
      v_bytes := (length(v_clean) * 3) / 4;
      if v_bytes > 2 * 1024 * 1024 then
        raise exception 'Ukuran tiap foto maksimal 2 MB.' using errcode = 'P0001';
      end if;
      v_total := v_total + v_bytes;
      if v_total > 10 * 1024 * 1024 then
        raise exception 'Total foto maksimal 10 MB.' using errcode = 'P0001';
      end if;
      begin
        perform length(decode(v_clean, 'base64'));
      exception when others then
        raise exception 'Format foto tidak valid.' using errcode = 'P0001';
      end;
      v_kept := v_kept || v_clean;
    end loop;
  end if;

  insert into public.suspension_task_submissions
    (task_id, suspension_id, photo_urls, photo_data, note, status)
  values (p_task_id, v.id, '{}', v_kept,
    nullif(trim(coalesce(p_note, '')), ''), 'dikerjakan')
  on conflict (task_id, suspension_id)
  do update set
    photo_data = case
      when coalesce(array_length(excluded.photo_data, 1), 0) > 0
      then (public.suspension_task_submissions.photo_data || excluded.photo_data)
      else public.suspension_task_submissions.photo_data end,
    note = excluded.note,
    status = 'dikerjakan',
    submitted_at = now(),
    updated_at = now()
  returning id into v_sub_id;

  -- Batasi akumulasi: maksimal 12 foto per submission
  update public.suspension_task_submissions
  set photo_data = (photo_data)
    [greatest(array_length(photo_data, 1) - 11, 1):array_length(photo_data, 1)]
  where id = v_sub_id
    and coalesce(array_length(photo_data, 1), 0) > 12;

  insert into public.audit_logs (action, source, table_name, record_id, new_data,
    actor_name, actor_role, created_at)
  values ('INSERT', 'OPERATIONAL', 'suspension_task_submissions', v_sub_id,
    jsonb_build_object('suspension_id', v.id, 'task_id', p_task_id,
      'photo_count', coalesce(array_length(v_kept, 1), 0)),
    'Wali (' || v_prefix || ')', 'wali', now());

  return jsonb_build_object('ok', true, 'submission_id', v_sub_id,
    'photo_count', coalesce(array_length(v_kept, 1), 0));
end $$;

-- Hanya 4 RPC publik yang boleh dieksekusi anon; helper (_) tidak di-grant
revoke execute on function public.validate_suspension_token(text) from public, anon, authenticated;
revoke execute on function public.get_suspension_day(text, date) from public, anon, authenticated;
revoke execute on function public.save_suspension_log(text, date, jsonb, text) from public, anon, authenticated;
revoke execute on function public.submit_suspension_task(text, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.validate_suspension_token(text) to public;
grant execute on function public.get_suspension_day(text, date) to public;
grant execute on function public.save_suspension_log(text, date, jsonb, text) to public;
grant execute on function public.submit_suspension_task(text, uuid, text[], text) to public;

-- ------------------------------------------------------------
-- Seed template checklist (24 item — 4 blok + varian weekend)
-- ------------------------------------------------------------
insert into public.suspension_log_templates
  (block_key, item_key, label_id, input_type, options, day_type,
   monday_thursday_only, jenjang, sort_order, is_active)
values
  ('dinihari', 'qiyamul_lail', 'Qiyamul lail', 'check', '[]', 'both', false, 'both', 1, true),
  ('dinihari', 'subuh_berjamaah', 'Salat Subuh berjamaah di masjid/musala dekat rumah', 'check', '[]', 'both', false, 'both', 2, true),
  ('dinihari', 'ngaji_subuh', 'Mengaji setelah Subuh', 'check', '[]', 'both', false, 'both', 3, true),
  ('dinihari', 'kultum', 'Kultum / mendengarkan kultum', 'check', '[]', 'both', false, 'both', 4, true),
  ('dinihari', 'olahraga_piket', 'Olahraga pagi / membantu pekerjaan rumah', 'choice', '["Olahraga pagi", "Membantu pekerjaan rumah", "Keduanya", "Belum sempat"]', 'both', false, 'both', 5, true),
  ('dinihari', 'puasa', 'Puasa sunah Senin/Kamis', 'check', '[]', 'both', true, 'both', 6, true),
  ('pagi', 'dhuha', 'Salat Duha', 'check', '[]', 'both', false, 'both', 1, true),
  ('pagi', 'wafa_bta', 'Wafa / BTA (isi jilid + halaman)', 'wafa', '[]', 'both', false, 'both', 2, true),
  ('pagi', 'tugas_kbm', 'Tugas KBM per mapel (lihat daftar tugas + unggah foto bukti)', 'tugas_ref', '[]', 'both', false, 'both', 3, true),
  ('pagi', 'dzuhur_ngaji', 'Salat Zuhur berjamaah + mengaji', 'check', '[]', 'both', false, 'both', 4, true),
  ('pagi', 'tahfidz', 'Setoran tahfidz (isi surah + ayat)', 'surah', '[]', 'both', false, 'both', 5, true),
  ('sore', 'ashar_ngaji', 'Salat Asar berjamaah + mengaji', 'check', '[]', 'both', false, 'both', 1, true),
  ('sore', 'giat_mandiri', 'Kegiatan mandiri bermanfaat (tulis singkat)', 'text', '[]', 'both', false, 'both', 2, true),
  ('sore', 'kajian_sore', 'Kajian sore (catatan singkat)', 'text', '[]', 'both', false, 'both', 3, true),
  ('sore', 'maghrib', 'Salat Magrib berjamaah', 'check', '[]', 'both', false, 'both', 4, true),
  ('malam', 'isya', 'Salat Isya berjamaah', 'check', '[]', 'both', false, 'both', 1, true),
  ('malam', 'tahfidz_murajaah', 'Tahfidz / murajaah', 'check', '[]', 'both', false, 'both', 2, true),
  ('malam', 'mufrodat', 'Hafalan mufrodat', 'check', '[]', 'both', false, 'both', 3, true),
  ('malam', 'belajar_malam', 'Belajar malam', 'check', '[]', 'both', false, 'both', 4, true),
  ('malam', 'tahajjud', 'Salat tahajud', 'check', '[]', 'both', false, 'both', 5, true),
  ('pagi', 'kerja_bakti', 'Kerja bakti / bersih-bersih rumah dan lingkungan', 'check', '[]', 'weekend', false, 'both', 6, true),
  ('sore', 'bantu_usaha', 'Membantu usaha orang tua', 'check', '[]', 'weekend', false, 'both', 5, true),
  ('sore', 'tugas_pembina', 'Tugas ekstra dari pembina (tulis singkat)', 'text', '[]', 'weekend', false, 'both', 6, true)
on conflict (block_key, item_key, jenjang) do nothing;
