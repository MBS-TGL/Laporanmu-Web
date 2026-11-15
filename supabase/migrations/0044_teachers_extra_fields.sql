-- ============================================================
-- 0044: Field tambahan tabel teachers (paritas data guru dgn V1)
--   * employment_status : GTY/GTT/Honorer/PNS/ASNP3K
--   * type              : guru / pengabdian / karyawan
--   * biodata           : birth_place, birth_date
--   * kepegawaian       : teaching_hours
--   * pendidikan        : last_education, major, graduation_year
--   * presensi mesin    : fingerspot_name, work_days
--   * ui                : is_pinned (sematkan baris di atas)
-- ============================================================

alter table public.teachers
  add column if not exists employment_status text default 'GTY',
  add column if not exists type              text default 'guru',
  add column if not exists birth_place       text,
  add column if not exists birth_date        date,
  add column if not exists teaching_hours    integer,
  add column if not exists last_education    text,
  add column if not exists major             text,
  add column if not exists graduation_year   integer,
  add column if not exists work_days         text[] default array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
  add column if not exists fingerspot_name   text,
  add column if not exists is_pinned         boolean not null default false;

-- Nilai employment_status di luar daftar dibereskan ke default
update public.teachers
set employment_status = 'GTY'
where employment_status is null
   or employment_status not in ('GTY', 'GTT', 'Honorer', 'PNS', 'ASNP3K');

update public.teachers
set type = 'guru'
where type is null
   or type not in ('guru', 'pengabdian', 'karyawan');

create index if not exists teachers_type_idx
  on public.teachers (type)
  where deleted_at is null;

create index if not exists teachers_pinned_idx
  on public.teachers (is_pinned)
  where deleted_at is null;
