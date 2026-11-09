-- ============================================================
-- 0012: Layanan santri — Kesehatan (poskestren), BK, Izin Pulang
-- Perbaikan dari V1: RLS staff-only (bukan authenticated-all),
-- status kesehatan pakai CHECK constraint, status izin pakai CHECK
-- ============================================================

-- ------------------------------------------------------------
-- Kesehatan: stok obat
-- ------------------------------------------------------------
create table public.health_medicines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  stock integer not null default 0,
  unit text not null default 'tablet',
  min_stock integer not null default 10,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint health_medicines_stock_check check (stock >= 0)
);

create index health_medicines_name_idx on public.health_medicines (name);
create trigger trg_health_medicines_updated_at
  before update on public.health_medicines
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Kesehatan: log kunjungan / rekam medis
-- medicine_* disimpan snapshot agar historis tetap benar
-- saat obat dihapus dari stok
-- ------------------------------------------------------------
create table public.health_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  time text not null default to_char(now(), 'HH24:MI'),
  student_id uuid references public.students (id) on delete set null,
  student_name text not null,
  class_name text,
  complaint text not null,
  diagnosis text,
  treatment text,
  medicine_id uuid references public.health_medicines (id) on delete set null,
  medicine_name text,
  medicine_qty integer not null default 0,
  status text not null default 'Kembali'
    check (status in ('UKS', 'Asrama', 'Kembali')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index health_logs_date_idx on public.health_logs (date desc);
create index health_logs_student_idx on public.health_logs (student_id);
create trigger trg_health_logs_updated_at
  before update on public.health_logs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- BK: kategori/urgensi/status pakai enum (mewarisi pola V1)
-- ------------------------------------------------------------
create type public.counseling_category as enum ('pribadi', 'sosial', 'akademik', 'karir');
create type public.counseling_urgency as enum ('ringan', 'sedang', 'tinggi');
create type public.counseling_status as enum ('proses', 'selesai');

create table public.counseling_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  time text not null default to_char(now(), 'HH24:MI'),
  student_id uuid references public.students (id) on delete set null,
  student_name text not null,
  class_name text,
  counselor_name text not null,
  category public.counseling_category not null default 'pribadi',
  complaint text not null,
  diagnosis text,
  action_plan text,
  urgency public.counseling_urgency not null default 'ringan',
  status public.counseling_status not null default 'proses',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index counseling_logs_date_idx on public.counseling_logs (date desc);
create index counseling_logs_student_idx on public.counseling_logs (student_id);
create trigger trg_counseling_logs_updated_at
  before update on public.counseling_logs
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Izin pulang / izin keluar pondok
-- ------------------------------------------------------------
create table public.leave_permits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  phone text,
  destination text not null,
  purpose text not null,
  leave_date date not null default current_date,
  return_deadline timestamptz not null,
  status text not null default 'issued'
    check (status in ('issued', 'departed', 'returned', 'overdue', 'cancelled')),
  issued_by uuid references public.profiles (id) on delete set null,
  gate_log_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leave_permits_status_idx on public.leave_permits (status);
create index leave_permits_leave_date_idx on public.leave_permits (leave_date desc);
create trigger trg_leave_permits_updated_at
  before update on public.leave_permits
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.health_medicines enable row level security;
alter table public.health_logs enable row level security;
alter table public.counseling_logs enable row level security;
alter table public.leave_permits enable row level security;

create policy "health_medicines_select" on public.health_medicines
  for select to authenticated using (public.is_staff());
create policy "health_medicines_insert" on public.health_medicines
  for insert to authenticated with check (public.is_staff());
create policy "health_medicines_update" on public.health_medicines
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "health_medicines_delete" on public.health_medicines
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "health_logs_select" on public.health_logs
  for select to authenticated using (public.is_staff());
create policy "health_logs_insert" on public.health_logs
  for insert to authenticated with check (public.is_staff());
create policy "health_logs_update" on public.health_logs
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "health_logs_delete" on public.health_logs
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "counseling_select" on public.counseling_logs
  for select to authenticated using (public.is_staff());
create policy "counseling_insert" on public.counseling_logs
  for insert to authenticated with check (public.is_staff());
create policy "counseling_update" on public.counseling_logs
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "counseling_delete" on public.counseling_logs
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "leave_permits_select" on public.leave_permits
  for select to authenticated using (public.is_staff());
create policy "leave_permits_insert" on public.leave_permits
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "leave_permits_update" on public.leave_permits
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "leave_permits_delete" on public.leave_permits
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));
