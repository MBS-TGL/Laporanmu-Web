-- ============================================================
-- 0068: Scope & rate limit RPC sensitif (pendamping 0066/0067)
--
-- 1. cbt_force_submit / cbt_grade_essays: guru hanya boleh menyentuh
--    attempt dari kelas-mapel yang ia ampu (sebelumnya semua staf).
--    Implementasi wrapper: fungsi lama di-revoke, klien memanggil
--    versi *_checked yang memeriksa kepemilikan lalu mendelegasikan.
-- 2. eval_start / eval_submit: rate limit per token + submit wajib
--    berasal dari santri di kelas target angket.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Wrapper CBT dengan cek kepemilikan class_subject
-- ------------------------------------------------------------
create or replace function public.cbt_force_submit_checked(p_attempt_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_class_subject uuid;
begin
  select e.class_subject_id
    into v_class_subject
  from public.cbt_attempts a
  join public.cbt_exams e on e.id = a.exam_id
  where a.id = p_attempt_id;

  if v_class_subject is null then
    raise exception 'Attempt tidak ditemukan';
  end if;

  if not (
    public.has_any_role(array['developer', 'admin']::public.app_role[])
    or public.is_class_subject_owner(v_class_subject)
  ) then
    raise exception 'Hanya guru pengampu kelas-mapel ini yang dapat menyelesaikan ujian paksa';
  end if;

  return public.cbt_force_submit(p_attempt_id);
end;
$$;

revoke execute on function public.cbt_force_submit_checked(uuid) from public, anon;
grant execute on function public.cbt_force_submit_checked(uuid) to authenticated;

revoke execute on function public.cbt_force_submit(uuid) from public, anon, authenticated;

create or replace function public.cbt_grade_essays_checked(
  p_attempt_id uuid,
  p_scores jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_class_subject uuid;
begin
  select e.class_subject_id
    into v_class_subject
  from public.cbt_attempts a
  join public.cbt_exams e on e.id = a.exam_id
  where a.id = p_attempt_id;

  if v_class_subject is null then
    raise exception 'Attempt tidak ditemukan';
  end if;

  if not (
    public.has_any_role(array['developer', 'admin']::public.app_role[])
    or public.is_class_subject_owner(v_class_subject)
  ) then
    raise exception 'Hanya guru pengampu kelas-mapel ini yang dapat menilai essay';
  end if;

  return public.cbt_grade_essays(p_attempt_id, p_scores);
end;
$$;

revoke execute on function public.cbt_grade_essays_checked(uuid, jsonb) from public, anon;
grant execute on function public.cbt_grade_essays_checked(uuid, jsonb) to authenticated;

revoke execute on function public.cbt_grade_essays(uuid, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Rate limit angket (eval_*)
-- ------------------------------------------------------------
create table if not exists public.eval_login_attempts (
  token_prefix text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists eval_login_attempts_idx
  on public.eval_login_attempts (token_prefix, attempted_at);

alter table public.eval_login_attempts enable row level security;
-- Tanpa policy: hanya security-definer wrapper yang menulis/membaca.

create or replace function public.eval_start_checked(
  p_token text,
  p_student_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prefix text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
begin
  delete from public.eval_login_attempts where attempted_at < now() - interval '1 day';
  insert into public.eval_login_attempts (token_prefix) values (v_prefix);

  if (
    select count(*) from public.eval_login_attempts
    where token_prefix = v_prefix
      and attempted_at > now() - interval '10 minutes'
  ) > 20 then
    raise exception 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.';
  end if;

  return public.eval_start(p_token, p_student_code);
end;
$$;

revoke execute on function public.eval_start_checked(text, text) from public;
grant execute on function public.eval_start_checked(text, text) to anon, authenticated;
revoke execute on function public.eval_start(text, text) from public, anon, authenticated;

create or replace function public.eval_submit_checked(
  p_token text,
  p_student_code text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prefix  text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
  v_instr   public.instruments;
  v_student public.students;
begin
  delete from public.eval_login_attempts where attempted_at < now() - interval '1 day';
  insert into public.eval_login_attempts (token_prefix) values (v_prefix);

  if (
    select count(*) from public.eval_login_attempts
    where token_prefix = v_prefix
      and attempted_at > now() - interval '10 minutes'
  ) > 20 then
    raise exception 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.';
  end if;

  v_instr := public._eval_check_token(p_token);

  select * into v_student
  from public.students s
  where s.deleted_at is null and s.status = 'active'
    and (upper(btrim(s.registration_code)) = upper(btrim(p_student_code))
         or s.nis = btrim(p_student_code) or s.nisn = btrim(p_student_code))
  limit 1;

  if not found then
    raise exception 'Santri tidak ditemukan';
  end if;

  if v_student.class_id is distinct from v_instr.target_class_id then
    raise exception 'Angket ini hanya untuk santri di kelas target.';
  end if;

  return public.eval_submit(p_token, p_student_code, p_answers);
end;
$$;

revoke execute on function public.eval_submit_checked(text, text, jsonb) from public;
grant execute on function public.eval_submit_checked(text, text, jsonb) to anon, authenticated;
revoke execute on function public.eval_submit(text, text, jsonb) from public, anon, authenticated;
