-- ============================================================
-- 0013: Audit log + RPC publik (cek wali santri & verifikasi rapor)
-- Perbaikan dari V1: PIN divalidasi di dalam RPC security-definer
-- (V1 memfilter .eq('pin') via anon SELECT — row mentah bisa
-- ter-expose & PIN bisa diprobe kolom per kolom)
-- ============================================================

-- ------------------------------------------------------------
-- Audit log
-- ------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  source text not null default 'SYSTEM',
  table_name text,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  actor_name text,
  actor_role text,
  ip_address text,
  user_agent text,
  url text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_insert" on public.audit_logs
  for insert to authenticated with check (true);
create policy "audit_logs_select" on public.audit_logs
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- RPC publik: cek wali santri (kode registrasi + PIN)
-- Return terbatas — tanpa pin, tanpa kolom sensitif lain
-- ------------------------------------------------------------
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
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;

-- ------------------------------------------------------------
-- RPC publik: verifikasi keaslian rapor bulanan
-- ------------------------------------------------------------
create or replace function public.verify_raport(p_student_id uuid, p_month int, p_year int)
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

  select m.month, m.year, m.nilai_akhlak, m.nilai_ibadah, m.nilai_kebersihan,
         m.nilai_quran, m.nilai_bahasa, m.berat_badan, m.tinggi_badan,
         m.ziyadah, m.murojaah, m.total_hafalan, m.hari_sakit, m.hari_izin,
         m.hari_alpa, m.hari_pulang, m.catatan, m.musyrif_name, m.updated_at
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

revoke execute on function public.verify_raport(uuid, int, int) from public, anon, authenticated;
grant execute on function public.verify_raport(uuid, int, int) to public;
