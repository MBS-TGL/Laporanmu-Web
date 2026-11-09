-- ============================================================
-- 0020: Feature flags — saklar fitur & maintenance mode
--
-- Flag dibaca semua staff (dipakai untuk gating UI), tapi hanya
-- developer|admin yang boleh mengubah. Sisi browser selalu
-- fail-open: flag yang tidak dikenal dianggap aktif.
-- ============================================================

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  category text not null default 'system',
  description text,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index feature_flags_category_idx on public.feature_flags (category, sort_order);

create trigger trg_feature_flags_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('system.maintenance', 'Mode Maintenance', 'system',
   'Tutup aplikasi untuk semua role kecuali developer (perawatan sistem)', false, 1),
  ('system.debug_mode', 'Mode Debug', 'system',
   'Tampilkan informasi teknis tambahan untuk diagnosis', false, 2)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- RLS — baca: semua staff; tulis: developer|admin saja
-- ------------------------------------------------------------
alter table public.feature_flags enable row level security;

create policy "feature_flags_select" on public.feature_flags
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin', 'pengurus', 'guru']::public.app_role[]));

create policy "feature_flags_insert" on public.feature_flags
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "feature_flags_update" on public.feature_flags
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "feature_flags_delete" on public.feature_flags
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));
