-- ============================================================
-- 0047: CBT Lanjutan — tipe soal, tingkat kesulitan, essay grading
--   * cbt_questions + type ('pg' default | 'pg_multi' | 'true_false'
--     | 'matching' | 'essay'), difficulty, answer jsonb (kunci fleksibel
--     per tipe), pairs jsonb (pasangan matching)
--   * cbt_attempts + essay_scores jsonb + status 'grading'
--     (ujian ber-essay: skor PG dulu, final setelah guru menilai)
--   * RPC cbt_grade_essays (staf) + perluasan grading per tipe
--   * flag module.cbt_lanjutan
--
-- Konvensi data:
--   pg          : answer_key 'A' (kolom lama), answer null
--   pg_multi    : answer ["A","C"]
--   true_false  : answer "B" (options bawaan B=Benar S=Salah)
--   matching    : options = item kiri [{key,text}],
--                 pairs = { rights:[{key,text}], correct:{leftKey:rightKey} }
--   essay       : answer null (dinilai manual, rubrik di explanation)
-- ============================================================

alter table public.cbt_questions
  add column if not exists type text not null default 'pg'
    check (type in ('pg', 'pg_multi', 'true_false', 'matching', 'essay'));
alter table public.cbt_questions
  add column if not exists difficulty text not null default 'sedang'
    check (difficulty in ('mudah', 'sedang', 'sulit'));
alter table public.cbt_questions
  add column if not exists answer jsonb;
alter table public.cbt_questions
  add column if not exists pairs jsonb;

alter table public.cbt_attempts
  add column if not exists essay_scores jsonb;
-- perluasan status: 'grading' = menunggu nilai essay guru
alter table public.cbt_attempts
  drop constraint if exists cbt_attempts_status_check;
alter table public.cbt_attempts
  add constraint cbt_attempts_status_check
    check (status in ('in_progress', 'submitted', 'grading'));

-- Sebaran kesulitan per ujian: {"mudah":5,"sedang":3,"sulit":2}
-- Kosong = acak murni sesuai question_count.
alter table public.cbt_exams
  add column if not exists difficulty_mix jsonb not null default '{}'::jsonb;

-- ------------------------------------------------------------
-- Grading ulang (finalisasi) — per tipe soal:
--   pg/true_false : tepat = poin penuh
--   pg_multi      : partial credit = max(0, benar - salah)/kunci * poin
--   matching      : (item tepat / total item) * poin
--   essay         : 0 hingga dinilai guru (essay_scores)
-- Ujian ber-essay -> status 'grading' (skor parsial), assessment_scores
-- baru di-upsert saat seluruh essay dinilai (status 'submitted').
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
  v_has_essay boolean := false;
  v_score    numeric;
  v_q        record;
  v_resp     jsonb;
  v_keys     jsonb;
  v_right    int;
  v_wrong    int;
begin
  select * into v_attempt from public.cbt_attempts where id = p_attempt_id;
  if not found or v_attempt.status = 'submitted' then
    return v_attempt.score;
  end if;

  select * into v_exam from public.cbt_exams where id = v_attempt.exam_id;

  for v_q in
    select q.id, q.type, q.answer_key, q.answer, q.points, q.pairs
    from jsonb_array_elements_text(v_attempt.question_order) arr(qid)
    join public.cbt_questions q on q.id = (arr.qid)::uuid
  loop
    v_max := v_max + v_q.points;
    v_resp := v_attempt.answers -> v_q.id::text;

    if v_q.type = 'essay' then
      v_has_essay := true;
      -- skor essay dari essay_scores (dinilai guru)
      v_points := v_points + coalesce(
        (v_attempt.essay_scores ->> v_q.id::text)::numeric, 0);
      -- max_non_essay tidak termasuk essay
      continue;
    end if;

    if v_q.type = 'pg' then
      if coalesce(v_resp #>> '{}', '') = v_q.answer_key then
        v_correct := v_correct + 1;
        v_points := v_points + v_q.points;
      end if;
    elsif v_q.type = 'true_false' then
      if coalesce(v_resp #>> '{}', '') = coalesce(v_q.answer #>> '{}', '') then
        v_correct := v_correct + 1;
        v_points := v_points + v_q.points;
      end if;
    elsif v_q.type = 'pg_multi' then
      -- partial credit: (benar - salah) / jumlah kunci
      v_keys := coalesce(v_q.answer, '[]'::jsonb);
      v_right := 0;
      v_wrong := 0;
      if jsonb_typeof(v_resp) = 'array' and jsonb_typeof(v_keys) = 'array' then
        select count(*) into v_right
        from jsonb_array_elements_text(v_resp) r
        where r::text in (select k::text from jsonb_array_elements_text(v_keys) k);
        select count(*) into v_wrong
        from jsonb_array_elements_text(v_resp) r
        where r::text not in (select k::text from jsonb_array_elements_text(v_keys) k);
      end if;
      if v_right > 0 or v_wrong > 0 then
        v_points := v_points + round(
          greatest(0, v_right - v_wrong)::numeric /
          greatest(1, jsonb_array_length(v_keys)) * v_q.points, 1);
      end if;
    elsif v_q.type = 'matching' then
      -- pairs.correct = {leftKey: rightKey}; respons santri bentuk sama
      if jsonb_typeof(v_resp) = 'object' and jsonb_typeof(v_q.pairs -> 'correct') = 'object' then
        declare
          v_total int := 0;
          v_hit   int := 0;
          v_pair  record;
        begin
          for v_pair in
            select key, value from jsonb_each(v_q.pairs -> 'correct')
          loop
            v_total := v_total + 1;
            if v_resp ->> v_pair.key = v_pair.value #>> '{}' then
              v_hit := v_hit + 1;
            end if;
          end loop;
          v_points := v_points + round(
            v_hit::numeric / greatest(1, v_total) * v_q.points, 1);
        end;
      end if;
    end if;

  end loop;

  v_score := case when v_max > 0 then round(v_points / v_max * 100, 1) else 0 end;

  if v_has_essay then
    -- menunggu penilaian guru: skor parsial (essay belum dinilai = 0)
    update public.cbt_attempts
    set status = 'grading',
        submitted_at = now(),
        score = v_score,
        correct_count = v_correct
    where id = p_attempt_id;
    return v_score;
  end if;

  update public.cbt_attempts
  set status = 'submitted',
      submitted_at = now(),
      score = v_score,
      correct_count = v_correct
  where id = p_attempt_id;

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
-- RPC staf: nilai essay santri -> finalisasi skor saat lengkap
-- ------------------------------------------------------------
create or replace function public.cbt_grade_essays(
  p_attempt_id uuid,
  p_scores jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_attempt public.cbt_attempts;
  v_exam    public.cbt_exams;
  v_earned  numeric := 0;
  v_max     numeric := 0;
  v_essay   record;
  v_pending int := 0;
  v_score   numeric;
begin
  if not public.is_staff() then
    raise exception 'Hanya staf yang dapat menilai essay';
  end if;

  select * into v_attempt from public.cbt_attempts where id = p_attempt_id;
  if not found then
    raise exception 'Attempt tidak ditemukan';
  end if;
  if v_attempt.status not in ('grading', 'submitted') then
    raise exception 'Attempt belum mengumpulkan jawaban';
  end if;

  select * into v_exam from public.cbt_exams where id = v_attempt.exam_id;

  -- gabung skor essay lama + baru
  update public.cbt_attempts
  set essay_scores = coalesce(essay_scores, '{}'::jsonb) || coalesce(p_scores, '{}'::jsonb)
  where id = p_attempt_id;

  select * into v_attempt from public.cbt_attempts where id = p_attempt_id;

  -- poin essay: max + nilai guru (dibatasi poin maksimum); hitung yang belum dinilai
  for v_essay in
    select q.id, q.points
    from jsonb_array_elements_text(v_attempt.question_order) arr(qid)
    join public.cbt_questions q on q.id = (arr.qid)::uuid
    where q.type = 'essay'
  loop
    v_max := v_max + v_essay.points;
    if (v_attempt.essay_scores ->> v_essay.id::text) is null then
      v_pending := v_pending + 1;
    else
      v_earned := v_earned + least(
        v_essay.points,
        coalesce((v_attempt.essay_scores ->> v_essay.id::text)::numeric, 0));
    end if;
  end loop;

  -- skor non-essay dihitung ulang memakai logika grading yang sama
  -- (v_earned saat ini = poin essay; non-essay ditambahkan setelah ini)
  for v_essay in
    select q.id, q.type, q.answer_key, q.answer, q.points, q.pairs
    from jsonb_array_elements_text(v_attempt.question_order) arr(qid)
    join public.cbt_questions q on q.id = (arr.qid)::uuid
    where q.type <> 'essay'
  loop
    declare
      v_resp jsonb := v_attempt.answers -> v_essay.id::text;
      v_keys jsonb;
      v_right int;
      v_wrong int;
    begin
      if v_essay.type = 'pg' then
        if coalesce(v_resp #>> '{}', '') = v_essay.answer_key then
          v_earned := v_earned + v_essay.points;
        end if;
      elsif v_essay.type = 'true_false' then
        if coalesce(v_resp #>> '{}', '') = coalesce(v_essay.answer #>> '{}', '') then
          v_earned := v_earned + v_essay.points;
        end if;
      elsif v_essay.type = 'pg_multi' then
        v_keys := coalesce(v_essay.answer, '[]'::jsonb);
        if jsonb_typeof(v_resp) = 'array' and jsonb_typeof(v_keys) = 'array' then
          select count(*) into v_right
          from jsonb_array_elements_text(v_resp) r
          where r::text in (select k::text from jsonb_array_elements_text(v_keys) k);
          select count(*) into v_wrong
          from jsonb_array_elements_text(v_resp) r
          where r::text not in (select k::text from jsonb_array_elements_text(v_keys) k);
          v_earned := v_earned + round(
            greatest(0, v_right - v_wrong)::numeric /
            greatest(1, jsonb_array_length(v_keys)) * v_essay.points, 1);
        end if;
      elsif v_essay.type = 'matching' then
        if jsonb_typeof(v_resp) = 'object' and jsonb_typeof(v_essay.pairs -> 'correct') = 'object' then
          select count(*) into v_right
          from jsonb_each(v_essay.pairs -> 'correct') p
          where v_resp ->> p.key = p.value #>> '{}';
          select count(*) into v_wrong
          from jsonb_each(v_essay.pairs -> 'correct') p;
          v_earned := v_earned + round(
            v_right::numeric / greatest(1, v_wrong) * v_essay.points, 1);
        end if;
      end if;
    end;
  end loop;

  v_score := case when v_max > 0 then round(v_earned / v_max * 100, 1) else 0 end;

  if v_pending > 0 then
    -- masih ada essay yang belum dinilai — simpan progres saja
    update public.cbt_attempts set score = v_score where id = p_attempt_id;
    return v_score;
  end if;

  update public.cbt_attempts
  set status = 'submitted', score = v_score
  where id = p_attempt_id;

  if v_exam.assessment_id is not null then
    insert into public.assessment_scores (assessment_id, student_id, score)
    values (v_exam.assessment_id, v_attempt.student_id, v_score)
    on conflict (assessment_id, student_id)
    do update set score = excluded.score, updated_at = now();
  end if;

  return v_score;
end;
$$;

revoke execute on function public.cbt_grade_essays(uuid, jsonb) from public, anon;
grant execute on function public.cbt_grade_essays(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- cbt_start_attempt: kembalikan type/difficulty/pairs per soal;
-- shuffle opsi hanya untuk pg/pg_multi (matching/true_false urutan tetap).
-- (hanya blok pembangunan daftar soal yang berubah)
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

  v_had_attempt := found;

  if v_had_attempt and v_attempt.status = 'submitted' then
    return jsonb_build_object(
      'status', 'submitted',
      'student_name', v_student.name,
      'score', v_attempt.score,
      'correct_count', v_attempt.correct_count,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  if v_had_attempt and v_attempt.status = 'grading' then
    return jsonb_build_object(
      'status', 'grading',
      'student_name', v_student.name,
      'score', v_attempt.score,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  if v_had_attempt and v_attempt.deadline_at < now() then
    perform public._cbt_finalize_attempt(v_attempt.id);
    select * into v_attempt from public.cbt_attempts where id = v_attempt.id;
    if v_attempt.status = 'grading' then
      return jsonb_build_object(
        'status', 'grading',
        'student_name', v_student.name,
        'score', v_attempt.score,
        'submitted_at', v_attempt.submitted_at
      );
    end if;
    return jsonb_build_object(
      'status', 'submitted',
      'student_name', v_student.name,
      'score', v_attempt.score,
      'correct_count', v_attempt.correct_count,
      'submitted_at', v_attempt.submitted_at
    );
  end if;

  select count(*) into v_total
  from public.cbt_questions q
  where q.class_subject_id = v_exam.class_subject_id and q.deleted_at is null;
  if v_total = 0 then
    raise exception 'Ujian ini belum memiliki soal. Hubungi pengawas.';
  end if;

  if not v_had_attempt then
    if v_exam.shuffle_questions
       and coalesce((v_exam.difficulty_mix ->> 'mudah')::int, 0)
         + coalesce((v_exam.difficulty_mix ->> 'sedang')::int, 0)
         + coalesce((v_exam.difficulty_mix ->> 'sulit')::int, 0) > 0 then
      -- Sebaran kesulitan: pilih per tingkat sesuai komposisi, sisa diacak
      declare
        v_pool_mudah uuid[];
        v_pool_sedang uuid[];
        v_pool_sulit uuid[];
        v_pick uuid[] := '{}';
        v_want int;
        v_remaining uuid[];
      begin
        select array_agg(id) into v_pool_mudah from (
          select id from public.cbt_questions
          where class_subject_id = v_exam.class_subject_id and deleted_at is null and difficulty = 'mudah'
          order by random() limit coalesce((v_exam.difficulty_mix ->> 'mudah')::int, 0)
        ) m;
        select array_agg(id) into v_pool_sedang from (
          select id from public.cbt_questions
          where class_subject_id = v_exam.class_subject_id and deleted_at is null and difficulty = 'sedang'
          order by random() limit coalesce((v_exam.difficulty_mix ->> 'sedang')::int, 0)
        ) s2;
        select array_agg(id) into v_pool_sulit from (
          select id from public.cbt_questions
          where class_subject_id = v_exam.class_subject_id and deleted_at is null and difficulty = 'sulit'
          order by random() limit coalesce((v_exam.difficulty_mix ->> 'sulit')::int, 0)
        ) s3;
        v_pick := coalesce(v_pool_mudah, '{}') || coalesce(v_pool_sedang, '{}') || coalesce(v_pool_sulit, '{}');

        -- sisa kuota (question_count - picked) diambil acak dari soal yang belum terpilih
        v_remaining := coalesce(v_total, 0);
        if v_exam.question_count is not null and array_length(v_pick, 1) < v_exam.question_count then
          select array_agg(id) into v_remaining from (
            select id from public.cbt_questions
            where class_subject_id = v_exam.class_subject_id
              and deleted_at is null
              and not (id = any(v_pick))
            order by random()
            limit v_exam.question_count - array_length(v_pick, 1)
          ) r;
          v_pick := v_pick || coalesce(v_remaining, '{}');
        end if;
        v_qids := v_pick;
      end;
    elsif v_exam.shuffle_questions then
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

    -- Urutan opsi per soal (pg/pg_multi saja; true_false & matching tetap)
    if v_exam.shuffle_options then
      for v_q in
        select q.id, q.options from public.cbt_questions q
        where q.id = any(v_qids) and q.type in ('pg', 'pg_multi')
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

  v_result := '[]'::jsonb;
  for v_q in
    select q.id, q.question, q.points, q.options, q.type, q.difficulty, q.pairs
    from jsonb_array_elements_text(v_attempt.question_order) with ordinality as arr(qid, idx)
    join public.cbt_questions q on q.id = (arr.qid)::uuid
    order by arr.idx
  loop
    if v_q.type in ('pg', 'pg_multi') then
      select coalesce(
        (select array_agg(k) from jsonb_array_elements_text(v_attempt.option_order ->> v_q.id::text) k),
        (select array_agg(o->>'key') from jsonb_array_elements(v_q.options) o)
      ) into v_keys;
    else
      select array_agg(o->>'key') into v_keys
      from jsonb_array_elements(v_q.options) o;
    end if;

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
      'type', v_q.type,
      'difficulty', v_q.difficulty,
      'pairs', v_q.pairs,
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
    'show_explanations', v_exam.show_explanations,
    'show_leaderboard', v_exam.show_leaderboard,
    'questions', v_result
  );
end;
$$;

-- ------------------------------------------------------------
-- Feature flag
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.cbt_lanjutan', 'CBT Lanjutan', 'module', 'Tipe soal PG-multi/true-false/matching/essay, kesulitan, analitik butir, dan grading essay', true, 27)
on conflict (key) do nothing;
