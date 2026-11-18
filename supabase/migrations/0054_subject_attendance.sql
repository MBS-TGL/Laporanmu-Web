-- ============================================================
-- 0054: P2 Attendance Center — absensi per jam pelajaran
--
-- Slot pelajaran diturunkan dari `schedules` (jadwal kelas hari itu)
-- — TIDAK membuat tabel master time_slots terpisah (deviasi plan,
-- catatan di MEMORY): setiap baris jadwal = 1 slot, guru jam itu
-- diambil dari schedules + override substitution_logs per tanggal.
--
-- subject_attendance: unik (student_id, schedule_id, date) — pola
-- student_attendance 0011 (upsert, tanpa deleted_at).
-- WA wali saat tanpa keterangan: toggle auto_absen_mapel_wa
-- (extend wa_settings_status / update_wa_settings — pola 0048).
-- ============================================================

create table public.subject_attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  date        date not null default current_date,
  status      text not null default 'H' check (status in ('H', 'S', 'I', 'A')),
  note        text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint subject_attendance_unique unique (student_id, schedule_id, date)
);

create index subject_attendance_date_idx
  on public.subject_attendance (date desc);
create index subject_attendance_student_idx
  on public.subject_attendance (student_id, date desc);
create index subject_attendance_schedule_idx
  on public.subject_attendance (schedule_id, date);

create trigger trg_subject_attendance_updated_at
  before update on public.subject_attendance
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — pola master data: baca staff, tulis staff writer,
-- hapus staff deleter
-- ------------------------------------------------------------
alter table public.subject_attendance enable row level security;

create policy "subject_attendance_select" on public.subject_attendance
  for select to authenticated using (public.is_staff());
create policy "subject_attendance_insert" on public.subject_attendance
  for insert to authenticated with check (public.is_staff_writer());
create policy "subject_attendance_update" on public.subject_attendance
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "subject_attendance_delete" on public.subject_attendance
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- WA otomatis absensi mapel: toggle baru di wa_settings
-- (extend RPC lama — param baru di AKHIR signature agar pemanggil
-- lama tidak berubah)
-- ------------------------------------------------------------
alter table public.wa_settings
  add column if not exists auto_absen_mapel_wa boolean not null default false;

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
    'auto_absen_mapel_wa', v_row.auto_absen_mapel_wa,
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
  p_auto_cbt boolean default null,
  p_auto_absen_mapel boolean default null
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
    auto_absen_mapel_wa = coalesce(p_auto_absen_mapel, auto_absen_mapel_wa),
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- Flag module.subject_attendance
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.subject_attendance', 'Modul Absensi Mapel', 'module',
   'Absensi per jam pelajaran (tab Mapel di /attendance): grid santri × jam, WA wali, analitik', true, 28)
on conflict (key) do nothing;
