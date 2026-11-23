-- Verifikasi raport semester lewat QR (belum ada sebelumnya — verify_report hanya bulanan).
create or replace function public.verify_semester_report(
  p_student_id uuid,
  p_report_type text,
  p_semester int,
  p_academic_year_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student record;
  v_report record;
  v_year text;
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

  select r.semester, r.report_type, r.academic_year_id,
         r.scores, r.extras, r.musyrif_name, r.updated_at
  into v_report
  from public.student_semester_reports r
  where r.student_id = p_student_id
    and r.report_type = p_report_type
    and r.semester = p_semester
    and (p_academic_year_id is null or r.academic_year_id = p_academic_year_id)
  order by r.updated_at desc
  limit 1;

  if not found then
    return jsonb_build_object('error', 'Rapor semester tidak ditemukan untuk periode tersebut');
  end if;

  select name into v_year
  from public.academic_years
  where id = v_report.academic_year_id;

  return jsonb_build_object(
    'student', to_jsonb(v_student),
    'report', to_jsonb(v_report),
    'academic_year', v_year
  );
end;
$$;

revoke execute on function public.verify_semester_report(uuid, text, int, uuid) from public, anon, authenticated;
grant execute on function public.verify_semester_report(uuid, text, int, uuid) to public;
