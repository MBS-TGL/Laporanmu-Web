-- ============================================================
-- 0031: Operasional Harian — Fase 2 PRD (§6.4, §6.5, §6.6)
--   * time_slots          : slot jam pelajaran (Jam 1, 2, dst) per tahun ajaran
--   * teacher_attendance  : log kehadiran harian guru (H/S/I/T)
--   * official_letters    : surat resmi BK (panggilan/pujian) + token verifikasi
--   * profile_pins        : PIN petugas untuk otorisasi transaksi keuangan (hashed)
--   * verify_staff_pin()  : RPC verifikasi PIN staf
--   * set_staff_pin()     : RPC pasang/ubah PIN staf
--   * verify_official_letter() : RPC publik verifikasi keaslian surat via token
--   * check_student()     : upgrade menambahkan rapor semester umum
-- ============================================================

-- ------------------------------------------------------------
-- 1. time_slots — Slot jam KBM per tahun ajaran
-- ------------------------------------------------------------
create table if not exists public.time_slots (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name             text not null, -- contoh: "Jam Ke-1", "Istirahat", "Sholat Dzuhur"
  start_time       time not null,
  end_time         time not null,
  sort_order       smallint not null default 0,
  is_break         boolean not null default false,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint time_slots_time_check check (end_time > start_time)
);

create index if not exists time_slots_year_idx
  on public.time_slots (academic_year_id, sort_order)
  where deleted_at is null;

create trigger trg_time_slots_updated_at
  before update on public.time_slots
  for each row execute function public.set_updated_at();

alter table public.time_slots enable row level security;

create policy "time_slots_select" on public.time_slots
  for select to authenticated using (public.is_staff());

create policy "time_slots_insert" on public.time_slots
  for insert to authenticated with check (public.is_staff_writer());

create policy "time_slots_update" on public.time_slots
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "time_slots_delete" on public.time_slots
  for delete to authenticated using (public.is_staff_deleter());


-- ------------------------------------------------------------
-- 2. teacher_attendance — Log kehadiran harian guru
-- ------------------------------------------------------------
create table if not exists public.teacher_attendance (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.teachers (id) on delete cascade,
  date        date not null default current_date,
  status      text not null check (status in ('hadir', 'sakit', 'izin', 'tugas_luar')),
  note        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint teacher_attendance_unique unique (teacher_id, date)
);

create index if not exists teacher_attendance_date_idx
  on public.teacher_attendance (date desc);

create trigger trg_teacher_attendance_updated_at
  before update on public.teacher_attendance
  for each row execute function public.set_updated_at();

alter table public.teacher_attendance enable row level security;

create policy "teacher_attendance_select" on public.teacher_attendance
  for select to authenticated using (public.is_staff());

create policy "teacher_attendance_insert" on public.teacher_attendance
  for insert to authenticated with check (public.is_staff_writer());

create policy "teacher_attendance_update" on public.teacher_attendance
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "teacher_attendance_delete" on public.teacher_attendance
  for delete to authenticated using (public.is_staff_deleter());


-- ------------------------------------------------------------
-- 3. official_letters — Surat resmi BK (panggilan, peringatan, pujian)
-- ------------------------------------------------------------
create table if not exists public.official_letters (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students (id) on delete cascade,
  type         text not null check (type in ('panggilan', 'peringatan', 'pujian')),
  letter_no    text not null unique,
  subject      text not null,
  body_text    text not null,
  verify_token text not null unique,
  issued_date  date not null default current_date,
  related_report_id uuid references public.reports (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists official_letters_student_idx
  on public.official_letters (student_id);

create index if not exists official_letters_token_idx
  on public.official_letters (verify_token);

create trigger trg_official_letters_updated_at
  before update on public.official_letters
  for each row execute function public.set_updated_at();

alter table public.official_letters enable row level security;

create policy "official_letters_select" on public.official_letters
  for select to authenticated using (public.is_staff());

create policy "official_letters_insert" on public.official_letters
  for insert to authenticated with check (public.is_staff_writer());

create policy "official_letters_update" on public.official_letters
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "official_letters_delete" on public.official_letters
  for delete to authenticated using (public.is_staff_deleter());


-- ------------------------------------------------------------
-- 4. profile_pins — PIN Petugas untuk transaksi tabungan/keuangan
-- ------------------------------------------------------------
create table if not exists public.profile_pins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  pin_hash   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_pins enable row level security;

-- Hanya pemilik akun yang bisa baca/tulis PIN-nya sendiri
create policy "profile_pins_self" on public.profile_pins
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- RPC untuk pasang / ubah PIN staf
create or replace function public.set_staff_pin(p_new_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(p_new_pin)) < 4 or length(trim(p_new_pin)) > 8 then
    raise exception 'PIN harus terdiri dari 4 sampai 8 digit';
  end if;

  insert into public.profile_pins (profile_id, pin_hash, updated_at)
  values (auth.uid(), crypt(trim(p_new_pin), gen_salt('bf')), now())
  on conflict (profile_id)
  do update set
    pin_hash = crypt(trim(p_new_pin), gen_salt('bf')),
    updated_at = now();
end;
$$;

revoke execute on function public.set_staff_pin(text) from public, anon;
grant execute on function public.set_staff_pin(text) to authenticated;

-- RPC untuk verifikasi PIN staf saat transaksi
create or replace function public.verify_staff_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash
  from public.profile_pins
  where profile_id = auth.uid();

  if not found then
    return false;
  end if;

  return v_hash = crypt(trim(p_pin), v_hash);
end;
$$;

revoke execute on function public.verify_staff_pin(text) from public, anon;
grant execute on function public.verify_staff_pin(text) to authenticated;


-- ------------------------------------------------------------
-- 5. RPC publik verifikasi keaslian surat resmi via token
-- ------------------------------------------------------------
create or replace function public.verify_official_letter(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_letter record;
begin
  select
    ol.id,
    ol.letter_no,
    ol.type,
    ol.subject,
    ol.body_text,
    ol.issued_date,
    s.name as student_name,
    s.registration_code,
    c.name as class_name
  into v_letter
  from public.official_letters ol
  join public.students s on s.id = ol.student_id
  left join public.classes c on c.id = s.class_id
  where ol.verify_token = trim(p_token)
    and ol.deleted_at is null;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Surat tidak ditemukan atau token tidak valid.');
  end if;

  return jsonb_build_object(
    'valid', true,
    'letter_no', v_letter.letter_no,
    'type', v_letter.type,
    'subject', v_letter.subject,
    'body_text', v_letter.body_text,
    'issued_date', v_letter.issued_date,
    'student_name', v_letter.student_name,
    'registration_code', v_letter.registration_code,
    'class_name', v_letter.class_name
  );
end;
$$;

revoke execute on function public.verify_official_letter(text) from public;
grant execute on function public.verify_official_letter(text) to anon, authenticated;


-- ------------------------------------------------------------
-- 6. Upgrade check_student — sertakan Rapor Semester Umum
-- ------------------------------------------------------------
create or replace function public.check_student(p_code text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student record;
  v_result jsonb;
  v_prefix text;
  v_failures integer;
begin
  if p_code is null or p_pin is null or length(trim(p_code)) = 0 or length(trim(p_pin)) = 0 then
    return jsonb_build_object('error', 'Kode registrasi dan PIN wajib diisi');
  end if;

  v_prefix := upper(trim(p_code));

  select count(*) into v_failures
  from public.guardian_login_attempts
  where code_prefix = v_prefix
    and attempted_at > now() - interval '10 minutes';

  if v_failures >= 10 then
    return jsonb_build_object(
      'error', 'Terlalu banyak percobaan. Coba lagi dalam 10 menit.'
    );
  end if;

  select s.id, s.name, s.registration_code, s.nisn, s.gender, s.status,
         s.total_points, s.photo_url,
         c.name as class_name,
         d.name as dorm_name
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.dorms d on d.id = s.dorm_id
  where upper(trim(s.registration_code)) = v_prefix
    and s.pin = trim(p_pin)
    and s.deleted_at is null
  limit 1;

  if not found then
    perform public._guardian_log_failure(p_code);
    return jsonb_build_object('error', 'Kode registrasi atau PIN salah');
  end if;

  delete from public.guardian_login_attempts where code_prefix = v_prefix;

  select jsonb_build_object(
    'student', to_jsonb(v_student),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'points', r.points, 'notes', r.notes,
        'reported_at', r.reported_at, 'rule_name', pr.name
      ) order by r.reported_at desc), '[]'::jsonb)
      from public.reports r
      left join public.point_rules pr on pr.id = r.rule_id
      where r.student_id = v_student.id
    ),
    'report_cards', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month, 'year', m.year,
        'character_score', m.character_score, 'worship_score', m.worship_score,
        'cleanliness_score', m.cleanliness_score, 'quran_score', m.quran_score,
        'language_score', m.language_score, 'notes', m.notes
      ) order by m.year desc, m.month desc), '[]'::jsonb)
      from public.student_monthly_reports m
      where m.student_id = v_student.id
    ),
    'semester_reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'semester', sr.semester,
        'academic_year', ay.name,
        'scores', sr.scores,
        'extras', sr.extras
      ) order by ay.name desc, sr.semester desc), '[]'::jsonb)
      from public.student_semester_reports sr
      join public.academic_years ay on ay.id = sr.academic_year_id
      where sr.student_id = v_student.id
        and sr.report_type = 'general'
    ),
    'attendance', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'year', a.year, 'month', a.month,
        'hadir', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'H'),
        'sakit', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'S'),
        'izin', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'I'),
        'alpa', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'A'),
        'pulang', (select count(*) from jsonb_object_keys(a.days) k where a.days ->> k = 'P')
      ) order by a.year desc, a.month desc), '[]'::jsonb)
      from (
        select * from public.student_attendance sa
        where sa.student_id = v_student.id
        order by sa.year desc, sa.month desc
        limit 3
      ) a
    ),
    'suspensions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sp.id, 'jenjang', sp.jenjang,
        'start_date', sp.start_date, 'end_date', sp.end_date,
        'status', sp.status
      ) order by sp.start_date desc), '[]'::jsonb)
      from public.suspensions sp
      where sp.student_id = v_student.id
    ),
    'savings', (
      select jsonb_build_object(
        'balance', sa.balance,
        'status', sa.status,
        'opened_at', sa.opened_at,
        'transactions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', t.id, 'kind', t.kind, 'amount', t.amount,
            'balance_after', t.balance_after, 'note', t.note,
            'occurred_at', t.occurred_at
          ) order by t.occurred_at desc, t.created_at desc)
          from (
            select st.id, st.kind, st.amount, st.balance_after,
                   st.note, st.occurred_at, st.created_at
            from public.savings_transactions st
            where st.account_id = sa.id
            order by st.occurred_at desc, st.created_at desc
            limit 30
          ) t
        ), '[]'::jsonb)
      )
      from public.savings_accounts sa
      where sa.student_id = v_student.id
        and sa.deleted_at is null
      order by sa.opened_at desc
      limit 1
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;
