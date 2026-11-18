-- ============================================================
-- 0055: P3 Spiritual Center — kemahiran ibadah & nilai bulanan
--
-- worship_items  : butir ibadah per kategori (wudhu/sholat/
--                  hafalan_hadist/hafalan_doa) + preset bawaan
-- worship_mastery: kemahiran butir per santri (terampil/belum,
--                  unik santri+item) — progresi item
-- worship_scores : nilai bulanan per butir (unik santri+item+bulan)
-- WA saat butir dikuasai: toggle auto_rohani_wa (extend RPC WA).
-- Preset bawaan di-seed dari TS (features/worship/presets.ts)
-- lewat tombol "Muat Preset" — bukan hard-code di migrasi.
-- ============================================================

create table public.worship_items (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('wudhu', 'sholat', 'hafalan_hadist', 'hafalan_doa')),
  label      text not null,
  sort_order integer not null default 0,
  is_preset  boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index worship_items_active_idx on public.worship_items (category, sort_order)
  where deleted_at is null;
create unique index worship_items_active_unique on public.worship_items (category, label)
  where deleted_at is null;
create trigger trg_worship_items_updated_at
  before update on public.worship_items
  for each row execute function public.set_updated_at();

create table public.worship_mastery (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students (id) on delete cascade,
  item_id     uuid not null references public.worship_items (id) on delete cascade,
  mastered    boolean not null default false,
  mastered_at date,
  note        text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint worship_mastery_unique unique (student_id, item_id)
);

create index worship_mastery_student_idx on public.worship_mastery (student_id);
create index worship_mastery_item_idx on public.worship_mastery (item_id);

create trigger trg_worship_mastery_updated_at
  before update on public.worship_mastery
  for each row execute function public.set_updated_at();

create table public.worship_scores (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  item_id    uuid not null references public.worship_items (id) on delete cascade,
  year       smallint not null,
  month      smallint not null check (month between 1 and 12),
  grade      smallint not null check (grade between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worship_scores_unique unique (student_id, item_id, year, month)
);

create index worship_scores_period_idx on public.worship_scores (year, month);
create index worship_scores_student_idx on public.worship_scores (student_id);

create trigger trg_worship_scores_updated_at
  before update on public.worship_scores
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — pola master data
-- ------------------------------------------------------------
alter table public.worship_items enable row level security;
alter table public.worship_mastery enable row level security;
alter table public.worship_scores enable row level security;

create policy "worship_items_select" on public.worship_items
  for select to authenticated using (public.is_staff());
create policy "worship_items_insert" on public.worship_items
  for insert to authenticated with check (public.is_staff_writer());
create policy "worship_items_update" on public.worship_items
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "worship_items_delete" on public.worship_items
  for delete to authenticated using (public.is_staff_deleter());

create policy "worship_mastery_select" on public.worship_mastery
  for select to authenticated using (public.is_staff());
create policy "worship_mastery_insert" on public.worship_mastery
  for insert to authenticated with check (public.is_staff_writer());
create policy "worship_mastery_update" on public.worship_mastery
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "worship_mastery_delete" on public.worship_mastery
  for delete to authenticated using (public.is_staff_deleter());

create policy "worship_scores_select" on public.worship_scores
  for select to authenticated using (public.is_staff());
create policy "worship_scores_insert" on public.worship_scores
  for insert to authenticated with check (public.is_staff_writer());
create policy "worship_scores_update" on public.worship_scores
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());
create policy "worship_scores_delete" on public.worship_scores
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- WA otomatis kemahiran ibadah (toggle auto_rohani_wa)
-- ------------------------------------------------------------
alter table public.wa_settings
  add column if not exists auto_rohani_wa boolean not null default false;

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
    'auto_rohani_wa', v_row.auto_rohani_wa,
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
  p_auto_absen_mapel boolean default null,
  p_auto_rohani boolean default null
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
    auto_rohani_wa      = coalesce(p_auto_rohani, auto_rohani_wa),
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------
-- Flag module.spiritual + modul RBAC worship didaftarkan dari
-- src/shared/rbac/permissions.ts (registry = sumber default)
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.spiritual', 'Modul Ibadah', 'module',
   'Kemahiran ibadah (wudhu, sholat, hafalan hadist & doa) + nilai bulanan per butir', true, 29)
on conflict (key) do nothing;
