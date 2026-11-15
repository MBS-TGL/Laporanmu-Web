-- ============================================================
-- 0049: Pusat Evaluasi — engine kuesioner generik
--   * instruments          : angket (AKPD/Sosiometri/MBTI/EDOM/kustom)
--     questions jsonb: [{id, text, type:'skala'|'pilihan'|'teks'|'teman',
--       dimension, options:[{key,text}], max? (skala), maxChoices? (teman)}]
--   * instrument_responses : isian santri (unique per angket)
--   * RPC publik eval_start / eval_submit (pola CBT: token hash)
--   * flag module.evaluasi
-- ============================================================

create table public.instruments (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null
    check (kind in ('akpd', 'sosiometri', 'mbti', 'edom', 'custom')),
  title            text not null,
  description      text,
  target_class_id  uuid not null references public.classes (id) on delete cascade,
  questions        jsonb not null default '[]'::jsonb,
  token_hash       text unique,
  token_prefix     text,
  token_expires_at timestamptz,
  is_published     boolean not null default false,
  published_at     timestamptz,
  deleted_at       timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index instruments_class_idx
  on public.instruments (target_class_id)
  where deleted_at is null;

create trigger trg_instruments_updated_at
  before update on public.instruments
  for each row execute function public.set_updated_at();

alter table public.instruments enable row level security;

create policy "instruments_select" on public.instruments
  for select to authenticated using (public.is_staff());

create policy "instruments_insert" on public.instruments
  for insert to authenticated with check (public.is_staff_writer());

create policy "instruments_update" on public.instruments
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "instruments_delete" on public.instruments
  for delete to authenticated using (public.is_staff_deleter());

create table public.instrument_responses (
  id            uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments (id) on delete cascade,
  student_id    uuid not null references public.students (id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint instrument_responses_unique unique (instrument_id, student_id)
);

create index instrument_responses_instrument_idx
  on public.instrument_responses (instrument_id);

create trigger trg_instrument_responses_updated_at
  before update on public.instrument_responses
  for each row execute function public.set_updated_at();

alter table public.instrument_responses enable row level security;

create policy "instrument_responses_select" on public.instrument_responses
  for select to authenticated using (public.is_staff());
-- isian hanya lewat RPC publik (security definer)

-- ------------------------------------------------------------
-- RPC publik: mulai / lanjutkan isian
-- ------------------------------------------------------------
create or replace function public._eval_check_token(p_token text)
returns public.instruments
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_instr public.instruments;
  v_norm  text;
begin
  v_norm := upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g'));
  if length(v_norm) < 16 then
    raise exception 'Token angket tidak valid';
  end if;

  select * into v_instr
  from public.instruments i
  where i.token_hash = encode(digest(v_norm, 'sha256'), 'hex')
    and i.is_published
    and i.deleted_at is null
    and i.token_expires_at >= now()
  limit 1;

  if not found then
    raise exception 'Token angket tidak valid atau sudah kedaluwarsa';
  end if;

  return v_instr;
end;
$$;

create or replace function public.eval_start(
  p_token text,
  p_student_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_instr    public.instruments;
  v_student  public.students;
  v_resp     public.instrument_responses;
  v_prefix   text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
  v_classmates jsonb;
begin
  v_instr := public._eval_check_token(p_token);

  select * into v_student
  from public.students s
  where s.deleted_at is null and s.status = 'active'
    and (upper(btrim(s.registration_code)) = upper(btrim(p_student_code))
         or s.nis = btrim(p_student_code) or s.nisn = btrim(p_student_code))
  limit 1;
  if not found then
    raise exception 'Santri tidak ditemukan. Periksa kembali NIS atau kode registrasi.';
  end if;

  -- angket menarget satu kelas
  if v_student.class_id is distinct from v_instr.target_class_id then
    declare
      v_target text;
      v_mine   text;
    begin
      select coalesce(name, '-') into v_target from public.classes where id = v_instr.target_class_id;
      select coalesce(name, '-') into v_mine from public.classes where id = v_student.class_id;
      raise exception 'Angket ini hanya untuk kelas %. Kamu terdaftar di kelas %.', v_target, v_mine;
    end;
  end if;

  -- teman sekelas untuk soal 'teman' (sosiometri)
  select coalesce(jsonb_agg(jsonb_build_object('key', s.id, 'text', s.name) order by s.name), '[]'::jsonb)
    into v_classmates
  from public.students s
  where s.class_id = v_student.class_id and s.deleted_at is null and s.id <> v_student.id and s.status = 'active';

  select * into v_resp
  from public.instrument_responses r
  where r.instrument_id = v_instr.id and r.student_id = v_student.id;

  if found and v_resp.submitted_at is not null then
    return jsonb_build_object('status', 'submitted', 'student_name', v_student.name);
  end if;

  if not found then
    insert into public.instrument_responses (instrument_id, student_id)
    values (v_instr.id, v_student.id)
    returning * into v_resp;
  end if;

  return jsonb_build_object(
    'status', 'in_progress',
    'student_name', v_student.name,
    'instrument_title', v_instr.title,
    'kind', v_instr.kind,
    'answers', v_resp.answers,
    'classmates', v_classmates,
    'questions', v_instr.questions
  );
end;
$$;

create or replace function public.eval_submit(
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
  v_instr   public.instruments;
  v_student public.students;
begin
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

  update public.instrument_responses
  set answers = coalesce(p_answers, '{}'::jsonb),
      submitted_at = now()
  where instrument_id = v_instr.id and student_id = v_student.id;

  if not found then
    raise exception 'Angket belum dimulai untuk santri ini';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.eval_start(text, text) from public, anon, authenticated;
grant execute on function public.eval_start(text, text) to anon, authenticated;
revoke execute on function public.eval_submit(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.eval_submit(text, text, jsonb) to anon, authenticated;
revoke execute on function public._eval_check_token(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Feature flag + RBAC permission seed (client registry)
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.evaluasi', 'Pusat Evaluasi', 'module', 'Angket AKPD, Sosiometri, MBTI, EDOM, dan kuesioner kustom', true, 29)
on conflict (key) do nothing;
