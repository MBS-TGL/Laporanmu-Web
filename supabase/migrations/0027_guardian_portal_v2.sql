-- ============================================================
-- 0027: Portal wali v2
--   1. Rate limit server-side untuk check_student (PIN 4–6 digit)
--      — pola sama dengan _suspension_log_attempt (0014), tapi
--      hanya percobaan GAGAL yang dicatat.
--   2. Pulihkan payload 'attendance' & 'suspensions' yang hilang
--      saat check_student ditulis ulang di 0021 (FE masih
--      memakainya → crash bila undefined).
--   3. Tambah payload 'savings' (saldo + 30 mutasi terakhir).
--      RLS savings_* tetap tertutup untuk anon; wali hanya
--      membaca lewat RPC security definer ini.
-- ============================================================

create table public.guardian_login_attempts (
  code_prefix text not null,
  attempted_at timestamptz not null default now()
);

create index idx_guardian_attempts_prefix
  on public.guardian_login_attempts (code_prefix, attempted_at);

alter table public.guardian_login_attempts enable row level security;

-- Hanya admin yang boleh mengintip log percobaan; RPC definer bypass RLS
create policy "guardian_attempts_admin" on public.guardian_login_attempts
  for all to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- Catat percobaan gagal (maks 10 per 10 menit per kode)
-- ------------------------------------------------------------
create or replace function public._guardian_log_failure(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.guardian_login_attempts
    where attempted_at < now() - interval '1 day';

  insert into public.guardian_login_attempts (code_prefix)
    values (upper(trim(coalesce(p_code, ''))));
end;
$$;

revoke execute on function public._guardian_log_failure(text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- RPC portal wali (pengganti check_student 0021)
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

  -- Rate limit server-side: 10 percobaan GAGAL per 10 menit per kode
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

  -- Login sukses — bersihkan riwayat gagal kode ini
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
    'attendance', (
      -- Rekap per bulan dari days jsonb {"1":"H","2":"S",...} (0011)
      select coalesce(jsonb_agg(jsonb_build_object(
        'year', a.year, 'month', a.month,
        'hadir', (select count(*) from jsonb_object_keys(a.days) k
                  where a.days ->> k = 'H'),
        'sakit', (select count(*) from jsonb_object_keys(a.days) k
                  where a.days ->> k = 'S'),
        'izin', (select count(*) from jsonb_object_keys(a.days) k
                 where a.days ->> k = 'I'),
        'alpa', (select count(*) from jsonb_object_keys(a.days) k
                 where a.days ->> k = 'A'),
        'pulang', (select count(*) from jsonb_object_keys(a.days) k
                   where a.days ->> k = 'P')
      ) order by a.year desc, a.month desc), '[]'::jsonb)
      from (
        select * from public.student_attendance sa
        where sa.student_id = v_student.id
        order by sa.year desc, sa.month desc
        limit 3
      ) a
    ),
    'suspensions', (
      -- Tanpa reason_summary — internal kesiswaan/BK (0014)
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sp.id, 'jenjang', sp.jenjang,
        'start_date', sp.start_date, 'end_date', sp.end_date,
        'status', sp.status
      ) order by sp.start_date desc), '[]'::jsonb)
      from public.suspensions sp
      where sp.student_id = v_student.id
    ),
    'savings', (
      -- Saldo + 30 mutasi terakhir (0022). RLS tertutup untuk anon,
      -- jadi wajib lewat RPC definer ini.
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
