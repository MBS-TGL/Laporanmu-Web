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
-- ============================================================
-- 0013: Audit log + RPC publik (cek wali santri & verifikasi rapor)
-- Perbaikan dari V1: PIN divalidasi di dalam RPC security-definer
-- (V1 memfilter .eq('pin') via anon SELECT — row mentah bisa
-- ter-expose & PIN bisa diprobe kolom per kolom)
-- ============================================================

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  source text not null default 'SYSTEM',
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  actor_name text,
  actor_role text,
  ip_address text,
  user_agent text,
  url text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated with check (true);
create policy "audit_logs_select" on public.audit_logs
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- RPC publik: cek wali santri (kode registrasi + PIN)
-- Return terbatas — tanpa pin, tanpa kolom sensitif lain
-- ------------------------------------------------------------
create or replace function public.check_student(p_code text, p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student record;
  v_result jsonb;
begin
  if p_code is null or p_pin is null or length(trim(p_code)) = 0 or length(trim(p_pin)) = 0 then
    return jsonb_build_object('error', 'Kode registrasi dan PIN wajib diisi');
  end if;

  select s.id, s.name, s.registration_code, s.nisn, s.gender, s.status,
         s.total_points, s.photo_url,
         c.name as class_name,
         d.name as dorm_name
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.dorms d on d.id = s.dorm_id
  where upper(trim(s.registration_code)) = upper(trim(p_code))
    and s.pin = trim(p_pin)
    and s.deleted_at is null
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Kode registrasi atau PIN salah');
  end if;

  select jsonb_build_object(
    'student', to_jsonb(v_student),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'points', r.points, 'notes', r.notes,
        'reported_at', r.reported_at, 'rule_name', pr.name
      ) order by r.reported_at desc), '[]'::jsonb)
      from public.reports r
      left join public.point_rules pr on pr.id = r.rule_id
      where r.student_id = v_student.id
    ),
    'raports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month, 'year', m.year,
        'nilai_akhlak', m.nilai_akhlak, 'nilai_ibadah', m.nilai_ibadah,
        'nilai_kebersihan', m.nilai_kebersihan, 'nilai_quran', m.nilai_quran,
        'nilai_bahasa', m.nilai_bahasa, 'catatan', m.catatan
      ) order by m.year desc, m.month desc), '[]'::jsonb)
      from public.student_monthly_reports m
      where m.student_id = v_student.id
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;

-- ------------------------------------------------------------
-- RPC publik: verifikasi keaslian rapor bulanan
-- ------------------------------------------------------------
create or replace function public.verify_raport(p_student_id uuid, p_month int, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student record;
  v_report record;
begin
  select s.name, s.registration_code, s.nisn, s.gender,
         c.name as class_name
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = p_student_id and s.deleted_at is null;

  if not found then
    return jsonb_build_object('error', 'Santri tidak ditemukan');
  end if;

  select m.month, m.year, m.nilai_akhlak, m.nilai_ibadah, m.nilai_kebersihan,
         m.nilai_quran, m.nilai_bahasa, m.berat_badan, m.tinggi_badan,
         m.ziyadah, m.murojaah, m.total_hafalan, m.hari_sakit, m.hari_izin,
         m.hari_alpa, m.hari_pulang, m.catatan, m.musyrif_name, m.updated_at
  into v_report
  from public.student_monthly_reports m
  where m.student_id = p_student_id
    and (p_month is null or m.month = p_month)
    and (p_year is null or m.year = p_year)
  order by m.year desc, m.month desc
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Rapor tidak ditemukan untuk periode tersebut');
  end if;

  return jsonb_build_object(
    'student', to_jsonb(v_student),
    'report', to_jsonb(v_report)
  );
end;
$$;

revoke execute on function public.verify_raport(uuid, int, int) from public, anon, authenticated;
grant execute on function public.verify_raport(uuid, int, int) to public;
