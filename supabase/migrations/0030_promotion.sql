-- ============================================================
-- 0030: Kenaikan kelas tahunan
--
-- Wizard naik kelas memindahkan siswa per kelas asal → kelas
-- tujuan (tahun ajaran berikutnya) sekaligus, dalam satu batch
-- yang bisa dibatalkan (undo) dari UI.
--
-- Kolom jejak di students:
--   previous_class_id  — kelas sebelum dipromosikan (untuk undo)
--   promoted_at        — waktu promosi
--   promotion_batch_id — penanda batch; undo memakai ini
--
-- Kelulusan kelas akhir TETAP lewat graduate_students (0018) —
-- RPC ini hanya untuk promosi, dipanggil bersama oleh wizard.
-- ============================================================

alter table public.students
  add column if not exists previous_class_id uuid references public.classes (id) on delete set null,
  add column if not exists promoted_at timestamptz,
  add column if not exists promotion_batch_id uuid;

create index if not exists students_promotion_batch_idx
  on public.students (promotion_batch_id)
  where promotion_batch_id is not null;

-- ------------------------------------------------------------
-- Promosi massal: p_moves = [{"student_id": "...", "class_id": "..."}]
-- Mengembalikan batch id untuk undo.
-- ------------------------------------------------------------
create or replace function public.promote_students(p_moves jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_move jsonb;
  v_student uuid;
  v_class uuid;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat menaikkan kelas';
  end if;

  if p_moves is null or jsonb_typeof(p_moves) <> 'array' or jsonb_array_length(p_moves) = 0 then
    raise exception 'Tidak ada siswa yang dipilih';
  end if;

  for v_move in select * from jsonb_array_elements(p_moves) loop
    v_student := nullif(v_move ->> 'student_id', '')::uuid;
    v_class := nullif(v_move ->> 'class_id', '')::uuid;

    if v_student is null or v_class is null then
      raise exception 'Data kenaikan kelas tidak valid';
    end if;

    if not exists (
      select 1 from public.classes c
      where c.id = v_class and c.deleted_at is null
    ) then
      raise exception 'Kelas tujuan tidak ditemukan';
    end if;

    update public.students s
       set previous_class_id = s.class_id,
           class_id = v_class,
           promoted_at = now(),
           promotion_batch_id = v_batch
     where s.id = v_student
       and s.deleted_at is null
       and s.status = 'active';
  end loop;

  return v_batch;
end;
$$;

revoke execute on function public.promote_students(jsonb) from public, anon, authenticated;
grant execute on function public.promote_students(jsonb) to authenticated;

-- ------------------------------------------------------------
-- Undo satu batch promosi: kembalikan kelas asal.
-- Siswa berstatus selain active (mis. sudah diluluskan) dilewati
-- — kelulusan dibatalkan terpisah lewat halaman Alumni.
-- Mengembalikan jumlah siswa yang dipulihkan.
-- ------------------------------------------------------------
create or replace function public.undo_promotion(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat membatalkan kenaikan kelas';
  end if;

  update public.students s
     set class_id = s.previous_class_id,
         previous_class_id = null,
         promoted_at = null,
         promotion_batch_id = null
   where s.promotion_batch_id = p_batch_id
     and s.status = 'active'
     and s.deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.undo_promotion(uuid) from public, anon, authenticated;
grant execute on function public.undo_promotion(uuid) to authenticated;
