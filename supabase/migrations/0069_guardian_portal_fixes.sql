-- ============================================================
-- 0069: Perbaikan portal wali + portal santri + kotak masuk push
--
-- Latar belakang (audit 2026-11-22):
--  1. check_student (0066) masih merujuk suspensions.jenjang, padahal
--     0021 sudah rename kolom itu menjadi level. Efeknya SELURUH halaman
--     /check gagal: column sp.jenjang does not exist.
--  2. Rapor akademik di /check mencetak UUID mapel karena klien membaca
--     tabel subjects sebagai anon (RLS: authenticated + is_staff).
--     Resolusi nama harus di server lewat definer function.
--  3. Panel Kemahiran Ibadah di /portal selalu kosong karena klien query
--     worship_items/worship_mastery sebagai anon. Portal WAJIB lewat RPC
--     bertoken, bukan query tabel langsung.
--  4. Wali tidak bisa melihat tagihan SPP sama sekali (portal santri bisa).
--  5. Fitur "Aktifkan Notifikasi" tidak pernah menghasilkan notifikasi:
--     tidak ada inbox server-side untuk santri.
--  6. Flag module.cbt_elite di-seed tetapi tidak dikonsumsi UI mana pun;
--     cbt.ai_generate dikonsumsi tetapi tidak pernah di-seed.
--
-- Jalankan di Supabase SQL Editor (bukan supabase db push).
-- Idempoten: create ... if not exists + create or replace.
-- ============================================================

-- ------------------------------------------------------------
-- 1. check_student — perbaikan jenjang → level, nama mapel, SPP
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
  v_ay uuid;
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
    and exists (
      select 1 from public.student_pins sp
      where sp.student_id = s.id and sp.pin = trim(p_pin)
    )
    and s.deleted_at is null
  limit 1;

  if not found then
    perform public._guardian_log_failure(p_code);
    return jsonb_build_object('error', 'Kode registrasi atau PIN salah');
  end if;

  delete from public.guardian_login_attempts where code_prefix = v_prefix;

  select id into v_ay from public.academic_years
  where is_active and deleted_at is null
  order by start_date desc nulls last limit 1;

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
    -- Rapor semester umum: skor di-key UUID mapel. Nama mapel di-resolve
    -- di server karena klien anon tidak boleh membaca tabel subjects.
    'semester_reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'semester', sr.semester,
        'academic_year', ay.name,
        'scores', sr.scores,
        'subject_names', coalesce((
          select jsonb_object_agg(sub.id, sub.name)
          from public.subjects sub
          where sub.deleted_at is null
            and sub.id::text in (
              select jsonb_object_keys(sr.scores)
            )
        ), '{}'::jsonb),
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
    -- skorsing: kolom sudah bernama level sejak 0021
    'suspensions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sp.id, 'level', sp.level,
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
    ),
    -- SPP: wali perlu melihat tunggakan, bukan hanya portal santri
    'spp', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'component', comp.name, 'period', o.period, 'amount', o.amount,
          'paid', coalesce(pay.total, 0), 'due_date', o.due_date
        ) order by o.due_date nulls last, o.created_at)
        from public.spp_obligations o
        join public.spp_components comp on comp.id = o.component_id
        left join (
          select obligation_id, sum(amount) as total
          from public.spp_payments group by obligation_id
        ) pay on pay.obligation_id = o.id
        where o.deleted_at is null and o.student_id = v_student.id
          and (v_ay is null or o.academic_year_id = v_ay)
      ), '[]'::jsonb),
      'total_due', coalesce((
        select sum(o.amount)
        from public.spp_obligations o
        where o.deleted_at is null and o.student_id = v_student.id
          and (v_ay is null or o.academic_year_id = v_ay)
      ), 0),
      'total_paid', coalesce((
        select sum(p.amount)
        from public.spp_payments p
        join public.spp_obligations o on o.id = p.obligation_id
        where o.deleted_at is null and o.student_id = v_student.id
          and (v_ay is null or o.academic_year_id = v_ay)
      ), 0)
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.check_student(text, text) from public, anon, authenticated;
grant execute on function public.check_student(text, text) to public;

-- ------------------------------------------------------------
-- 2. portal_data — tambah kemahiran ibadah (lewat RPC, bukan query tabel)
-- ------------------------------------------------------------
create or replace function public.portal_data(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
  v_student_row record;
  v_ay uuid;
  v_result jsonb;
begin
  v_student := public._portal_check_token(p_token);

  select s.*, c.name as class_name into v_student_row
  from public.students s
  left join public.classes c on c.id = s.class_id
  where s.id = v_student;

  select id into v_ay from public.academic_years
  where is_active and deleted_at is null
  order by start_date desc nulls last limit 1;

  v_result := jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student_row.id,
      'name', v_student_row.name,
      'class_name', v_student_row.class_name,
      'photo_url', v_student_row.photo_url,
      'status', v_student_row.status,
      'total_points', v_student_row.total_points
    ),
    'schedule', coalesce((
      select jsonb_agg(jsonb_build_object(
        'start_time', sch.start_time, 'end_time', sch.end_time,
        'subject', sub.name, 'teacher', t.name, 'room', sch.room
      ) order by sch.start_time)
      from public.schedules sch
      left join public.subjects sub on sub.id = sch.subject_id
      left join public.teachers t on t.id = sch.teacher_id
      where sch.class_id = v_student_row.class_id
        and sch.day_of_week = extract(isodow from current_date)
        and sch.deleted_at is null
    ), '[]'::jsonb),
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject', sub.name, 'type', a.type, 'title', a.title,
        'score', sc.score, 'max_score', a.max_score, 'date', a.assessment_date
      ) order by a.assessment_date desc nulls last, a.created_at desc)
      from (
        select * from public.assessment_scores
        where student_id = v_student
        order by created_at desc limit 60
      ) sc
      join public.assessments a on a.id = sc.assessment_id and a.deleted_at is null
      join public.class_subjects cs on cs.id = a.class_subject_id
        and cs.deleted_at is null
        and cs.class_id = v_student_row.class_id
        and (v_ay is null or cs.academic_year_id = v_ay)
      left join public.subjects sub on sub.id = cs.subject_id
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('year', sa.year, 'month', sa.month, 'days', sa.days)
        order by sa.year desc, sa.month desc)
      from (
        select * from public.student_attendance
        where student_id = v_student
          and year = extract(year from current_date)
        order by month desc limit 3
      ) sa
    ), '[]'::jsonb),
    'points', jsonb_build_object(
      'total', v_student_row.total_points,
      'recent', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rule', pr.name, 'points', r.points, 'notes', r.notes, 'reported_at', r.reported_at
        ) order by r.reported_at desc)
        from (
          select * from public.reports
          where student_id = v_student
          order by reported_at desc limit 10
        ) r
        join public.point_rules pr on pr.id = r.rule_id
      ), '[]'::jsonb)
    ),
    'spp', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'component', comp.name, 'period', o.period, 'amount', o.amount,
          'paid', coalesce(pay.total, 0), 'due_date', o.due_date
        ) order by o.due_date nulls last, o.created_at)
        from public.spp_obligations o
        join public.spp_components comp on comp.id = o.component_id
        left join (
          select obligation_id, sum(amount) as total
          from public.spp_payments group by obligation_id
        ) pay on pay.obligation_id = o.id
        where o.deleted_at is null and o.student_id = v_student
          and (v_ay is null or o.academic_year_id = v_ay)
      ), '[]'::jsonb),
      'total_due', coalesce((
        select sum(o.amount)
        from public.spp_obligations o
        where o.deleted_at is null and o.student_id = v_student
          and (v_ay is null or o.academic_year_id = v_ay)
      ), 0),
      'total_paid', coalesce((
        select sum(p.amount)
        from public.spp_payments p
        join public.spp_obligations o on o.id = p.obligation_id
        where o.deleted_at is null and o.student_id = v_student
          and (v_ay is null or o.academic_year_id = v_ay)
      ), 0)
    ),
    'tahfidz', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', tr.kind, 'surah', tr.surah, 'from_ayat', tr.from_ayat,
        'to_ayat', tr.to_ayat, 'quality', tr.quality,
        'recorded_at', tr.recorded_at
      ) order by tr.recorded_at desc, tr.created_at desc)
      from (
        select * from public.tahfidz_records
        where student_id = v_student and deleted_at is null
        order by recorded_at desc, created_at desc limit 10
      ) tr
    ), '[]'::jsonb),
    -- Kemahiran ibadah: agregat per kategori (butir aktif + terampil)
    'worship', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category', cat,
        'totalItems', item_count,
        'masteredCount', mastered_count
      ))
      from (
        select
          wi.category as cat,
          count(*) as item_count,
          count(*) filter (where m.mastered) as mastered_count
        from public.worship_items wi
        left join public.worship_mastery m
          on m.item_id = wi.id and m.student_id = v_student
        where wi.deleted_at is null
        group by wi.category
      ) c
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;

revoke execute on function public.portal_data(text) from public;
grant execute on function public.portal_data(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 3. Kotak masuk notifikasi santri
-- ------------------------------------------------------------
create table if not exists public.portal_notifications (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title      text not null,
  body       text not null default '',
  url        text,
  kind       text not null default 'general'
    check (kind in ('announcement', 'spp', 'report', 'general')),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_notifications_student_idx
  on public.portal_notifications (student_id, created_at desc);

alter table public.portal_notifications enable row level security;
-- Tanpa policy: hanya security-definer RPC + Edge Function (service role).

create or replace function public.portal_notifications(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
begin
  v_student := public._portal_check_token(p_token);

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'title', n.title, 'body', n.body,
        'url', n.url, 'kind', n.kind,
        'read_at', n.read_at, 'created_at', n.created_at
      ) order by n.created_at desc)
      from (
        select * from public.portal_notifications
        where student_id = v_student
        order by created_at desc limit 30
      ) n
    ), '[]'::jsonb),
    'unread_count', (
      select count(*) from public.portal_notifications
      where student_id = v_student and read_at is null
    )
  );
end;
$$;

create or replace function public.portal_mark_notification_read(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_student uuid;
begin
  v_student := public._portal_check_token(p_token);

  update public.portal_notifications
     set read_at = now()
   where id = p_id and student_id = v_student and read_at is null;
end;
$$;

revoke execute on function public.portal_notifications(text) from public;
revoke execute on function public.portal_mark_notification_read(text, uuid) from public;
grant execute on function public.portal_notifications(text) to anon, authenticated;
grant execute on function public.portal_mark_notification_read(text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Dashboard operasional harian: satu RPC agregat
-- ------------------------------------------------------------
-- Dashboard sebelumnya nol data keuangan dan nol data absensi. Pola yang
-- sama dengan admin_table_stats (0062): satu panggilan, bukan belasan.
create or replace function public.dashboard_ops()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_ay uuid;
  v_month_start date := date_trunc('month', current_date)::date;
  v_month_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  if not public.is_staff() then
    raise exception 'Hanya staf yang dapat membaca ringkasan dashboard';
  end if;

  select id into v_ay from public.academic_years
  where is_active and deleted_at is null
  order by start_date desc nulls last limit 1;

  return jsonb_build_object(
    -- Kehadiran hari ini: kunci days jsonb TIDAK di-pad ("1".."31"),
    -- jadi jangan pakai to_char(..., 'DD') yang menghasilkan "01".."31".
    'attendance_today', jsonb_build_object(
      'hadir', coalesce((
        select count(*) from public.student_attendance a
        where a.year = extract(year from current_date)
          and a.month = extract(month from current_date)
          and a.days ? (extract(day from current_date))::int::text
          and a.days ->> (extract(day from current_date))::int::text = 'H'
      ), 0),
      'total', coalesce((
        select count(*) from public.students
        where status = 'active' and deleted_at is null and class_id is not null
      ), 0)
    ),
    -- SPP bulan ini berdasarkan tanggal bayar
    'spp_month', jsonb_build_object(
      'collected', coalesce((
        select sum(p.amount) from public.spp_payments p
        where p.paid_at between v_month_start and v_month_end
      ), 0),
      -- outstanding = total kewajiban dikurangi total pembayaran (level kewajiban)
      'outstanding', coalesce((
        select sum(o.amount - coalesce(pay.total, 0))
        from public.spp_obligations o
        left join (
          select obligation_id, sum(amount) as total
          from public.spp_payments group by obligation_id
        ) pay on pay.obligation_id = o.id
        where o.deleted_at is null
          and (v_ay is null or o.academic_year_id = v_ay)
          and o.amount > coalesce(pay.total, 0)
      ), 0)
    ),
    -- Tunggakan teratas (5 santri)
    'arrears_top', coalesce((
      select jsonb_agg(t)
      from (
        select jsonb_build_object(
          'student_id', x.student_id, 'name', x.name,
          'class_name', x.class_name, 'outstanding', x.outstanding
        ) as t
        from (
          select o.student_id, s.name, c.name as class_name,
                 sum(o.amount) - coalesce(sum(pay.total), 0) as outstanding
          from public.spp_obligations o
          join public.students s on s.id = o.student_id
          left join public.classes c on c.id = s.class_id
          left join (
            select obligation_id, sum(amount) as total
            from public.spp_payments group by obligation_id
          ) pay on pay.obligation_id = o.id
          where o.deleted_at is null and (v_ay is null or o.academic_year_id = v_ay)
          group by o.student_id, s.name, c.name
        ) x
        where x.outstanding > 0
        order by x.outstanding desc
        limit 5
      ) y
    ), '[]'::jsonb),
    -- PPDB per tahap
    'ppdb_pipeline', coalesce((
      select jsonb_object_agg(stage, cnt)
      from (
        select stage::text as stage, count(*) as cnt
        from public.admissions
        where deleted_at is null
        group by stage
      ) x
    ), '{}'::jsonb),
    -- Sesi BK urgensi tinggi yang masih proses
    'counseling_urgent', coalesce((
      select count(*) from public.counseling_logs
      where urgency = 'high' and status = 'in_progress'
    ), 0)
  );
end;
$$;

revoke execute on function public.dashboard_ops() from public, anon;
grant execute on function public.dashboard_ops() to authenticated;

-- ------------------------------------------------------------
-- 5. Tindak lanjut BK: tenggat sesi + denda perpustakaan + mutasi stok
-- ------------------------------------------------------------
-- Sesi BK berstatus proses tanpa tenggat akan menggantung diam-diam.
alter table public.counseling_logs
  add column if not exists next_session_date date;

-- Perpustakaan: buku sering kembali lewat tenggat tanpa catatan apa pun.
alter table public.book_loans
  add column if not exists fine_amount numeric(12,0) not null default 0,
  add column if not exists fine_paid boolean not null default false,
  add column if not exists condition_on_return text
    check (condition_on_return in ('good', 'light_damaged', 'heavy_damaged', 'lost'));

-- Inventaris: quantity diedit langsung tanpa riwayat. Mutasi dicatat di
-- ledger, lalu trigger menyinkronkan inventory_items.quantity.
create table if not exists public.inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.inventory_items (id) on delete cascade,
  kind       text not null check (kind in ('in', 'out', 'damage', 'loss', 'adjustment')),
  quantity   integer not null check (quantity > 0),
  note       text,
  actor_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_item_idx
  on public.inventory_movements (item_id, created_at desc);

alter table public.inventory_movements enable row level security;

drop policy if exists "inventory_movements_select" on public.inventory_movements;
create policy "inventory_movements_select" on public.inventory_movements
  for select to authenticated using (public.is_staff());

drop policy if exists "inventory_movements_insert" on public.inventory_movements;
create policy "inventory_movements_insert" on public.inventory_movements
  for insert to authenticated with check (public.is_staff_writer());

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind in ('in') then
    update public.inventory_items
       set quantity = quantity + new.quantity
     where id = new.item_id;
  elsif new.kind in ('out', 'damage', 'loss') then
    update public.inventory_items
       set quantity = greatest(0, quantity - new.quantity)
     where id = new.item_id;
  else
    -- adjustment: quantity = jumlah fisik hasil hitung ulang
    update public.inventory_items
       set quantity = new.quantity
     where id = new.item_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_apply_inventory_movement on public.inventory_movements;
create trigger trg_apply_inventory_movement
  after insert on public.inventory_movements
  for each row execute function public.apply_inventory_movement();

-- ------------------------------------------------------------
-- 6. Flag: seed cbt.ai_generate, hapus module.cbt_elite (tidak dikonsumsi)
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order)
values (
  'cbt.ai_generate',
  'Pembuatan Soal AI',
  'cbt',
  'Izinkan guru membuat draf soal CBT dengan bantuan AI',
  true,
  20
)
on conflict (key) do nothing;

delete from public.feature_flags where key = 'module.cbt_elite';

-- ------------------------------------------------------------
-- 5. Catatan konfigurasi push (nilai asli = secret, isi manual)
-- ------------------------------------------------------------
-- portal_push_config membaca app_settings key 'push.vapid_public' dengan
-- bentuk { "public": "<vapid public key>" }. Nilai ini TIDAK di-seed dari
-- repo karena pasangan kuncinya disimpan sebagai secret Edge Function.
-- Isi manual setelah `npx web-push generate-vapid-keys`:
--   insert into public.app_settings (key, value)
--   values ('push.vapid_public', '{"public":"..."}')
--   on conflict (key) do update set value = excluded.value;
