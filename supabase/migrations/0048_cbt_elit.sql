-- ============================================================
-- 0048: CBT Elit (P6) — review jawaban, remedial, leaderboard, WA
--   * cbt_exams.show_explanations : review jawaban pasca-ujian
--   * cbt_exams.show_leaderboard  : papan peringkat anonim
--   * cbt_exams.is_remedial_of    : penanda ujian remedial
--   * RPC publik cbt_review_answers(p_token, p_student_code)
--   * flag module.cbt_elite + toggle auto_cbt_wa
-- ============================================================

alter table public.cbt_exams
  add column if not exists show_explanations boolean not null default false;
alter table public.cbt_exams
  add column if not exists show_leaderboard boolean not null default false;
alter table public.cbt_exams
  add column if not exists is_remedial_of uuid references public.cbt_exams (id) on delete set null;

-- ------------------------------------------------------------
-- RPC publik: review jawaban santri pasca-ujian
-- (hanya jika show_explanations aktif; attempt sudah final)
-- ------------------------------------------------------------
create or replace function public.cbt_review_answers(
  p_token text,
  p_student_code text
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
  v_result  jsonb;
begin
  if public._cbt_rate_limited(v_prefix) then
    raise exception 'Terlalu banyak percobaan. Tunggu beberapa menit lagi.';
  end if;

  v_exam := public._cbt_check_exam_token(p_token);
  if not v_exam.show_explanations then
    raise exception 'Guru belum mengaktifkan review jawaban untuk ujian ini';
  end if;

  select * into v_student from public._cbt_find_student(btrim(coalesce(p_student_code, '')));
  if not found then
    raise exception 'Santri tidak ditemukan';
  end if;

  select * into v_attempt
  from public.cbt_attempts
  where exam_id = v_exam.id and student_id = v_student.id
    and status in ('submitted', 'grading');

  if not found then
    raise exception 'Belum ada jawaban terkumpul untuk direview';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'question', q.question,
      'response', v_attempt.answers -> q.id::text,
      'correct', case
        when q.type = 'pg' then q.answer_key
        when q.type = 'true_false' then q.answer #>> '{}'
        when q.type = 'pg_multi' then q.answer
        when q.type = 'matching' then q.pairs -> 'correct'
        else null
      end,
      'explanation', case when v_exam.show_explanations then q.explanation else null end,
      'points', q.points,
      'essay_score', v_attempt.essay_scores -> q.id::text
    ) order by arr.idx
  ) into v_result
  from jsonb_array_elements_text(v_attempt.question_order) with ordinality as arr(qid, idx)
  join public.cbt_questions q on q.id = (arr.qid)::uuid;

  return jsonb_build_object(
    'review', v_result,
    'score', v_attempt.score,
    'correct_count', v_attempt.correct_count
  );
end;
$$;

revoke execute on function public.cbt_review_answers(text, text) from public, anon, authenticated;
grant execute on function public.cbt_review_answers(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- RPC publik: papan peringkat anonim (hanya jika toggle aktif)
-- ------------------------------------------------------------
create or replace function public.cbt_leaderboard(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_exam public.cbt_exams;
  v_rows jsonb;
begin
  v_exam := public._cbt_check_exam_token(p_token);
  if not v_exam.show_leaderboard then
    return jsonb_build_object('enabled', false, 'board', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('initial', left(split_part(s.name, ' ', 1), 1) || left(split_part(s.name, ' ', 2), 1),
                       'score', a.score)
    order by a.score desc
  ), '[]'::jsonb)
  into v_rows
  from public.cbt_attempts a
  join public.students s on s.id = a.student_id
  where a.exam_id = v_exam.id and a.status = 'submitted'
  limit 10;

  return jsonb_build_object('enabled', true, 'board', v_rows);
end;
$$;

revoke execute on function public.cbt_leaderboard(text) from public, anon, authenticated;
grant execute on function public.cbt_leaderboard(text) to anon, authenticated;

-- ------------------------------------------------------------
-- Flag + toggle WA
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.cbt_elite', 'CBT Elit', 'module', 'Analitik butir, review jawaban, remedial 1-klik, papan peringkat, WA skor', true, 28)
on conflict (key) do nothing;

alter table public.wa_settings
  add column if not exists auto_cbt_wa boolean not null default false;

create or replace function public.wa_settings_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.wa_settings;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    return jsonb_build_object('error', 'Tidak punya akses');
  end if;

  select * into v_row from public.wa_settings where id = true;
  return jsonb_build_object(
    'configured', coalesce(v_row.fonnte_token, '') <> '',
    'sender_name', v_row.sender_name,
    'auto_violation_wa', v_row.auto_violation_wa,
    'auto_bk_wa', v_row.auto_bk_wa,
    'auto_savings_wa', v_row.auto_savings_wa,
    'auto_spp_wa', v_row.auto_spp_wa,
    'auto_cbt_wa', v_row.auto_cbt_wa,
    'updated_at', v_row.updated_at
  );
end;
$$;

create or replace function public.update_wa_settings(
  p_token text,
  p_sender_name text,
  p_auto_violation boolean default null,
  p_auto_bk boolean default null,
  p_auto_savings boolean default null,
  p_auto_spp boolean default null,
  p_auto_cbt boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin']::public.app_role[]) then
    return jsonb_build_object('error', 'Hanya developer/admin dapat mengubah pengaturan WA');
  end if;

  update public.wa_settings set
    fonnte_token = coalesce(nullif(trim(p_token), ''), fonnte_token),
    sender_name  = nullif(trim(p_sender_name), ''),
    auto_violation_wa = coalesce(p_auto_violation, auto_violation_wa),
    auto_bk_wa        = coalesce(p_auto_bk, auto_bk_wa),
    auto_savings_wa   = coalesce(p_auto_savings, auto_savings_wa),
    auto_spp_wa       = coalesce(p_auto_spp, auto_spp_wa),
    auto_cbt_wa       = coalesce(p_auto_cbt, auto_cbt_wa),
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;
