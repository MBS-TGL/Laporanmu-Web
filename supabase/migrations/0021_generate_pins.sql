-- ============================================================
-- 0021: Generate PIN portal wali (massal atau per siswa)
--  - RPC generate_student_pins: buat PIN 6 digit acak untuk siswa
--    terpilih, update students.pin, dan kembalikan pasangan (id, pin)
--    agar UI bisa langsung menampilkannya di kartu portal
--  - Sebelum fitur ini PIN tidak bisa diatur dari UI sama sekali
--  - PIN disimpan plaintext — konsisten dengan check_student (0019)
--    yang membandingkan teks; hash PIN adalah tindak lanjut terpisah
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
  if not public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau pengurus yang dapat membuat PIN siswa';
  end if;

  if p_ids is null or array_length(p_ids, 1) = 0 then
    raise exception 'Pilih minimal satu siswa';
  end if;

  for v_id in select unnest(p_ids) loop
    -- lewati siswa yang tidak ada / sudah diarsipkan
    if not exists (
      select 1 from public.students
      where id = v_id and deleted_at is null
    ) then
      continue;
    end if;

    loop
      v_pin := lpad((floor(random() * 1000000))::integer::text, 6, '0');
      -- regenerasi bila kebetulan sama dengan PIN lama siswa ini
      exit when not exists (
        select 1 from public.students
        where id = v_id and pin = v_pin
      );
    end loop;

    update public.students
       set pin = v_pin
     where id = v_id;

    student_id := v_id;
    new_pin := v_pin;
    return next;
  end loop;
end;
$$;

revoke execute on function public.generate_student_pins(uuid[]) from public, anon;
grant execute on function public.generate_student_pins(uuid[]) to authenticated;
