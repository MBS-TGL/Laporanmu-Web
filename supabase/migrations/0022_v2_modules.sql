-- ============================================================
-- 0022: Modul V2 — akademik & operasional pelengkap
--   * subjects               : mata pelajaran (PRD §6.1 / Fase 0)
--   * schedules              : jadwal KBM per kelas (PRD §6.4 / Fase 2)
--   * tahfidz_records        : setoran hafalan santri (paritas V1)
--   * halaqah_groups/_members: halaqah + anggota (paritas V1)
--   * extracurriculars/_members: ekstrakurikuler (PRD Fase 4 lite)
--   * savings_accounts/_transactions: tabungan santri (PRD §6.5 / Fase 2)
--   * books / book_loans     : perpustakaan + peminjaman (paritas V1)
--   * inventory_items        : inventaris aset (paritas V1)
--   * admissions             : PPDB/SPMB pipeline internal (PRD §6.7 lite)
--
-- Konvensi mengikuti migrasi lama: uuid PK, soft delete, trigger
-- updated_at, RLS dengan helper role. Kebijakan tulis/hapus memakai
-- helper TEKS (role::text) sehingga aman baik sebelum maupun sesudah
-- rename enum app_role di 0021 (pengurus→manager, guru→teacher).
-- Transaksi tabungan hanya lewat RPC security definer agar saldo
-- selalu atomik (tabel transaksi immutable seperti gate_logs).
-- ============================================================

-- ------------------------------------------------------------
-- Helper role berbasis label teks — tahan rename enum
-- ------------------------------------------------------------
create or replace function public.is_staff_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('developer', 'admin', 'pengurus', 'manager')
  );
$$;

create or replace function public.is_staff_deleter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('developer', 'admin')
  );
$$;

-- ------------------------------------------------------------
-- Enum baru
-- ------------------------------------------------------------
create type public.tahfidz_kind as enum ('ziyadah', 'murojaah');
create type public.tahfidz_quality as enum ('excellent', 'good', 'needs_work');
create type public.savings_txn_kind as enum ('deposit', 'withdrawal');
create type public.savings_status as enum ('active', 'closed');
create type public.item_condition as enum ('good', 'light_damaged', 'heavy_damaged', 'lost');
create type public.admission_stage as enum ('registered', 'selection', 'accepted', 'rejected', 'enrolled');

-- ------------------------------------------------------------
-- Mata pelajaran
-- ------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  weekly_hours integer not null default 0,
  category text,
  description text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_weekly_hours_check check (weekly_hours >= 0)
);

create unique index subjects_code_active_unique on public.subjects (code)
  where deleted_at is null and code is not null;
create index subjects_name_active_idx on public.subjects (name) where deleted_at is null;
create trigger trg_subjects_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Jadwal KBM
-- ------------------------------------------------------------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  room text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_day_check check (day_of_week between 1 and 7),
  constraint schedules_time_check check (end_time > start_time)
);

create index schedules_class_active_idx on public.schedules (class_id) where deleted_at is null;
create index schedules_teacher_active_idx on public.schedules (teacher_id) where deleted_at is null;
create index schedules_day_idx on public.schedules (day_of_week, start_time) where deleted_at is null;
create trigger trg_schedules_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Tahfidz (setoran hafalan)
-- ------------------------------------------------------------
create table public.tahfidz_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  kind public.tahfidz_kind not null default 'ziyadah',
  surah text not null,
  from_ayat integer,
  to_ayat integer,
  quality public.tahfidz_quality,
  note text,
  recorded_at date not null default current_date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tahfidz_ayat_check check (
    from_ayat is null or to_ayat is null or to_ayat >= from_ayat
  )
);

create index tahfidz_student_idx on public.tahfidz_records (student_id, recorded_at desc);
create index tahfidz_recorded_idx on public.tahfidz_records (recorded_at desc) where deleted_at is null;
create trigger trg_tahfidz_records_updated_at
  before update on public.tahfidz_records
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Halaqah + anggota
-- ------------------------------------------------------------
create table public.halaqah_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  musyrif_id uuid references public.teachers (id) on delete set null,
  gender public.person_gender,
  place text,
  schedule text,
  capacity integer not null default 0,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint halaqah_groups_capacity_check check (capacity >= 0)
);

create index halaqah_groups_name_active_idx on public.halaqah_groups (name) where deleted_at is null;
create trigger trg_halaqah_groups_updated_at
  before update on public.halaqah_groups
  for each row execute function public.set_updated_at();

create table public.halaqah_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.halaqah_groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  joined_at date not null default current_date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index halaqah_members_active_unique on public.halaqah_members (group_id, student_id)
  where deleted_at is null;
create index halaqah_members_student_idx on public.halaqah_members (student_id) where deleted_at is null;
create trigger trg_halaqah_members_updated_at
  before update on public.halaqah_members
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Ekstrakurikuler + anggota
-- ------------------------------------------------------------
create table public.extracurriculars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  coach_id uuid references public.teachers (id) on delete set null,
  schedule text,
  place text,
  description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index extracurriculars_name_active_idx on public.extracurriculars (name) where deleted_at is null;
create trigger trg_extracurriculars_updated_at
  before update on public.extracurriculars
  for each row execute function public.set_updated_at();

create table public.extracurricular_members (
  id uuid primary key default gen_random_uuid(),
  ekskul_id uuid not null references public.extracurriculars (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  role text not null default 'Anggota',
  joined_at date not null default current_date,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index extracurricular_members_active_unique on public.extracurricular_members (ekskul_id, student_id)
  where deleted_at is null;
create index extracurricular_members_student_idx on public.extracurricular_members (student_id) where deleted_at is null;
create trigger trg_extracurricular_members_updated_at
  before update on public.extracurricular_members
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Tabungan santri
-- ------------------------------------------------------------
create table public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  balance numeric(14, 2) not null default 0,
  status public.savings_status not null default 'active',
  opened_at date not null default current_date,
  closed_at date,
  note text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_accounts_balance_check check (balance >= 0)
);

create unique index savings_accounts_student_active_unique on public.savings_accounts (student_id)
  where deleted_at is null;
create index savings_accounts_status_idx on public.savings_accounts (status) where deleted_at is null;
create trigger trg_savings_accounts_updated_at
  before update on public.savings_accounts
  for each row execute function public.set_updated_at();

-- Buku transaksi immutable — hanya ditulis via RPC savings_apply_txn
create table public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.savings_accounts (id) on delete cascade,
  kind public.savings_txn_kind not null,
  amount numeric(14, 2) not null,
  balance_after numeric(14, 2) not null,
  note text,
  occurred_at date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_transactions_amount_check check (amount > 0)
);

create index savings_txn_account_idx on public.savings_transactions (account_id, occurred_at desc);
create trigger trg_savings_transactions_updated_at
  before update on public.savings_transactions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Perpustakaan
-- ------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  code text,
  title text not null,
  author text,
  publisher text,
  year integer,
  category text,
  copies integer not null default 1,
  shelf text,
  description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_copies_check check (copies > 0)
);

create unique index books_code_active_unique on public.books (code)
  where deleted_at is null and code is not null;
create index books_title_active_idx on public.books (title) where deleted_at is null;
create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create table public.book_loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  borrowed_at date not null default current_date,
  due_date date,
  returned_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint book_loans_dates_check check (
    due_date is null or borrowed_at is null or due_date >= borrowed_at
  )
);

create index book_loans_book_idx on public.book_loans (book_id) where returned_at is null;
create index book_loans_student_idx on public.book_loans (student_id);
create index book_loans_borrowed_idx on public.book_loans (borrowed_at desc);
create trigger trg_book_loans_updated_at
  before update on public.book_loans
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Inventaris
-- ------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  category text,
  quantity integer not null default 0,
  unit text,
  condition public.item_condition not null default 'good',
  location text,
  min_quantity integer not null default 0,
  acquired_at date,
  price numeric(14, 2),
  source text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_quantity_check check (quantity >= 0),
  constraint inventory_items_min_check check (min_quantity >= 0)
);

create unique index inventory_items_code_active_unique on public.inventory_items (code)
  where deleted_at is null and code is not null;
create index inventory_items_name_active_idx on public.inventory_items (name) where deleted_at is null;
create index inventory_items_category_idx on public.inventory_items (category) where deleted_at is null;
create trigger trg_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- PPDB / SPMB (pipeline internal; formulir publik menyusul Fase 3)
-- ------------------------------------------------------------
create table public.admissions (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null,
  full_name text not null,
  gender public.person_gender,
  birth_place text,
  birth_date date,
  origin_school text,
  target_grade text,
  parent_name text,
  parent_phone text,
  address text,
  stage public.admission_stage not null default 'registered',
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index admissions_reg_number_active_unique on public.admissions (registration_number)
  where deleted_at is null;
create index admissions_stage_idx on public.admissions (stage) where deleted_at is null;
create index admissions_name_idx on public.admissions (full_name) where deleted_at is null;
create trigger trg_admissions_updated_at
  before update on public.admissions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RPC tabungan: setor/tarif atomik (lock baris rekening, validasi
-- saldo, catat transaksi dengan saldo berjalan, lalu perbarui saldo)
-- ------------------------------------------------------------
create or replace function public.savings_apply_txn(
  p_account_id uuid,
  p_kind public.savings_txn_kind,
  p_amount numeric,
  p_note text default null,
  p_occurred_at date default current_date
)
returns public.savings_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.savings_accounts;
  v_after numeric(14, 2);
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('developer', 'admin', 'pengurus', 'manager')
  ) then
    raise exception 'Hanya staff tertentu yang boleh mencatat transaksi tabungan';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Jumlah transaksi harus lebih besar dari nol';
  end if;

  select * into v_account
  from public.savings_accounts
  where id = p_account_id and deleted_at is null
  for update;

  if v_account.id is null then
    raise exception 'Rekening tabungan tidak ditemukan';
  end if;

  if v_account.status = 'closed' then
    raise exception 'Rekening sudah ditutup — buka rekening baru untuk santri ini';
  end if;

  if p_kind = 'withdrawal' and v_account.balance < p_amount then
    raise exception 'Saldo tidak cukup — saldo saat ini Rp %', to_char(v_account.balance, 'FM999999999990');
  end if;

  v_after := case when p_kind = 'deposit' then v_account.balance + p_amount else v_account.balance - p_amount end;

  insert into public.savings_transactions (account_id, kind, amount, balance_after, note, occurred_at, created_by)
  values (p_account_id, p_kind, p_amount, v_after, p_note, p_occurred_at, auth.uid());

  update public.savings_accounts
  set balance = v_after
  where id = p_account_id;

  select * into v_account from public.savings_accounts where id = p_account_id;
  return v_account;
end;
$$;

revoke execute on function public.savings_apply_txn(uuid, public.savings_txn_kind, numeric, text, date)
  from public, anon;
grant execute on function public.savings_apply_txn(uuid, public.savings_txn_kind, numeric, text, date)
  to authenticated;

-- ------------------------------------------------------------
-- RLS — pola matrix lama:
--   SELECT  : semua staff
--   INSERT/UPDATE : developer|admin|pengurus (tahfidz: semua staff —
--                   musyrif/guru juga mencatat setoran)
--   DELETE  : developer|admin
--   savings_transactions : immutable — tanpa policy INSERT/UPDATE/DELETE
--                          (hanya RPC security definer yang menulis)
-- ------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.schedules enable row level security;
alter table public.tahfidz_records enable row level security;
alter table public.halaqah_groups enable row level security;
alter table public.halaqah_members enable row level security;
alter table public.extracurriculars enable row level security;
alter table public.extracurricular_members enable row level security;
alter table public.savings_accounts enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.books enable row level security;
alter table public.book_loans enable row level security;
alter table public.inventory_items enable row level security;
alter table public.admissions enable row level security;

-- --- subjects ---
create policy "subjects_select" on public.subjects
  for select to authenticated using (public.is_staff());
create policy "subjects_insert" on public.subjects
  for insert to authenticated with check (public.is_staff_writer());
create policy "subjects_update" on public.subjects
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "subjects_delete" on public.subjects
  for delete to authenticated using (public.is_staff_deleter());

-- --- schedules ---
create policy "schedules_select" on public.schedules
  for select to authenticated using (public.is_staff());
create policy "schedules_insert" on public.schedules
  for insert to authenticated with check (public.is_staff_writer());
create policy "schedules_update" on public.schedules
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "schedules_delete" on public.schedules
  for delete to authenticated using (public.is_staff_deleter());

-- --- tahfidz_records (musyrif/guru boleh mencatat setoran) ---
create policy "tahfidz_select" on public.tahfidz_records
  for select to authenticated using (public.is_staff());
create policy "tahfidz_insert" on public.tahfidz_records
  for insert to authenticated with check (public.is_staff());
create policy "tahfidz_update" on public.tahfidz_records
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "tahfidz_delete" on public.tahfidz_records
  for delete to authenticated using (public.is_staff_deleter());

-- --- halaqah ---
create policy "halaqah_groups_select" on public.halaqah_groups
  for select to authenticated using (public.is_staff());
create policy "halaqah_groups_insert" on public.halaqah_groups
  for insert to authenticated with check (public.is_staff_writer());
create policy "halaqah_groups_update" on public.halaqah_groups
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "halaqah_groups_delete" on public.halaqah_groups
  for delete to authenticated using (public.is_staff_deleter());

create policy "halaqah_members_select" on public.halaqah_members
  for select to authenticated using (public.is_staff());
create policy "halaqah_members_insert" on public.halaqah_members
  for insert to authenticated with check (public.is_staff_writer());
create policy "halaqah_members_update" on public.halaqah_members
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "halaqah_members_delete" on public.halaqah_members
  for delete to authenticated using (public.is_staff_deleter());

-- --- ekstrakurikuler ---
create policy "ekskul_select" on public.extracurriculars
  for select to authenticated using (public.is_staff());
create policy "ekskul_insert" on public.extracurriculars
  for insert to authenticated with check (public.is_staff_writer());
create policy "ekskul_update" on public.extracurriculars
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "ekskul_delete" on public.extracurriculars
  for delete to authenticated using (public.is_staff_deleter());

create policy "ekskul_members_select" on public.extracurricular_members
  for select to authenticated using (public.is_staff());
create policy "ekskul_members_insert" on public.extracurricular_members
  for insert to authenticated with check (public.is_staff_writer());
create policy "ekskul_members_update" on public.extracurricular_members
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "ekskul_members_delete" on public.extracurricular_members
  for delete to authenticated using (public.is_staff_deleter());

-- --- tabungan ---
create policy "savings_accounts_select" on public.savings_accounts
  for select to authenticated using (public.is_staff());
create policy "savings_accounts_insert" on public.savings_accounts
  for insert to authenticated with check (public.is_staff_writer());
create policy "savings_accounts_update" on public.savings_accounts
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "savings_accounts_delete" on public.savings_accounts
  for delete to authenticated using (public.is_staff_deleter());

-- Transaksi: hanya dibaca; penulisan lewat RPC security definer
create policy "savings_transactions_select" on public.savings_transactions
  for select to authenticated using (public.is_staff());

-- --- perpustakaan ---
create policy "books_select" on public.books
  for select to authenticated using (public.is_staff());
create policy "books_insert" on public.books
  for insert to authenticated with check (public.is_staff_writer());
create policy "books_update" on public.books
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "books_delete" on public.books
  for delete to authenticated using (public.is_staff_deleter());

create policy "book_loans_select" on public.book_loans
  for select to authenticated using (public.is_staff());
create policy "book_loans_insert" on public.book_loans
  for insert to authenticated with check (public.is_staff_writer());
create policy "book_loans_update" on public.book_loans
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "book_loans_delete" on public.book_loans
  for delete to authenticated using (public.is_staff_deleter());

-- --- inventaris ---
create policy "inventory_items_select" on public.inventory_items
  for select to authenticated using (public.is_staff());
create policy "inventory_items_insert" on public.inventory_items
  for insert to authenticated with check (public.is_staff_writer());
create policy "inventory_items_update" on public.inventory_items
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "inventory_items_delete" on public.inventory_items
  for delete to authenticated using (public.is_staff_deleter());

-- --- admissions ---
create policy "admissions_select" on public.admissions
  for select to authenticated using (public.is_staff());
create policy "admissions_insert" on public.admissions
  for insert to authenticated with check (public.is_staff_writer());
create policy "admissions_update" on public.admissions
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "admissions_delete" on public.admissions
  for delete to authenticated using (public.is_staff_deleter());
