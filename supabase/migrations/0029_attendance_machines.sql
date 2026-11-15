-- ============================================================
-- 0027: Mesin Presensi / Pengganti Sidik (PRD §3, §5 #7)
--   * attendance_machines       : master mesin sidik jari/RFID
--   * machine_attendance_logs   : log mentah scan dari mesin
--   * RPC ingest_machine_attendance : endpoint ingest push dari mesin
--   * RPC sync_machine_to_attendance: sinkronisasi scan ke absensi harian
-- ============================================================

-- ------------------------------------------------------------
-- 1. attendance_machines — master mesin
-- ------------------------------------------------------------
create table public.attendance_machines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  serial_no   text not null,
  location    text,
  api_key     text not null, -- token otentikasi push mesin
  is_active   boolean not null default true,
  last_seen_at timestamptz,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index attendance_machines_serial_unique
  on public.attendance_machines (serial_no)
  where deleted_at is null;

create trigger trg_attendance_machines_updated_at
  before update on public.attendance_machines
  for each row execute function public.set_updated_at();

alter table public.attendance_machines enable row level security;

create policy "attendance_machines_select" on public.attendance_machines
  for select to authenticated using (public.is_staff());

create policy "attendance_machines_insert" on public.attendance_machines
  for insert to authenticated with check (public.is_staff_writer());

create policy "attendance_machines_update" on public.attendance_machines
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "attendance_machines_delete" on public.attendance_machines
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 2. machine_attendance_logs — log scan mentah
-- ------------------------------------------------------------
create table public.machine_attendance_logs (
  id                 uuid primary key default gen_random_uuid(),
  machine_id         uuid references public.attendance_machines (id) on delete set null,
  device_user_id     text not null, -- UID di mesin (biasanya NIS / No Santri)
  scan_time          timestamptz not null,
  scan_type          text not null default 'check_in' check (scan_type in ('check_in', 'check_out', 'auto')),
  matched_student_id uuid references public.students (id) on delete set null,
  matched_status     text not null default 'unmatched' check (matched_status in ('matched', 'unmatched', 'manual')),
  synced_at          timestamptz, -- kapan disinkronkan ke student_attendance
  created_at         timestamptz not null default now()
);

create index machine_logs_time_idx
  on public.machine_attendance_logs (scan_time desc);

create index machine_logs_student_idx
  on public.machine_attendance_logs (matched_student_id);

create index machine_logs_device_uid_idx
  on public.machine_attendance_logs (device_user_id);

alter table public.machine_attendance_logs enable row level security;

create policy "machine_logs_select" on public.machine_attendance_logs
  for select to authenticated using (public.is_staff());

create policy "machine_logs_insert" on public.machine_attendance_logs
  for insert to authenticated with check (public.is_staff_writer());

create policy "machine_logs_update" on public.machine_attendance_logs
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "machine_logs_delete" on public.machine_attendance_logs
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 3. RPC: ingest_machine_attendance — dipanggil mesin / middleware
--    Menerima p_api_key, p_serial, dan jsonb logs
--    logs = [{ "user_id": "12345", "time": "2026-11-10 07:15:00", "type": "check_in" }]
--    Auto-match ke students by NIS, NISN, atau registration_code
-- ------------------------------------------------------------
create or replace function public.ingest_machine_attendance(
  p_api_key text,
  p_serial  text,
  p_logs    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_machine record;
  v_log     jsonb;
  v_student record;
  v_uid     text;
  v_time    timestamptz;
  v_type    text;
  v_inserted integer := 0;
  v_matched  integer := 0;
begin
  -- Validasi mesin & api key
  select * into v_machine
  from public.attendance_machines
  where serial_no = p_serial
    and api_key = p_api_key
    and is_active = true
    and deleted_at is null;

  if not found then
    raise exception 'Mesin tidak terdaftar, API key salah, atau mesin nonaktif';
  end if;

  -- Update last seen
  update public.attendance_machines
  set last_seen_at = now()
  where id = v_machine.id;

  for v_log in select * from jsonb_array_elements(p_logs)
  loop
    v_uid  := trim(v_log->>'user_id');
    v_time := (v_log->>'time')::timestamptz;
    v_type := coalesce(nullif(v_log->>'type', ''), 'check_in');

    if v_uid is null or v_uid = '' or v_time is null then
      continue;
    end if;

    -- Cari santri by NIS / NISN / registration_code
    select id, class_id into v_student
    from public.students
    where deleted_at is null
      and status = 'active'
      and (
        nis = v_uid or
        nisn = v_uid or
        registration_code = v_uid
      )
    limit 1;

    insert into public.machine_attendance_logs (
      machine_id,
      device_user_id,
      scan_time,
      scan_type,
      matched_student_id,
      matched_status
    ) values (
      v_machine.id,
      v_uid,
      v_time,
      v_type,
      v_student.id,
      case when v_student.id is not null then 'matched' else 'unmatched' end
    );

    v_inserted := v_inserted + 1;
    if v_student.id is not null then
      v_matched := v_matched + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'matched', v_matched
  );
end;
$$;

revoke execute on function public.ingest_machine_attendance(text, text, jsonb)
  from public;
grant execute on function public.ingest_machine_attendance(text, text, jsonb)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 4. RPC: sync_machine_to_daily_attendance — pindahkan scan tanggal
--    tertentu ke student_attendance (menandai 'H')
-- ------------------------------------------------------------
create or replace function public.sync_machine_to_daily_attendance(
  p_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_day_key text := extract(day from p_date)::text;
  v_year  integer := extract(year from p_date)::integer;
  v_month integer := extract(month from p_date)::integer;
  v_count integer := 0;
begin
  if not public.is_staff_writer() then
    raise exception 'Hanya staf yang boleh menyinkronkan absensi';
  end if;

  -- Ambil semua santri yang punya scan pada tanggal tersebut
  for v_rec in
    select distinct l.matched_student_id as student_id, s.class_id
    from public.machine_attendance_logs l
    join public.students s on s.id = l.matched_student_id
    where l.matched_student_id is not null
      and l.scan_time::date = p_date
      and s.deleted_at is null
      and s.status = 'active'
      and s.class_id is not null
  loop
    -- Upsert ke student_attendance (merge hari)
    insert into public.student_attendance (student_id, class_id, year, month, days)
    values (
      v_rec.student_id,
      v_rec.class_id,
      v_year,
      v_month,
      jsonb_build_object(v_day_key, 'H')
    )
    on conflict (student_id, year, month)
    do update set
      days = public.student_attendance.days || jsonb_build_object(v_day_key, 'H'),
      updated_at = now();

    v_count := v_count + 1;
  end loop;

  -- Tandai logs yang tersinkron
  update public.machine_attendance_logs
  set synced_at = now()
  where scan_time::date = p_date
    and matched_student_id is not null
    and synced_at is null;

  return v_count;
end;
$$;

revoke execute on function public.sync_machine_to_daily_attendance(date)
  from public, anon;
grant execute on function public.sync_machine_to_daily_attendance(date)
  to authenticated;
