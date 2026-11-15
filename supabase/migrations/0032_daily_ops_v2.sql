-- ============================================================
-- 0032: Operasional Harian v2 — Guru Pengganti, Time Slot Jadwal & Konseling Kelompok
--   * schedules.time_slot_id    : referensi slot jam KBM
--   * substitution_logs         : penunjukan guru pengganti per jadwal & tanggal
--   * counseling_participants   : relasi multi-santri untuk sesi BK kelompok
-- ============================================================

-- ------------------------------------------------------------
-- 1. Perluas schedules dengan time_slot_id
-- ------------------------------------------------------------
alter table public.schedules
  add column if not exists time_slot_id uuid references public.time_slots (id) on delete set null;

create index if not exists schedules_time_slot_idx
  on public.schedules (time_slot_id)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 2. substitution_logs — Log penunjukan guru pengganti
-- ------------------------------------------------------------
create table if not exists public.substitution_logs (
  id                    uuid primary key default gen_random_uuid(),
  schedule_id           uuid not null references public.schedules (id) on delete cascade,
  date                  date not null default current_date,
  original_teacher_id   uuid references public.teachers (id) on delete set null,
  substitute_teacher_id uuid not null references public.teachers (id) on delete cascade,
  note                  text,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint substitution_logs_unique unique (schedule_id, date)
);

create index if not exists substitution_logs_date_idx
  on public.substitution_logs (date desc);

create trigger trg_substitution_logs_updated_at
  before update on public.substitution_logs
  for each row execute function public.set_updated_at();

alter table public.substitution_logs enable row level security;

create policy "substitution_logs_select" on public.substitution_logs
  for select to authenticated using (public.is_staff());

create policy "substitution_logs_insert" on public.substitution_logs
  for insert to authenticated with check (public.is_staff_writer());

create policy "substitution_logs_update" on public.substitution_logs
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "substitution_logs_delete" on public.substitution_logs
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 3. counseling_participants — Relasi multi-santri sesi BK kelompok
-- ------------------------------------------------------------
create table if not exists public.counseling_participants (
  id            uuid primary key default gen_random_uuid(),
  counseling_id uuid not null references public.counseling_logs (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint counseling_participants_unique unique (counseling_id, student_id)
);

create index if not exists counseling_participants_idx
  on public.counseling_participants (counseling_id, student_id);

alter table public.counseling_participants enable row level security;

create policy "counseling_participants_select" on public.counseling_participants
  for select to authenticated using (public.is_staff());

create policy "counseling_participants_insert" on public.counseling_participants
  for insert to authenticated with check (public.is_staff_writer());

create policy "counseling_participants_update" on public.counseling_participants
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "counseling_participants_delete" on public.counseling_participants
  for delete to authenticated using (public.is_staff_deleter());
