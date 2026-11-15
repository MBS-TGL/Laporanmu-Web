-- ============================================================
-- 0037: Flag per modul + tabel app_settings
--
-- 1) Seed flag `module.*` untuk setiap modul domain yang bisa
--    dimatikan lewat tab Pengaturan Developer. Semua default
--    AKTIF (fail-open) supaya modul yang sudah berjalan tidak
--    tiba-tiba hilang setelah migrasi.
-- 2) Tabel `app_settings` (key/value jsonb) untuk pengaturan
--    sistem non-boolean, mulai dari pesan maintenance kustom
--    (key `maintenance.message`: { message, until }).
-- ============================================================

insert into public.feature_flags (key, label, category, description, enabled, sort_order) values
  ('module.dorms',        'Modul Asrama',          'module', 'Kamar dan plotting santri asrama',                        true, 10),
  ('module.gate',         'Modul Gerbang',         'module', 'Log keluar-masuk santri di gerbang',                      true, 11),
  ('module.tahfidz',      'Modul Tahfidz',         'module', 'Setoran hafalan ziyadah & murojaah santri',               true, 12),
  ('module.halaqah',      'Modul Halaqah',         'module', 'Kelompok halaqah, musyrif, dan anggota',                  true, 13),
  ('module.library',      'Modul Perpustakaan',    'module', 'Katalog buku dan peminjaman santri',                      true, 14),
  ('module.savings',      'Modul Tabungan',        'module', 'Rekening tabungan, setor-tarik, dan buku tabungan',       true, 15),
  ('module.inventory',    'Modul Inventaris',      'module', 'Aset dan barang beserta kondisinya',                      true, 16),
  ('module.ekskul',       'Modul Ekstrakurikuler', 'module', 'Kegiatan ekstrakurikuler dan pembina',                    true, 17),
  ('module.health',       'Modul Kesehatan',       'module', 'Rekam medis, observasi, dan stok obat',                   true, 18),
  ('module.counseling',   'Modul Bimbingan Konseling', 'module', 'Sesi BK dan pembinaan santri',                        true, 19),
  ('module.leave_permit', 'Modul Izin Keluar',     'module', 'Surat izin keluar pondok',                                true, 20),
  ('module.report_cards', 'Modul Raport',          'module', 'Input raport bulanan & semester per kelas',               true, 21),
  ('module.grades',       'Modul Penilaian',       'module', 'Nilai formatif, sumatif, PTS, PAS, dan leger',            true, 22),
  ('module.schedules',    'Modul Jadwal KBM',      'module', 'Jadwal mengajar per kelas, mapel, dan guru',              true, 23),
  ('insights.ai_enabled', 'Modul AI Insights',     'module', 'Pembangkitan insight AI (Gemini) di tab AI Insights',     true, 24)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- app_settings — pengaturan sistem non-boolean (key/value jsonb)
-- ------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('maintenance.message', '{"message": "", "until": null}'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- RLS app_settings
-- Baca: staff mana pun bisa membaca semua; anon hanya boleh
-- membaca kunci `maintenance.%` (dipakai gate route publik).
-- Tulis: developer|admin saja.
-- ------------------------------------------------------------
alter table public.app_settings enable row level security;

create policy "app_settings_select_staff" on public.app_settings
  for select to authenticated
  using (true);

create policy "app_settings_select_anon_maintenance" on public.app_settings
  for select to anon
  using (key like 'maintenance.%');

create policy "app_settings_insert" on public.app_settings
  for insert to authenticated
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "app_settings_update" on public.app_settings
  for update to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]))
  with check (public.has_any_role(array['developer', 'admin']::public.app_role[]));

create policy "app_settings_delete" on public.app_settings
  for delete to authenticated
  using (public.has_any_role(array['developer', 'admin']::public.app_role[]));
