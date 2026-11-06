-- ============================================================
-- 0011: Absensi harian santri
-- days (jsonb): {"1":"H","2":"S","5":"A"} — nilai H|S|I|A|P
--   H=Hadir, S=Sakit, I=Izin, A=Alpa, P=Pulang awal
--   hari tanpa status tidak memiliki key
-- ============================================================

create table public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  class_id uuid not null references public.classes (id),
  year smallint not null,
  month smallint not null check (month between 1 and 12),
  days jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu baris absensi per siswa per bulan (dipakai upsert onConflict)
create unique index student_attendance_unique
  on public.student_attendance (student_id, year, month);
create index student_attendance_period_idx
  on public.student_attendance (year, month);

create trigger trg_student_attendance_updated_at
  before update on public.student_attendance
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS: absensi adalah tugas harian seluruh staff;
-- hapus hanya developer|admin
-- ------------------------------------------------------------
alter table public.student_attendance enable row level security;

create policy "attendance_select" on public.student_attendance
  for select to authenticated using (public.is_staff());
create policy "attendance_insert" on public.student_attendance
  for insert to authenticated with check (public.is_staff());
create policy "attendance_update" on public.student_attendance
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
create policy "attendance_delete" on public.student_attendance
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));
