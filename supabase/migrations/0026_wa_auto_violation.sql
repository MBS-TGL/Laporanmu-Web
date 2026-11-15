-- ============================================================
-- 0026: WA otomatis saat pelanggaran dicatat
--
-- Toggle per-pengaturan (bukan per-user): wa_settings.auto_violation_wa.
-- Saat aktif + token Fonnte terpasang, client mengirim WA ke nomor
-- siswa (students.phone) segera setelah laporan poin negatif berhasil
-- disimpan (fire-and-forget — kegagalan tidak memblokir pencatatan).
--
-- Catatan: kolom & RPC ikut memakai pola 0021 — role 'manager'
-- (pengurus versi English naming), bukan 'pengurus'.
-- ============================================================

alter table public.wa_settings
  add column auto_violation_wa boolean not null default false;

-- ------------------------------------------------------------
-- RPC status: tambah auto_violation_wa (role developer|admin|manager)
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
    'updated_at', v_row.updated_at
  );
end;
$$;

-- ------------------------------------------------------------
-- RPC simpan: p_auto_violation null = tidak mengubah toggle
-- (pola sama dengan p_token null = tidak mengubah token)
-- ------------------------------------------------------------
create or replace function public.update_wa_settings(
  p_token text,
  p_sender_name text,
  p_auto_violation boolean default null
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
    updated_by   = auth.uid()
  where id = true;

  return jsonb_build_object('ok', true);
end;
$$;
