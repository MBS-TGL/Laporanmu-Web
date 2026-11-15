-- ============================================================
-- 0041: Auto-Scope Musyrif Halaqah (keputusan 2026-11-14)
--   * Guru (akun ter-link ke teachers) hanya melihat & mengelola
--     kelompok halaqah di mana ia musyrif-nya.
--   * Musyrif boleh: simpan presensi, catat/edit/hapus setoran
--     santri kelompoknya, kelola anggota kelompoknya.
--   * Policy lama staff-wide (0022/0033) di-drop & dibuat ulang
--     — RLS permissive hanya bisa melebar, untuk mempersempit
--     harus diganti. is_staff_writer()/is_staff_deleter() tidak
--     berubah (developer/admin/pengurus tetap akses penuh).
--
-- Konvensi: mengikuti 0022/0028 (helper security definer, role
-- teks label ganda, soft delete, teachers.profile_id = auth link)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: musyrif pemegang kelompok halaqah
-- ------------------------------------------------------------
create or replace function public.is_halaqah_musyrif(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.halaqah_groups g
    join public.teachers t on t.id = g.musyrif_id
    join public.profiles p on p.id = t.profile_id
    where g.id = p_group_id
      and g.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

-- Musyrif pemegang kelompok yang memuat santri tsb (untuk tahfidz_records
-- yang tidak punya group_id — scope lewat anggota kelompok).
create or replace function public.is_halaqah_musyrif_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.halaqah_members m
    join public.halaqah_groups g on g.id = m.group_id
    join public.teachers t on t.id = g.musyrif_id
    join public.profiles p on p.id = t.profile_id
    where m.student_id = p_student_id
      and m.deleted_at is null
      and g.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 2. halaqah_groups — SELECT dibatasi (writer ATAU musyrif grup)
--    insert/update/delete grup tetap staff-only (tidak disentuh)
-- ------------------------------------------------------------
drop policy if exists "halaqah_groups_select" on public.halaqah_groups;
create policy "halaqah_groups_select" on public.halaqah_groups
  for select to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif(id));

-- ------------------------------------------------------------
-- 3. halaqah_members — musyrif kelola anggota kelompoknya
-- ------------------------------------------------------------
drop policy if exists "halaqah_members_select" on public.halaqah_members;
create policy "halaqah_members_select" on public.halaqah_members
  for select to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif(group_id));

drop policy if exists "halaqah_members_insert" on public.halaqah_members;
create policy "halaqah_members_insert" on public.halaqah_members
  for insert to authenticated
  with check (public.is_staff_writer() or public.is_halaqah_musyrif(group_id));

drop policy if exists "halaqah_members_update" on public.halaqah_members;
create policy "halaqah_members_update" on public.halaqah_members
  for update to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif(group_id))
  with check (public.is_staff_writer() or public.is_halaqah_musyrif(group_id));

drop policy if exists "halaqah_members_delete" on public.halaqah_members;
create policy "halaqah_members_delete" on public.halaqah_members
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_halaqah_musyrif(group_id));

-- ------------------------------------------------------------
-- 4. halaqah_attendance — musyrif isi presensi kelompoknya.
--    Upsert mengevaluasi INSERT (baris baru) DAN UPDATE USING
--    (baris lama) — keduanya wajib mencakup musyrif.
--    Tabel ini TANPA deleted_at (hard delete).
-- ------------------------------------------------------------
drop policy if exists "halaqah_attendance_select" on public.halaqah_attendance;
create policy "halaqah_attendance_select" on public.halaqah_attendance
  for select to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif(group_id));

drop policy if exists "halaqah_attendance_insert" on public.halaqah_attendance;
create policy "halaqah_attendance_insert" on public.halaqah_attendance
  for insert to authenticated
  with check (public.is_staff_writer() or public.is_halaqah_musyrif(group_id));

drop policy if exists "halaqah_attendance_update" on public.halaqah_attendance;
create policy "halaqah_attendance_update" on public.halaqah_attendance
  for update to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif(group_id))
  with check (public.is_staff_writer() or public.is_halaqah_musyrif(group_id));

drop policy if exists "halaqah_attendance_delete" on public.halaqah_attendance;
create policy "halaqah_attendance_delete" on public.halaqah_attendance
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_halaqah_musyrif(group_id));

-- ------------------------------------------------------------
-- 5. tahfidz_records — musyrif kelola setoran santri kelompoknya
-- ------------------------------------------------------------
drop policy if exists "tahfidz_select" on public.tahfidz_records;
create policy "tahfidz_select" on public.tahfidz_records
  for select to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif_of_student(student_id));

drop policy if exists "tahfidz_insert" on public.tahfidz_records;
create policy "tahfidz_insert" on public.tahfidz_records
  for insert to authenticated
  with check (public.is_staff_writer() or public.is_halaqah_musyrif_of_student(student_id));

drop policy if exists "tahfidz_update" on public.tahfidz_records;
create policy "tahfidz_update" on public.tahfidz_records
  for update to authenticated
  using (public.is_staff_writer() or public.is_halaqah_musyrif_of_student(student_id))
  with check (public.is_staff_writer() or public.is_halaqah_musyrif_of_student(student_id));

drop policy if exists "tahfidz_delete" on public.tahfidz_records;
create policy "tahfidz_delete" on public.tahfidz_records
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_halaqah_musyrif_of_student(student_id));
