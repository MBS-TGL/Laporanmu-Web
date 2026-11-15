-- =============================================================
-- 0033 — Presensi halaqah bulanan (port fitur "Presensi Halaqah" V1)
--   * halaqah_attendance: status H/S/I/A/P per hari per anggota per sesi
--   * Satu baris per (group, santri, sesi, tahun, bulan) — days jsonb
--     berformat sama dengan student_attendance: { "1": "H", "2": "S", ... }
-- =============================================================

create table if not exists public.halaqah_attendance (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.halaqah_groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  session text not null default 'mengaji' check (session in ('mengaji', 'tahfidz')),
  year smallint not null check (year between 2000 and 2100),
  month smallint not null check (month between 1 and 12),
  days jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu baris absensi per anggota per sesi per bulan (dipakai upsert onConflict)
create unique index if not exists halaqah_attendance_unique
  on public.halaqah_attendance (group_id, student_id, session, year, month);
create index if not exists halaqah_attendance_student_idx
  on public.halaqah_attendance (student_id);
create index if not exists halaqah_attendance_period_idx
  on public.halaqah_attendance (year, month);

create trigger trg_halaqah_attendance_updated_at
  before update on public.halaqah_attendance
  for each row execute function public.set_updated_at();

alter table public.halaqah_attendance enable row level security;

create policy "halaqah_attendance_select" on public.halaqah_attendance
  for select to authenticated using (public.is_staff());
create policy "halaqah_attendance_insert" on public.halaqah_attendance
  for insert to authenticated with check (public.is_staff_writer());
create policy "halaqah_attendance_update" on public.halaqah_attendance
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "halaqah_attendance_delete" on public.halaqah_attendance
  for delete to authenticated using (public.is_staff_deleter());
