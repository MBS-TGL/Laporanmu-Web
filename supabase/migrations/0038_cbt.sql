-- ============================================================
-- 0038: CBT (Computer Based Test) — pengganti modul CBT Sidikmu
--   * cbt_questions  : bank soal pilihan ganda per class_subject
--   * cbt_exams      : sesi ujian ber-token (token hash ala suspension)
--   * cbt_attempts   : attempt santri (jawaban + skor, tanpa deleted_at)
--   * cbt_login_attempts : rate limit RPC publik
--   * RPC publik (anon) : start / save / submit — semua re-validasi token
--   * Integrasi nilai : submit upsert ke assessment_scores (assessment
--     dibuat saat publish) -> ikut generate_semester_grade & leger
--
-- Konvensi mengikuti 0014 (token sha256 + rate limit), 0028 (RLS
-- granular guru mapel), 0031 (grant RPC publik).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. cbt_questions — bank soal pilihan ganda
--    options jsonb: [{"key":"A","text":"..."}, ...]
-- ------------------------------------------------------------
create table public.cbt_questions (
  id               uuid primary key default gen_random_uuid(),
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  question         text not null,
  options          jsonb not null default '[]'::jsonb,
  answer_key       text not null check (answer_key in ('A', 'B', 'C', 'D', 'E')),
  points           numeric(5,1) not null default 1 check (points > 0),
  explanation      text,
  deleted_at       timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index cbt_questions_cs_idx
  on public.cbt_questions (class_subject_id)
  where deleted_at is null;

create trigger trg_cbt_questions_updated_at
  before update on public.cbt_questions
  for each row execute function public.set_updated_at();

alter table public.cbt_questions enable row level security;

create policy "cbt_questions_select" on public.cbt_questions
  for select to authenticated using (public.is_staff());

create policy "cbt_questions_insert" on public.cbt_questions
  for insert to authenticated with check (
    public.is_staff_writer() or public.is_class_subject_owner(class_subject_id)
  );

create policy "cbt_questions_update" on public.cbt_questions
  for update to authenticated
  using (public.is_staff_writer() or public.is_class_subject_owner(class_subject_id))
  with check (public.is_staff_writer() or public.is_class_subject_owner(class_subject_id));

create policy "cbt_questions_delete" on public.cbt_questions
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_class_subject_owner(class_subject_id));

-- ------------------------------------------------------------
-- 2. cbt_exams — sesi ujian ber-token
--    Token dibuat client-side (ala suspension): DB hanya simpan hash.
--    assessment_id diisi saat publish (assessments dibuat oleh client
--    staff dengan RLS assessments yang sudah ada).
-- ------------------------------------------------------------
create table public.cbt_exams (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  class_subject_id uuid not null references public.class_subjects (id) on delete cascade,
  duration_minutes int not null check (duration_minutes between 1 and 600),
  exam_type        text not null default 'sumatif'
    check (exam_type in ('formatif', 'sumatif', 'pts', 'pas')),
  question_count   int check (question_count is null or question_count > 0),
  shuffle_questions boolean not null default true,
  shuffle_options   boolean not null default true,
  assessment_id    uuid references public.assessments (id) on delete set null,
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

create index cbt_exams_cs_idx
  on public.cbt_exams (class_subject_id)
  where deleted_at is null;

create index cbt_exams_token_idx
  on public.cbt_exams (token_hash)
  where is_published and deleted_at is null;

create trigger trg_cbt_exams_updated_at
  before update on public.cbt_exams
  for each row execute function public.set_updated_at();

alter table public.cbt_exams enable row level security;

create policy "cbt_exams_select" on public.cbt_exams
  for select to authenticated using (public.is_staff());

create policy "cbt_exams_insert" on public.cbt_exams
  for insert to authenticated with check (
    public.is_staff_writer() or public.is_class_subject_owner(class_subject_id)
  );

create policy "cbt_exams_update" on public.cbt_exams
  for update to authenticated
  using (public.is_staff_writer() or public.is_class_subject_owner(class_subject_id))
  with check (public.is_staff_writer() or public.is_class_subject_owner(class_subject_id));

create policy "cbt_exams_delete" on public.cbt_exams
  for delete to authenticated
  using (public.is_staff_deleter() or public.is_class_subject_owner(class_subject_id));

-- ------------------------------------------------------------
-- 3. cbt_attempts — attempt santri (unique per ujian)
--    question_order jsonb: ["<qid>", ...] urutan tampil soal hasil
--    shuffle; option_order jsonb: {"<qid>": ["A","C","B"]} urutan
--    opsi per soal agar resume di perangkat lain tetap konsisten.
-- ------------------------------------------------------------
create table public.cbt_attempts (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.cbt_exams (id) on delete cascade,
  student_id     uuid not null references public.students (id) on delete cascade,
  status         text not null default 'in_progress'
    check (status in ('in_progress', 'submitted')),
  started_at     timestamptz not null default now(),
  deadline_at    timestamptz not null,
  submitted_at   timestamptz,
  score          numeric(5,1) check (score is null or (score >= 0 and score <= 100)),
  correct_count  int,
  answers        jsonb not null default '{}'::jsonb,
  question_order jsonb not null default '[]'::jsonb,
  option_order   jsonb not null default '{}'::jsonb,
  client_meta    jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint cbt_attempts_unique unique (exam_id, student_id)
);

create index cbt_attempts_exam_idx on public.cbt_attempts (exam_id, status);

create trigger trg_cbt_attempts_updated_at
  before update on public.cbt_attempts
  for each row execute function public.set_updated_at();

alter table public.cbt_attempts enable row level security;

create policy "cbt_attempts_select" on public.cbt_attempts
  for select to authenticated using (public.is_staff());

-- Pengawas boleh menghapus attempt (reset santri yang terganggu/erroneus)
drop policy if exists "cbt_attempts_delete" on public.cbt_attempts;
create policy "cbt_attempts_delete" on public.cbt_attempts
  for delete to authenticated using (public.is_staff_writer());
-- Insert/update tetap hanya lewat RPC security-definer (publik & staf)

-- ------------------------------------------------------------
-- 4. cbt_login_attempts — rate limit RPC publik (ala 0014/0027)
-- ------------------------------------------------------------
create table public.cbt_login_attempts (
  token_prefix text not null,
  student_code text,
  attempted_at timestamptz not null default now()
);

create index idx_cbt_att_prefix on public.cbt_login_attempts (token_prefix, attempted_at);

alter table public.cbt_login_attempts enable row level security;
-- Tanpa policy: hanya diakses lewat RPC security-definer

-- ------------------------------------------------------------
-- 5. Helper privat (security definer) — dibuat SEBELUM dipakai RPC
--    (body PL/pgSQL tervalidasi saat CREATE, urutan menentukan)
-- ------------------------------------------------------------

-- Validasi token -> baris exam. Raise exception bila tidak valid.
-- search_path menyertakan `extensions` (lokasi default pgcrypto di Supabase).
-- Token dinormalkan (buang tanda hubung/spasi, uppercase) agar santri boleh
-- mengetik persis seperti tampilan bergrup XXXX-XXXX-XXXX-XXXX.
create or replace function public._cbt_check_exam_token(p_token text)
returns public.cbt_exams
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_exam public.cbt_exams;
  v_norm text;
begin
  v_norm := upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g'));

  if length(v_norm) < 16 then
    raise exception 'Token ujian tidak valid';
  end if;

  select * into v_exam
  from public.cbt_exams e
  where e.token_hash = encode(digest(v_norm, 'sha256'), 'hex')
    and e.is_published
    and e.deleted_at is null
    and e.token_expires_at >= now()
  limit 1;

  if not found then
    raise exception 'Token ujian tidak valid atau sudah kedaluwarsa';
  end if;

  return v_exam;
end;
$$;

-- Cari santri aktif by NIS / NISN / kode registrasi (pola ingest mesin 0029)
create or replace function public._cbt_find_student(p_code text)
returns public.students
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.students s
  where s.deleted_at is null
    and s.status = 'active'
    and (
      upper(btrim(s.registration_code)) = upper(btrim(p_code))
      or s.nis = btrim(p_code)
      or s.nisn = btrim(p_code)
    )
  limit 1;
$$;

-- Rate limit: max 10 gagal per prefix per 10 menit
create or replace function public._cbt_rate_limited(p_prefix text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select count(*) >= 10
  from public.cbt_login_attempts
  where token_prefix = p_prefix
    and attempted_at > now() - interval '10 minutes';
$$;

create or replace function public._cbt_log_attempt(p_prefix text, p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.cbt_login_attempts (token_prefix, student_code)
  values (p_prefix, nullif(left(btrim(coalesce(p_code, '')), 20), ''));
$$;

-- ------------------------------------------------------------
-- 6. Helper finalisasi (grading server-side) — privat
--    Skor 0-100 = (poin benar / total poin) * 100; upsert ke
--    assessment_scores agar ikut generate_semester_grade & leger.
--    Exam tanpa assessment = CBT latihan (skor tidak masuk nilai).
-- ------------------------------------------------------------
create or replace function public._cbt_finalize_attempt(p_attempt_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_attempt public.cbt_attempts;
  v_exam    public.cbt_exams;
  v_correct int := 0;
  v_points  numeric := 0;
  v_max     numeric := 0;
  v_score   numeric;
  v_q       record;
begin
  select * into v_attempt from public.cbt_attempts where id = p_attempt_id;
  if not found or v_attempt.status = 'submitted' then
    return v_attempt.score;
  end if;

  select * into v_exam from public.cbt_exams where id = v_attempt.exam_id;

  for v_q in
    select q.id, q.answer_key, q.points
    from jsonb_array_elements_text(v_attempt.question_order) arr(qid)
    join public.cbt_questions q on q.id = (arr.qid)::uuid
  loop
    v_max := v_max + v_q.points;
    if coalesce(v_attempt.answers ->> v_q.id::text, '') = v_q.answer_key then
      v_correct := v_correct + 1;
      v_points := v_points + v_q.points;
    end if;
  end loop;

  v_score := case when v_max > 0 then round(v_points / v_max * 100, 1) else 0 end;

  update public.cbt_attempts
  set status = 'submitted',
      submitted_at = now(),
      score = v_score,
      correct_count = v_correct
  where id = p_attempt_id;

  -- Alirkan ke pipeline nilai
  if v_exam.assessment_id is not null then
    insert into public.assessment_scores (assessment_id, student_id, score)
    values (v_exam.assessment_id, v_attempt.student_id, v_score)
    on conflict (assessment_id, student_id)
    do update set score = excluded.score, updated_at = now();
  end if;

  return v_score;
end;
$$;

-- ------------------------------------------------------------
-- 7. RPC publik: mulai / resume attempt
--    Return jsonb: status, data santri & ujian, daftar soal TANPA
--    answer_key. Resume attempt yang lewat deadline memfinalisasi
--    otomatis dengan jawaban tersimpan.
-- ------------------------------------------------------------
create or replace function public.cbt_start_attempt(
  p_token text,
  p_student_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_exam     public.cbt_exams;
  v_student  public.students;
  v_attempt  public.cbt_attempts;
  v_prefix   text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
  v_had_attempt boolean;
  v_exam_class_id   uuid;
  v_exam_class_name text;
  v_student_class_name text;
  v_qids     uuid[];
  v_total    int;
  v_order    jsonb;
  v_optorder jsonb := '{}'::jsonb;
  v_keys     text[];
  v_q        record;
  v_opts     jsonb;
  v_result   jsonb;
begin
  -- Rate limit dulu
  if public._cbt_rate_limited(v_prefix) then
    raise exception 'Terlalu banyak percobaan. Tunggu beberapa menit lagi.';
  end if;

  begin
    v_exam := public._cbt_check_exam_token(p_token);
  exception when others then
    perform public._cbt_log_attempt(v_prefix, p_student_code);
    raise;
  end;

  if btrim(coalesce(p_student_code, '')) = '' then
    perform public._cbt_log_attempt(v_prefix, p_student_code);
    raise exception 'Masukkan NIS atau kode registrasi santri';
  end if;

  select * into v_student from public._cbt_find_student(btrim(p_student_code));
  if not found then
    perform public._cbt_log_attempt(v_prefix, p_student_code);
    raise exception 'Santri tidak ditemukan. Periksa kembali NIS atau kode registrasi.';
  end if;

  -- Anti lintas kelas: santri hanya boleh masuk ujian kelasnya sendiri
  select cs.class_id into v_exam_class_id
  from public.class_subjects cs
  where cs.id = v_exam.class_subject_id;
  if v_student.class_id is distinct from v_exam_class_id then
    select coalesce(name, '-') into v_exam_class_name from public.classes where id = v_exam_class_id;
    select coalesce(name, '-') into v_student_class_name from public.classes where id = v_student.class_id;
    perform public._cbt_log_attempt(v_prefix, p_student_code);
    raise exception 'Ujian ini hanya untuk santri kelas %. Kamu terdaftar di kelas %.',
      v_exam_class_name, v_student_class_name;
  end if;

  select * into v_attempt
  from public.cbt_attempts a
  where a.exam_id = v_exam.id and a.student_id = v_student.id;

  -- PENTING: simpan found SEBELUM select lain (select count(*) me-reset found)
  v_had_attempt := found;

  -- Sudah submit (atau lewat deadline, difinalisasi otomatis) -> kirim hasil
  if v_had_attempt and v_attempt.status = 'submitted' then
    return jsonb_build_object(
      'status', 'submitted',
      'student_name', v_student.name,
      'score', v_attempt.score,
      'correct_count', v_attempt.correct_count,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  if v_had_attempt and v_attempt.deadline_at < now() then
    perform public._cbt_finalize_attempt(v_attempt.id);
    select * into v_attempt from public.cbt_attempts where id = v_attempt.id;
    return jsonb_build_object(
      'status', 'submitted',
      'student_name', v_student.name,
      'score', v_attempt.score,
      'correct_count', v_attempt.correct_count,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  -- Soal ujian (dari bank, subset acak bila question_count diisi)
  select count(*) into v_total
  from public.cbt_questions q
  where q.class_subject_id = v_exam.class_subject_id and q.deleted_at is null;
  if v_total = 0 then
    raise exception 'Ujian ini belum memiliki soal. Hubungi pengawas.';
  end if;

  if not v_had_attempt then
    -- Urutan soal
    if v_exam.shuffle_questions then
      select array_agg(qid) into v_qids
      from (
        select q.id as qid
        from public.cbt_questions q
        where q.class_subject_id = v_exam.class_subject_id and q.deleted_at is null
        order by random()
        limit coalesce(v_exam.question_count, v_total)
      ) s;
    else
      select array_agg(qid) into v_qids
      from (
        select q.id as qid
        from public.cbt_questions q
        where q.class_subject_id = v_exam.class_subject_id and q.deleted_at is null
        order by q.created_at, q.id
        limit coalesce(v_exam.question_count, v_total)
      ) s;
    end if;

    select coalesce(jsonb_agg(to_jsonb(qid::text) order by idx), '[]'::jsonb)
      into v_order
    from unnest(v_qids) with ordinality as t(qid, idx);

    -- Urutan opsi per soal
    if v_exam.shuffle_options then
      for v_q in
        select q.id, q.options from public.cbt_questions q
        where q.id = any(v_qids)
      loop
        select array_agg(k) into v_keys
        from (
          select o->>'key' as k
          from jsonb_array_elements(v_q.options) o
          order by random()
        ) ks;
        v_optorder := v_optorder || jsonb_build_object(v_q.id::text, to_jsonb(v_keys));
      end loop;
    end if;

    insert into public.cbt_attempts
      (exam_id, student_id, deadline_at, question_order, option_order)
    values (
      v_exam.id, v_student.id,
      now() + make_interval(mins => v_exam.duration_minutes),
      v_order, v_optorder
    )
    returning * into v_attempt;
  end if;

  -- Susun daftar soal sesuai urutan attempt (TANPA answer_key)
  v_result := '[]'::jsonb;
  for v_q in
    select q.id, q.question, q.points, q.options
    from jsonb_array_elements_text(v_attempt.question_order) with ordinality as arr(qid, idx)
    join public.cbt_questions q on q.id = (arr.qid)::uuid
    order by arr.idx
  loop
    -- urutan key opsi: hasil shuffle bila ada (operator `->` = jsonb, wajib
    -- untuk jsonb_array_elements_text), fallback urutan asli bila key absen
    select coalesce(
      (select array_agg(k) from jsonb_array_elements_text(v_attempt.option_order -> v_q.id::text) k),
      (select array_agg(o->>'key') from jsonb_array_elements(v_q.options) o)
    ) into v_keys;

    select coalesce(jsonb_agg(jsonb_build_object('key', k.k, 'text', kv.txt) order by k.pos), '[]'::jsonb)
      into v_opts
    from unnest(v_keys) with ordinality as k(k, pos)
    join lateral (
      select o->>'text' as txt
      from jsonb_array_elements(v_q.options) o
      where o->>'key' = k.k
      limit 1
    ) kv on true;

    v_result := v_result || jsonb_build_object(
      'id', v_q.id,
      'question', v_q.question,
      'points', v_q.points,
      'options', v_opts
    );
  end loop;

  return jsonb_build_object(
    'status', 'in_progress',
    'student_name', v_student.name,
    'exam_title', v_exam.title,
    'exam_type', v_exam.exam_type,
    'duration_minutes', v_exam.duration_minutes,
    'deadline_at', v_attempt.deadline_at,
    'answers', v_attempt.answers,
    'warnings', coalesce(v_attempt.client_meta ->> 'warnings', '0')::int,
    'questions', v_result
  );
end;
$$;

-- ------------------------------------------------------------
-- 8. RPC publik: autosave jawaban
-- ------------------------------------------------------------
create or replace function public.cbt_save_answers(
  p_token text,
  p_student_code text,
  p_answers jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_exam    public.cbt_exams;
  v_student public.students;
  v_attempt public.cbt_attempts;
  v_prefix  text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
begin
  if public._cbt_rate_limited(v_prefix) then
    raise exception 'Terlalu banyak percobaan. Tunggu beberapa menit lagi.';
  end if;

  v_exam := public._cbt_check_exam_token(p_token);

  select * into v_student from public._cbt_find_student(btrim(coalesce(p_student_code, '')));
  if not found then
    raise exception 'Santri tidak ditemukan';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where exam_id = v_exam.id and student_id = v_student.id;

  if not found or v_attempt.status <> 'in_progress' then
    return; -- tidak ada yang perlu disimpan
  end if;

  -- Grace 60 detik setelah deadline
  if now() > v_attempt.deadline_at + interval '60 seconds' then
    return;
  end if;

  update public.cbt_attempts
  set answers = coalesce(p_answers, '{}'::jsonb)
  where id = v_attempt.id;
end;
$$;

-- ------------------------------------------------------------
-- 9. RPC publik: submit jawaban (grading + alirkan ke nilai)
-- ------------------------------------------------------------
create or replace function public.cbt_submit_attempt(
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
  v_exam    public.cbt_exams;
  v_student public.students;
  v_attempt public.cbt_attempts;
  v_prefix  text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
  v_score   numeric;
begin
  if public._cbt_rate_limited(v_prefix) then
    raise exception 'Terlalu banyak percobaan. Tunggu beberapa menit lagi.';
  end if;

  v_exam := public._cbt_check_exam_token(p_token);

  select * into v_student from public._cbt_find_student(btrim(coalesce(p_student_code, '')));
  if not found then
    raise exception 'Santri tidak ditemukan';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where exam_id = v_exam.id and student_id = v_student.id;

  if not found then
    raise exception 'Ujian belum dimulai untuk santri ini';
  end if;

  if v_attempt.status = 'submitted' then
    return jsonb_build_object(
      'score', v_attempt.score,
      'correct_count', v_attempt.correct_count,
      'already_submitted', true
    );
  end if;

  -- Grace 60 detik untuk auto-submit client saat waktu habis
  if now() > v_attempt.deadline_at + interval '60 seconds' then
    perform public._cbt_finalize_attempt(v_attempt.id);
    select * into v_attempt from public.cbt_attempts where id = v_attempt.id;
    return jsonb_build_object(
      'score', v_attempt.score,
      'correct_count', v_attempt.correct_count,
      'already_submitted', true
    );
  end if;

  update public.cbt_attempts
  set answers = coalesce(p_answers, '{}'::jsonb)
  where id = v_attempt.id;

  v_score := public._cbt_finalize_attempt(v_attempt.id);

  return jsonb_build_object(
    'score', v_score,
    'correct_count', v_attempt.correct_count,
    'already_submitted', false
  );
end;
$$;

-- ------------------------------------------------------------
-- 10. RPC publik: lapor event kecurangan (pindah tab, blur, dsb)
--     Event tersimpan di cbt_attempts.client_meta (events + warnings,
--     maks 100 event) dan dicatat ke audit_logs source SECURITY.
-- ------------------------------------------------------------
create or replace function public.cbt_report_event(
  p_token text,
  p_student_code text,
  p_event text,
  p_meta jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_exam    public.cbt_exams;
  v_student public.students;
  v_attempt public.cbt_attempts;
  v_prefix  text := left(upper(regexp_replace(btrim(coalesce(p_token, '')), '[^A-Za-z0-9]', '', 'g')), 8);
  v_events  jsonb;
  v_warnings int;
begin
  if public._cbt_rate_limited(v_prefix) then
    return jsonb_build_object('recorded', false);
  end if;

  v_exam := public._cbt_check_exam_token(p_token);

  select * into v_student from public._cbt_find_student(btrim(coalesce(p_student_code, '')));
  if not found then
    return jsonb_build_object('recorded', false);
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where exam_id = v_exam.id and student_id = v_student.id;

  if not found or v_attempt.status <> 'in_progress' then
    return jsonb_build_object('recorded', false);
  end if;

  if now() > v_attempt.deadline_at + interval '60 seconds' then
    return jsonb_build_object('recorded', false);
  end if;

  v_events := coalesce(v_attempt.client_meta -> 'events', '[]'::jsonb);
  if jsonb_array_length(v_events) >= 100 then
    v_events := v_events - 0; -- buang event tertua agar tidak tumbuh tanpa batas
  end if;
  v_events := v_events || jsonb_build_array(jsonb_build_object(
    'at', now(),
    'event', left(btrim(coalesce(p_event, '?')), 40),
    'meta', coalesce(p_meta, '{}'::jsonb)
  ));
  v_warnings := coalesce(v_attempt.client_meta ->> 'warnings', '0')::int + 1;

  update public.cbt_attempts
  set client_meta = jsonb_build_object('events', v_events, 'warnings', v_warnings)
  where id = v_attempt.id;

  insert into public.audit_logs (action, source, table_name, record_id, actor_name, new_data)
  values (
    'EXECUTE', 'SECURITY', 'cbt_attempts', v_attempt.id,
    'Santri (' || v_prefix || '…)',
    jsonb_build_object(
      'event', left(btrim(coalesce(p_event, '?')), 40),
      'exam', v_exam.title,
      'meta', coalesce(p_meta, '{}'::jsonb),
      'total_warnings', v_warnings
    )
  );

  return jsonb_build_object('recorded', true, 'warnings', v_warnings);
end;
$$;

-- ------------------------------------------------------------
-- 11. RPC staf: selesaikan paksa attempt (pengawas)
-- ------------------------------------------------------------
create or replace function public.cbt_force_submit(p_attempt_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_staff() then
    raise exception 'Hanya staf yang dapat menyelesaikan ujian paksa';
  end if;

  if not exists (select 1 from public.cbt_attempts where id = p_attempt_id) then
    raise exception 'Attempt tidak ditemukan';
  end if;

  return public._cbt_finalize_attempt(p_attempt_id);
end;
$$;

-- ------------------------------------------------------------
-- 11. Grant
-- ------------------------------------------------------------
revoke execute on function public.cbt_start_attempt(text, text) from public, anon, authenticated;
grant execute on function public.cbt_start_attempt(text, text) to anon, authenticated;

revoke execute on function public.cbt_save_answers(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cbt_save_answers(text, text, jsonb) to anon, authenticated;

revoke execute on function public.cbt_submit_attempt(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cbt_submit_attempt(text, text, jsonb) to anon, authenticated;

revoke execute on function public.cbt_report_event(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.cbt_report_event(text, text, text, jsonb) to anon, authenticated;

revoke execute on function public.cbt_force_submit(uuid) from public, anon;
grant execute on function public.cbt_force_submit(uuid) to authenticated;

-- Helper privat tidak untuk konsumsi klien
revoke execute on function public._cbt_check_exam_token(text) from public, anon, authenticated;
revoke execute on function public._cbt_find_student(text) from public, anon, authenticated;
revoke execute on function public._cbt_rate_limited(text) from public, anon, authenticated;
revoke execute on function public._cbt_log_attempt(text, text) from public, anon, authenticated;
revoke execute on function public._cbt_finalize_attempt(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 12. Feature flag modul
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.cbt', 'Modul CBT', 'module', 'Bank soal, ujian ber-token, dan pemantauan ujian', true, 25)
on conflict (key) do nothing;
