-- ============================================================
-- 0006: Row Level Security untuk semua tabel aplikasi
-- Matrix akses:
--   SELECT  : semua staff (developer|admin|pengurus|guru) — pending terblokir
--   INSERT/UPDATE master data : developer|admin|pengurus
--   DELETE  : developer|admin
--   reports & gate_logs : INSERT juga boleh guru (pelapor/satpam)
--   gate_logs : immutable (tanpa policy UPDATE/DELETE)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.dorms enable row level security;
alter table public.students enable row level security;
alter table public.point_rules enable row level security;
alter table public.reports enable row level security;
alter table public.gate_logs enable row level security;

-- ------------------------------------------------------------
-- profiles: user boleh baca profil sendiri (agar role 'pending'
-- tetap terbaca oleh ProtectedRoute), staff baca semua
-- ------------------------------------------------------------
create policy "profiles_select_self_or_staff"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- Master data: academic_years, teachers, classes, dorms, students, point_rules
-- ------------------------------------------------------------
create policy "academic_years_select" on public.academic_years
  for select to authenticated using (public.is_staff());
create policy "academic_years_insert" on public.academic_years
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "academic_years_update" on public.academic_years
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "academic_years_delete" on public.academic_years
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "teachers_select" on public.teachers
  for select to authenticated using (public.is_staff());
create policy "teachers_insert" on public.teachers
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "teachers_update" on public.teachers
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "teachers_delete" on public.teachers
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "classes_select" on public.classes
  for select to authenticated using (public.is_staff());
create policy "classes_insert" on public.classes
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "classes_update" on public.classes
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "classes_delete" on public.classes
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "dorms_select" on public.dorms
  for select to authenticated using (public.is_staff());
create policy "dorms_insert" on public.dorms
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "dorms_update" on public.dorms
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "dorms_delete" on public.dorms
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "students_select" on public.students
  for select to authenticated using (public.is_staff());
create policy "students_insert" on public.students
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "students_update" on public.students
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "students_delete" on public.students
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "point_rules_select" on public.point_rules
  for select to authenticated using (public.is_staff());
create policy "point_rules_insert" on public.point_rules
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "point_rules_update" on public.point_rules
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "point_rules_delete" on public.point_rules
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- reports: semua staff bisa mencatat (guru = pelapor),
-- edit dibatasi pengurus ke atas, hapus developer|admin
-- ------------------------------------------------------------
create policy "reports_select" on public.reports
  for select to authenticated using (public.is_staff());
create policy "reports_insert" on public.reports
  for insert to authenticated
  with check (public.is_staff() and reporter_id = auth.uid());
create policy "reports_update" on public.reports
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));
create policy "reports_delete" on public.reports
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- gate_logs: semua staff bisa mencatat; tanpa UPDATE/DELETE (immutable)
-- ------------------------------------------------------------
create policy "gate_logs_select" on public.gate_logs
  for select to authenticated using (public.is_staff());
create policy "gate_logs_insert" on public.gate_logs
  for insert to authenticated
  with check (public.is_staff());
