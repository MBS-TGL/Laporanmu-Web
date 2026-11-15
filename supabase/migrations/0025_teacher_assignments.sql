-- ============================================================
-- 0025: Bulk Assign Mapel dari Sisi Guru
--   * RPC save_teacher_assignments() — assign/unassign satu guru
--     ke (kelas, mapel) dalam jumlah besar, tahun ajaran tertentu
--   * Perbaikan helper RLS 0024 — join profiles via teachers.profile_id
--     (bukan p.id = t.id, mengikuti konvensi 0003)
--
-- Konvensi: mengikuti 0022/0024 (helper teks, soft delete, RLS matrix)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Perbaikan helper RLS 0024 — join via profile_id
-- ------------------------------------------------------------
create or replace function public.is_homeroom_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.teachers t on t.id = c.homeroom_teacher_id
    join public.profiles p on p.id = t.profile_id
    where c.id = p_class_id
      and c.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

create or replace function public.is_class_subject_teacher(
  p_class_id uuid,
  p_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.class_subjects cs
    join public.teachers t on t.id = cs.teacher_id
    join public.profiles p on p.id = t.profile_id
    where cs.class_id = p_class_id
      and cs.subject_id = p_subject_id
      and cs.deleted_at is null
      and t.deleted_at is null
      and p.id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 2. RPC: save_teacher_assignments — bulk assign dari sisi guru
--    rows = [{class_id, subject_id, assigned}]
--    assigned=true  -> upsert baris aktif, teacher_id = guru ini
--                      (overwrite guru lain yang memegang)
--    assigned=false -> soft-delete HANYA jika teacher_id = guru ini
--                      (tidak menyentuh assignment guru lain)
-- ------------------------------------------------------------
create or replace function public.save_teacher_assignments(
  p_teacher_id uuid,
  p_academic_year_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  -- Validasi role
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('developer', 'admin', 'pengurus', 'manager')
  ) then
    raise exception 'Hanya staff tertentu yang boleh mengatur beban mengajar';
  end if;

  -- Validasi guru exists
  if not exists (
    select 1 from public.teachers
    where id = p_teacher_id and deleted_at is null
  ) then
    raise exception 'Guru tidak ditemukan';
  end if;

  -- Validasi tahun ajaran exists
  if not exists (
    select 1 from public.academic_years
    where id = p_academic_year_id and deleted_at is null
  ) then
    raise exception 'Tahun ajaran tidak ditemukan';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if coalesce(v_row->>'assigned', 'true')::boolean then
      -- Assign: upsert baris aktif, set/overwrite teacher_id
      insert into public.class_subjects (class_id, subject_id, teacher_id, academic_year_id, deleted_at)
      values (
        (v_row->>'class_id')::uuid,
        (v_row->>'subject_id')::uuid,
        p_teacher_id,
        p_academic_year_id,
        null
      )
      on conflict (class_id, subject_id, academic_year_id) where deleted_at is null
      do update set
        teacher_id = p_teacher_id,
        deleted_at = null;
    else
      -- Unassign: soft-delete hanya baris milik guru ini
      update public.class_subjects
      set deleted_at = now()
      where class_id = (v_row->>'class_id')::uuid
        and subject_id = (v_row->>'subject_id')::uuid
        and academic_year_id = p_academic_year_id
        and teacher_id = p_teacher_id
        and deleted_at is null;
    end if;
  end loop;
end;
$$;

revoke execute on function public.save_teacher_assignments(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.save_teacher_assignments(uuid, uuid, jsonb)
  to authenticated;
