-- ============================================================
-- 0010: Modul Raport
--   * student_monthly_reports — raport bulanan pondok (kolom datar)
--   * student_semester_reports — raport semester (skor jsonb per jenis)
--   * school_settings — profil sekolah untuk kop kartu raport (1 baris)
-- ============================================================

-- ------------------------------------------------------------
-- Raport bulanan (pondok): 5 kriteria nilai skala 1–9
-- ------------------------------------------------------------
create table public.student_monthly_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  month smallint not null check (month between 1 and 12),
  year smallint not null,
  nilai_akhlak smallint,
  nilai_ibadah smallint,
  nilai_kebersihan smallint,
  nilai_quran smallint,
  nilai_bahasa smallint,
  berat_badan numeric(5, 1),
  tinggi_badan numeric(5, 1),
  ziyadah text,
  murojaah text,
  total_hafalan text,
  sholat text,
  hari_sakit smallint not null default 0,
  hari_izin smallint not null default 0,
  hari_alpa smallint not null default 0,
  hari_pulang smallint not null default 0,
  catatan text,
  pelanggaran text,
  prestasi text,
  musyrif_name text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_monthly_reports_nilai_range check (
    (nilai_akhlak is null or nilai_akhlak between 0 and 9)
    and (nilai_ibadah is null or nilai_ibadah between 0 and 9)
    and (nilai_kebersihan is null or nilai_kebersihan between 0 and 9)
    and (nilai_quran is null or nilai_quran between 0 and 9)
    and (nilai_bahasa is null or nilai_bahasa between 0 and 9)
  ),
  constraint student_monthly_reports_hari_range check (
    hari_sakit between 0 and 365 and hari_izin between 0 and 365
    and hari_alpa between 0 and 365 and hari_pulang between 0 and 365
  )
);

-- Satu raport per siswa per bulan (dipakai upsert onConflict)
create unique index student_monthly_reports_unique
  on public.student_monthly_reports (student_id, month, year);
create index student_monthly_reports_period_idx
  on public.student_monthly_reports (year, month);

create trigger trg_student_monthly_reports_updated_at
  before update on public.student_monthly_reports
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Raport semester: skor jsonb per jenis raport
-- report_type: pondok_lisan | pondok_mapel | umum
-- ------------------------------------------------------------
create table public.student_semester_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  report_type text not null check (report_type in ('pondok_lisan', 'pondok_mapel', 'umum')),
  semester smallint not null check (semester in (1, 2)),
  academic_year_id uuid not null references public.academic_years (id),
  scores jsonb not null default '{}'::jsonb,
  extras jsonb not null default '{}'::jsonb,
  musyrif_name text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index student_semester_reports_unique
  on public.student_semester_reports (student_id, report_type, semester, academic_year_id);
create index student_semester_reports_period_idx
  on public.student_semester_reports (report_type, semester, academic_year_id);

create trigger trg_student_semester_reports_updated_at
  before update on public.student_semester_reports
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Profil sekolah (baris tunggal — kop kartu raport)
-- ------------------------------------------------------------
create table public.school_settings (
  id boolean primary key default true check (id = true),
  school_name text not null default 'Laporanmu Boarding School',
  school_address text,
  headmaster_name text,
  pengasuh_name text,
  color_primary text not null default '#1a5c35',
  color_secondary text not null default '#c8a400',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id) values (true) on conflict do nothing;

create trigger trg_school_settings_updated_at
  before update on public.school_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
--   select : semua staff
--   insert/update raport : semua staff (guru = pengisi raport harian)
--   delete raport : developer|admin|pengurus
--   school_settings : update developer|admin
-- ------------------------------------------------------------
alter table public.student_monthly_reports enable row level security;
alter table public.student_semester_reports enable row level security;
alter table public.school_settings enable row level security;

create policy "monthly_raport_select" on public.student_monthly_reports
  for select to authenticated using (public.is_staff());
create policy "monthly_raport_insert" on public.student_monthly_reports
  for insert to authenticated with check (public.is_staff());
create policy "monthly_raport_update" on public.student_monthly_reports
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
create policy "monthly_raport_delete" on public.student_monthly_reports
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

create policy "semester_raport_select" on public.student_semester_reports
  for select to authenticated using (public.is_staff());
create policy "semester_raport_insert" on public.student_semester_reports
  for insert to authenticated with check (public.is_staff());
create policy "semester_raport_update" on public.student_semester_reports
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
create policy "semester_raport_delete" on public.student_semester_reports
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

create policy "school_settings_select" on public.school_settings
  for select to authenticated using (public.is_staff());
create policy "school_settings_update" on public.school_settings
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));
