-- ============================================================
-- 0021: Standardize Indonesian naming to English
--   * rename columns (nilai_*, hari_*, berat/tinggi_badan, catatan,
--     pelanggaran, prestasi, pengasuh_name, jenjang)
--   * translate stored status values in CHECK-constrained columns
--   * remap JSONB keys (semester reports scores/extras)
--   * rename enum values (ALTER TYPE ... RENAME VALUE keeps Oids,
--     so existing policies/defaults keep working)
--   * recreate every function whose body embedded renamed literals
--     or renamed columns; verify_raport -> verify_report
-- Domain terms are intentionally kept: musyrif, hafalan, murojaah,
-- ziyadah, sholat, wafa, jilid, pondok, nis/nisn/nik/nbm/nuptk, UKS,
-- Kesantrian, SMP/SMA, attendance codes H|S|I|A|P.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Column renames
-- ------------------------------------------------------------
alter table public.student_monthly_reports
  rename column nilai_akhlak to character_score;
alter table public.student_monthly_reports
  rename column nilai_ibadah to worship_score;
alter table public.student_monthly_reports
  rename column nilai_kebersihan to cleanliness_score;
alter table public.student_monthly_reports
  rename column nilai_quran to quran_score;
alter table public.student_monthly_reports
  rename column nilai_bahasa to language_score;
alter table public.student_monthly_reports
  rename column berat_badan to weight_kg;
alter table public.student_monthly_reports
  rename column tinggi_badan to height_cm;
alter table public.student_monthly_reports
  rename column hari_sakit to sick_days;
alter table public.student_monthly_reports
  rename column hari_izin to excused_days;
alter table public.student_monthly_reports
  rename column hari_alpa to absent_days;
alter table public.student_monthly_reports
  rename column hari_pulang to early_leave_days;
alter table public.student_monthly_reports
  rename column catatan to notes;
alter table public.student_monthly_reports
  rename column pelanggaran to violations;
alter table public.student_monthly_reports
  rename column prestasi to achievements;

alter table public.student_monthly_reports
  rename constraint student_monthly_reports_nilai_range to student_monthly_reports_score_range;
alter table public.student_monthly_reports
  rename constraint student_monthly_reports_hari_range to student_monthly_reports_days_range;

alter table public.school_settings
  rename column pengasuh_name to caretaker_name;

alter table public.suspensions
  rename column jenjang to level;

alter table public.suspension_log_templates
  rename column jenjang to level;

-- ------------------------------------------------------------
-- 2) Translated status values in CHECK-constrained text columns
-- ------------------------------------------------------------
alter table public.suspensions drop constraint suspensions_status_check;
drop index if exists idx_sus_active;
update public.suspensions set status = 'active'    where status = 'aktif';
update public.suspensions set status = 'completed' where status = 'selesai';
update public.suspensions set status = 'cancelled' where status = 'dibatalkan';
alter table public.suspensions
  alter column status set default 'active',
  add constraint suspensions_status_check
    check (status in ('active', 'completed', 'cancelled'));
create index idx_sus_active on public.suspensions (status) where status = 'active';

alter table public.suspension_task_submissions
  drop constraint suspension_task_submissions_status_check;
update public.suspension_task_submissions set status = 'pending'   where status = 'belum';
update public.suspension_task_submissions set status = 'submitted' where status = 'dikerjakan';
update public.suspension_task_submissions set status = 'graded'    where status = 'dinilai';
alter table public.suspension_task_submissions
  alter column status set default 'submitted',
  add constraint suspension_task_submissions_status_check
    check (status in ('pending', 'submitted', 'graded'));

alter table public.health_logs drop constraint health_logs_status_check;
update public.health_logs set status = 'Dormitory' where status = 'Asrama';
update public.health_logs set status = 'Returned'  where status = 'Kembali';
alter table public.health_logs
  alter column status set default 'Returned',
  add constraint health_logs_status_check
    check (status in ('UKS', 'Dormitory', 'Returned'));

alter table public.student_semester_reports
  drop constraint student_semester_reports_report_type_check;
update public.student_semester_reports set report_type = 'monthly'        where report_type = 'bulanan';
update public.student_semester_reports set report_type = 'pondok_oral'    where report_type = 'pondok_lisan';
update public.student_semester_reports set report_type = 'pondok_subject' where report_type = 'pondok_mapel';
update public.student_semester_reports set report_type = 'general'        where report_type = 'umum';
alter table public.student_semester_reports
  add constraint student_semester_reports_report_type_check
    check (report_type in ('pondok_oral', 'pondok_subject', 'general'));

alter table public.announcements drop constraint announcements_category_check;
update public.announcements set category = 'Announcement' where category = 'Pengumuman';
update public.announcements set category = 'Information'  where category = 'Informasi';
update public.announcements set category = 'Academic'     where category = 'Akademik';
update public.announcements set category = 'Emergency'    where category = 'Darurat';
alter table public.announcements
  alter column category set default 'Announcement',
  add constraint announcements_category_check
    check (category in ('Announcement', 'Information', 'Academic', 'Kesantrian', 'Emergency'));

alter table public.student_guardians drop constraint student_guardians_relation_check;
update public.student_guardians set relation = 'father'   where relation = 'ayah';
update public.student_guardians set relation = 'mother'   where relation = 'ibu';
update public.student_guardians set relation = 'guardian' where relation = 'wali';
alter table public.student_guardians
  add constraint student_guardians_relation_check
    check (relation in ('father', 'mother', 'guardian'));

-- ------------------------------------------------------------
-- 3) JSONB key remap (semester report scores + extras)
-- ------------------------------------------------------------
update public.student_semester_reports
   set scores = (scores - 'praktek' - 'pagi_petang')
                || jsonb_build_object(
                     'practice', scores -> 'praktek',
                     'morning_evening', scores -> 'pagi_petang')
 where scores ? 'praktek' or scores ? 'pagi_petang';

update public.student_semester_reports
   set extras = (extras
                 || jsonb_build_object(
                      'weight_kg', extras -> 'berat_badan',
                      'height_cm', extras -> 'tinggi_badan',
                      'sick_days', extras -> 'hari_sakit',
                      'excused_days', extras -> 'hari_izin',
                      'absent_days', extras -> 'hari_alpa',
                      'early_leave_days', extras -> 'hari_pulang',
                      'notes', extras -> 'catatan'))
               - 'berat_badan' - 'tinggi_badan'
               - 'hari_sakit' - 'hari_izin' - 'hari_alpa' - 'hari_pulang'
               - 'catatan'
 where extras ?| array['berat_badan', 'tinggi_badan', 'hari_sakit',
                       'hari_izin', 'hari_alpa', 'hari_pulang', 'catatan'];

-- ------------------------------------------------------------
-- 4) Enum value renames
-- ------------------------------------------------------------
alter type public.app_role rename value 'pengurus' to 'manager';
alter type public.app_role rename value 'guru' to 'teacher';

alter type public.semester_type rename value 'Ganjil' to 'Odd';
alter type public.semester_type rename value 'Genap' to 'Even';

alter type public.student_status rename value 'aktif' to 'active';
alter type public.student_status rename value 'lulus' to 'graduated';
alter type public.student_status rename value 'pindah' to 'transferred';
alter type public.student_status rename value 'keluar' to 'left';

alter type public.teacher_status rename value 'cuti' to 'on_leave';

alter type public.dorm_gender rename value 'putra' to 'male';
alter type public.dorm_gender rename value 'putri' to 'female';
alter type public.dorm_gender rename value 'campur' to 'mixed';

alter type public.dorm_status rename value 'aktif' to 'active';
alter type public.dorm_status rename value 'penuh' to 'full';
alter type public.dorm_status rename value 'nonaktif' to 'inactive';

alter type public.gate_direction rename value 'keluar' to 'exit';
alter type public.gate_direction rename value 'masuk' to 'entry';

alter type public.counseling_category rename value 'pribadi' to 'personal';
alter type public.counseling_category rename value 'sosial' to 'social';
alter type public.counseling_category rename value 'akademik' to 'academic';
alter type public.counseling_category rename value 'karir' to 'career';

alter type public.counseling_urgency rename value 'ringan' to 'low';
alter type public.counseling_urgency rename value 'sedang' to 'medium';
alter type public.counseling_urgency rename value 'tinggi' to 'high';

alter type public.counseling_status rename value 'proses' to 'in_progress';
alter type public.counseling_status rename value 'selesai' to 'completed';

-- ------------------------------------------------------------
-- 5) Recreate functions that embedded renamed literals/columns
--    (plpgsql bodies are parsed at execution and SQL comments
--    aside, old column names or old stored values would fail)
-- ------------------------------------------------------------

-- From 0002: staff = developer|admin|manager|teacher
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(
    array['developer', 'admin', 'manager', 'teacher']::public.app_role[]
  );
$$;

-- From 0016: import students (default status 'active')
create or replace function public.import_students(p_rows jsonb)
returns table (row_index integer, ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_index integer := 0;
  v_class_id uuid;
  v_dorm_id uuid;
  v_tags text[];
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat mengimpor siswa';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows harus berupa array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    begin
      if coalesce(v_row ->> 'name', '') = '' then
        raise exception 'Nama wajib diisi';
      end if;
      if coalesce(v_row ->> 'registration_code', '') = '' then
        raise exception 'Kode registrasi wajib diisi';
      end if;

      v_class_id := null;
      if coalesce(v_row ->> 'class_id', '') = '' then
        raise exception 'Kelas wajib dipilih';
      end if;
      select c.id into v_class_id
      from public.classes c
      where c.id = (v_row ->> 'class_id')::uuid and c.deleted_at is null;
      if v_class_id is null then
        raise exception 'Kelas tidak ditemukan';
      end if;

      v_dorm_id := null;
      if coalesce(v_row ->> 'dorm_id', '') <> '' then
        select d.id into v_dorm_id
        from public.dorms d
        where d.id = (v_row ->> 'dorm_id')::uuid and d.deleted_at is null;
        if v_dorm_id is null then
          raise exception 'Asrama tidak ditemukan';
        end if;
      end if;

      -- tags: accept a json array (from UI) or a ';'-separated string
      v_tags := null;
      if jsonb_typeof(v_row -> 'tags') = 'array' then
        select coalesce(array_agg(trim(t)), '{}')
          into v_tags
          from jsonb_array_elements_text(v_row -> 'tags') as t
         where coalesce(trim(t), '') <> '';
      elsif coalesce(v_row ->> 'tags', '') <> '' then
        select coalesce(array_agg(trim(t)), '{}')
          into v_tags
          from unnest(string_to_array(v_row ->> 'tags', ';')) as t
         where coalesce(trim(t), '') <> '';
      end if;

      insert into public.students (
        registration_code, name, class_id, dorm_id, gender, status,
        phone, nisn, nis, nik, photo_url, tags,
        guardian_name, guardian_relation, birth_place, birth_date,
        religion, address
      ) values (
        trim(v_row ->> 'registration_code'),
        trim(v_row ->> 'name'),
        v_class_id,
        v_dorm_id,
        nullif(v_row ->> 'gender', '')::public.person_gender,
        coalesce(nullif(v_row ->> 'status', '')::public.student_status, 'active'::public.student_status),
        nullif(v_row ->> 'phone', ''),
        nullif(v_row ->> 'nisn', ''),
        nullif(v_row ->> 'nis', ''),
        nullif(v_row ->> 'nik', ''),
        nullif(v_row ->> 'photo_url', ''),
        v_tags,
        nullif(v_row ->> 'guardian_name', ''),
        nullif(v_row ->> 'guardian_relation', ''),
        nullif(v_row ->> 'birth_place', ''),
        nullif(v_row ->> 'birth_date', '')::date,
        nullif(v_row ->> 'religion', ''),
        nullif(v_row ->> 'address', '')
      );

      row_index := v_index;
      ok := true;
      error := null;
      return next;
    exception when others then
      row_index := v_index;
      ok := false;
      error := case
        when sqlerrm like '%students_registration_code_active_unique%' then 'Kode registrasi sudah dipakai'
        when sqlerrm like '%person_gender%' then 'Gender harus L atau P'
        when sqlerrm like '%student_status%' then 'Status tidak valid'
        when sqlerrm like '%date/time field value out of range%'
          or sqlerrm like '%invalid input syntax for type date%'
          or sqlerrm like '%invalid input syntax for type json%' then 'Tanggal lahir tidak valid (pakai YYYY-MM-DD)'
        else sqlerrm
      end;
      return next;
    end;
  end loop;
end;
$$;

revoke execute on function public.import_students(jsonb) from public, anon;
grant execute on function public.import_students(jsonb) to authenticated;

-- From 0013: public guardian check (renamed report columns + keys)
create or replace function public.check_student(p_code text, p_pin text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student record;
  v_result jsonb;
begin
  if p_code is null or p_pin is null or length(trim(p_code)) = 0 or length(trim(p_pin)) = 0 then
    return jsonb_build_object('error', 'Kode registrasi dan PIN wajib diisi');
  end if;

  select s.id, s.name, s.registration_code, s.nisn, s.gender, s.status,
         s.total_points, s.photo_url,
         c.name as class_name,
         d.name as dorm_name
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.dorms d on d.id = s.dorm_id
  where upper(trim(s.registration_code)) = upper(trim(p_code))
    and s.pin = trim(p_pin)
    and s.deleted_at is null
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Kode registrasi atau PIN salah');
  end if;

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
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;

-- From 0013: verify_raport -> verify_report (renamed columns)
create or replace function public.verify_report(p_student_id uuid, p_month int, p_year int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student record;
  v_report record;
begin
  select s.name, s.registration_code, s.nisn, s.gender,
         c.name as class_name
  into v_student
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = p_student_id and s.deleted_at is null;

  if not found then
    return jsonb_build_object('error', 'Santri tidak ditemukan');
  end if;

  select m.month, m.year, m.character_score, m.worship_score, m.cleanliness_score,
         m.quran_score, m.language_score, m.weight_kg, m.height_cm,
         m.ziyadah, m.murojaah, m.total_hafalan, m.sick_days, m.excused_days,
         m.absent_days, m.early_leave_days, m.notes, m.musyrif_name, m.updated_at
  into v_report
  from public.student_monthly_reports m
  where m.student_id = p_student_id
    and (p_month is null or m.month = p_month)
    and (p_year is null or m.year = p_year)
  order by m.year desc, m.month desc
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Rapor tidak ditemukan untuk periode tersebut');
  end if;

  return jsonb_build_object(
    'student', to_jsonb(v_student),
    'report', to_jsonb(v_report)
  );
end;
$$;

revoke execute on function public.verify_report(uuid, int, int) from public, anon, authenticated;
grant execute on function public.verify_report(uuid, int, int) to public;
drop function if exists public.verify_raport(uuid, int, int);

-- From 0014: token validation (translated status comparison)
create or replace function public._suspension_check_token(p_token text)
returns public.suspensions
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Tautan tidak valid.' using errcode = 'P0001';
  end if;

  select s.* into v
  from public.suspensions s
  join public.suspension_tokens t on t.suspension_id = s.id
  where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and t.revoked_at is null
    and now() <= t.expires_at;

  if not found then
    raise exception 'Tautan tidak valid atau sudah kedaluwarsa.' using errcode = 'P0001';
  end if;
  if v.status <> 'active' then
    raise exception 'Masa pembinaan sudah selesai atau dibatalkan.' using errcode = 'P0001';
  end if;

  update public.suspension_tokens
  set last_used_at = now(), use_count = use_count + 1
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');

  return v;
end $$;

-- From 0014: token -> summary (renamed level column/output key)
create or replace function public.validate_suspension_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_student_name text;
  v_class_name text;
  v_days text[];
begin
  perform public._suspension_log_attempt(substr(coalesce(p_token, ''), 1, 8));
  v := public._suspension_check_token(p_token);

  select s.name, c.name into v_student_name, v_class_name
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = v.student_id;

  select array_agg(to_char(d, 'YYYY-MM-DD') order by d) into v_days
  from generate_series(v.start_date, v.end_date, interval '1 day') d;

  return jsonb_build_object(
    'suspension_id', v.id,
    'student_name', coalesce(v_student_name, '-'),
    'class_name', v_class_name,
    'level', v.level,
    'start_date', v.start_date,
    'end_date', v.end_date,
    'days', coalesce(to_jsonb(v_days), '[]'::jsonb)
  );
end $$;

-- From 0014: day data (renamed level column/output key)
create or replace function public.get_suspension_day(p_token text, p_date date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_dow int;
  v_daytype text;
  v_templates jsonb;
  v_tasks jsonb;
  v_log jsonb;
  v_subs jsonb;
begin
  perform public._suspension_log_attempt(substr(coalesce(p_token, ''), 1, 8));
  v := public._suspension_check_token(p_token);

  if p_date is null or p_date < v.start_date or p_date > v.end_date then
    raise exception 'Tanggal di luar masa pembinaan.' using errcode = 'P0001';
  end if;

  v_dow := extract(dow from p_date)::int;
  v_daytype := case when v_dow in (0, 6) then 'weekend' else 'weekday' end;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.ord, t.sort_order), '[]'::jsonb)
  into v_templates
  from (
    select id, block_key, item_key, label_id, input_type, options, sort_order,
      array_position(array['dinihari', 'pagi', 'sore', 'malam'], block_key) as ord
    from public.suspension_log_templates
    where is_active
      and (level = 'both' or level = v.level)
      and (day_type = 'both' or day_type = v_daytype)
      and (not monday_thursday_only or v_dow in (1, 4))
  ) t;

  select coalesce(
    jsonb_agg(to_jsonb(t) order by t.due_date nulls last, t.created_at),
    '[]'::jsonb)
  into v_tasks
  from (
    select id, subject, title, description, due_date,
      created_at
    from public.suspension_tasks
    where suspension_id = v.id
  ) t;

  select to_jsonb(l) into v_log
  from (
    select entries, note_optional, submitted_at, updated_at
    from public.suspension_daily_logs
    where suspension_id = v.id and log_date = p_date
  ) l;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.task_id), '[]'::jsonb)
  into v_subs
  from (
    select task_id, status, score, teacher_comment,
      coalesce(array_length(photo_data, 1), 0)
        + coalesce(array_length(photo_urls, 1), 0) as photo_count,
      note, submitted_at
    from public.suspension_task_submissions
    where suspension_id = v.id
  ) s;

  return jsonb_build_object(
    'templates', v_templates,
    'tasks', v_tasks,
    'log', coalesce(v_log, 'null'::jsonb),
    'submissions', v_subs
  );
end $$;

-- From 0014: save daily log (audit actor_role 'wali' -> 'guardian')
create or replace function public.save_suspension_log(
  p_token text, p_date date, p_entries jsonb, p_note text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_id uuid;
  v_prefix text := substr(coalesce(p_token, ''), 1, 8);
begin
  perform public._suspension_log_attempt(v_prefix);
  v := public._suspension_check_token(p_token);

  if p_date is null or p_date < v.start_date or p_date > v.end_date then
    raise exception 'Tanggal di luar masa pembinaan.' using errcode = 'P0001';
  end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'object' then
    raise exception 'Format isian tidak valid.' using errcode = 'P0001';
  end if;

  insert into public.suspension_daily_logs (suspension_id, log_date, entries, note_optional)
  values (v.id, p_date, p_entries, nullif(p_note, ''))
  on conflict (suspension_id, log_date)
  do update set entries = excluded.entries,
    note_optional = excluded.note_optional,
    updated_at = now()
  returning id into v_id;

  insert into public.audit_logs (action, source, table_name, record_id, new_data,
    actor_name, actor_role, created_at)
  values ('UPDATE', 'OPERATIONAL', 'suspension_daily_logs', v_id,
    jsonb_build_object('suspension_id', v.id, 'log_date', p_date),
    'Wali (' || v_prefix || ')', 'guardian', now());

  return jsonb_build_object('ok', true, 'log_id', v_id);
end $$;

-- From 0014: submit task evidence (translated submission status)
create or replace function public.submit_suspension_task(
  p_token text, p_task_id uuid, p_photos_base64 text[], p_note text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v public.suspensions%rowtype;
  v_prefix text := substr(coalesce(p_token, ''), 1, 8);
  v_found uuid;
  v_photo text;
  v_clean text;
  v_bytes int;
  v_total int := 0;
  v_kept text[] := '{}';
  v_sub_id uuid;
begin
  perform public._suspension_log_attempt(v_prefix);
  v := public._suspension_check_token(p_token);

  select id into v_found from public.suspension_tasks
  where id = p_task_id and suspension_id = v.id;
  if not found then
    raise exception 'Tugas tidak ditemukan.' using errcode = 'P0001';
  end if;

  if (p_photos_base64 is null or coalesce(array_length(p_photos_base64, 1), 0) = 0)
     and (p_note is null or length(trim(p_note)) = 0) then
    raise exception 'Lampirkan minimal satu foto atau catatan.' using errcode = 'P0001';
  end if;

  if p_photos_base64 is not null then
    if coalesce(array_length(p_photos_base64, 1), 0) > 6 then
      raise exception 'Maksimal 6 foto per pengiriman.' using errcode = 'P0001';
    end if;
    foreach v_photo in array p_photos_base64 loop
      v_clean := v_photo;
      if v_clean like 'data:%;base64,%' then
        v_clean := split_part(v_clean, ',', 2);
      end if;
      if v_clean is null or length(v_clean) = 0 then
        raise exception 'Foto yang dikirim kosong.' using errcode = 'P0001';
      end if;
      v_bytes := (length(v_clean) * 3) / 4;
      if v_bytes > 2 * 1024 * 1024 then
        raise exception 'Ukuran tiap foto maksimal 2 MB.' using errcode = 'P0001';
      end if;
      v_total := v_total + v_bytes;
      if v_total > 10 * 1024 * 1024 then
        raise exception 'Total foto maksimal 10 MB.' using errcode = 'P0001';
      end if;
      begin
        perform length(decode(v_clean, 'base64'));
      exception when others then
        raise exception 'Format foto tidak valid.' using errcode = 'P0001';
      end;
      v_kept := v_kept || v_clean;
    end loop;
  end if;

  insert into public.suspension_task_submissions
    (task_id, suspension_id, photo_urls, photo_data, note, status)
  values (p_task_id, v.id, '{}', v_kept,
    nullif(trim(coalesce(p_note, '')), ''), 'submitted')
  on conflict (task_id, suspension_id)
  do update set
    photo_data = case
      when coalesce(array_length(excluded.photo_data, 1), 0) > 0
      then (public.suspension_task_submissions.photo_data || excluded.photo_data)
      else public.suspension_task_submissions.photo_data end,
    note = excluded.note,
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
  returning id into v_sub_id;

  -- Cap accumulation: max 12 photos per submission
  update public.suspension_task_submissions
  set photo_data = (photo_data)
    [greatest(array_length(photo_data, 1) - 11, 1):array_length(photo_data, 1)]
  where id = v_sub_id
    and coalesce(array_length(photo_data, 1), 0) > 12;

  insert into public.audit_logs (action, source, table_name, record_id, new_data,
    actor_name, actor_role, created_at)
  values ('INSERT', 'OPERATIONAL', 'suspension_task_submissions', v_sub_id,
    jsonb_build_object('suspension_id', v.id, 'task_id', p_task_id,
      'photo_count', coalesce(array_length(v_kept, 1), 0)),
    'Wali (' || v_prefix || ')', 'guardian', now());

  return jsonb_build_object('ok', true, 'submission_id', v_sub_id,
    'photo_count', coalesce(array_length(v_kept, 1), 0));
end $$;

revoke execute on function public.validate_suspension_token(text) from public, anon, authenticated;
revoke execute on function public.get_suspension_day(text, date) from public, anon, authenticated;
revoke execute on function public.save_suspension_log(text, date, jsonb, text) from public, anon, authenticated;
revoke execute on function public.submit_suspension_task(text, uuid, text[], text) from public, anon, authenticated;
grant execute on function public.validate_suspension_token(text) to public;
grant execute on function public.get_suspension_day(text, date) to public;
grant execute on function public.save_suspension_log(text, date, jsonb, text) to public;
grant execute on function public.submit_suspension_task(text, uuid, text[], text) to public;

-- From 0017: WA settings status (role 'pengurus' -> 'manager')
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
    'updated_at', v_row.updated_at
  );
end;
$$;

-- From 0018: graduate students (role + status 'lulus' -> 'graduated')
create or replace function public.graduate_students(p_ids uuid[], p_graduation_year integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat meluluskan siswa';
  end if;

  if p_graduation_year is null or p_graduation_year not between 1980 and 2200 then
    raise exception 'Tahun lulus tidak valid';
  end if;

  update public.students
     set status = 'graduated',
         graduated_at = now(),
         graduation_year = p_graduation_year,
         last_class_id = class_id,
         class_id = null,
         dorm_id = null
   where id = any(p_ids)
     and deleted_at is null;
end;
$$;

-- From 0020: save guardians (role + translated relations)
create or replace function public.save_student_guardians(p_student_id uuid, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_relation text;
  v_count integer := 0;
begin
  if not public.has_any_role(array['developer', 'admin', 'manager']::public.app_role[]) then
    raise exception 'Hanya developer, admin, atau manager yang dapat mengubah data orang tua';
  end if;

  if p_student_id is null then
    raise exception 'Siswa wajib dipilih';
  end if;

  if not exists (
    select 1 from public.students
    where id = p_student_id and deleted_at is null
  ) then
    raise exception 'Siswa tidak ditemukan';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows harus berupa array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_relation := coalesce(v_row ->> 'relation', '');
    if v_relation not in ('father', 'mother', 'guardian') then
      raise exception 'Hubungan orang tua harus ayah, ibu, atau wali';
    end if;
    v_count := v_count + 1;

    insert into public.student_guardians (
      student_id, relation, name, nik, birth_year, education,
      occupation, income_range, phone, address
    ) values (
      p_student_id,
      v_relation,
      nullif(v_row ->> 'name', ''),
      nullif(v_row ->> 'nik', ''),
      nullif(v_row ->> 'birth_year', '')::integer,
      nullif(v_row ->> 'education', ''),
      nullif(v_row ->> 'occupation', ''),
      nullif(v_row ->> 'income_range', ''),
      nullif(v_row ->> 'phone', ''),
      nullif(v_row ->> 'address', '')
    )
    on conflict (student_id, relation) where deleted_at is null
    do update set
      name = excluded.name,
      nik = excluded.nik,
      birth_year = excluded.birth_year,
      education = excluded.education,
      occupation = excluded.occupation,
      income_range = excluded.income_range,
      phone = excluded.phone,
      address = excluded.address;
  end loop;

  -- Soft-delete rows that were no longer sent from the form
  update public.student_guardians
     set deleted_at = now()
   where student_id = p_student_id
     and deleted_at is null
     and (v_count = 0 or relation not in (
       select coalesce(r ->> 'relation', '')
       from jsonb_array_elements(p_rows) as r
     ));
end;
$$;

revoke execute on function public.save_student_guardians(uuid, jsonb) from public, anon;
grant execute on function public.save_student_guardians(uuid, jsonb) to authenticated;
