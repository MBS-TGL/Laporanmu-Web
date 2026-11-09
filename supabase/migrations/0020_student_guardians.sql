-- ============================================================
-- 0020: Perluasan master siswa (PRD §6.1b)
--  - students += 10 kolom nullable dari Dapodik/form Sidikmu
--    (nama panggilan, KK, status anak, anak ke, saudara, telp rumah,
--    sekolah asal, tahun lulus, tanggal diterima, ukuran seragam)
--  - tabel student_guardians: data ayah/ibu/wali per siswa, dipisah
--    dari students agar NIK & penghasilan orang tua tidak terbaca
--    semua staff (students_select = is_staff; RLS per baris)
--  - RLS guardians: hanya developer/admin/pengurus
--  - RPC save_student_guardians: simpan 3 baris sekaligus (diff per
--    relation, soft-delete yang tidak dikirim)
-- ============================================================

alter table public.students
  add column if not exists nickname text,
  add column if not exists kk_number text,
  add column if not exists child_status text,
  add column if not exists child_number integer,
  add column if not exists siblings_count integer,
  add column if not exists home_phone text,
  add column if not exists origin_school text,
  add column if not exists origin_graduation_year integer,
  add column if not exists admitted_at date,
  add column if not exists uniform_size text;

alter table public.students
  add constraint students_child_number_check
  check (child_number is null or child_number between 1 and 50);

alter table public.students
  add constraint students_siblings_count_check
  check (siblings_count is null or siblings_count between 0 and 50);

alter table public.students
  add constraint students_origin_graduation_year_check
  check (origin_graduation_year is null or (origin_graduation_year between 1980 and 2200));

-- ============ student_guardians ============

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  relation text not null,
  name text,
  nik text,
  birth_year integer,
  education text,
  occupation text,
  income_range text,
  phone text,
  address text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Satu baris per orang per siswa (ayah/ibu/wali); soft-delete boleh dipakai ulang
create unique index student_guardians_student_relation_unique
  on public.student_guardians (student_id, relation)
  where deleted_at is null;

create index student_guardians_student_idx
  on public.student_guardians (student_id)
  where deleted_at is null;

alter table public.student_guardians
  add constraint student_guardians_relation_check
  check (relation in ('father', 'mother', 'guardian'));

alter table public.student_guardians
  add constraint student_guardians_birth_year_check
  check (birth_year is null or (birth_year between 1900 and 2200));

create trigger trg_student_guardians_updated_at
  before update on public.student_guardians
  for each row execute function public.set_updated_at();

alter table public.student_guardians enable row level security;

-- Lebih ketat dari students_select (is_staff): NIK & penghasilan orang
-- tua tidak untuk dibaca guru (PRD §6.1b keputusan 1, §13 #9)
create policy "student_guardians_select" on public.student_guardians
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

create policy "student_guardians_insert" on public.student_guardians
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

create policy "student_guardians_update" on public.student_guardians
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]));

create policy "student_guardians_delete" on public.student_guardians
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ============ RPC simpan guardians ============
-- Diff per relation: baris yang dikirim di-upsert (di-undelete bila
-- sebelumnya soft-delete), baris lama yang tidak dikirim di-soft-delete.
create or replace function public.save_student_guardians(p_student_id uuid, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_relation text;
  v_count integer := 0;
begin
  if not public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau pengurus yang dapat mengubah data orang tua';
  end if;

  if p_student_id is null then
    raise exception 'Siswa wajib dipilih';
  end if;

  if not exists (
    select 1 from public.students
    where id = p_student_id and deleted_at is null
  ) then
    raise exception 'Siswa tidak ditemukan';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows harus berupa array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_relation := coalesce(v_row ->> 'relation', '');
    if v_relation not in ('father', 'mother', 'guardian') then
      raise exception 'Hubungan orang tua harus ayah, ibu, atau wali';
    end if;
    v_count := v_count + 1;

    insert into public.student_guardians (
      student_id, relation, name, nik, birth_year, education,
      occupation, income_range, phone, address
    ) values (
      p_student_id,
      v_relation,
      nullif(v_row ->> 'name', ''),
      nullif(v_row ->> 'nik', ''),
      nullif(v_row ->> 'birth_year', '')::integer,
      nullif(v_row ->> 'education', ''),
      nullif(v_row ->> 'occupation', ''),
      nullif(v_row ->> 'income_range', ''),
      nullif(v_row ->> 'phone', ''),
      nullif(v_row ->> 'address', '')
    )
    on conflict (student_id, relation) where deleted_at is null
    do update set
      name = excluded.name,
      nik = excluded.nik,
      birth_year = excluded.birth_year,
      education = excluded.education,
      occupation = excluded.occupation,
      income_range = excluded.income_range,
      phone = excluded.phone,
      address = excluded.address;
  end loop;

  -- Soft-delete baris lama yang tidak lagi dikirim dari form
  update public.student_guardians
     set deleted_at = now()
   where student_id = p_student_id
     and deleted_at is null
     and (v_count = 0 or relation not in (
       select coalesce(r ->> 'relation', '')
       from jsonb_array_elements(p_rows) as r
     ));
end;
$$;

revoke execute on function public.save_student_guardians(uuid, jsonb) from public, anon;
grant execute on function public.save_student_guardians(uuid, jsonb) to authenticated;
