-- ============================================================
-- 0036: Master Ruangan (Ruang KBM)
--   * rooms : master ruangan untuk jadwal KBM (sebelumnya free-text
--     di schedules.room — rawan typo, deteksi bentrok ruang membanding
--     string mentah)
--   * Seed awal: nilai unik dari schedules.room yang sudah dipakai
-- ============================================================

create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  capacity   integer,
  notes      text,
  is_active  boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nama ruang unik di antara baris aktif (case-insensitive, anti duplikat "Lab IPA" vs "lab ipa")
create unique index if not exists rooms_name_unique
  on public.rooms (lower(name))
  where deleted_at is null;

create trigger trg_rooms_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;

create policy "rooms_select" on public.rooms
  for select to authenticated using (public.is_staff());

create policy "rooms_insert" on public.rooms
  for insert to authenticated with check (public.is_staff_writer());

create policy "rooms_update" on public.rooms
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "rooms_delete" on public.rooms
  for delete to authenticated using (public.is_staff_deleter());

-- Seed: ruang yang sudah ditulis manual di jadwal KBM (skip duplikat case-insensitive)
insert into public.rooms (name)
select distinct trim(s.room)
from public.schedules s
where s.room is not null
  and trim(s.room) <> ''
  and s.deleted_at is null
  and not exists (
    select 1 from public.rooms r
    where r.deleted_at is null and lower(r.name) = lower(trim(s.room))
  )
on conflict do nothing;
