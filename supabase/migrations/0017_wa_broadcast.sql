-- ============================================================
-- 0017: Pengaturan WhatsApp (Fonnte) untuk broadcast wali santri
--
-- Token Fonnte TIDAK PERNAH dikirim ke browser:
--   - Edge Function wa-broadcast membaca token langsung dari
--     tabel ini (service role) lalu memanggil api.fonnte.com.
--   - Browser hanya boleh tahu status "terpasang/belum" lewat
--     RPC wa_settings_status().
-- ============================================================

create table public.wa_settings (
  id boolean primary key default true check (id = true),
  fonnte_token text,
  sender_name text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.wa_settings (id) values (true) on conflict do nothing;

create trigger trg_wa_settings_updated_at
  before update on public.wa_settings
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — hanya developer|admin yang boleh menyentuh baris ini
-- ------------------------------------------------------------
alter table public.wa_settings enable row level security;

create policy "wa_settings_select" on public.wa_settings
  for select to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));
create policy "wa_settings_update" on public.wa_settings
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

-- ------------------------------------------------------------
-- RPC status: boleh dibaca semua staff yang boleh menulis
-- (developer|admin|pengurus) — return TANPA token
-- ------------------------------------------------------------
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
  if not public.has_any_role(array['developer', 'admin', 'pengurus']::public.app_role[]) then
    return jsonb_build_object('error', 'Tidak punya akses');
  end if;

  select * into v_row from public.wa_settings where id = true;
  return jsonb_build_object(
    'configured', coalesce(v_row.fonnte_token, '') <> '',
    'sender_name', v_row.sender_name,
    'updated_at', v_row.updated_at
  );
end;
$$;

-- ------------------------------------------------------------
-- RPC simpan: developer|admin saja. p_token null = tidak mengubah
-- token yang sudah tersimpan.
-- ------------------------------------------------------------
create or replace function public.update_wa_settings(p_token text, p_sender_name text)
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
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;
