-- ============================================================
-- 0018: Kelulusan & jejak alumni
--  - graduated_at / graduation_year: kapan & tahun siswa lulus
--  - last_class_id: snapshot kelas terakhir (class_id dikosongkan
--    saat lulus agar rosters kelas/asrama otomatis bersih)
--  - RPC graduate_students: luluskan massal dari halaman Data Siswa
-- ============================================================

alter table public.students
  add column if not exists graduated_at timestamptz,
  add column if not exists graduation_year integer,
  add column if not exists last_class_id uuid references public.classes (id) on delete set null;

alter table public.students
  add constraint students_graduation_year_range_check
  check (graduation_year is null or (graduation_year between 1980 and 2200));

create index if not exists students_graduated_idx
  on public.students (graduated_at desc)
  where graduated_at is not null;

-- Luluskan massal: status + jejak kelulusan, snapshot kelas terakhir,
-- kosongkan kelas & asrama (poin/raport/log tetap tersimpan per student_id).
create or replace function public.graduate_students(p_ids uuid[], p_graduation_year integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau pengurus yang dapat meluluskan siswa';
  end if;

  if p_graduation_year is null or p_graduation_year not between 1980 and 2200 then
    raise exception 'Tahun lulus tidak valid';
  end if;

  update public.students
     set status = 'lulus',
         graduated_at = now(),
         graduation_year = p_graduation_year,
         last_class_id = class_id,
         class_id = null,
         dorm_id = null
   where id = any(p_ids)
     and deleted_at is null;
end;
$$;
