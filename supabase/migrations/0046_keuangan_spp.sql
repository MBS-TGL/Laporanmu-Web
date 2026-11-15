-- ============================================================
-- 0046: Keuangan SPP — kewajiban biaya & pembayaran per santri
--   * spp_components  : komponen biaya per tahun ajaran
--                       (SPP Bulanan, DSP, Seragam, dst.)
--   * spp_obligations : kewajiban per santri (snapshot nominal
--                       saat digenerate dari komponen)
--   * spp_payments    : pembayaran (ledger — tanpa soft delete)
--   * flag module.keuangan_spp + toggle auto_spp_wa
--
-- Tunggakan = kewajiban yang jumlah pembayarannya < nominal.
-- Konvensi mengikuti 0028 (RLS granular, soft delete) — payments
-- dikecualikan soft delete (pola assessment_scores, churn tinggi).
-- Nominal rupiah integer tanpa desimal.
-- ============================================================

-- ------------------------------------------------------------
-- 1. spp_components — komponen biaya per tahun ajaran
-- ------------------------------------------------------------
create table public.spp_components (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name             text not null,
  amount           numeric(12,0) not null check (amount >= 0),
  frequency        text not null default 'sekali'
    check (frequency in ('sekali', 'bulanan', 'semester')),
  grade            text check (grade in ('7', '8', '9')),
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index spp_components_year_idx
  on public.spp_components (academic_year_id)
  where deleted_at is null;

create trigger trg_spp_components_updated_at
  before update on public.spp_components
  for each row execute function public.set_updated_at();

alter table public.spp_components enable row level security;

create policy "spp_components_select" on public.spp_components
  for select to authenticated using (public.is_staff());

create policy "spp_components_insert" on public.spp_components
  for insert to authenticated with check (public.is_staff_writer());

create policy "spp_components_update" on public.spp_components
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "spp_components_delete" on public.spp_components
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 2. spp_obligations — kewajiban per santri per komponen
--    period 'YYYY-MM' untuk frekuensi bulanan, null untuk
--    sekali/semester.
-- ------------------------------------------------------------
create table public.spp_obligations (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  component_id     uuid not null references public.spp_components (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  amount           numeric(12,0) not null check (amount >= 0),
  period           text not null default '',
  due_date         date,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index spp_obligations_student_idx
  on public.spp_obligations (student_id)
  where deleted_at is null;
create index spp_obligations_year_idx
  on public.spp_obligations (academic_year_id)
  where deleted_at is null;

create unique index spp_obligations_unique
  on public.spp_obligations (student_id, component_id, period)
  where deleted_at is null;

create trigger trg_spp_obligations_updated_at
  before update on public.spp_obligations
  for each row execute function public.set_updated_at();

alter table public.spp_obligations enable row level security;

create policy "spp_obligations_select" on public.spp_obligations
  for select to authenticated using (public.is_staff());

create policy "spp_obligations_insert" on public.spp_obligations
  for insert to authenticated with check (public.is_staff_writer());

create policy "spp_obligations_update" on public.spp_obligations
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "spp_obligations_delete" on public.spp_obligations
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 3. spp_payments — ledger pembayaran (tanpa deleted_at)
-- ------------------------------------------------------------
create table public.spp_payments (
  id            uuid primary key default gen_random_uuid(),
  obligation_id uuid not null references public.spp_obligations (id) on delete cascade,
  amount        numeric(12,0) not null check (amount > 0),
  method        text not null default 'tunai'
    check (method in ('tunai', 'transfer', 'qris')),
  paid_at       date not null default current_date,
  note          text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index spp_payments_obligation_idx on public.spp_payments (obligation_id);
create index spp_payments_paid_at_idx on public.spp_payments (paid_at);

create trigger trg_spp_payments_updated_at
  before update on public.spp_payments
  for each row execute function public.set_updated_at();

alter table public.spp_payments enable row level security;

create policy "spp_payments_select" on public.spp_payments
  for select to authenticated using (public.is_staff());

create policy "spp_payments_insert" on public.spp_payments
  for insert to authenticated with check (public.is_staff_writer());

create policy "spp_payments_update" on public.spp_payments
  for update to authenticated
  using (public.is_staff_writer()) with check (public.is_staff_writer());

create policy "spp_payments_delete" on public.spp_payments
  for delete to authenticated using (public.is_staff_deleter());

-- ------------------------------------------------------------
-- 4. Feature flag + toggle WA pembayaran
-- ------------------------------------------------------------
insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.keuangan_spp', 'Modul Keuangan SPP', 'module', 'Kewajiban biaya, pembayaran, dan tunggakan per santri', true, 26)
on conflict (key) do nothing;

alter table public.wa_settings
  add column if not exists auto_spp_wa boolean not null default false;

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
  p_auto_spp boolean default null
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
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;
