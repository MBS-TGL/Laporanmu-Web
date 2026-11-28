-- ============================================================
-- 0073: Perbaiki generate_student_pins (kolom student_id ambigu)
--
-- Gejala: RPC generate_student_pins mengembalikan 400
--   "column reference \"student_id\" is ambiguous"
-- sehingga pembuatan PIN per santri maupun massal gagal.
--
-- Sebab: fungsi RETURNS TABLE punya parameter OUT bernama student_id,
-- sedangkan query cek duplikat PIN memakai kolom student_pins.student_id.
-- PL/pgSQL tidak bisa menentukan mana yang dimaksud.
--
-- Perbaikan: alias tabel (sp) pada query tersebut. Nama OUT tidak diubah
-- agar bentuk respons RPC tetap { student_id, new_pin } untuk frontend.
--
-- Penerapan: dashboard SQL Editor, sama seperti 0066 (jangan supabase db push).
-- ============================================================

create or replace function public.generate_student_pins(p_ids uuid[])
returns table (student_id uuid, new_pin text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pin text;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat membuat PIN siswa';
  end if;

  if p_ids is null or array_length(p_ids, 1) = 0 then
    raise exception 'Pilih minimal satu siswa';
  end if;

  for v_id in select unnest(p_ids) loop
    if not exists (
      select 1 from public.students
      where id = v_id and deleted_at is null
    ) then
      continue;
    end if;

    loop
      v_pin := lpad((floor(random() * 1000000))::integer::text, 6, '0');
      exit when not exists (
        select 1 from public.student_pins sp
        where sp.student_id = v_id and sp.pin = v_pin
      );
    end loop;

    insert into public.student_pins (student_id, pin, updated_at)
    values (v_id, v_pin, now())
    on conflict (student_id)
    do update set pin = excluded.pin, updated_at = now();

    student_id := v_id;
    new_pin := v_pin;
    return next;
  end loop;
end;
$$;

revoke execute on function public.generate_student_pins(uuid[]) from public, anon;
grant execute on function public.generate_student_pins(uuid[]) to authenticated;
