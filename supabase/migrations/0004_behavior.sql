-- ============================================================
-- 0004: Poin santri (aturan poin + catatan pelanggaran/prestasi)
-- ============================================================

-- ------------------------------------------------------------
-- Aturan poin
-- is_negative derived (points < 0) agar tidak pernah ganda antar kolom
-- ------------------------------------------------------------
create table public.point_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null,
  category text,
  is_negative boolean generated always as (points < 0) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index point_rules_name_active_unique on public.point_rules (name)
  where deleted_at is null;
create trigger trg_point_rules_updated_at
  before update on public.point_rules
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Catatan poin (pelanggaran & prestasi)
-- points disimpan snapshot agar riwayat tetap akurat
-- meski aturan poin diubah/dihapus
-- ------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  rule_id uuid not null references public.point_rules (id),
  reporter_id uuid references public.profiles (id) on delete set null,
  points integer not null,
  notes text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_student_idx on public.reports (student_id);
create index reports_rule_idx on public.reports (rule_id);
create index reports_reported_at_idx on public.reports (reported_at desc);
create trigger trg_reports_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Sinkronisasi students.total_points setiap reports berubah
-- ------------------------------------------------------------
create or replace function public.adjust_student_total_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.students
      set total_points = total_points + new.points
      where id = new.student_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.students
      set total_points = total_points - old.points
      where id = old.student_id;
    return old;
  else
    if new.student_id is distinct from old.student_id
       or new.points is distinct from old.points then
      update public.students
        set total_points = total_points - old.points
        where id = old.student_id;
      update public.students
        set total_points = total_points + new.points
        where id = new.student_id;
    end if;
    return new;
  end if;
end;
$$;

create trigger trg_reports_adjust_points
  after insert or update or delete on public.reports
  for each row execute function public.adjust_student_total_points();
