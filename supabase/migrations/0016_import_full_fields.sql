-- ============================================================
-- 0016: RPC impor siswa — simpan SEMUA kolom yang dikumpulkan UI
--       (versi 0007 hanya menyimpan 9 kolom; sisanya diam-diam
--       dibuang: nis, nik, photo_url, tags, wali, tempat/tanggal
--       lahir, agama, alamat)
-- Input : array jsonb, tiap elemen:
--         { name, registration_code, class_id, dorm_id?, gender?,
--           status?, phone?, nisn?, nis?, nik?, photo_url?, tags?,
--           guardian_name?, guardian_relation?, birth_place?,
--           birth_date?, religion?, address? }
-- Output: per-baris { row_index, ok, error } (tidak berubah)
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
  v_tags text[];
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

      -- tags: terima array json (dari UI) atau string dipisah ';'
      v_tags := null;
      if jsonb_typeof(v_row -> 'tags') = 'array' then
        select coalesce(array_agg(trim(t)), '{}')
          into v_tags
          from jsonb_array_elements_text(v_row -> 'tags') as t
         where coalesce(trim(t), '') <> '';
      elsif coalesce(v_row ->> 'tags', '') <> '' then
        select coalesce(array_agg(trim(t)), '{}')
          into v_tags
          from unnest(string_to_array(v_row ->> 'tags', ';')) as t
         where coalesce(trim(t), '') <> '';
      end if;

      insert into public.students (
        registration_code, name, class_id, dorm_id, gender, status,
        phone, nisn, nis, nik, photo_url, tags,
        guardian_name, guardian_relation, birth_place, birth_date,
        religion, address
      ) values (
        trim(v_row ->> 'registration_code'),
        trim(v_row ->> 'name'),
        v_class_id,
        v_dorm_id,
        nullif(v_row ->> 'gender', '')::public.person_gender,
        coalesce(nullif(v_row ->> 'status', '')::public.student_status, 'aktif'::public.student_status),
        nullif(v_row ->> 'phone', ''),
        nullif(v_row ->> 'nisn', ''),
        nullif(v_row ->> 'nis', ''),
        nullif(v_row ->> 'nik', ''),
        nullif(v_row ->> 'photo_url', ''),
        v_tags,
        nullif(v_row ->> 'guardian_name', ''),
        nullif(v_row ->> 'guardian_relation', ''),
        nullif(v_row ->> 'birth_place', ''),
        nullif(v_row ->> 'birth_date', '')::date,
        nullif(v_row ->> 'religion', ''),
        nullif(v_row ->> 'address', '')
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
        when sqlerrm like '%date/time field value out of range%'
          or sqlerrm like '%invalid input syntax for type date%'
          or sqlerrm like '%invalid input syntax for type json%' then 'Tanggal lahir tidak valid (pakai YYYY-MM-DD)'
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
