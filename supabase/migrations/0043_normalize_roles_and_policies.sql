-- ============================================================
-- 0043: Normalisasi label role & perbaikan policy pra-0021 (2026-11-14)
--
--   Latar (lihat juga 0042): enum app_role di DB live memuat label ganda
--   (lama pengurus/guru DAN baru manager/teacher). Policy & RPC pra-0021
--   menanam literal lama langsung (array['developer','admin','pengurus']),
--   sehingga akun ber-label BARU gagal tulis; sebaliknya is_staff() versi
--   0021 hanya mengenali label baru → akun ber-label LAMA gagal baca.
--
--   Isi migration ini (jalankan SETELAH 0039 dan 0041):
--     1. has_any_role() dibuat text-based & toleran label lama→baru
--        (semua policy + RPC pemanggilnya otomatis membenar, tanpa
--        recreate body satu per satu).
--     2. is_staff() versi 0042 diulang (idempotent) agar file ini
--        mandiri.
--     3. profiles.role dinormalisasi: pengurus→manager, guru→teacher
--        (dijaga DO block: hanya bila enum memuat label baru).
--     4. Policy yang menanam literal lama langsung di-recreate memakai
--        helper text-safe (is_staff_writer/is_staff) agar tahan bila
--        label lama kelak dihapus dari enum.
--
--   Catatan: RPC yang menanam array lama (import_students 0007/0016,
--   wa_broadcast 0017, graduate_students 0018, save_student_guardians
--   0020) TIDAK di-recreate — cukup dibenahi lewat has_any_role() yang
--   kini toleran. Jangan hapus label lama dari enum sebelum RPC-RPC itu
--   di-recreate.
--
--   Urutan apply manual ke Supabase (SQL Editor):
--     0039_rbac_roles.sql → 0041_halaqah_musyrif_rls.sql → 0042 (bila
--     belum) → 0043 (file ini).
--     Verifikasi:
--       select role::text, count(*) from public.profiles group by 1;
--       -- harus tinggal developer/admin/manager/teacher/pending
--       select public.is_staff(), public.has_any_role(
--         array['developer','admin','pengurus']::public.app_role[]);
-- ============================================================

-- ------------------------------------------------------------
-- 1. has_any_role() — text-based, label lama dipetakan ke baru.
--    Signature tidak berubah sehingga semua pemanggil tetap sah.
-- ------------------------------------------------------------
create or replace function public.has_any_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text = any (
        select case v::text
                 when 'pengurus' then 'manager'
                 when 'guru'     then 'teacher'
                 else v::text
               end
        from unnest(required) as v
      )
  );
$$;

-- ------------------------------------------------------------
-- 2. is_staff() — label ganda, gaya 0042 (idempotent).
-- ------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in (
        'developer', 'admin',
        'manager', 'teacher',   -- label baru (0021)
        'pengurus', 'guru'      -- label lama
      )
  );
$$;

-- ------------------------------------------------------------
-- 3. Normalisasi data profiles.role (hanya bila enum memuat label baru)
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'app_role' and e.enumlabel = 'manager'
  ) then
    update public.profiles set role = 'manager' where role::text = 'pengurus';
    update public.profiles set role = 'teacher' where role::text = 'guru';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. Recreate policy penanam literal lama → helper text-safe
-- ------------------------------------------------------------

-- 0006: master data (tulis = developer|admin|manager)
drop policy if exists "academic_years_insert" on public.academic_years;
create policy "academic_years_insert" on public.academic_years
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "academic_years_update" on public.academic_years;
create policy "academic_years_update" on public.academic_years
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

drop policy if exists "teachers_insert" on public.teachers;
create policy "teachers_insert" on public.teachers
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "teachers_update" on public.teachers;
create policy "teachers_update" on public.teachers
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

drop policy if exists "classes_insert" on public.classes;
create policy "classes_insert" on public.classes
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "classes_update" on public.classes;
create policy "classes_update" on public.classes
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

drop policy if exists "dorms_insert" on public.dorms;
create policy "dorms_insert" on public.dorms
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "dorms_update" on public.dorms;
create policy "dorms_update" on public.dorms
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

drop policy if exists "students_insert" on public.students;
create policy "students_insert" on public.students
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "students_update" on public.students;
create policy "students_update" on public.students
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

drop policy if exists "point_rules_insert" on public.point_rules;
create policy "point_rules_insert" on public.point_rules
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "point_rules_update" on public.point_rules;
create policy "point_rules_update" on public.point_rules
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

drop policy if exists "reports_update" on public.reports;
create policy "reports_update" on public.reports
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

-- 0010: hapus raport (developer|admin|manager — selaras DELETE lama)
drop policy if exists "monthly_raport_delete" on public.student_monthly_reports;
create policy "monthly_raport_delete" on public.student_monthly_reports
  for delete to authenticated
  using (public.is_staff_writer());
drop policy if exists "semester_raport_delete" on public.student_semester_reports;
create policy "semester_raport_delete" on public.student_semester_reports
  for delete to authenticated
  using (public.is_staff_writer());

-- 0012: izin keluar hanya diajukan manager ke atas
drop policy if exists "leave_permits_insert" on public.leave_permits;
create policy "leave_permits_insert" on public.leave_permits
  for insert to authenticated
  with check (public.is_staff_writer());

-- 0015: informasi (select = semua staff, tulis = manager ke atas)
drop policy if exists "announcements_select_staff" on public.announcements;
create policy "announcements_select_staff" on public.announcements
  for select to authenticated
  using (public.is_staff());
drop policy if exists "announcements_insert" on public.announcements;
create policy "announcements_insert" on public.announcements
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "announcements_update" on public.announcements;
create policy "announcements_update" on public.announcements
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());

-- 0020: data orang tua — sengaja lebih ketat dari students (tanpa guru)
drop policy if exists "student_guardians_select" on public.student_guardians;
create policy "student_guardians_select" on public.student_guardians
  for select to authenticated
  using (public.is_staff_writer());
drop policy if exists "student_guardians_insert" on public.student_guardians;
create policy "student_guardians_insert" on public.student_guardians
  for insert to authenticated
  with check (public.is_staff_writer());
drop policy if exists "student_guardians_update" on public.student_guardians;
create policy "student_guardians_update" on public.student_guardians
  for update to authenticated
  using (public.is_staff_writer())
  with check (public.is_staff_writer());
