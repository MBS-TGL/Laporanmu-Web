-- ============================================================
-- 0039: WA otomatis Fase 3 — surat resmi BK & mutasi tabungan
--
-- Meniru pola 0026 (WA otomatis pelanggaran): toggle global di
-- wa_settings, client mengirim fire-and-forget setelah mutasi
-- berhasil. Dua toggle baru:
--   auto_bk_wa      — WA ke wali saat surat resmi BK diterbitkan
--                     (pesan memuat link verifikasi /verify?token=...)
--   auto_savings_wa — WA ke wali saat mutasi tabungan (setor/tarik)
--
-- Catatan: role 'manager' (pengurus versi English naming) mengikuti 0026.
-- ============================================================

alter table public.wa_settings
  add column if not exists auto_bk_wa boolean not null default false;
alter table public.wa_settings
  add column if not exists auto_savings_wa boolean not null default false;

-- ------------------------------------------------------------
-- RPC status: kembalikan ketiga toggle otomatis
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
    'updated_at', v_row.updated_at
  );
end;
$$;

-- ------------------------------------------------------------
-- RPC simpan: param null = tidak mengubah toggle terkait
-- ------------------------------------------------------------
create or replace function public.update_wa_settings(
  p_token text,
  p_sender_name text,
  p_auto_violation boolean default null,
  p_auto_bk boolean default null,
  p_auto_savings boolean default null
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
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;
