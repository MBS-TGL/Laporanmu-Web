-- ============================================================
-- 0007: RPC impor siswa massal (dipakai modul Impor CSV)
-- Input : array jsonb, tiap elemen:
--         { name, registration_code, class_id, gender?, status?, phone?, nisn?, dorm_id? }
-- Output: per-baris { row_index, ok, error }
-- ============================================================

create or replace function public.import_students(p_rows jsonb)
returns table (row_index integer, ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_index integer := 0;
  v_class_id uuid;
  v_dorm_id uuid;
begin
  if not public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau pengurus yang dapat mengimpor siswa';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows harus berupa array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      if coalesce(v_row ->> 'name', '') = '' then
        raise exception 'Nama wajib diisi';
      end if;
      if coalesce(v_row ->> 'registration_code', '') = '' then
        raise exception 'Kode registrasi wajib diisi';
      end if;

      v_class_id := null;
      if coalesce(v_row ->> 'class_id', '') = '' then
        raise exception 'Kelas wajib dipilih';
      end if;
      select c.id into v_class_id
      from public.classes c
      where c.id = (v_row ->> 'class_id')::uuid and c.deleted_at is null;
      if v_class_id is null then
        raise exception 'Kelas tidak ditemukan';
      end if;

      v_dorm_id := null;
      if coalesce(v_row ->> 'dorm_id', '') <> '' then
        select d.id into v_dorm_id
        from public.dorms d
        where d.id = (v_row ->> 'dorm_id')::uuid and d.deleted_at is null;
        if v_dorm_id is null then
          raise exception 'Asrama tidak ditemukan';
        end if;
      end if;

      insert into public.students (registration_code, name, class_id, dorm_id, gender, status, phone, nisn)
      values (
        trim(v_row ->> 'registration_code'),
        trim(v_row ->> 'name'),
        v_class_id,
        v_dorm_id,
        (v_row ->> 'gender')::public.person_gender,
        coalesce((v_row ->> 'status')::public.student_status, 'aktif'::public.student_status),
        v_row ->> 'phone',
        v_row ->> 'nisn'
      );

      row_index := v_index;
      ok := true;
      error := null;
      return next;
    exception when others then
      row_index := v_index;
      ok := false;
      error := case
        when sqlerrm like '%students_registration_code_active_unique%' then 'Kode registrasi sudah dipakai'
        when sqlerrm like '%person_gender%' then 'Gender harus L atau P'
        when sqlerrm like '%student_status%' then 'Status tidak valid'
        else sqlerrm
      end;
      return next;
    end;
  end loop;
end;
$$;

-- Hanya user terautentikasi yang boleh memanggil RPC ini
revoke execute on function public.import_students(jsonb) from public, anon;
grant execute on function public.import_students(jsonb) to authenticated;
