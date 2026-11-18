-- ============================================================
-- 0057: Perbaikan nama lembaga
--
-- Nama resmi: Muhammadiyah Boarding School Tanggul (MBS Tanggul).
-- Ganti default + data lama "Laporanmu Boarding School" di
-- school_settings (kop raport/profil) dan entities (backfill 0052).
-- ============================================================

alter table public.school_settings
  alter column school_name set default 'Muhammadiyah Boarding School Tanggul';

update public.school_settings
set school_name = 'Muhammadiyah Boarding School Tanggul'
where school_name in ('Laporanmu Boarding School', 'Laporanmu Boarding School Tanggul');

update public.entities
set name = 'Muhammadiyah Boarding School Tanggul'
where code = 'utama'
  and name in ('Laporanmu Boarding School', 'Laporanmu Boarding School Tanggul');
