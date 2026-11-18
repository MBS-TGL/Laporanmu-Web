-- ============================================================
-- Patch Wudhu Tarjih (2026-11-17): selaraskan butir kemahiran
-- wudhu dengan Tuntunan Thaharah Majelis Tarjih PWM DIY + HPT
-- 44-46.
--
-- 1. Rename label 'Mengusap Kepala & Kedua Telinga (Fardhu)':
--    menurut Tarjih Muhammadiyah, mengusap KEPALA = rukun,
--    mengusap TELINGA = sunnah (bukan fardhu). Label lama
--    menyesatkan.
-- 2. Insert 2 butir sunnah Tarjih yang belum ada: istinsyar
--    (mengeluarkan air hidung) & menyela jenggot.
-- 3. Renumber sort_order kategori wudhu mengikuti urutan preset
--    Tarjih agar butir baru tampil di posisi fiqh yang benar
--    (UI "Muat Preset" menaruh butir baru di akhir kategori).
--
-- Aman dari unique partial index (category, label)
-- where deleted_at is null: DB hanya punya 9 baris wudhu aktif
-- dan belum ada label baru. FK tidak merujuk label, jadi mastery/
-- scores tetap aman; sync rapor pakai substring match (label baru
-- masih mengandung "Mengusap Kepala").
--
-- Idempoten: aman dijalankan ulang.
-- ============================================================

-- 1. Rename label wudhu (guard: hanya bila padanan belum ada)
update public.worship_items
set label = 'Mengusap Kepala (Fardhu) & Kedua Telinga (Sunnah)',
    updated_at = now()
where deleted_at is null
  and category = 'wudhu'
  and label = 'Mengusap Kepala & Kedua Telinga (Fardhu)'
  and not exists (
    select 1 from public.worship_items w2
    where w2.category = 'wudhu'
      and w2.label = 'Mengusap Kepala (Fardhu) & Kedua Telinga (Sunnah)'
      and w2.deleted_at is null
  );

-- 2. Insert 2 butir sunnah Tarjih (guard: hanya bila belum ada)
insert into public.worship_items (category, label, sort_order, is_preset)
select 'wudhu', v.label, v.sort_order, true
from (values
  ('Istinsyar (Mengeluarkan Air Hidung) (Sunnah)', 40),
  ('Menyela Jenggot (Sunnah)', 80)
) as v(label, sort_order)
where not exists (
  select 1 from public.worship_items w
  where w.category = 'wudhu'
    and w.label = v.label
    and w.deleted_at is null
);

-- 3. Renumber sort_order wudhu sesuai urutan preset Tarjih
--    (11 butir; butir custom non-preset yang tidak cocok mapping
--    dibiarkan dengan sort_order lamanya)
with preset_order(label, ord) as (
  values
    ('Niat & Membaca Basmalah', 10),
    ('Membasuh Telapak Tangan & Sela Jari', 20),
    ('Berkumur & Istinsyaq (Menghirup Air)', 30),
    ('Istinsyar (Mengeluarkan Air Hidung) (Sunnah)', 40),
    ('Membasuh Muka secara Merata (Fardhu)', 50),
    ('Membasuh Tangan hingga Siku (Fardhu)', 60),
    ('Mengusap Kepala (Fardhu) & Kedua Telinga (Sunnah)', 70),
    ('Menyela Jenggot (Sunnah)', 80),
    ('Membasuh Kaki hingga Mata Kaki (Fardhu)', 90),
    ('Tertib & Berurutan Mendahulukan Kanan', 100),
    ('Doa Setelah Wudhu (Syahadat & Taubat)', 110)
)
update public.worship_items i
set sort_order = p.ord,
    updated_at = now()
from preset_order p
where i.category = 'wudhu'
  and i.label = p.label
  and i.deleted_at is null
  and i.sort_order is distinct from p.ord;

