-- ============================================================
-- 0067: PPDB inbox + monitor push (pendamping 0066)
--
-- Tabel `admissions` sudah diisi webhook PPDB tetapi belum punya UI.
-- Migrasi ini menambah RPC konversi pendaftar -> santri, flag modul,
-- dan RPC admin untuk daftar/hapus langganan push portal.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Konversi pendaftar menjadi santri aktif
-- ------------------------------------------------------------
create or replace function public.convert_admission_to_student(
  p_admission_id uuid,
  p_class_id uuid,
  p_registration_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adm record;
  v_code text;
  v_student_id uuid;
  v_try integer := 0;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat mengonversi pendaftar';
  end if;

  select * into v_adm
  from public.admissions
  where id = p_admission_id and deleted_at is null;

  if not found then
    raise exception 'Pendaftar tidak ditemukan';
  end if;

  if p_class_id is null or not exists (
    select 1 from public.classes where id = p_class_id and deleted_at is null
  ) then
    raise exception 'Kelas tujuan wajib dipilih';
  end if;

  v_code := nullif(btrim(coalesce(p_registration_code, '')), '');
  if v_code is null then
    loop
      v_try := v_try + 1;
      v_code := 'REG-'
        || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
        || '-'
        || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      exit when not exists (
        select 1 from public.students
        where registration_code = v_code and deleted_at is null
      );
      if v_try > 20 then
        raise exception 'Gagal membuat kode registrasi unik';
      end if;
    end loop;
  end if;

  insert into public.students (
    registration_code, name, gender, status, class_id,
    birth_place, birth_date, origin_school, address,
    guardian_name, guardian_relation, phone
  )
  values (
    v_code, v_adm.full_name, v_adm.gender, 'active', p_class_id,
    v_adm.birth_place, v_adm.birth_date, v_adm.origin_school, v_adm.address,
    v_adm.parent_name, 'guardian', v_adm.parent_phone
  )
  returning id into v_student_id;

  if v_adm.parent_name is not null and btrim(v_adm.parent_name) <> '' then
    insert into public.student_guardians (student_id, relation, name, phone)
    values (v_student_id, 'guardian', v_adm.parent_name, v_adm.parent_phone);
  end if;

  update public.admissions
  set stage = 'accepted',
      notes = btrim(concat_ws(E'\n', notes, 'Dikonversi menjadi santri: ' || v_code)),
      updated_at = now()
  where id = p_admission_id;

  return v_student_id;
end;
$$;

revoke execute on function public.convert_admission_to_student(uuid, uuid, text) from public, anon;
grant execute on function public.convert_admission_to_student(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 2. Flag modul PPDB
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.ppdb', 'PPDB / Pendaftar', 'module',
   'Kotak masuk pendaftar dari webhook PPDB dan konversi menjadi santri aktif', true, 40)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 3. RPC admin: langganan push portal
-- ------------------------------------------------------------
create or replace function public.admin_push_subscriptions()
returns table (
  id uuid,
  student_id uuid,
  student_name text,
  endpoint text,
  user_agent text,
  last_used_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    raise exception 'Hanya developer atau admin yang dapat melihat langganan push';
  end if;

  return query
  select ps.id, ps.student_id, s.name, ps.endpoint, ps.user_agent,
         ps.last_used_at, ps.created_at
  from public.push_subscriptions ps
  join public.students s on s.id = ps.student_id
  order by ps.last_used_at desc
  limit 500;
end;
$$;

revoke execute on function public.admin_push_subscriptions() from public, anon;
grant execute on function public.admin_push_subscriptions() to authenticated;

create or replace function public.admin_delete_push(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    raise exception 'Hanya developer atau admin yang dapat menghapus langganan push';
  end if;

  delete from public.push_subscriptions where id = p_id;
end;
$$;

revoke execute on function public.admin_delete_push(uuid) from public, anon;
grant execute on function public.admin_delete_push(uuid) to authenticated;
