-- ============================================================
-- 0019: Portal wali satu pintu
--  Perluas RPC publik check_student (0013) dengan:
--   • attendance: rekap H|S|I|A|P per bulan (3 bulan terakhir)
--     dari student_attendance.days (jsonb, lihat 0011)
--   • suspensions: status & periode skorsing siswa.
--     reason_summary TIDAK dikembalikan — INTERNAL kesiswaan/BK
--     (lihat comment kolom di 0014_skorsing.sql)
-- ============================================================

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
    'raports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month', m.month, 'year', m.year,
        'nilai_akhlak', m.nilai_akhlak, 'nilai_ibadah', m.nilai_ibadah,
        'nilai_kebersihan', m.nilai_kebersihan, 'nilai_quran', m.nilai_quran,
        'nilai_bahasa', m.nilai_bahasa, 'catatan', m.catatan
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
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;
