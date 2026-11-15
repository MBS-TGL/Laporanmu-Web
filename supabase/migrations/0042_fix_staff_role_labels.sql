-- ============================================================
-- 0042: Perbaikan label role pada helper staff (keputusan 2026-11-14)
--   * Enum app_role di DB live memuat label ganda: lama (pengurus,
--     guru) DAN baru (manager, teacher) — akibat rename 0021 yang
--     tidak menyertakan penyesuaian data baru yang ditulis aplikasi.
--   * Aplikasi (Edge Function create-user, roleMetas, scope UI)
--     menulis/mencocokkan label lama: 'pengurus', 'guru'.
--   * is_staff() versi 0021 hanya mengenali label baru → akun guru
--     gagal semua policy select master data (teachers, classes,
--     students, dorms, dst.) → scope musyrif halaqah kosong.
--   * Fix: helper berbasis role::text dengan KEDUA generasi label,
--     konvensi yang sudah dipakai is_staff_writer()/is_staff_deleter()
--     di 0022. feature_flags_select ikut diperbaiki (policy-nya
--     menanam label baru langsung, bukan lewat helper).
-- ============================================================

-- ------------------------------------------------------------
-- 1. is_staff() — label ganda, gaya 0022
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
        'pengurus', 'guru'      -- label lama (dipakai aplikasi)
      )
  );
$$;

-- ------------------------------------------------------------
-- 2. feature_flags_select — lewat helper, bukan array label baru
-- ------------------------------------------------------------
drop policy if exists "feature_flags_select" on public.feature_flags;
create policy "feature_flags_select" on public.feature_flags
  for select to authenticated
  using (public.is_staff());
