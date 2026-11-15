-- ============================================================
-- 0034: Kalender Pendidikan & Agenda Kegiatan Pondok
-- ============================================================

create table if not exists public.academic_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('akademik', 'pondok', 'ujian', 'libur', 'umum')),
  target_level text not null default 'ALL' check (target_level in ('ALL', 'SMP', 'SMA')),
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  location text,
  description text,
  color text,
  academic_year_id uuid references public.academic_years (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_calendar_date_check check (end_date >= start_date)
);

create index if not exists academic_calendar_dates_idx
  on public.academic_calendar_events (start_date, end_date)
  where deleted_at is null;

create index if not exists academic_calendar_category_idx
  on public.academic_calendar_events (category)
  where deleted_at is null;

create index if not exists academic_calendar_target_idx
  on public.academic_calendar_events (target_level)
  where deleted_at is null;

create trigger trg_academic_calendar_updated_at
  before update on public.academic_calendar_events
  for each row execute function public.set_updated_at();

alter table public.academic_calendar_events enable row level security;

create policy "academic_calendar_select" on public.academic_calendar_events
  for select to authenticated using (public.is_staff());

create policy "academic_calendar_insert" on public.academic_calendar_events
  for insert to authenticated with check (public.is_staff_writer());

create policy "academic_calendar_update" on public.academic_calendar_events
  for update to authenticated using (public.is_staff_writer());

create policy "academic_calendar_delete" on public.academic_calendar_events
  for delete to authenticated using (public.is_admin());
