-- =============================================================
-- 0040 — Presensi ekstrakurikuler bulanan
--   * ekskul_attendance: status H/S/I/A/P per hari per anggota kegiatan
--   * Satu baris per (ekskul, santri, tahun, bulan) — days jsonb
--     berformat sama dengan student_attendance: { "1": "H", "2": "S", ... }
--   * Pola tabel & RLS: 0033_halaqah_attendance.sql (tanpa kolom session)
-- =============================================================

create table if not exists public.ekskul_attendance (
  id uuid primary key default gen_random_uuid(),
  ekskul_id uuid not null references public.extracurriculars (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  year smallint not null check (year between 2000 and 2100),
  month smallint not null check (month between 1 and 12),
  days jsonb not null default '{}'::jsonb,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu baris absensi per anggota per kegiatan per bulan (dipakai upsert onConflict)
create unique index if not exists ekskul_attendance_unique
  on public.ekskul_attendance (ekskul_id, student_id, year, month);
create index if not exists ekskul_attendance_student_idx
  on public.ekskul_attendance (student_id);
create index if not exists ekskul_attendance_period_idx
  on public.ekskul_attendance (year, month);

create trigger trg_ekskul_attendance_updated_at
  before update on public.ekskul_attendance
  for each row execute function public.set_updated_at();

alter table public.ekskul_attendance enable row level security;

create policy "ekskul_attendance_select" on public.ekskul_attendance
  for select to authenticated using (public.is_staff());
create policy "ekskul_attendance_insert" on public.ekskul_attendance
  for insert to authenticated with check (public.is_staff_writer());
create policy "ekskul_attendance_update" on public.ekskul_attendance
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "ekskul_attendance_delete" on public.ekskul_attendance
  for delete to authenticated using (public.is_staff_deleter());
